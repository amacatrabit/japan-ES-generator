from __future__ import annotations

import json
import re
from pathlib import Path

from fastapi import FastAPI, HTTPException
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.schemas import Claim, EvidenceRef, ExportRequest, GenerateRequest, QAFinding

app = FastAPI(title="es-writer backend")

UI_ROOT = Path(__file__).resolve().parent / "ui"
TEMPLATES_ROOT = UI_ROOT / "templates"
STATIC_ROOT = UI_ROOT / "static"

env = Environment(loader=FileSystemLoader(str(TEMPLATES_ROOT)), autoescape=select_autoescape(["html"]))


def _render_page(template_name: str, *, title: str, heading: str, page_key: str) -> str:
    content = env.get_template(template_name).render()
    return env.get_template("base.html").render(title=title, heading=heading, page_key=page_key, content=content)


def _load_default_rules() -> dict:
    path = Path(__file__).resolve().parents[2] / "shared" / "rules" / "ja_rules.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _merge_rules(override: dict | None) -> dict:
    base = _load_default_rules()
    if override:
        for key, value in override.items():
            base[key] = value
    return base


def _outline_for(qtype: str) -> list[str]:
    mapping = {
        "gakuchika": ["背景", "課題", "行動", "結果", "学び"],
        "self_pr": ["強み", "裏付け", "発揮場面", "入社後の再現"],
        "motivation": ["志望理由", "接点", "貢献可能性"],
        "strengths_weaknesses": ["強み", "弱み", "改善行動", "成果"],
        "future_plan": ["目標", "3年計画", "実行手段"],
        "job_hunting_axis": ["軸", "理由", "企業との一致"],
    }
    return mapping.get(qtype, ["要点", "根拠", "結論"])


def _make_claims(req: GenerateRequest) -> list[Claim]:
    chunk_map = {c["chunk_id"]: c for c in req.selected_chunks}
    first_id = next(iter(chunk_map))
    first_text = chunk_map[first_id]["text"]
    episode = req.selected_episodes[0] if req.selected_episodes else {}
    company: dict = req.company_context or {}

    drafts = [
        ("c1", f"私の主な取り組みは{episode.get('title') or '継続的な改善活動'}です。", first_id, 0.82, False),
        ("c2", f"課題に対して{episode.get('action') or '原因を分解し施策を実行'}しました。", first_id, 0.79, False),
        ("c3", f"{company.get('company_name') or '貴社'}でも同じ再現性で貢献できます。", first_id, 0.55, True),
    ]

    claims: list[Claim] = []
    for cid, text, evid_id, conf, assumption in drafts:
        evidence = []
        if evid_id in chunk_map and (not assumption or "result" in first_text or "実績" in first_text):
            evidence = [EvidenceRef(chunk_id=evid_id, quote=chunk_map[evid_id]["text"][:60]).model_dump()]
        export_allowed = len(evidence) >= 1
        claims.append(
            Claim(
                claim_id=cid,
                text=text,
                evidence=evidence,
                confidence=conf,
                assumption=assumption,
                export_allowed=export_allowed,
            )
        )
    return claims


def _quantification_missing(text: str) -> bool:
    return re.search(r"(\d+|回|日|週|月|年|%|倍|増|減|より)", text) is None


def _run_qa(claims: list[dict], rules: dict) -> list[QAFinding]:
    findings: list[QAFinding] = []
    banned = rules.get("banned_phrases", [])
    abstract = rules.get("abstract_suffix_patterns", [])
    passive = rules.get("passive_stance_patterns", [])

    for claim in claims:
        text = claim["text"]
        cid = claim["claim_id"]
        for bp in banned:
            if bp in text:
                findings.append(QAFinding(code="BANNED_PHRASE", level="warn", message=f"禁止表現: {bp}", claim_id=cid))
        for sfx in abstract:
            if text.endswith(sfx) or f"{sfx}を" in text:
                findings.append(QAFinding(code="ABSTRACT_SUFFIX", level="warn", message=f"抽象語尾: {sfx}", claim_id=cid))
        for p in passive:
            if p in text:
                findings.append(QAFinding(code="PASSIVE_STANCE", level="warn", message=f"受け身姿勢: {p}", claim_id=cid))
        if _quantification_missing(text):
            findings.append(QAFinding(code="MISSING_QUANT", level="warn", message="定量表現が不足", claim_id=cid))
        if len(claim.get("evidence", [])) < 1:
            findings.append(QAFinding(code="MISSING_EVIDENCE", level="blocker", message="根拠不足のため出力不可", claim_id=cid))
    return findings


def _compress(text: str, level: int) -> str:
    out = text
    if level >= 1:
        for w in ["非常に", "かなり", "しっかり", "その結果", "まず", "特に"]:
            out = out.replace(w, "")
    if level >= 2:
        out = out.replace("ことができました", "できた").replace("取り組みました", "実行した")
        out = out.replace("。", "")
    if level >= 3:
        out = out.replace("貢献できます", "貢献する")
    return re.sub(r"\s+", "", out).strip()


def _export_strict(claims: list[dict], char_limit: int, compression_level: int) -> dict:
    allowed = [c for c in claims if c.get("export_allowed")]
    ranked = sorted(allowed, key=lambda c: (c.get("assumption", False), c.get("confidence", 0.0)), reverse=False)
    used: list[dict] = []
    text = ""
    for claim in ranked:
        compressed = _compress(claim["text"], compression_level)
        candidate = text + compressed
        if len(candidate) <= char_limit:
            text = candidate
            used.append(claim)
    if len(text) > char_limit:
        text = text[:char_limit]
    used_ids = [c["claim_id"] for c in used]
    dropped_ids = [c["claim_id"] for c in claims if c["claim_id"] not in used_ids]
    return {
        "text": text,
        "used_claim_ids": used_ids,
        "dropped_claim_ids": dropped_ids,
        "char_count": len(text),
        "within_limit": len(text) <= char_limit,
    }


@app.get("/")
def root() -> tuple[str, int, dict[str, str]]:
    return "", 302, {"Location": "/sources"}


@app.get("/sources")
def sources_page() -> str:
    return _render_page("sources.html", title="ES Writer - Sources", heading="Sources", page_key="sources")


@app.get("/profile")
def profile_page() -> str:
    return _render_page("profile.html", title="ES Writer - Profile", heading="Profile", page_key="profile")


@app.get("/company")
def company_page() -> str:
    return _render_page("company.html", title="ES Writer - Company", heading="Company", page_key="company")


@app.get("/drafts")
def drafts_page() -> str:
    return _render_page("drafts.html", title="ES Writer - Drafts", heading="Drafts", page_key="drafts")


@app.get("/ui/static/app.css")
def ui_css() -> str:
    return (STATIC_ROOT / "app.css").read_text(encoding="utf-8")


@app.get("/ui/static/app.js")
def ui_js() -> str:
    return (STATIC_ROOT / "app.js").read_text(encoding="utf-8")


@app.get("/healthz")
def healthz() -> dict[str, bool]:
    return {"ok": True}


@app.post("/v1/generate")
def generate(payload: dict) -> dict:
    req = GenerateRequest.model_validate(payload)
    if not req.selected_chunks:
        raise HTTPException(status_code=400, detail="selected_chunks must not be empty")
    rules = _merge_rules(req.writing_rules)
    claims = [c.model_dump() for c in _make_claims(req)]
    allowed_ids = {c["chunk_id"] for c in req.selected_chunks}
    for claim in claims:
        claim["evidence"] = [e for e in claim["evidence"] if e["chunk_id"] in allowed_ids]
        claim["export_allowed"] = len(claim["evidence"]) >= 1
    qa = [q.model_dump() for q in _run_qa(claims, rules)]
    return {
        "outline": _outline_for(req.question_type),
        "claims": claims,
        "qa_findings": qa,
        "export_preview": None,
    }


@app.post("/v1/qa")
def qa(payload: dict) -> dict:
    claims = payload.get("claims", [])
    rules = _merge_rules(payload.get("writing_rules"))
    findings = [f.model_dump() for f in _run_qa(claims, rules)]
    return {"qa_findings": findings}


@app.post("/v1/export")
def export(payload: dict) -> dict:
    req = ExportRequest.model_validate(payload)
    level = min(3, max(1, req.compression_level))
    return _export_strict(req.claims, req.char_limit, level)

import json
import re
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.schemas import Claim, EvidenceRef, ExportRequest, GenerateRequest, QAFinding

app = FastAPI(title="es-writer backend")

UI_ROOT = Path(__file__).resolve().parent / "ui"
TEMPLATES_ROOT = UI_ROOT / "templates"
STATIC_ROOT = UI_ROOT / "static"

jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_ROOT)),
    autoescape=select_autoescape(["html", "xml"]),
)

app.mount("/ui/static", StaticFiles(directory=str(STATIC_ROOT)), name="ui-static")


def _render_page(template_name: str, *, title: str, heading: str, page_key: str) -> HTMLResponse:
    content = jinja_env.get_template(template_name).render()
    html = jinja_env.get_template("base.html").render(
        title=title,
        heading=heading,
        page_key=page_key,
        content=content,
    )
    return HTMLResponse(content=html)


def _load_default_rules() -> dict:
    path = Path(__file__).resolve().parents[2] / "shared" / "rules" / "ja_rules.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _merge_rules(override: dict | None) -> dict:
    base = _load_default_rules()
    if override:
        base.update(override)
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
    company = req.company_context or {}

    drafts = [
        ("c1", f"私の主な取り組みは{episode.get('title') or '継続的な改善活動'}です。", first_id, 0.82, False),
        ("c2", f"課題に対して{episode.get('action') or '原因を分解し施策を実行'}しました。", first_id, 0.79, False),
        ("c3", f"{company.get('company_name') or '貴社'}でも同じ再現性で貢献できます。", first_id, 0.55, True),
    ]

    claims: list[Claim] = []
    for cid, text, evid_id, conf, assumption in drafts:
        evidence: list[dict] = []
        if evid_id in chunk_map and (not assumption or "result" in first_text or "実績" in first_text):
            evidence = [EvidenceRef(chunk_id=evid_id, quote=chunk_map[evid_id]["text"][:60]).model_dump()]
        claims.append(
            Claim(
                claim_id=cid,
                text=text,
                evidence=evidence,
                confidence=conf,
                assumption=assumption,
                export_allowed=len(evidence) >= 1,
            )
        )
    return claims


def _quantification_missing(text: str) -> bool:
    return re.search(r"(\d+|回|日|週|月|年|%|倍|増|減|より)", text) is None


def _run_qa(claims: list[dict], rules: dict) -> list[QAFinding]:
    findings: list[QAFinding] = []
    for claim in claims:
        text = claim["text"]
        cid = claim["claim_id"]
        for bp in rules.get("banned_phrases", []):
            if bp in text:
                findings.append(QAFinding("BANNED_PHRASE", "warn", f"禁止表現: {bp}", cid))
        for sfx in rules.get("abstract_suffix_patterns", []):
            if text.endswith(sfx) or f"{sfx}を" in text:
                findings.append(QAFinding("ABSTRACT_SUFFIX", "warn", f"抽象語尾: {sfx}", cid))
        for p in rules.get("passive_stance_patterns", []):
            if p in text:
                findings.append(QAFinding("PASSIVE_STANCE", "warn", f"受け身姿勢: {p}", cid))
        if _quantification_missing(text):
            findings.append(QAFinding("MISSING_QUANT", "warn", "定量表現が不足", cid))
        if len(claim.get("evidence", [])) < 1:
            findings.append(QAFinding("MISSING_EVIDENCE", "blocker", "根拠不足のため出力不可", cid))
    return findings


def _compress(text: str, level: int) -> str:
    out = text
    if level >= 1:
        for w in ["非常に", "かなり", "しっかり", "その結果", "まず", "特に"]:
            out = out.replace(w, "")
    if level >= 2:
        out = out.replace("ことができました", "できた").replace("取り組みました", "実行した").replace("。", "")
    if level >= 3:
        out = out.replace("貢献できます", "貢献する")
    return re.sub(r"\s+", "", out).strip()


def _export_strict(claims: list[dict], char_limit: int, compression_level: int) -> dict:
    allowed = [c for c in claims if c.get("export_allowed")]
    ranked = sorted(allowed, key=lambda c: (c.get("assumption", False), c.get("confidence", 0.0)))
    used, text = [], ""
    for claim in ranked:
        comp = _compress(claim["text"], compression_level)
        if len(text + comp) <= char_limit:
            text += comp
            used.append(claim)
    used_ids = [c["claim_id"] for c in used]
    return {
        "text": text,
        "used_claim_ids": used_ids,
        "dropped_claim_ids": [c["claim_id"] for c in claims if c["claim_id"] not in used_ids],
        "char_count": len(text),
        "within_limit": len(text) <= char_limit,
    }


@app.get("/")
def root() -> RedirectResponse:
    return RedirectResponse(url="/sources", status_code=302)


@app.get("/favicon.ico")
def favicon() -> Response:
    return Response(status_code=204)


@app.get("/sources")
def sources_page() -> HTMLResponse:
    return _render_page("sources.html", title="ES Writer - 소스", heading="소스", page_key="sources")


@app.get("/profile")
def profile_page() -> HTMLResponse:
    return _render_page("profile.html", title="ES Writer - 프로필", heading="프로필", page_key="profile")


@app.get("/company")
def company_page() -> HTMLResponse:
    return _render_page("company.html", title="ES Writer - 기업", heading="기업", page_key="company")


@app.get("/drafts")
def drafts_page() -> HTMLResponse:
    return _render_page("drafts.html", title="ES Writer - 초안", heading="초안", page_key="drafts")


@app.get("/healthz")
def healthz() -> JSONResponse:
    return JSONResponse({"ok": True})


@app.post("/v1/generate")
def generate(payload: dict) -> dict:
    req = GenerateRequest.model_validate(payload)
    if not req.selected_chunks:
        raise HTTPException(status_code=400, detail="selected_chunks must not be empty")
    claims = [c.model_dump() for c in _make_claims(req)]
    allowed_ids = {c["chunk_id"] for c in req.selected_chunks}
    for claim in claims:
        claim["evidence"] = [e for e in claim["evidence"] if e["chunk_id"] in allowed_ids]
        claim["export_allowed"] = len(claim["evidence"]) >= 1
    qa = [q.model_dump() for q in _run_qa(claims, _merge_rules(req.writing_rules))]
    return {"outline": _outline_for(req.question_type), "claims": claims, "qa_findings": qa, "export_preview": None}


@app.post("/v1/qa")
def qa(payload: dict) -> dict:
    claims = payload.get("claims", [])
    findings = [f.model_dump() for f in _run_qa(claims, _merge_rules(payload.get("writing_rules")))]
    return {"qa_findings": findings}


@app.post("/v1/export")
def export(payload: dict) -> dict:
    req = ExportRequest.model_validate(payload)
    level = min(3, max(1, req.compression_level))
    return _export_strict(req.claims, req.char_limit, level)

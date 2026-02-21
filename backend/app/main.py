import json
import re
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.schemas import (
    Claim,
    EvidenceRef,
    ExportRequest,
    ExportResponse,
    GenerateRequest,
    GenerateResponse,
    QAFinding,
    QARequest,
    QAResponse,
)

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
    chunk_map = {chunk.chunk_id: chunk for chunk in req.selected_chunks}
    first_chunk = req.selected_chunks[0]
    episode = req.selected_episodes[0] if req.selected_episodes else None
    company = req.company_context

    action_text = episode.action if (episode and episode.action) else "原因を分解し施策を実行"
    episode_title = episode.title if (episode and episode.title) else "継続的な改善活動"
    company_name = (
        company.company_name
        if company and company.company_name
        else (company.name if company and company.name else "貴社")
    )

    drafts = [
        ("c1", f"私の主な取り組みは{episode_title}です。", first_chunk.chunk_id, 0.82, False),
        ("c2", f"課題に対して{action_text}しました。", first_chunk.chunk_id, 0.79, False),
        ("c3", f"{company_name}でも同じ再現性で貢献できます。", first_chunk.chunk_id, 0.55, True),
    ]

    claims: list[Claim] = []
    for claim_id, text, evidence_chunk_id, confidence, assumption in drafts:
        evidence: list[EvidenceRef] = []
        first_text = chunk_map[first_chunk.chunk_id].text
        if evidence_chunk_id in chunk_map and (not assumption or "result" in first_text or "実績" in first_text):
            evidence = [EvidenceRef(chunk_id=evidence_chunk_id, quote=chunk_map[evidence_chunk_id].text[:60])]
        claims.append(
            Claim(
                claim_id=claim_id,
                text=text,
                evidence=evidence,
                confidence=confidence,
                assumption=assumption,
                export_allowed=len(evidence) >= 1,
            )
        )
    return claims


def _quantification_missing(text: str) -> bool:
    return re.search(r"(\d+|回|日|週|月|年|%|倍|増|減|より)", text) is None


def _run_qa(claims: list[Claim], rules: dict) -> list[QAFinding]:
    findings: list[QAFinding] = []
    for claim in claims:
        for banned_phrase in rules.get("banned_phrases", []):
            if banned_phrase in claim.text:
                findings.append(
                    QAFinding(
                        code="BANNED_PHRASE",
                        level="warn",
                        message=f"禁止表現: {banned_phrase}",
                        claim_id=claim.claim_id,
                    )
                )

        for suffix in rules.get("abstract_suffix_patterns", []):
            if claim.text.endswith(suffix) or f"{suffix}を" in claim.text:
                findings.append(
                    QAFinding(
                        code="ABSTRACT_SUFFIX",
                        level="warn",
                        message=f"抽象語尾: {suffix}",
                        claim_id=claim.claim_id,
                    )
                )

        for passive_pattern in rules.get("passive_stance_patterns", []):
            if passive_pattern in claim.text:
                findings.append(
                    QAFinding(
                        code="PASSIVE_STANCE",
                        level="warn",
                        message=f"受け身姿勢: {passive_pattern}",
                        claim_id=claim.claim_id,
                    )
                )

        if _quantification_missing(claim.text):
            findings.append(
                QAFinding(
                    code="MISSING_QUANT",
                    level="warn",
                    message="定量表現が不足",
                    claim_id=claim.claim_id,
                )
            )

        if len(claim.evidence) < 1:
            findings.append(
                QAFinding(
                    code="MISSING_EVIDENCE",
                    level="blocker",
                    message="根拠不足のため出力不可",
                    claim_id=claim.claim_id,
                )
            )

    return findings


def _compress(text: str, level: int) -> str:
    output = text
    if level >= 1:
        for word in ["非常に", "かなり", "しっかり", "その結果", "まず", "特に"]:
            output = output.replace(word, "")
    if level >= 2:
        output = output.replace("ことができました", "できた").replace("取り組みました", "実行した").replace("。", "")
    if level >= 3:
        output = output.replace("貢献できます", "貢献する")
    return re.sub(r"\s+", "", output).strip()


def _export_strict(claims: list[Claim], char_limit: int, compression_level: int) -> ExportResponse:
    allowed_claims = [claim for claim in claims if claim.export_allowed]
    ranked = sorted(allowed_claims, key=lambda claim: (claim.assumption, claim.confidence))

    used: list[Claim] = []
    text = ""
    for claim in ranked:
        compressed = _compress(claim.text, compression_level)
        if len(text + compressed) <= char_limit:
            text += compressed
            used.append(claim)

    used_claim_ids = [claim.claim_id for claim in used]
    dropped_claim_ids = [claim.claim_id for claim in claims if claim.claim_id not in used_claim_ids]

    return ExportResponse(
        text=text,
        used_claim_ids=used_claim_ids,
        dropped_claim_ids=dropped_claim_ids,
        char_count=len(text),
        within_limit=len(text) <= char_limit,
    )


@app.get("/")
def root() -> RedirectResponse:
    return RedirectResponse(url="/sources", status_code=302)


@app.get("/favicon.ico")
def favicon() -> Response:
    return Response(status_code=204)


@app.get("/sources", response_class=HTMLResponse)
def sources_page() -> HTMLResponse:
    return _render_page("sources.html", title="ES Writer - 소스", heading="소스", page_key="sources")


@app.get("/profile", response_class=HTMLResponse)
def profile_page() -> HTMLResponse:
    return _render_page("profile.html", title="ES Writer - 프로필", heading="프로필", page_key="profile")


@app.get("/company", response_class=HTMLResponse)
def company_page() -> HTMLResponse:
    return _render_page("company.html", title="ES Writer - 기업", heading="기업", page_key="company")


@app.get("/drafts", response_class=HTMLResponse)
def drafts_page() -> HTMLResponse:
    return _render_page("drafts.html", title="ES Writer - 초안", heading="초안", page_key="drafts")


@app.get("/healthz")
def healthz() -> JSONResponse:
    return JSONResponse({"ok": True})


@app.post("/v1/generate")
def generate(req: GenerateRequest) -> GenerateResponse:
    if not req.selected_chunks:
        raise HTTPException(status_code=400, detail="selected_chunks must not be empty")

    claims = _make_claims(req)
    allowed_chunk_ids = {chunk.chunk_id for chunk in req.selected_chunks}

    normalized_claims: list[Claim] = []
    for claim in claims:
        evidence = [evidence for evidence in claim.evidence if evidence.chunk_id in allowed_chunk_ids]
        normalized_claims.append(claim.model_copy(update={"evidence": evidence, "export_allowed": len(evidence) >= 1}))

    qa_findings = _run_qa(normalized_claims, _merge_rules(req.writing_rules))

    return GenerateResponse(
        outline=_outline_for(req.question_type),
        claims=normalized_claims,
        qa_findings=qa_findings,
        export_preview=None,
    )


@app.post("/v1/qa")
def qa(req: QARequest) -> QAResponse:
    findings = _run_qa(req.claims, _merge_rules(req.writing_rules))
    return QAResponse(qa_findings=findings)


@app.post("/v1/export")
def export(req: ExportRequest) -> ExportResponse:
    level = min(3, max(1, req.compression_level))
    return _export_strict(req.claims, req.char_limit, level)

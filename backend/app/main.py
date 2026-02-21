import json
import os
import re
import urllib.request
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pydantic import BaseModel, Field

from app import db
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
db.init_db()

UI_ROOT = Path(__file__).resolve().parent / "ui"
TEMPLATES_ROOT = UI_ROOT / "templates"
STATIC_ROOT = UI_ROOT / "static"

jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_ROOT)),
    autoescape=select_autoescape(["html", "xml"]),
)

app.mount("/ui/static", StaticFiles(directory=str(STATIC_ROOT)), name="ui-static")


@app.on_event("startup")
def startup() -> None:
    db.init_db()


def _render_page(template_name: str, *, title: str, heading: str, page_key: str) -> HTMLResponse:
    content = jinja_env.get_template(template_name).render()
    html = jinja_env.get_template("base.html").render(
        title=title,
        heading=heading,
        page_key=page_key,
        content=content,
    )
    return HTMLResponse(content=html, media_type="text/html; charset=utf-8")


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


def _extract_json_text(raw: str) -> str:
    stripped = raw.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?", "", stripped).strip()
        stripped = re.sub(r"```$", "", stripped).strip()
    start = stripped.find("{")
    alt = stripped.find("[")
    if alt != -1 and (start == -1 or alt < start):
        start = alt
    if start > 0:
        stripped = stripped[start:]
    return stripped


async def _call_openai_json(prompt: str) -> dict | list | None:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None

    payload = {
        "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        "messages": [
            {"role": "system", "content": "You are a careful Japanese writing assistant. Return JSON only."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            body = json.loads(res.read().decode("utf-8"))
        content = body["choices"][0]["message"]["content"]
        return json.loads(_extract_json_text(content))
    except Exception:
        return None


async def _make_claims(req: GenerateRequest) -> list[Claim]:
    chunk_map = {chunk.chunk_id: chunk for chunk in req.selected_chunks}
    company_name = req.company_context.company_name if req.company_context and req.company_context.company_name else "貴社"

    chunks_text = "\n".join([f"- {c.chunk_id}: {c.text}" for c in req.selected_chunks[:8]])
    episode_text = "\n".join([f"- title={ep.title} action={ep.action} result={ep.results_qual}" for ep in req.selected_episodes[:5]])

    prompt = (
        "以下の材料のみを使って、日本語の主張claimを3件作ってください。"
        "JSON配列のみ返してください。各要素は"
        "{claim_id,text,evidence_chunk_id,confidence,assumption}。"
        "confidenceは0~1。\n"
        f"会社: {company_name}\n"
        f"chunks:\n{chunks_text}\n"
        f"episodes:\n{episode_text}\n"
    )

    llm_result = await _call_openai_json(prompt)

    raw_claims: list[dict] = []
    if isinstance(llm_result, list):
        raw_claims = [item for item in llm_result if isinstance(item, dict)]

    if not raw_claims:
        first = req.selected_chunks[0]
        ep = req.selected_episodes[0] if req.selected_episodes else None
        action_text = ep.action if ep and ep.action else "課題を分析して改善策を実行"
        title_text = ep.title if ep and ep.title else "実務での改善経験"
        raw_claims = [
            {
                "claim_id": "c1",
                "text": f"{title_text}に取り組み、具体的な改善を進めました。",
                "evidence_chunk_id": first.chunk_id,
                "confidence": 0.78,
                "assumption": False,
            },
            {
                "claim_id": "c2",
                "text": f"私は{action_text}を通じて成果につながる行動を継続しました。",
                "evidence_chunk_id": first.chunk_id,
                "confidence": 0.74,
                "assumption": False,
            },
            {
                "claim_id": "c3",
                "text": f"{company_name}でも再現可能な価値提供ができます。",
                "evidence_chunk_id": first.chunk_id,
                "confidence": 0.58,
                "assumption": True,
            },
        ]

    claims: list[Claim] = []
    for idx, item in enumerate(raw_claims[:6], start=1):
        claim_id = str(item.get("claim_id") or f"c{idx}")
        text = str(item.get("text") or "")
        evidence_chunk_id = str(item.get("evidence_chunk_id") or "")
        confidence = float(item.get("confidence") or 0.5)
        assumption = bool(item.get("assumption") or False)

        evidence: list[EvidenceRef] = []
        first_text = req.selected_chunks[0].text if req.selected_chunks else ""
        has_result_signal = ("result" in first_text.lower()) or ("実績" in first_text)
        if evidence_chunk_id in chunk_map and (not assumption or has_result_signal):
            quote = chunk_map[evidence_chunk_id].text[:80]
            evidence = [EvidenceRef(chunk_id=evidence_chunk_id, quote=quote)]

        claims.append(
            Claim(
                claim_id=claim_id,
                text=text,
                evidence=evidence,
                confidence=max(0.0, min(1.0, confidence)),
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


def _safe_trim(text: str, char_limit: int) -> str:
    if char_limit <= 0:
        return ""
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= char_limit:
        return text
    sentence_parts = re.split(r"(?<=[。！？])", text)
    out = ""
    for part in sentence_parts:
        if len(out + part) > char_limit:
            break
        out += part
    if out:
        return out[:char_limit]
    return text[:char_limit]


async def _compress(text: str, char_limit: int, level: int) -> str:
    if char_limit <= 0:
        return ""

    prompt = (
        "次の日本語文を意味を保って簡潔に圧縮してください。"
        f"出力は必ず{char_limit}文字以内。余計な説明は禁止。\n"
        f"圧縮レベル:{level}\n"
        f"本文:{text}"
    )
    llm_result = await _call_openai_json(prompt)

    if isinstance(llm_result, dict) and isinstance(llm_result.get("text"), str):
        return _safe_trim(llm_result["text"], char_limit)
    if isinstance(llm_result, list) and llm_result and isinstance(llm_result[0], dict):
        maybe = llm_result[0].get("text")
        if isinstance(maybe, str):
            return _safe_trim(maybe, char_limit)

    fallback = text
    if level >= 2:
        fallback = fallback.replace("することができます", "できます")
        fallback = fallback.replace("ことができました", "できました")
    if level >= 3:
        fallback = fallback.replace("取り組みました", "取り組んだ")
    return _safe_trim(fallback, char_limit)


def _evidence_allows_export(claim: Claim) -> bool:
    return len(claim.evidence) >= 1


async def _export_strict(claims: list[Claim], char_limit: int, compression_level: int) -> ExportResponse:
    normalized_claims = [
        claim.model_copy(update={"export_allowed": _evidence_allows_export(claim)})
        for claim in claims
    ]
    allowed_claims = [claim for claim in normalized_claims if claim.export_allowed]
    ranked = sorted(allowed_claims, key=lambda claim: (claim.assumption, -claim.confidence))

    used: list[Claim] = []
    text = ""
    for claim in ranked:
        remaining = char_limit - len(text)
        if remaining <= 0:
            break
        compressed = await _compress(claim.text, remaining, compression_level)
        if len(text + compressed) <= char_limit and compressed:
            text += compressed
            used.append(claim)

    used_claim_ids = [claim.claim_id for claim in used]
    used_claim_id_set = set(used_claim_ids)
    dropped_claim_ids = [
        claim.claim_id
        for claim in normalized_claims
        if claim.claim_id not in used_claim_id_set
    ]

    return ExportResponse(
        text=text,
        used_claim_ids=used_claim_ids,
        dropped_claim_ids=dropped_claim_ids,
        char_count=len(text),
        within_limit=len(text) <= char_limit,
    )


def _split_chunks(text: str, max_len: int = 800) -> list[dict]:
    chunks: list[dict] = []
    chunk_idx = 1
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    for para in paragraphs if paragraphs else [text.strip()]:
        rest = para
        while len(rest) > max_len:
            chunks.append({"chunk_id": f"ch{chunk_idx}", "text": rest[:max_len]})
            chunk_idx += 1
            rest = rest[max_len:]
        if rest:
            chunks.append({"chunk_id": f"ch{chunk_idx}", "text": rest})
            chunk_idx += 1
    return chunks


class SourceUpsertRequest(BaseModel):
    title: str
    raw_text: str


class ProfileUpsertRequest(BaseModel):
    name: str
    payload: dict = Field(default_factory=dict)


class RestoreRequest(BaseModel):
    sources: list[dict] = Field(default_factory=list)
    profiles: list[dict] = Field(default_factory=list)


class CompanyResearchRequest(BaseModel):
    company_name: str


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


@app.get("/v1/sources")
def list_sources_api() -> JSONResponse:
    items = db.list_sources()
    summaries = [{"id": item["id"], "title": item["title"], "updated_at": item["updated_at"]} for item in items]
    return JSONResponse(summaries)


@app.get("/v1/sources/{source_id}")
def get_source_api(source_id: str) -> JSONResponse:
    item = db.get_source(source_id)
    if not item:
        raise HTTPException(status_code=404, detail="source not found")
    return JSONResponse(item)


@app.post("/v1/sources")
def create_source_api(req: SourceUpsertRequest) -> JSONResponse:
    if not req.title.strip() or not req.raw_text.strip():
        raise HTTPException(status_code=400, detail="title and raw_text are required")
    item = db.create_source(req.title.strip(), req.raw_text)
    return JSONResponse(item, status_code=201)


@app.put("/v1/sources/{source_id}")
def update_source_api(source_id: str, req: SourceUpsertRequest) -> JSONResponse:
    item = db.update_source(source_id, req.title.strip(), req.raw_text)
    if not item:
        raise HTTPException(status_code=404, detail="source not found")
    return JSONResponse(item)


@app.delete("/v1/sources/{source_id}")
def delete_source_api(source_id: str) -> JSONResponse:
    ok = db.delete_source(source_id)
    if not ok:
        raise HTTPException(status_code=404, detail="source not found")
    return JSONResponse({"ok": True})


@app.post("/v1/sources/upload")
async def upload_source(file: UploadFile = File(...)) -> JSONResponse:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".txt", ".md", ".json"}:
        raise HTTPException(status_code=400, detail="unsupported file type")
    raw = await file.read()
    text = raw.decode("utf-8", errors="replace")
    title = file.filename or "uploaded"
    created = db.create_source(title, text)
    return JSONResponse({"id": created["id"], "title": title, "preview": text[:200]})


@app.post("/v1/sources/{source_id}/chunks")
def source_chunks(source_id: str) -> JSONResponse:
    item = db.get_source(source_id)
    if not item:
        raise HTTPException(status_code=404, detail="source not found")
    chunks = _split_chunks(item["raw_text"])
    for chunk in chunks:
        chunk["source_id"] = source_id
    return JSONResponse(chunks)


@app.get("/v1/profiles")
def list_profiles_api() -> JSONResponse:
    items = db.list_profiles()
    summaries = [{"id": item["id"], "name": item["name"], "updated_at": item["updated_at"]} for item in items]
    return JSONResponse(summaries)


@app.get("/v1/profiles/{profile_id}")
def get_profile_api(profile_id: str) -> JSONResponse:
    item = db.get_profile(profile_id)
    if not item:
        raise HTTPException(status_code=404, detail="profile not found")
    return JSONResponse(item)


@app.post("/v1/profiles")
def create_profile_api(req: ProfileUpsertRequest) -> JSONResponse:
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="name is required")
    item = db.create_profile(req.name.strip(), req.payload)
    return JSONResponse(item, status_code=201)


@app.put("/v1/profiles/{profile_id}")
def update_profile_api(profile_id: str, req: ProfileUpsertRequest) -> JSONResponse:
    item = db.update_profile(profile_id, req.name.strip(), req.payload)
    if not item:
        raise HTTPException(status_code=404, detail="profile not found")
    return JSONResponse(item)


@app.delete("/v1/profiles/{profile_id}")
def delete_profile_api(profile_id: str) -> JSONResponse:
    ok = db.delete_profile(profile_id)
    if not ok:
        raise HTTPException(status_code=404, detail="profile not found")
    return JSONResponse({"ok": True})


@app.get("/v1/backup")
def backup_api() -> JSONResponse:
    payload = {
        "sources": db.list_sources(),
        "profiles": db.list_profiles(),
    }
    return JSONResponse(payload)


@app.post("/v1/restore")
def restore_api(req: RestoreRequest) -> JSONResponse:
    for source in req.sources:
        if source.get("id") and source.get("title") is not None and source.get("raw_text") is not None:
            db.upsert_source(source["id"], source["title"], source["raw_text"])
    for profile in req.profiles:
        if profile.get("id") and profile.get("name") is not None and profile.get("payload") is not None:
            db.upsert_profile(profile["id"], profile["name"], profile["payload"])
    return JSONResponse({"ok": True})




@app.post("/v1/company/research")
async def company_research(req: CompanyResearchRequest) -> JSONResponse:
    company_name = req.company_name.strip()
    if not company_name:
        raise HTTPException(status_code=400, detail="company_name is required")

    prompt = (
        "다음 일본 기업의 정보를 ES 작성에 맞게 요약해 주세요. JSON만 반환하세요. "
        "형식: {\"company_info\":\"...\",\"question_template\":\"...\",\"char_limit\":400}. "
        f"기업명: {company_name}"
    )
    llm_result = await _call_openai_json(prompt)

    if isinstance(llm_result, dict):
        info = str(llm_result.get("company_info") or "").strip()
        template = str(llm_result.get("question_template") or "").strip()
        try:
            char_limit = int(llm_result.get("char_limit") or 400)
        except Exception:
            char_limit = 400
        if info or template:
            return JSONResponse(
                {
                    "company_name": company_name,
                    "company_info": info or f"{company_name}의 공식 채용 페이지/사업보고서를 기반으로 인재상과 역할 요구사항을 정리하세요.",
                    "question_template": template or "지원 동기 및 기여 가능성을 400자 내외로 작성하세요.",
                    "char_limit": max(100, min(1200, char_limit)),
                }
            )

    return JSONResponse(
        {
            "company_name": company_name,
            "company_info": f"{company_name}의 핵심 사업, 최근 전략, 요구 역량을 확인해 회사 맞춤형 지원 동기를 구성하세요.",
            "question_template": "지원 동기 및 입사 후 기여 계획을 구체적으로 작성하세요.",
            "char_limit": 400,
        }
    )

@app.post("/v1/generate")
async def generate(req: GenerateRequest) -> GenerateResponse:
    if not req.selected_chunks:
        raise HTTPException(status_code=400, detail="selected_chunks must not be empty")

    claims = await _make_claims(req)
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
async def export(req: ExportRequest) -> ExportResponse:
    level = min(3, max(1, req.compression_level))
    return await _export_strict(req.claims, req.char_limit, level)

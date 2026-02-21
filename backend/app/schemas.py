from __future__ import annotations

from pydantic import BaseModel, Field


class ChunkInput(BaseModel):
    chunk_id: str
    text: str
    source_title: str = ""
    loc_hint: str = ""
    page_start: int | None = None
    page_end: int | None = None
    pinned: bool = False


class EpisodeInput(BaseModel):
    title: str = ""
    situation: str = ""
    task: str = ""
    action: str = ""
    result: str = ""


class CompanyInput(BaseModel):
    company_name: str = ""
    role: str = ""
    strengths: list[str] = Field(default=[])
    values: list[str] = Field(default=[])


class EvidenceRef(BaseModel):
    chunk_id: str
    quote: str


class Claim(BaseModel):
    claim_id: str
    text: str
    evidence: list[EvidenceRef] = Field(default=[])
    confidence: float = 0.5
    assumption: bool = False
    export_allowed: bool = False


class QAFinding(BaseModel):
    code: str
    level: str
    message: str
    claim_id: str | None = None


class GenerateRequest(BaseModel):
    selected_chunks: list[ChunkInput]
    selected_episodes: list[EpisodeInput] = Field(default=[])
    company_context: CompanyInput | None = None
    question_type: str
    char_limit: int = 400
    writing_rules: dict | None = None


class GenerateResponse(BaseModel):
    outline: list[str]
    claims: list[Claim]
    qa_findings: list[QAFinding]
    export_preview: str | None = None


class ExportRequest(BaseModel):
    claims: list[Claim]
    char_limit: int
    compression_level: int = 1


class ExportResponse(BaseModel):
    text: str
    used_claim_ids: list[str]
    dropped_claim_ids: list[str]
    char_count: int
    within_limit: bool

from typing import Any

from pydantic import BaseModel, Field


class ChunkInput(BaseModel):
    chunk_id: str
    text: str
    source_title: str = ""
    loc_hint: str = ""
    page_start: int = 0
    page_end: int = 0
    pinned: bool = False


class EpisodeInput(BaseModel):
    title: str = ""
    period: str = ""
    context: str = ""
    role: str = ""
    goal: str = ""
    problem: str = ""
    actions: list[str] = Field(default_factory=list)
    action: str = ""
    results_quant: str = ""
    results_qual: str = ""
    learning: str = ""
    linked_chunk_keys: list[str] = Field(default_factory=list)


class CompanyInput(BaseModel):
    company_name: str = ""
    name: str = ""
    role: str = ""
    key_phrases: list[str] = Field(default_factory=list)
    question_set: list[dict[str, Any]] = Field(default_factory=list)


class EvidenceRef(BaseModel):
    chunk_id: str
    quote: str


class Claim(BaseModel):
    claim_id: str
    text: str
    evidence: list[EvidenceRef] = Field(default_factory=list)
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
    selected_episodes: list[EpisodeInput] = Field(default_factory=list)
    company_context: CompanyInput | None = None
    question_type: str = "gakuchika"
    char_limit: int = 400
    writing_rules: dict[str, Any] | None = None


class GenerateResponse(BaseModel):
    outline: list[str]
    claims: list[Claim]
    qa_findings: list[QAFinding]
    export_preview: str | None = None


class QARequest(BaseModel):
    claims: list[Claim] = Field(default_factory=list)
    writing_rules: dict[str, Any] | None = None


class QAResponse(BaseModel):
    qa_findings: list[QAFinding]


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

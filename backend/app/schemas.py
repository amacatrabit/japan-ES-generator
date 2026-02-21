from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class EvidenceRef:
    chunk_id: str
    quote: str

    def model_dump(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Claim:
    claim_id: str
    text: str
    evidence: list[dict[str, Any]] = field(default_factory=list)
    confidence: float = 0.5
    assumption: bool = False
    export_allowed: bool = False

    def model_dump(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class QAFinding:
    code: str
    level: str
    message: str
    claim_id: str | None = None

    def model_dump(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class GenerateRequest:
    selected_chunks: list[dict[str, Any]]
    selected_episodes: list[dict[str, Any]] = field(default_factory=list)
    company_context: dict[str, Any] | None = None
    question_type: str = "gakuchika"
    char_limit: int = 400
    writing_rules: dict[str, Any] | None = None

    @classmethod
    def model_validate(cls, payload: dict[str, Any]) -> "GenerateRequest":
        return cls(
            selected_chunks=payload.get("selected_chunks", []),
            selected_episodes=payload.get("selected_episodes", []),
            company_context=payload.get("company_context"),
            question_type=payload.get("question_type", "gakuchika"),
            char_limit=int(payload.get("char_limit", 400)),
            writing_rules=payload.get("writing_rules"),
        )


@dataclass
class ExportRequest:
    claims: list[dict[str, Any]]
    char_limit: int
    compression_level: int = 1

    @classmethod
    def model_validate(cls, payload: dict[str, Any]) -> "ExportRequest":
        return cls(
            claims=payload.get("claims", []),
            char_limit=int(payload.get("char_limit", 400)),
            compression_level=int(payload.get("compression_level", 1)),
        )

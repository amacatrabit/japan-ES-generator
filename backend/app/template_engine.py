from __future__ import annotations

from pathlib import Path


class TemplateEngine:
    def __init__(self, root: Path) -> None:
        self.root = root

    def render(self, name: str, context: dict[str, str]) -> str:
        text = (self.root / name).read_text(encoding="utf-8")
        for key, value in context.items():
            text = text.replace("{{ " + key + " }}", value)
            text = text.replace("{{ " + key + " | safe }}", value)
        return text

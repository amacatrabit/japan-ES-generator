from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class FileSystemLoader:
    searchpath: str


class Template:
    def __init__(self, text: str) -> None:
        self.text = text

    def render(self, **context: Any) -> str:
        rendered = self.text
        pattern = re.compile(r"{{\s*([a-zA-Z0-9_]+)(?:\s*\|\s*safe)?\s*}}")

        def replace(match: re.Match[str]) -> str:
            key = match.group(1)
            value = context.get(key, "")
            return str(value)

        return pattern.sub(replace, rendered)


class Environment:
    def __init__(self, loader: FileSystemLoader, autoescape: bool | None = None) -> None:
        self.loader = loader
        self.autoescape = autoescape

    def get_template(self, name: str) -> Template:
        root = Path(self.loader.searchpath)
        path = root / name
        return Template(path.read_text(encoding="utf-8"))


def select_autoescape(_: list[str] | None = None) -> bool:
    return True

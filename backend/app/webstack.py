from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable


class HTTPException(Exception):
    def __init__(self, status_code: int, detail: Any) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(str(detail))


@dataclass
class Response:
    content: Any
    status_code: int = 200
    media_type: str = "text/plain"
    headers: dict[str, str] | None = None


class HTMLResponse(Response):
    def __init__(self, content: str, status_code: int = 200) -> None:
        super().__init__(content=content, status_code=status_code, media_type="text/html; charset=utf-8")


class JSONResponse(Response):
    def __init__(self, content: Any, status_code: int = 200) -> None:
        super().__init__(content=content, status_code=status_code, media_type="application/json")


class RedirectResponse(Response):
    def __init__(self, url: str, status_code: int = 307) -> None:
        super().__init__(content="", status_code=status_code, media_type="text/plain", headers={"Location": url})


class StaticFiles:
    def __init__(self, directory: str) -> None:
        self.directory = Path(directory)

    def _media_type(self, path: Path) -> str:
        if path.suffix == ".css":
            return "text/css; charset=utf-8"
        if path.suffix == ".js":
            return "application/javascript; charset=utf-8"
        if path.suffix == ".html":
            return "text/html; charset=utf-8"
        return "application/octet-stream"

    def serve(self, relpath: str) -> Response:
        target = (self.directory / relpath.lstrip("/")).resolve()
        if not str(target).startswith(str(self.directory.resolve())) or not target.exists():
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        return Response(content=target.read_text(encoding="utf-8"), status_code=200, media_type=self._media_type(target))


@dataclass
class _Route:
    method: str
    path: str
    handler: Callable[..., Any]


@dataclass
class _Mount:
    path: str
    app: StaticFiles


class FastAPI:
    def __init__(self, title: str = "app") -> None:
        self.title = title
        self.routes: dict[tuple[str, str], _Route] = {}
        self.mounts: list[_Mount] = []

    def get(self, path: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        return self._register("GET", path)

    def post(self, path: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        return self._register("POST", path)

    def mount(self, path: str, app: StaticFiles, name: str | None = None) -> None:
        _ = name
        self.mounts.append(_Mount(path=path.rstrip("/"), app=app))

    def _register(self, method: str, path: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        def decorator(handler: Callable[..., Any]) -> Callable[..., Any]:
            self.routes[(method, path)] = _Route(method=method, path=path, handler=handler)
            return handler

        return decorator


def to_response(payload: Any) -> Response:
    if isinstance(payload, Response):
        return payload
    if isinstance(payload, tuple):
        body = payload[0]
        status = payload[1] if len(payload) > 1 else 200
        headers = payload[2] if len(payload) > 2 else {}
        media_type = "application/json" if isinstance(body, (dict, list)) else "text/plain"
        return Response(content=body, status_code=status, media_type=media_type, headers=headers)
    if isinstance(payload, (dict, list)):
        return JSONResponse(payload)
    return Response(content=str(payload), status_code=200, media_type="text/plain")


def parse_json_text(text: str) -> Any:
    return json.loads(text)

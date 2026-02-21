from collections.abc import Callable
from dataclasses import dataclass
from typing import Any


class HTTPException(Exception):
    def __init__(self, status_code: int, detail: Any) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(str(detail))


@dataclass
class _Route:
    path: str
    method: str
    handler: Callable[..., Any]


class FastAPI:
    def __init__(self, title: str = "app") -> None:
        self.title = title
        self.routes: dict[tuple[str, str], _Route] = {}

    def get(self, path: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        return self._register("GET", path)

    def post(self, path: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        return self._register("POST", path)

    def _register(self, method: str, path: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        def decorator(handler: Callable[..., Any]) -> Callable[..., Any]:
            self.routes[(method, path)] = _Route(path=path, method=method, handler=handler)
            return handler

        return decorator

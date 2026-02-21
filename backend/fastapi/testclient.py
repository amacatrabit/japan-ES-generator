from dataclasses import dataclass, field
from typing import Any

from .app import FastAPI, HTTPException


@dataclass
class _Response:
    status_code: int
    _payload: Any
    headers: dict[str, str] = field(default_factory=dict)

    def json(self) -> Any:
        return self._payload

    @property
    def text(self) -> str:
        if isinstance(self._payload, str):
            return self._payload
        return str(self._payload)


class TestClient:
    __test__ = False

    def __init__(self, app: FastAPI) -> None:
        self.app = app

    def get(self, path: str) -> _Response:
        return self._request("GET", path)

    def post(self, path: str, json: dict[str, Any] | None = None) -> _Response:
        return self._request("POST", path, json=json)

    def _request(self, method: str, path: str, json: dict[str, Any] | None = None) -> _Response:
        route = self.app.routes.get((method, path))
        if route is None:
            return _Response(status_code=404, _payload={"detail": "Not Found"})

        try:
            payload = route.handler(json) if json is not None else route.handler()
            if isinstance(payload, tuple):
                body = payload[0]
                status = payload[1] if len(payload) > 1 else 200
                headers = payload[2] if len(payload) > 2 else {}
                return _Response(status_code=status, _payload=body, headers=headers)
            return _Response(status_code=200, _payload=payload)
        except HTTPException as exc:
            return _Response(status_code=exc.status_code, _payload={"detail": exc.detail})

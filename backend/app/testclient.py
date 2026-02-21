from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.webstack import FastAPI, HTTPException, Response, parse_json_text, to_response


@dataclass
class ClientResponse:
    status_code: int
    _content: Any
    headers: dict[str, str] = field(default_factory=dict)

    def json(self) -> Any:
        if isinstance(self._content, (dict, list)):
            return self._content
        return parse_json_text(self.text)

    @property
    def text(self) -> str:
        return str(self._content)


class TestClient:
    __test__ = False

    def __init__(self, app: FastAPI) -> None:
        self.app = app

    def get(self, path: str) -> ClientResponse:
        return self._request("GET", path)

    def post(self, path: str, json: dict[str, Any] | None = None) -> ClientResponse:
        return self._request("POST", path, json=json)

    def _request(self, method: str, path: str, json: dict[str, Any] | None = None) -> ClientResponse:
        route = self.app.routes.get((method, path))
        if route is None:
            for mount in self.app.mounts:
                prefix = mount.path
                if path == prefix or path.startswith(prefix + "/"):
                    rel = path[len(prefix) :]
                    resp = mount.app.serve(rel)
                    return self._wrap(resp)
            return ClientResponse(status_code=404, _content={"detail": "Not Found"}, headers={"content-type": "application/json"})

        try:
            payload = route.handler(json) if json is not None else route.handler()
            resp = to_response(payload)
            return self._wrap(resp)
        except HTTPException as exc:
            return ClientResponse(status_code=exc.status_code, _content={"detail": exc.detail}, headers={"content-type": "application/json"})

    def _wrap(self, resp: Response) -> ClientResponse:
        headers = {"content-type": resp.media_type}
        if resp.headers:
            headers.update({k.lower(): v for k, v in resp.headers.items()})
        return ClientResponse(status_code=resp.status_code, _content=resp.content, headers=headers)

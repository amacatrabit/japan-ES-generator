from app.testclient import TestClient

from app.main import app


def test_healthz_returns_ok_true() -> None:
    client = TestClient(app)

    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"ok": True}

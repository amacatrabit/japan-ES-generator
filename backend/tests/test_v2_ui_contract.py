from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_healthz_json() -> None:
    res = client.get('/healthz')
    assert res.status_code == 200
    assert 'application/json' in res.headers.get('content-type', '')
    assert res.json() == {'ok': True}


def test_sources_html_content_type() -> None:
    res = client.get('/sources')
    assert res.status_code == 200
    assert 'text/html' in res.headers.get('content-type', '')


def test_static_css_content_type() -> None:
    res = client.get('/ui/static/app.css')
    assert res.status_code == 200
    assert 'text/css' in res.headers.get('content-type', '')

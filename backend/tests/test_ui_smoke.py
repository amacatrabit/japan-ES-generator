from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_sources_page_renders() -> None:
    response = client.get("/sources")
    assert response.status_code == 200
    assert "소스" in response.text


def test_profile_company_drafts_pages_render() -> None:
    for path, expected in [
        ("/profile", "프로필"),
        ("/company", "기업"),
        ("/drafts", "초안 마법사"),
    ]:
        response = client.get(path)
        assert response.status_code == 200
        assert expected in response.text


def test_ui_assets_served() -> None:
    css = client.get("/ui/static/app.css")
    js = client.get("/ui/static/app.js")
    store = client.get("/ui/static/store.js")
    assert css.status_code == 200
    assert ".large-title" in css.text
    assert js.status_code == 200
    assert store.status_code == 200
    assert "esStore" in store.text

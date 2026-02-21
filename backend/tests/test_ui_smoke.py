from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_sources_page_contains_header_and_brand() -> None:
    response = client.get("/sources")
    assert response.status_code == 200
    assert "<header" in response.text
    assert "ES Writer" in response.text


def test_profile_company_drafts_pages_render() -> None:
    for path, expected in [
        ("/profile", "프로필"),
        ("/company", "기업"),
        ("/drafts", "초안 마법사"),
    ]:
        response = client.get(path)
        assert response.status_code == 200
        assert expected in response.text


def test_ui_css_served_and_not_empty() -> None:
    css = client.get("/ui/static/app.css")
    assert css.status_code == 200
    assert "text/css" in css.headers.get("content-type", "")
    assert len(css.text.strip()) > 0

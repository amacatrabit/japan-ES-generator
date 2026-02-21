from io import BytesIO

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_sources_crud_and_chunks() -> None:
    create = client.post("/v1/sources", json={"title": "제목", "raw_text": "첫줄\n\n둘째문단"})
    assert create.status_code == 201
    source_id = create.json()["id"]

    listed = client.get("/v1/sources")
    assert listed.status_code == 200
    assert any(item["id"] == source_id for item in listed.json())

    detail = client.get(f"/v1/sources/{source_id}")
    assert detail.status_code == 200
    assert detail.json()["raw_text"].startswith("첫줄")

    update = client.put(f"/v1/sources/{source_id}", json={"title": "수정", "raw_text": "변경 본문"})
    assert update.status_code == 200
    assert update.json()["title"] == "수정"

    chunks = client.post(f"/v1/sources/{source_id}/chunks")
    assert chunks.status_code == 200
    assert chunks.json()[0]["source_id"] == source_id

    remove = client.delete(f"/v1/sources/{source_id}")
    assert remove.status_code == 200


def test_upload_txt_works() -> None:
    content = "업로드 텍스트".encode("utf-8")
    res = client.post(
        "/v1/sources/upload",
        files={"file": ("memo.txt", BytesIO(content), "text/plain")},
    )
    assert res.status_code == 200
    assert res.json()["title"] == "memo.txt"


def test_profiles_crud() -> None:
    payload = {
        "name": "홍길동",
        "payload": {"episode": {"title": "인턴", "situation": "상황", "task": "과제", "action": "행동", "result": "결과", "learning": "배움"}},
    }
    create = client.post("/v1/profiles", json=payload)
    assert create.status_code == 201
    profile_id = create.json()["id"]

    listed = client.get("/v1/profiles")
    assert listed.status_code == 200
    assert any(item["id"] == profile_id for item in listed.json())

    detail = client.get(f"/v1/profiles/{profile_id}")
    assert detail.status_code == 200
    assert detail.json()["name"] == "홍길동"

    update = client.put(
        f"/v1/profiles/{profile_id}",
        json={"name": "김길동", "payload": {"episode": {"title": "수정"}}},
    )
    assert update.status_code == 200
    assert update.json()["name"] == "김길동"

    remove = client.delete(f"/v1/profiles/{profile_id}")
    assert remove.status_code == 200


def test_backup_restore_roundtrip() -> None:
    create_source = client.post("/v1/sources", json={"title": "백업소스", "raw_text": "내용"})
    create_profile = client.post("/v1/profiles", json={"name": "백업프로필", "payload": {"episode": {"title": "t"}}})
    assert create_source.status_code == 201
    assert create_profile.status_code == 201

    backup = client.get("/v1/backup")
    assert backup.status_code == 200
    body = backup.json()
    assert "sources" in body and "profiles" in body

    restore = client.post("/v1/restore", json=body)
    assert restore.status_code == 200
    assert restore.json()["ok"] is True


def test_app_js_and_sources_charset() -> None:
    html = client.get("/sources")
    assert html.status_code == 200
    assert "text/html" in html.headers.get("content-type", "")
    assert "charset=utf-8" in html.headers.get("content-type", "").lower()
    assert "소스" in html.text

    js = client.get("/ui/static/app.js")
    assert js.status_code == 200
    assert "javascript" in js.headers.get("content-type", "") or "text/plain" in js.headers.get("content-type", "")

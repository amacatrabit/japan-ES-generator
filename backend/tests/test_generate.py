from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def _base_payload() -> dict:
    return {
        "selected_chunks": [
            {
                "chunk_id": "ch1",
                "text": "売上を20%改善した実績。",
                "source_title": "intern",
                "loc_hint": "section A",
                "page_start": 1,
                "page_end": 1,
                "pinned": True,
            }
        ],
        "selected_episodes": [{"title": "アルバイト改善", "action": "導線を見直した"}],
        "company_context": {"company_name": "株式会社A", "role": "企画"},
        "question_type": "gakuchika",
        "char_limit": 200,
        "writing_rules": None,
    }


def test_generate_rejects_empty_selected_chunks() -> None:
    payload = _base_payload()
    payload["selected_chunks"] = []
    res = client.post("/v1/generate", json=payload)
    assert res.status_code == 400


def test_generate_claim_evidence_only_from_input_ids() -> None:
    res = client.post("/v1/generate", json=_base_payload())
    assert res.status_code == 200
    body = res.json()
    allowed = {"ch1"}
    for claim in body["claims"]:
        for ev in claim["evidence"]:
            assert ev["chunk_id"] in allowed


def test_blocked_claim_is_not_exportable() -> None:
    payload = _base_payload()
    payload["selected_chunks"][0]["text"] = "背景情報のみ"
    res = client.post("/v1/generate", json=payload)
    claims = res.json()["claims"]
    assert any((not c["export_allowed"]) for c in claims)

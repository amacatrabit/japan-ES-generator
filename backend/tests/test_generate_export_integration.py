from app.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_generate_minimal_response_schema() -> None:
    payload = {
        "selected_chunks": [
            {
                "chunk_id": "src:s1:chunk:1",
                "text": "実績データ 20% 改善",
                "source_title": "note-a",
                "loc_hint": "note",
                "page_start": 0,
                "page_end": 0,
                "pinned": True,
            }
        ],
        "selected_episodes": [{"title": "改善活動", "action": "施策実行"}],
        "company_context": {"company_name": "A社", "role": "企画"},
        "question_type": "gakuchika",
        "char_limit": 400,
        "writing_rules": None,
    }
    res = client.post("/v1/generate", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body.get("outline"), list)
    assert isinstance(body.get("claims"), list)
    assert isinstance(body.get("qa_findings"), list)


def test_export_strict_excludes_blocked_claims() -> None:
    payload = {
        "claims": [
            {
                "claim_id": "c1",
                "text": "根拠あり主張",
                "evidence": [{"chunk_id": "src:s1:chunk:1", "quote": "q"}],
                "confidence": 0.9,
                "assumption": False,
                "export_allowed": True,
            },
            {
                "claim_id": "c2",
                "text": "根拠なし主張",
                "evidence": [],
                "confidence": 0.2,
                "assumption": True,
                "export_allowed": False,
            },
        ],
        "char_limit": 200,
        "compression_level": 1,
    }
    res = client.post("/v1/export", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert "c1" in body["used_claim_ids"]
    assert "c2" in body["dropped_claim_ids"]

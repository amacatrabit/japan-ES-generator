from app.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_generate_minimal_schema_and_blocked_claim_behavior() -> None:
    payload = {
        "selected_chunks": [
            {
                "chunk_id": "src:s1:chunk:1",
                "text": "背景のみの記述",
                "source_title": "note-1",
                "loc_hint": "note",
                "page_start": 0,
                "page_end": 0,
                "pinned": True,
            }
        ],
        "selected_episodes": [{"title": "改善活動", "action": "仮説検証"}],
        "company_context": {"company_name": "A社", "role": "企画"},
        "question_type": "gakuchika",
        "char_limit": 400,
        "writing_rules": None,
    }

    response = client.post("/v1/generate", json=payload)
    assert response.status_code == 200
    body = response.json()

    assert isinstance(body.get("outline"), list)
    assert isinstance(body.get("claims"), list)
    assert isinstance(body.get("qa_findings"), list)

    # blocked claims must not be exportable and must produce MISSING_EVIDENCE blocker
    blocked_claim_ids = [c["claim_id"] for c in body["claims"] if not c.get("export_allowed")]
    assert blocked_claim_ids

    blocker_ids = {
        finding["claim_id"]
        for finding in body["qa_findings"]
        if finding.get("code") == "MISSING_EVIDENCE" and finding.get("level") == "blocker"
    }
    for claim_id in blocked_claim_ids:
        assert claim_id in blocker_ids

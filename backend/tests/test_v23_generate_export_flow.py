from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_generate_then_export_strict_excludes_blocked_claims() -> None:
    generate_payload = {
        "selected_chunks": [
            {
                "chunk_id": "src:s1:chunk:1",
                "text": "改善施策を実行し、チーム運用を標準化した",  # intentionally no 実績/result keyword
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

    generate_res = client.post("/v1/generate", json=generate_payload)
    assert generate_res.status_code == 200
    generated = generate_res.json()
    assert isinstance(generated.get("claims"), list)

    claims = generated["claims"]
    blocked = [c for c in claims if not c.get("export_allowed")]
    assert blocked, "at least one blocked claim should exist for strict export check"

    export_res = client.post(
        "/v1/export",
        json={"claims": claims, "char_limit": 400, "compression_level": 1},
    )
    assert export_res.status_code == 200
    exported = export_res.json()

    blocked_ids = {c["claim_id"] for c in blocked}
    used_ids = set(exported["used_claim_ids"])
    assert blocked_ids.isdisjoint(used_ids)
    assert blocked_ids.issubset(set(exported["dropped_claim_ids"]))

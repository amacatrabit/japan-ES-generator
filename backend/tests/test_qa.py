from app.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_qa_rules_each_detected() -> None:
    payload = {
        "claims": [
            {
                "claim_id": "c1",
                "text": "頑張りました。御社で学びたい。価値の最大化を進めた。",
                "evidence": [],
                "export_allowed": False,
            }
        ],
        "writing_rules": {
            "banned_phrases": ["頑張りました"],
            "abstract_suffix_patterns": ["化"],
            "passive_stance_patterns": ["御社で学びたい"],
        },
    }
    res = client.post("/v1/qa", json=payload)
    codes = {f["code"] for f in res.json()["qa_findings"]}
    assert "BANNED_PHRASE" in codes
    assert "ABSTRACT_SUFFIX" in codes
    assert "PASSIVE_STANCE" in codes
    assert "MISSING_QUANT" in codes
    assert "MISSING_EVIDENCE" in codes

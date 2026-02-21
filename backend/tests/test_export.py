from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_export_excludes_blocked_claims() -> None:
    payload = {
        "claims": [
            {"claim_id": "c1", "text": "実績を説明します。", "evidence": [{"chunk_id": "ch1", "quote": "q"}], "confidence": 0.9, "assumption": False, "export_allowed": True},
            {"claim_id": "c2", "text": "根拠なし主張。", "evidence": [], "confidence": 0.3, "assumption": True, "export_allowed": False},
        ],
        "char_limit": 100,
        "compression_level": 1,
    }
    res = client.post("/v1/export", json=payload)
    body = res.json()
    assert "c1" in body["used_claim_ids"]
    assert "c2" in body["dropped_claim_ids"]


def test_export_respects_char_limit() -> None:
    payload = {
        "claims": [
            {"claim_id": "c1", "text": "非常に長い説明文をここに記載して圧縮対象にします。", "evidence": [{"chunk_id": "ch1", "quote": "q"}], "confidence": 0.9, "assumption": False, "export_allowed": True},
            {"claim_id": "c2", "text": "さらに長い説明文を追加して文字数を超えるようにします。", "evidence": [{"chunk_id": "ch1", "quote": "q"}], "confidence": 0.8, "assumption": False, "export_allowed": True},
        ],
        "char_limit": 20,
        "compression_level": 3,
    }
    res = client.post("/v1/export", json=payload)
    assert res.json()["char_count"] <= 20

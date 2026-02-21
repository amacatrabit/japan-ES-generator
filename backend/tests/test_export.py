from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_export_excludes_blocked_claims() -> None:
    payload = {
        "claims": [
            {
                "claim_id": "c1",
                "text": "実績を説明します。",
                "evidence": [{"chunk_id": "ch1", "quote": "q"}],
                "confidence": 0.9,
                "assumption": False,
                "export_allowed": True,
            },
            {
                "claim_id": "c2",
                "text": "根拠なし主張。",
                "evidence": [],
                "confidence": 0.3,
                "assumption": True,
                "export_allowed": False,
            },
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
            {
                "claim_id": "c1",
                "text": "非常に長い説明文をここに記載して圧縮対象にします。",
                "evidence": [{"chunk_id": "ch1", "quote": "q"}],
                "confidence": 0.9,
                "assumption": False,
                "export_allowed": True,
            },
            {
                "claim_id": "c2",
                "text": "さらに長い説明文を追加して文字数を超えるようにします。",
                "evidence": [{"chunk_id": "ch1", "quote": "q"}],
                "confidence": 0.8,
                "assumption": False,
                "export_allowed": True,
            },
        ],
        "char_limit": 20,
        "compression_level": 3,
    }
    res = client.post("/v1/export", json=payload)
    assert res.json()["char_count"] <= 20


def test_export_recomputes_export_allowed_from_evidence() -> None:
    payload = {
        "claims": [
            {
                "claim_id": "c1",
                "text": "근거 있지만 클라이언트 플래그는 false",
                "evidence": [{"chunk_id": "ch1", "quote": "q"}],
                "confidence": 0.7,
                "assumption": False,
                "export_allowed": False,
            },
            {
                "claim_id": "c2",
                "text": "근거 없지만 클라이언트 플래그는 true",
                "evidence": [],
                "confidence": 0.9,
                "assumption": False,
                "export_allowed": True,
            },
        ],
        "char_limit": 100,
        "compression_level": 1,
    }
    res = client.post("/v1/export", json=payload)
    body = res.json()
    assert "c1" in body["used_claim_ids"]
    assert "c2" in body["dropped_claim_ids"]


def test_export_ranks_high_confidence_and_drops_assumptions_first() -> None:
    payload = {
        "claims": [
            {
                "claim_id": "c_low",
                "text": "낮은 신뢰도 근거",
                "evidence": [{"chunk_id": "ch1", "quote": "q"}],
                "confidence": 0.2,
                "assumption": False,
                "export_allowed": True,
            },
            {
                "claim_id": "c_high",
                "text": "높은 신뢰도 근거",
                "evidence": [{"chunk_id": "ch2", "quote": "q"}],
                "confidence": 0.9,
                "assumption": False,
                "export_allowed": True,
            },
            {
                "claim_id": "c_assume",
                "text": "가정 기반 주장",
                "evidence": [{"chunk_id": "ch3", "quote": "q"}],
                "confidence": 0.99,
                "assumption": True,
                "export_allowed": True,
            },
        ],
        "char_limit": 9,
        "compression_level": 1,
    }
    res = client.post("/v1/export", json=payload)
    body = res.json()
    assert body["used_claim_ids"] == ["c_high"]
    assert "c_assume" in body["dropped_claim_ids"]


def test_export_dropped_ids_are_based_on_normalized_claims() -> None:
    payload = {
        "claims": [
            {
                "claim_id": "c_allowed",
                "text": "근거가 있는 일반 주장",
                "evidence": [{"chunk_id": "ch1", "quote": "q"}],
                "confidence": 0.9,
                "assumption": False,
                "export_allowed": False,
            },
            {
                "claim_id": "c_no_evidence",
                "text": "근거 없음",
                "evidence": [],
                "confidence": 0.99,
                "assumption": False,
                "export_allowed": True,
            },
            {
                "claim_id": "c_overflow",
                "text": "문자수 제한 때문에 탈락해야 하는 주장",
                "evidence": [{"chunk_id": "ch2", "quote": "q"}],
                "confidence": 0.7,
                "assumption": False,
                "export_allowed": True,
            },
        ],
        "char_limit": 20,
        "compression_level": 1,
    }
    res = client.post("/v1/export", json=payload)
    body = res.json()

    assert body["used_claim_ids"] == ["c_allowed"]
    assert body["dropped_claim_ids"] == ["c_no_evidence", "c_overflow"]

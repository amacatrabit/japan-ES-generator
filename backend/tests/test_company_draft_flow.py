from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_company_crud_and_research_generation_endpoint() -> None:
    create = client.post(
        "/v1/companies",
        json={
            "company_name": "테스트기업",
            "role": "백엔드",
            "research_summary": "",
            "question_templates": ["질문1"],
        },
    )
    assert create.status_code == 201
    company_id = create.json()["id"]

    listed = client.get("/v1/companies")
    assert listed.status_code == 200
    assert any(item["id"] == company_id for item in listed.json())

    generated = client.post(f"/v1/companies/{company_id}/research/generate")
    assert generated.status_code == 200
    assert "research_summary" in generated.json()
    assert isinstance(generated.json().get("question_templates"), list)

    update = client.put(
        f"/v1/companies/{company_id}",
        json={
            "company_name": "테스트기업2",
            "role": "플랫폼",
            "research_summary": "요약",
            "question_templates": ["q1", "q2"],
        },
    )
    assert update.status_code == 200
    assert update.json()["company_name"] == "테스트기업2"

    delete = client.delete(f"/v1/companies/{company_id}")
    assert delete.status_code == 200


def test_draft_history_crud() -> None:
    create = client.post(
        "/v1/drafts/history",
        json={
            "question_type": "gakuchika",
            "char_limit": 400,
            "company_id": None,
            "draft_text": "초안 본문",
            "claims": [{"claim_id": "c1", "text": "t"}],
            "qa_findings": [{"code": "OK", "level": "warn", "message": "m"}],
        },
    )
    assert create.status_code == 201
    history_id = create.json()["id"]

    listed = client.get("/v1/drafts/history")
    assert listed.status_code == 200
    assert any(item["id"] == history_id for item in listed.json())

    detail = client.get(f"/v1/drafts/history/{history_id}")
    assert detail.status_code == 200
    assert detail.json()["draft_text"] == "초안 본문"

    delete = client.delete(f"/v1/drafts/history/{history_id}")
    assert delete.status_code == 200


def test_llm_health_endpoint_exposed() -> None:
    res = client.get("/v1/llm/health")
    assert res.status_code == 200
    body = res.json()
    assert body["provider"] == "openai"
    assert "configured" in body

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_company_research_endpoint_fallback_shape() -> None:
    res = client.post('/v1/company/research', json={'company_name': '라인야후'})
    assert res.status_code == 200
    body = res.json()
    assert body['company_name'] == '라인야후'
    assert isinstance(body.get('company_info'), str)
    assert isinstance(body.get('question_template'), str)
    assert isinstance(body.get('char_limit'), int)


def test_company_and_drafts_templates_have_required_ids() -> None:
    company = client.get('/company')
    assert company.status_code == 200
    for token in [
        'company-research-btn',
        'company-question-template',
        'company-char-limit',
        'company-detail-question-template',
        'company-detail-char-limit',
    ]:
        assert token in company.text

    drafts = client.get('/drafts')
    assert drafts.status_code == 200
    for token in ['draft-history-select', 'draft-company-select', 'draft-generate-btn', 'draft-open-export']:
        assert token in drafts.text

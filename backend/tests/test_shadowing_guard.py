from pathlib import Path


BANNED = {'fastapi','pydantic','starlette','uvicorn','jinja2','httpx','requests','typing','json','re'}


def test_no_shadowing_dirs_in_backend_root() -> None:
    root = Path(__file__).resolve().parents[1]
    found = {p.name for p in root.iterdir() if p.is_dir() and p.name in BANNED}
    assert not found, f'shadowing directories exist: {sorted(found)}'

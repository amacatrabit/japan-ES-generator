import importlib.util
from pathlib import Path

REQUIRED = ("fastapi", "jinja2")
missing = [name for name in REQUIRED if importlib.util.find_spec(name) is None]

if missing:
    base = Path(__file__).parent
    collect_ignore = [p.name for p in base.glob("test_*.py") if p.name != "test_env_smoke.py"]

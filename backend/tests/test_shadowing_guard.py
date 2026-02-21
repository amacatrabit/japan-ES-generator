from pathlib import Path


BANNED_MODULE_NAMES = {
    "fastapi",
    "pydantic",
    "jinja2",
    "starlette",
    "uvicorn",
    "httpx",
    "requests",
}


def test_no_import_shadowing_names_under_backend() -> None:
    backend_root = Path(__file__).resolve().parents[1]
    offenders: list[str] = []

    for path in backend_root.rglob("*"):
        relative = path.relative_to(backend_root)
        if ".venv" in relative.parts:
            continue

        if path.is_dir() and path.name in BANNED_MODULE_NAMES:
            offenders.append(str(relative))
            continue

        if path.is_file():
            if path.name in BANNED_MODULE_NAMES:
                offenders.append(str(relative))
                continue

            if path.suffix == ".py" and path.stem in BANNED_MODULE_NAMES:
                offenders.append(str(relative))

    assert not offenders, f"Import shadowing risk found: {sorted(offenders)}"

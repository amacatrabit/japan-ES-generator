# es-writer monorepo

Sources-first Japanese ES writing app monorepo:
- `ios/`: SwiftUI client scaffold managed by XcodeGen
- `backend/`: stateless FastAPI backend for generation / QA / export
- `shared/rules/`: shared Japanese writing constraints

## Hard constraints
- Generator must only use user-provided materials.
- Every output claim must include evidence references to selected chunks or be blocked from export.
- No invented facts. Missing evidence must create blocked claims and QA blockers.

## Backend setup (Codex/Web - online install)
```bash
cd backend
python -m pip install -U pip
python -m pip install -r requirements.txt
python -m pip install -r requirements-dev.txt
python -m pytest -q
python -m uvicorn app.main:app --reload --port 8000
```

## Backend setup (offline fallback with wheelhouse)
Use this only when a local wheelhouse is present at `backend/wheelhouse/`.
This branch does **not** include wheel artifacts by default, so prefer the online install steps above unless you prepared wheel files yourself.

If you have a local wheelhouse, run these commands at the repository root (where `README.md` is located):
```bash
cd /path/to/japan-ES-generator
python -m pip install --no-index --find-links=backend/wheelhouse -r backend/requirements.txt
python -m pip install --no-index --find-links=backend/wheelhouse -r backend/requirements-dev.txt
```
After installation, move into `backend/` only for test/run commands:
```bash
cd backend
python -m pytest -q
python -m uvicorn app.main:app --reload --port 8000
```

## Backend setup (Windows CMD)
```bat
cd backend
python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install -U pip
python -m pip install -r requirements.txt
python -m pip install -r requirements-dev.txt
python -m pytest -q
python -m uvicorn app.main:app --reload --port 8000
```

## Backend setup (Makefile helper)
```bash
cd backend
make venv && make install && make run
```

Run tests:
```bash
cd backend
make test
```

## iOS setup (XcodeGen)
```bash
brew install xcodegen
cd ios
xcodegen generate
```

Then open the generated `ESWriterApp.xcodeproj` in Xcode and run the app.


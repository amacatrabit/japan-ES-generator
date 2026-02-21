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
If network/proxy blocks package installation, use local wheels:
```bash
cd backend
python -m pip install --no-index --find-links=wheelhouse -r requirements.txt
python -m pip install --no-index --find-links=wheelhouse -r requirements-dev.txt
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

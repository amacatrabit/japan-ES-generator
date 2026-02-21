# es-writer monorepo

Sources-first Japanese ES writing app monorepo:
- `ios/`: SwiftUI client scaffold managed by XcodeGen
- `backend/`: stateless FastAPI backend for generation / QA / export
- `shared/rules/`: shared Japanese writing constraints

## Hard constraints
- Generator must only use user-provided materials.
- Every output claim must include evidence references to selected chunks or be blocked from export.
- No invented facts. Missing evidence must create blocked claims and QA blockers.

## Backend setup
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

## Web setup (Next.js)
```bash
cd web
npm install
npm run dev
```

Then open `http://localhost:3000`.

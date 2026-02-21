import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

DB_PATH = Path(__file__).resolve().parents[1] / "data" / "app.db"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sources (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                raw_text TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )


def list_sources() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, title, raw_text, created_at, updated_at FROM sources ORDER BY updated_at DESC"
        ).fetchall()
    return [dict(row) for row in rows]


def get_source(source_id: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, title, raw_text, created_at, updated_at FROM sources WHERE id = ?",
            (source_id,),
        ).fetchone()
    return dict(row) if row else None


def create_source(title: str, raw_text: str) -> dict:
    source_id = str(uuid4())
    now = _now_iso()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO sources(id, title, raw_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (source_id, title, raw_text, now, now),
        )
    return get_source(source_id)  # type: ignore[return-value]


def update_source(source_id: str, title: str, raw_text: str) -> dict | None:
    now = _now_iso()
    with _connect() as conn:
        cur = conn.execute(
            "UPDATE sources SET title = ?, raw_text = ?, updated_at = ? WHERE id = ?",
            (title, raw_text, now, source_id),
        )
        if cur.rowcount == 0:
            return None
    return get_source(source_id)


def delete_source(source_id: str) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM sources WHERE id = ?", (source_id,))
        return cur.rowcount > 0


def list_profiles() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, name, payload_json, created_at, updated_at FROM profiles ORDER BY updated_at DESC"
        ).fetchall()
    out: list[dict] = []
    for row in rows:
        item = dict(row)
        item["payload"] = json.loads(item.pop("payload_json"))
        out.append(item)
    return out


def get_profile(profile_id: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, name, payload_json, created_at, updated_at FROM profiles WHERE id = ?",
            (profile_id,),
        ).fetchone()
    if not row:
        return None
    item = dict(row)
    item["payload"] = json.loads(item.pop("payload_json"))
    return item


def create_profile(name: str, payload: dict) -> dict:
    profile_id = str(uuid4())
    now = _now_iso()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO profiles(id, name, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (profile_id, name, json.dumps(payload, ensure_ascii=False), now, now),
        )
    return get_profile(profile_id)  # type: ignore[return-value]


def update_profile(profile_id: str, name: str, payload: dict) -> dict | None:
    now = _now_iso()
    with _connect() as conn:
        cur = conn.execute(
            "UPDATE profiles SET name = ?, payload_json = ?, updated_at = ? WHERE id = ?",
            (name, json.dumps(payload, ensure_ascii=False), now, profile_id),
        )
        if cur.rowcount == 0:
            return None
    return get_profile(profile_id)


def delete_profile(profile_id: str) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
        return cur.rowcount > 0


def upsert_source(source_id: str, title: str, raw_text: str) -> None:
    now = _now_iso()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO sources(id, title, raw_text, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title=excluded.title,
              raw_text=excluded.raw_text,
              updated_at=excluded.updated_at
            """,
            (source_id, title, raw_text, now, now),
        )


def upsert_profile(profile_id: str, name: str, payload: dict) -> None:
    now = _now_iso()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO profiles(id, name, payload_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name=excluded.name,
              payload_json=excluded.payload_json,
              updated_at=excluded.updated_at
            """,
            (profile_id, name, json.dumps(payload, ensure_ascii=False), now, now),
        )

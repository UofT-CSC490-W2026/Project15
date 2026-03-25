import { Database } from "bun:sqlite"
import type { Msg, Paths, Session, ToolRecord } from "./types"

function now() {
  return Date.now()
}

export function openDb(paths: Paths) {
  const db = new Database(paths.db, { create: true })
  db.exec("PRAGMA journal_mode = WAL")
  db.exec("PRAGMA foreign_keys = ON")
  db.exec(`
    CREATE TABLE IF NOT EXISTS project (
      root TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      project_root TEXT NOT NULL,
      title TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS message (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      tool_call_id TEXT
    );
    CREATE TABLE IF NOT EXISTS tool_call (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      input TEXT NOT NULL,
      output TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)
  return db
}

export function ensureProject(db: Database, root: string) {
  db.query("INSERT OR IGNORE INTO project (root, created_at) VALUES (?, ?)").run(root, now())
}

export function loadSession(db: Database) {
  const row = db
    .query("SELECT id, project_root, title, model, created_at, updated_at FROM session ORDER BY updated_at DESC LIMIT 1")
    .get() as Session | null
  return row ?? undefined
}

export function saveSession(db: Database, session: Session) {
  db
    .query(
      "INSERT OR REPLACE INTO session (id, project_root, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(session.id, session.project_root, session.title, session.model, session.created_at, session.updated_at)
  return session
}

export function listMessages(db: Database) {
  return db
    .query("SELECT id, role, text, created_at, tool_call_id FROM message ORDER BY created_at ASC")
    .all() as Msg[]
}

export function appendMessage(db: Database, msg: Msg) {
  db
    .query("INSERT INTO message (id, role, text, created_at, tool_call_id) VALUES (?, ?, ?, ?, ?)")
    .run(msg.id, msg.role, msg.text, msg.created_at, msg.tool_call_id ?? null)
  return msg
}

export function upsertTool(db: Database, tool: ToolRecord) {
  db
    .query(
      "INSERT OR REPLACE INTO tool_call (id, name, input, output, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(tool.id, tool.name, tool.input, tool.output, tool.status, tool.created_at, tool.updated_at)
  return tool
}

export function listTools(db: Database) {
  return db
    .query("SELECT id, name, input, output, status, created_at, updated_at FROM tool_call ORDER BY created_at ASC")
    .all() as ToolRecord[]
}

export function resetSession(db: Database) {
  db.query("DELETE FROM message").run()
  db.query("DELETE FROM tool_call").run()
  db.query("DELETE FROM session").run()
}

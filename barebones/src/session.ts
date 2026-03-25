import { randomUUID } from "crypto"
import type { Database } from "bun:sqlite"
import { appendMessage, listMessages, loadSession, resetSession, saveSession, upsertTool } from "./db"
import type { Cfg, Msg, Session, ToolRecord } from "./types"

function now() {
  return Date.now()
}

export function current(db: Database, root: string, cfg: Cfg) {
  const existing = loadSession(db)
  if (existing) return existing
  const time = now()
  return saveSession(db, {
    id: randomUUID(),
    project_root: root,
    title: "Current session",
    model: cfg.model,
    created_at: time,
    updated_at: time,
  })
}

export function touch(db: Database, session: Session) {
  return saveSession(db, { ...session, updated_at: now() })
}

export function addSystem(db: Database, text: string) {
  const msg: Msg = {
    id: randomUUID(),
    role: "system",
    text,
    created_at: now(),
  }
  return appendMessage(db, msg)
}

export function addUser(db: Database, text: string) {
  const msg: Msg = {
    id: randomUUID(),
    role: "user",
    text,
    created_at: now(),
  }
  return appendMessage(db, msg)
}

export function addAssistant(db: Database, text: string) {
  const msg: Msg = {
    id: randomUUID(),
    role: "assistant",
    text,
    created_at: now(),
  }
  return appendMessage(db, msg)
}

export function addToolResult(
  db: Database,
  name: string,
  input: string,
  output: string,
  status: ToolRecord["status"],
  toolCallId?: string,
) {
  const time = now()
  const id = toolCallId || randomUUID()
  const tool: ToolRecord = {
    id,
    name,
    input,
    output,
    status,
    created_at: time,
    updated_at: time,
  }
  upsertTool(db, tool)
  appendMessage(db, {
    id: randomUUID(),
    role: "tool",
    text: output,
    created_at: time,
    tool_call_id: id,
  })
  return tool
}

export function history(db: Database) {
  return listMessages(db)
}

export function reset(db: Database, root: string, cfg: Cfg) {
  resetSession(db)
  return current(db, root, cfg)
}

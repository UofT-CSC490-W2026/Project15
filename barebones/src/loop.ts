import type { Database } from "bun:sqlite"
import { generateText, stepCountIs } from "ai"
import { addAssistant, addToolResult, addUser, history, touch } from "./session"
import type { Cfg, Paths, Session } from "./types"
import { modelId, provider } from "./bedrock"
import { tools } from "./tool/registry"

function toolChoice(text: string) {
  const value = text.toLowerCase()
  if (
    value.includes(" ls") ||
    value.startsWith("ls") ||
    value.includes("list files") ||
    value.includes("names of") ||
    value.includes("directory") ||
    value.includes("what files") ||
    value.includes("what file") ||
    value.includes("repo root")
  ) {
    return {
      type: "tool" as const,
      toolName: "ls" as const,
    }
  }
  return "auto" as const
}

function messages(db: Database) {
  const records = new Map(
    inputTools(db).map((item) => [item.id, item]),
  )
  return history(db)
    .flatMap((item) => {
      if (item.role === "user" || item.role === "assistant") {
        return [{
          role: item.role,
          content: [{ type: "text", text: item.text }],
        }]
      }
      if (item.role !== "tool") return []
      const tool = item.tool_call_id ? records.get(item.tool_call_id) : undefined
      const name = tool?.name || "tool"
      return [{
        role: "assistant" as const,
        content: [{
          type: "text" as const,
          text: `Tool ${name} output:\n${item.text}`,
        }],
      }]
    })
}

function inputTools(db: Database) {
  return db
    .query("SELECT id, name, input, output, status, created_at, updated_at FROM tool_call ORDER BY created_at ASC")
    .all() as Array<{
      id: string
      name: string
      input: string
      output: string
      status: string
      created_at: number
      updated_at: number
    }>
}

export async function runTurn(input: {
  db: Database
  paths: Paths
  cfg: Cfg
  session: Session
  system: string
  text: string
}) {
  addUser(input.db, input.text)
  const sdk = await provider(input.cfg)
  const response = await generateText({
    model: sdk.languageModel(modelId(input.cfg)),
    system: input.system,
    messages: messages(input.db),
    tools: tools(input.paths),
    toolChoice: toolChoice(input.text),
    stopWhen: stepCountIs(input.cfg.max_steps),
  })
  response.steps
    .flatMap((step) => step.toolResults)
    .forEach((item) =>
      addToolResult(
        input.db,
        item.toolName,
        JSON.stringify(item.input, null, 2),
        JSON.stringify("output" in item ? item.output : item, null, 2),
        "completed",
        item.toolCallId,
      ),
    )
  const text = response.text.trim()
  const assistant = addAssistant(input.db, text || "(no text returned)")
  const session = touch(input.db, input.session)
  return {
    assistant,
    session,
    result: response,
  }
}

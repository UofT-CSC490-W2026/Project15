import type { Msg, Session, ToolRecord } from "../types"

const reset = "\x1b[0m"
const dim = "\x1b[38;5;244m"
const faint = "\x1b[38;5;240m"
const user = "\x1b[38;5;255m"
const assistant = "\x1b[38;5;117m"
const system = "\x1b[38;5;246m"
const tool = "\x1b[38;5;221m"
const border = "\x1b[38;5;238m"
const inputBg = "\x1b[48;5;236m"
const inputFg = "\x1b[38;5;252m"

function plain(text: string) {
  return text.replace(/\x1b\[[0-9;]*m/g, "")
}

function pad(text: string, width: number) {
  const size = plain(text).length
  return size >= width ? text : text + " ".repeat(width - size)
}

function wrap(text: string, width: number) {
  if (width <= 1) return text.split(/\r?\n/)
  return text.split(/\r?\n/).flatMap((line) => {
    if (!line) return [""]
    const out: string[] = []
    let rest = line
    while (plain(rest).length > width) {
      let cut = rest.lastIndexOf(" ", width)
      if (cut <= 0) cut = width
      out.push(rest.slice(0, cut).trimEnd())
      rest = rest.slice(cut).trimStart()
    }
    out.push(rest)
    return out
  })
}

function label(role: Msg["role"]) {
  if (role === "assistant") return `${assistant}assistant${reset}`
  if (role === "user") return `${user}user${reset}`
  if (role === "tool") return `${tool}tool${reset}`
  return `${system}system${reset}`
}

function toolSummary(item?: ToolRecord) {
  if (!item) return []
  const rows = [`${tool}$ ${item.name}${reset}`]
  const input = item.input.trim()
  if (input) rows.push(...wrap(input, Math.max(20, (process.stdout.columns || 80) - 8)).map((line) => `${dim}${line}${reset}`))
  return rows
}

function messageBlock(msg: Msg, records: Map<string, ToolRecord>, width: number) {
  const head = `${label(msg.role)} ${faint}${new Date(msg.created_at).toLocaleTimeString()}${reset}`
  if (msg.role === "tool") {
    const item = msg.tool_call_id ? records.get(msg.tool_call_id) : undefined
    const body = item ? toolSummary(item) : wrap(msg.text, width - 4).map((line) => `${tool}${line}${reset}`)
    return [head, ...body, ""]
  }
  const color = msg.role === "assistant" ? assistant : msg.role === "user" ? user : system
  return [head, ...wrap(msg.text, width - 4).map((line) => `${color}${line}${reset}`), ""]
}

function thinkingBlock(width: number, spinner: string) {
  return [
    `${assistant}assistant${reset} ${faint}${new Date().toLocaleTimeString()}${reset}`,
    `${assistant}${spinner} thinking...${reset}`,
    "",
  ].map((line) => plain(line).includes("thinking") ? line : line)
}

function transcript(input: { messages: Msg[]; tools: ToolRecord[]; width: number; busy: boolean; spinner: string }) {
  const records = new Map(input.tools.map((item) => [item.id, item]))
  const rows = input.messages.flatMap((msg) => messageBlock(msg, records, input.width))
  if (input.busy) rows.push(...thinkingBlock(input.width, input.spinner))
  return rows.length ? rows : [`${dim}No messages yet.${reset}`]
}

function viewport(lines: string[], height: number, scroll: number) {
  const total = Math.max(0, lines.length - height)
  const offset = Math.min(total, Math.max(0, scroll))
  const start = Math.max(0, lines.length - height - offset)
  const end = start + height
  return {
    lines: lines.slice(start, end),
    offset,
    total,
  }
}

function inputBox(input: { draft: string; width: number }) {
  const line = input.draft || "Type your message here..."
  return [`${inputBg}${inputFg}${pad(`  ${line}`, input.width)}${reset}`]
}

export function render(input: {
  session: Session
  messages: Msg[]
  tools: ToolRecord[]
  model: string
  draft: string
  scroll: number
  busy: boolean
  spinner: string
}) {
  const width = Math.max(60, process.stdout.columns || 100)
  const height = Math.max(20, process.stdout.rows || 40)
  const transcriptRows = transcript({
    messages: input.messages,
    tools: input.tools,
    width,
    busy: input.busy,
    spinner: input.spinner,
  })
  const footer = 6
  const body = Math.max(6, height - footer)
  const view = viewport(transcriptRows, body, input.scroll)
  const status = [
    `${border}${"─".repeat(width)}${reset}`,
    pad(
      `${dim}barebones${reset} ${faint}|${reset} ${dim}${input.model}${reset}`,
      width,
    ),
    pad(`${faint}session ${input.session.id}${view.total ? ` | scroll ${view.offset}/${view.total}` : ""}${reset}`, width),
    `${border}${"─".repeat(width)}${reset}`,
  ]
  const controls = [
    `${border}${"─".repeat(width)}${reset}`,
    `${dim}Enter:${reset} send  ${dim}/reset:${reset} clear session  ${dim}Up/Down:${reset} scroll  ${dim}PgUp/PgDn:${reset} jump  ${dim}Ctrl-C:${reset} exit`,
  ]
  const panel = inputBox({ draft: input.draft, width })
  const rows = [...status, ...view.lines]
  while (rows.length < 4 + body) rows.push("")
  return [...rows.slice(0, 4 + body), ...controls, ...panel].join("\n")
}

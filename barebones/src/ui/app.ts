import type { Database } from "bun:sqlite"
import { listTools } from "../db"
import { runTurn } from "../loop"
import { addAssistant, history, reset } from "../session"
import type { Cfg, Paths, Session } from "../types"
import { render } from "./render"

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

function write(text: string) {
  process.stdout.write("\x1b[?1049h\x1b[?25l\x1b[H\x1b[2J")
  process.stdout.write(text)
}

function restore() {
  process.stdout.write("\x1b[?25h\x1b[?1049l")
}

function editable(input: string, chunk: string) {
  return [...chunk].every((char) => char >= " " && char !== "\x7f" && char !== "\r" && char !== "\n") ? input + chunk : input
}

export async function app(input: {
  db: Database
  paths: Paths
  cfg: Cfg
  session: Session
  system: string
}) {
  let session = input.session
  let draft = ""
  let scroll = 0
  let busy = false
  let frame = 0
  let done = false

  const redraw = () =>
    write(
      render({
        session,
        messages: history(input.db),
        tools: listTools(input.db),
        model: input.cfg.model,
        draft,
        scroll,
        busy,
        spinner: frames[frame],
      }),
    )

  const send = async () => {
    const text = draft.trim()
    if (!text || busy) return
    if (text === "/exit") {
      done = true
      return
    }
    if (text === "/reset") {
      session = reset(input.db, input.paths.root, input.cfg)
      draft = ""
      scroll = 0
      redraw()
      return
    }
    draft = ""
    scroll = 0
    busy = true
    redraw()
    try {
      const result = await runTurn({
        db: input.db,
        paths: input.paths,
        cfg: input.cfg,
        session,
        system: input.system,
        text,
      })
      session = result.session
    } catch (error) {
      addAssistant(input.db, error instanceof Error ? error.message : String(error))
    } finally {
      busy = false
      redraw()
    }
  }

  const onData = (raw: Buffer) => {
    const data = raw.toString("utf8")
    if (data === "\u0003") {
      done = true
      redraw()
      return
    }
    if (data === "\u001b[A") {
      scroll += 1
      redraw()
      return
    }
    if (data === "\u001b[B") {
      scroll = Math.max(0, scroll - 1)
      redraw()
      return
    }
    if (data === "\u001b[5~") {
      scroll += 10
      redraw()
      return
    }
    if (data === "\u001b[6~") {
      scroll = Math.max(0, scroll - 10)
      redraw()
      return
    }
    if (data === "\u007f") {
      draft = draft.slice(0, -1)
      redraw()
      return
    }
    if (data === "\r") {
      void send()
      return
    }
    const next = editable(draft, data)
    if (next === draft) return
    draft = next
    redraw()
  }

  const spin = setInterval(() => {
    if (!busy) return
    frame = (frame + 1) % frames.length
    redraw()
  }, 90)

  try {
    process.stdin.setRawMode?.(true)
    process.stdin.resume()
    process.stdin.on("data", onData)
    redraw()
    await new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        if (!done) return
        clearInterval(timer)
        resolve()
      }, 50)
    })
  } finally {
    clearInterval(spin)
    process.stdin.off("data", onData)
    process.stdin.setRawMode?.(false)
    process.stdin.pause()
    restore()
  }
}

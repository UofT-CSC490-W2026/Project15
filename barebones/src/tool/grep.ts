import { resolve, trim, type Def } from "./tool"

export const grepTool: Def = {
  description: "Search project files for a text pattern using ripgrep when available.",
  inputSchema: {
    type: "object",
    properties: {
      pattern: { type: "string" },
      path: { type: "string" },
    },
    required: ["pattern"],
  },
  async execute(input, ctx) {
    const cwd = resolve(ctx.paths.root, String(input.path || "."))
    const proc = Bun.spawn(["rg", "-n", String(input.pattern), cwd], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    await proc.exited
    const out = [stdout, stderr].filter(Boolean).join("\n").trim()
    return trim(out || "No matches")
  },
}

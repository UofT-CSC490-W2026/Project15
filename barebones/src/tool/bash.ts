import { trim, type Def } from "./tool"

export const bashTool: Def = {
  description: "Run a shell command in the current project.",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string" },
    },
    required: ["command"],
  },
  async execute(input, ctx) {
    const proc = Bun.spawn(["/bin/zsh", "-lc", String(input.command)], {
      cwd: ctx.paths.root,
      stdout: "pipe",
      stderr: "pipe",
    })
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const code = await proc.exited
    return trim([stdout.trim(), stderr.trim(), `exit_code=${code}`].filter(Boolean).join("\n"))
  },
}

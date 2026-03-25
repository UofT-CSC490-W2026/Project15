import fs from "fs/promises"
import { resolve, type Def } from "./tool"

export const lsTool: Def = {
  description: "List a directory inside the current project.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string" },
    },
  },
  async execute(input, ctx) {
    const dir = resolve(ctx.paths.root, String(input.path || "."))
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries
      .map((entry) => (entry.isDirectory() ? entry.name + "/" : entry.name))
      .sort((a, b) => a.localeCompare(b))
      .join("\n")
  },
}

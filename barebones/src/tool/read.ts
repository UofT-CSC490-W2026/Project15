import fs from "fs/promises"
import { resolve, trim, type Def } from "./tool"

export const readTool: Def = {
  description: "Read a file from the current project.",
  inputSchema: {
    type: "object",
    properties: {
      filePath: { type: "string" },
    },
    required: ["filePath"],
  },
  async execute(input, ctx) {
    const file = resolve(ctx.paths.root, String(input.filePath))
    const text = await fs.readFile(file, "utf8")
    return trim(text)
  },
}

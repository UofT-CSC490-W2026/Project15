import fs from "fs/promises"
import path from "path"
import { onWrite } from "./dafny/impact"
import { resolve, trim, type Def } from "./tool"

export const writeTool: Def = {
  description: "Write full file contents to a path in the current project.",
  inputSchema: {
    type: "object",
    properties: {
      filePath: { type: "string" },
      content: { type: "string" },
    },
    required: ["filePath", "content"],
  },
  async execute(input, ctx) {
    const file = resolve(ctx.paths.root, String(input.filePath))
    await fs.mkdir(path.dirname(file), { recursive: true })
    await Bun.write(file, String(input.content))
    const impact = await onWrite(ctx.paths, file).catch(() => undefined)
    return trim(["Wrote file successfully.", impact?.summary].filter(Boolean).join("\n\n"))
  },
}

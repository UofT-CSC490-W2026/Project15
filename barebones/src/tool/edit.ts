import fs from "fs/promises"
import { onWrite } from "./dafny/impact"
import { resolve, trim, type Def } from "./tool"

export const editTool: Def = {
  description: "Replace text in an existing file.",
  inputSchema: {
    type: "object",
    properties: {
      filePath: { type: "string" },
      oldString: { type: "string" },
      newString: { type: "string" },
      replaceAll: { type: "boolean" },
    },
    required: ["filePath", "oldString", "newString"],
  },
  async execute(input, ctx) {
    const file = resolve(ctx.paths.root, String(input.filePath))
    const text = await fs.readFile(file, "utf8")
    const oldString = String(input.oldString)
    const newString = String(input.newString)
    if (oldString === newString) throw new Error("oldString and newString are identical")
    if (!text.includes(oldString)) throw new Error("oldString not found in file")
    const next = input.replaceAll ? text.split(oldString).join(newString) : text.replace(oldString, newString)
    await Bun.write(file, next)
    const impact = await onWrite(ctx.paths, file).catch(() => undefined)
    return trim(["Edit applied successfully.", impact?.summary].filter(Boolean).join("\n\n"))
  },
}

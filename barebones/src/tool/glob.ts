import path from "path"
import { resolve, type Def } from "./tool"

export const globTool: Def = {
  description: "Find files in the project matching a glob pattern.",
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
    const glob = new Bun.Glob(String(input.pattern))
    const result = await Array.fromAsync(glob.scan({ cwd, absolute: true }))
    return result.map((item) => path.relative(ctx.paths.root, item)).join("\n")
  },
}

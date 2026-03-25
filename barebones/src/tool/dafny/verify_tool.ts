import type { Def } from "../tool"
import { verify } from "./verify"

export const dafnyVerifyTool: Def = {
  description: "Run Dafny verification for all or selected files.",
  inputSchema: {
    type: "object",
    properties: {
      targets: {
        type: "array",
        items: { type: "string" },
      },
      full: { type: "boolean" },
    },
  },
  async execute(input, ctx) {
    return verify(ctx.paths, {
      targets: Array.isArray(input.targets) ? input.targets.map(String) : undefined,
      full: Boolean(input.full),
    })
  },
}

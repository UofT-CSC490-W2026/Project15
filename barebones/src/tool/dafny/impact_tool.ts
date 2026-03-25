import type { Def } from "../tool"
import { ensure } from "./state"

export const dafnyImpactTool: Def = {
  description: "Show current Dafny status flags for tracked files.",
  inputSchema: {
    type: "object",
    properties: {},
  },
  async execute(_input, ctx) {
    const store = await ensure(ctx.paths)
    return store.graph.nodes
      .map((file) => `${file}: ${(store.state.statuses[file]?.flags ?? []).join(", ") || "UNSEEN"}`)
      .join("\n")
  },
}

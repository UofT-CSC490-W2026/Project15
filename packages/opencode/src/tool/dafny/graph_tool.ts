import z from "zod"
import { Tool } from "../tool"
import { ensure } from "./state"

export const DafnyGraphTool = Tool.define("dafny_graph", {
  description: "Build or refresh the Dafny dependency graph.",
  parameters: z.object({
    root: z.string().optional().describe("Optional root directory (unused; uses current worktree)."),
  }),
  async execute(_params) {
    const store = await ensure({ mode: "full" })
    return {
      title: "dafny graph",
      metadata: {
        files: store.graph.nodes.length,
      },
      output: JSON.stringify(store.graph, null, 2),
    }
  },
})

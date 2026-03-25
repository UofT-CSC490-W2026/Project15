import type { Def } from "../tool"
import { buildGraph } from "./graph"
import { writeGraph } from "./state"

export const dafnyGraphTool: Def = {
  description: "Build or refresh the Dafny dependency graph.",
  inputSchema: {
    type: "object",
    properties: {},
  },
  async execute(_input, ctx) {
    const graph = await buildGraph(ctx.paths.root)
    await writeGraph(ctx.paths, graph)
    const edgeCount = Object.values(graph.edges).reduce((sum, item) => sum + item.length, 0)
    const unresolved = Object.values(graph.unresolved).reduce((sum, item) => sum + item.length, 0)
    return [`Files: ${graph.nodes.length}`, `Edges: ${edgeCount}`, `Unresolved: ${unresolved}`].join("\n")
  },
}

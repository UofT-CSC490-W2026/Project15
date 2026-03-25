import { jsonSchema, tool } from "ai"
import { bashTool } from "./bash"
import { editTool } from "./edit"
import { globTool } from "./glob"
import { grepTool } from "./grep"
import { lsTool } from "./ls"
import { readTool } from "./read"
import { writeTool } from "./write"
import { dafnyGraphTool } from "./dafny/graph_tool"
import { dafnyImpactTool } from "./dafny/impact_tool"
import { dafnyVerifyTool } from "./dafny/verify_tool"
import type { Paths } from "../types"

const defs = {
  read: readTool,
  write: writeTool,
  edit: editTool,
  ls: lsTool,
  grep: grepTool,
  glob: globTool,
  bash: bashTool,
  dafny_graph: dafnyGraphTool,
  dafny_impact: dafnyImpactTool,
  dafny_verify: dafnyVerifyTool,
}

export function tools(paths: Paths) {
  return Object.fromEntries(
    Object.entries(defs).map(([id, def]) => [
      id,
      tool({
        description: def.description,
        inputSchema: jsonSchema(def.inputSchema),
        execute: async (input) => def.execute(input, { paths }),
      }),
    ]),
  )
}

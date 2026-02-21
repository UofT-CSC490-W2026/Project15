import z from "zod"
import path from "path"
import { Tool } from "../tool"
import { Instance } from "@/project/instance"
import { onWrite } from "./impact"

export const DafnyImpactTool = Tool.define("dafny_impact", {
  description: "Update Dafny impact after a file change.",
  parameters: z.object({
    filePath: z.string().describe("Absolute or relative path to the edited Dafny file."),
  }),
  async execute(params) {
    const file = path.isAbsolute(params.filePath)
      ? params.filePath
      : path.join(Instance.worktree, params.filePath)
    const impact = await onWrite(file)
    if (!impact) {
      return {
        title: "impact",
        metadata: { edited: params.filePath },
        output: "Impact: no changes applied.",
      }
    }
    return {
      title: "impact",
      metadata: impact,
      output: impact.summary,
    }
  },
})

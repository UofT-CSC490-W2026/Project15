import path from "path"
import type { Cfg } from "./types"

const defaults: Cfg = {
  model: "",
  region: process.env.AWS_REGION || "us-east-1",
  profile: process.env.AWS_PROFILE || undefined,
  endpoint: undefined,
  max_steps: 20,
  dafny_command: "dafny",
}

function merge(input: unknown): Cfg {
  if (!input || typeof input !== "object") return defaults
  const obj = input as Record<string, unknown>
  return {
    model: typeof obj.model === "string" ? obj.model : defaults.model,
    region: typeof obj.region === "string" ? obj.region : defaults.region,
    profile: typeof obj.profile === "string" ? obj.profile : defaults.profile,
    endpoint: typeof obj.endpoint === "string" ? obj.endpoint : defaults.endpoint,
    max_steps:
      typeof obj.max_steps === "number" && Number.isInteger(obj.max_steps) && obj.max_steps > 0
        ? obj.max_steps
        : defaults.max_steps,
    dafny_command: typeof obj.dafny_command === "string" ? obj.dafny_command : defaults.dafny_command,
  }
}

export async function loadConfig(root: string) {
  const file = path.join(root, ".barebones", "config.json")
  const json = await Bun.file(file)
    .json()
    .catch(() => undefined)
  return merge(json)
}

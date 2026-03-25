import path from "path"
import type { Paths } from "../types"

export type Ctx = {
  paths: Paths
}

export type Def = {
  description: string
  inputSchema: Record<string, unknown>
  execute(input: any, ctx: Ctx): Promise<string>
}

export function resolve(root: string, input: string) {
  const value = path.isAbsolute(input) ? path.normalize(input) : path.resolve(root, input)
  const rel = path.relative(root, value)
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`Path is outside project root: ${input}`)
  return value
}

export function trim(text: string, limit = 12000) {
  if (text.length <= limit) return text
  return text.slice(0, limit) + "\n... [truncated]"
}

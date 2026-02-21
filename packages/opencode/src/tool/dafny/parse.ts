import path from "path"
import { Instance } from "@/project/instance"
import { Filesystem } from "@/util/filesystem"

export type Diagnostic = {
  file: string
  line?: number
  column?: number
  message: string
}

const diag = /^(.*\.dfy)\((\d+),(\d+)\):\s*(.*)$/

function normalizeFile(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (path.isAbsolute(trimmed)) {
    if (!Filesystem.contains(Instance.worktree, trimmed)) return trimmed
    return path.relative(Instance.worktree, trimmed)
  }
  return path.normalize(trimmed)
}

export function parseOutput(text: string) {
  const diagnostics: Diagnostic[] = []
  const lines = text.split(/\r?\n/).filter(Boolean)
  for (const line of lines) {
    const match = diag.exec(line)
    if (!match) continue
    const file = normalizeFile(match[1])
    if (!file) continue
    diagnostics.push({
      file,
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      message: match[4].trim(),
    })
  }
  return diagnostics
}

export type RawRun = {
  run_id: string
  timestamp: string | number
  repo: {
    id?: string
    hash?: string
  }
  prompt: {
    text: string
    model: string
    params?: Record<string, unknown>
  }
  steps: RawStep[]
  dafny: {
    stdout: string
    stderr: string
  }
  graph: {
    nodes: { id: string; status?: string }[]
    edges: { from: string; to: string }[]
  }
  metrics?: {
    duration_ms?: number
    cpu_ms?: number
    mem_mb?: number
  }
}

export type RawStep = {
  step_id: number
  timestamp: string | number
  action?: string
  command?: string
  diff_ref?: string
  stdout_ref?: string
  stderr_ref?: string
  verification_status?: string
}

export type RunRow = {
  run_id: string
  timestamp: string
  repo_id: string | null
  repo_hash: string | null
  prompt: string
  model: string
  model_params: Record<string, unknown>
  status: string
  duration_ms: number | null
  cpu_ms: number | null
  mem_mb: number | null
  repair_success: boolean | null
  regression: boolean | null
  taint_spread: number
}

export type RunStepRow = {
  run_id: string
  step_id: number
  timestamp: string
  action: string | null
  command: string | null
  diff_ref: string | null
  stdout_ref: string | null
  stderr_ref: string | null
}

export type VerificationRow = {
  run_id: string
  module: string
  status: string
  time_ms: number | null
}

export type ErrorRow = {
  run_id: string
  file: string | null
  line: number | null
  error_kind: string | null
  message_hash: string
  raw_message: string
}

export type GraphSnapshotRow = {
  run_id: string
  snapshot_ts: string
  nodes: { id: string; status?: string }[]
  edges: { from: string; to: string }[]
  dirty_count: number
  tainted_count: number
}

export function normalizeTimestamp(value: string | number): string {
  const date = typeof value === "number" ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  return date.toISOString()
}

export function normalizeStatus(stdout: string, stderr: string): string {
  const text = `${stdout}\n${stderr}`.toLowerCase()
  if (text.includes("timeout")) return "timeout"
  if (text.includes("syntax error") || text.includes("parse error")) return "syntax_error"
  if (text.includes("verified") || text.includes("0 errors")) return "pass"
  if (text.includes("error") || text.includes("failed")) return "fail"
  return "unknown"
}

export function parseDafnyErrors(
  stderr: string,
): { file: string | null; line: number | null; error_kind: string | null; raw_message: string }[] {
  const lines = stderr.split(/\r?\n/).filter(Boolean)
  return lines.map((line) => {
    const fileMatch = /(.+)\((\d+),(\d+)\)/.exec(line)
    const kindMatch = /(postcondition|invariant|decreases|assertion|precondition)/i.exec(line)
    return {
      file: fileMatch ? fileMatch[1] : null,
      line: fileMatch ? Number(fileMatch[2]) : null,
      error_kind: kindMatch ? kindMatch[1].toLowerCase() : null,
      raw_message: line,
    }
  })
}

export function messageHash(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

export function toRunRows(raw: RawRun): {
  run: RunRow
  steps: RunStepRow[]
  verification: VerificationRow[]
  errors: ErrorRow[]
  graph: GraphSnapshotRow[]
} {
  const status = normalizeStatus(raw.dafny.stdout, raw.dafny.stderr)
  const timestamp = normalizeTimestamp(raw.timestamp)
  const steps = raw.steps.map((step) => ({
    run_id: raw.run_id,
    step_id: step.step_id,
    timestamp: normalizeTimestamp(step.timestamp),
    action: step.action ?? null,
    command: step.command ?? null,
    diff_ref: step.diff_ref ?? null,
    stdout_ref: step.stdout_ref ?? null,
    stderr_ref: step.stderr_ref ?? null,
  }))

  const errors = parseDafnyErrors(raw.dafny.stderr).map((err) => ({
    run_id: raw.run_id,
    file: err.file,
    line: err.line,
    error_kind: err.error_kind,
    message_hash: messageHash(err.raw_message),
    raw_message: err.raw_message,
  }))

  const tainted = raw.graph.nodes.filter((n) => n.status === "TAINTED").length
  const dirty = raw.graph.nodes.filter((n) => n.status === "DIRTY").length

  const run = {
    run_id: raw.run_id,
    timestamp,
    repo_id: raw.repo.id ?? null,
    repo_hash: raw.repo.hash ?? null,
    prompt: raw.prompt.text,
    model: raw.prompt.model,
    model_params: raw.prompt.params ?? {},
    status,
    duration_ms: raw.metrics?.duration_ms ?? null,
    cpu_ms: raw.metrics?.cpu_ms ?? null,
    mem_mb: raw.metrics?.mem_mb ?? null,
    repair_success: null,
    regression: null,
    taint_spread: tainted + dirty,
  }

  const verification = raw.steps
    .filter((step) => step.verification_status)
    .map((step) => ({
      run_id: raw.run_id,
      module: `module_${step.step_id}`,
      status: String(step.verification_status),
      time_ms: null,
    }))

  const graph = [
    {
      run_id: raw.run_id,
      snapshot_ts: timestamp,
      nodes: raw.graph.nodes,
      edges: raw.graph.edges,
      dirty_count: dirty,
      tainted_count: tainted,
    },
  ]

  return { run, steps, verification, errors, graph }
}

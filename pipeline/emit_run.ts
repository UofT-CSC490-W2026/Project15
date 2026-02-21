import { mkdirSync } from "fs"
import path from "path"
import { RawRun } from "./schemas"

function arg(name: string) {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx === -1) return
  return process.argv[idx + 1]
}

const out = arg("out") ?? "./out/run.jsonl"
const id = `run_${Date.now()}`
const time = new Date().toISOString()

const run: RawRun = {
  run_id: id,
  timestamp: time,
  repo: {
    id: process.env["REPO_ID"] ?? "opencode",
    hash: process.env["REPO_HASH"] ?? undefined,
  },
  prompt: {
    text: process.env["PROMPT"] ?? "Verify modules and repair failing proofs",
    model: process.env["MODEL"] ?? "gpt-4o-mini",
    params: {
      temperature: 0.2,
      max_tokens: 2048,
    },
  },
  steps: [
    {
      step_id: 1,
      timestamp: time,
      action: "verify",
      command: "dafny /compile:0 /timeLimit:10 src/Module1.dfy",
      stdout_ref: "artifacts/run_stdout_1.log",
      stderr_ref: "artifacts/run_stderr_1.log",
      verification_status: "fail",
    },
    {
      step_id: 2,
      timestamp: time,
      action: "edit",
      diff_ref: "artifacts/diff_2.patch",
    },
    {
      step_id: 3,
      timestamp: time,
      action: "verify",
      command: "dafny /compile:0 /timeLimit:10 src/Module1.dfy",
      stdout_ref: "artifacts/run_stdout_3.log",
      stderr_ref: "artifacts/run_stderr_3.log",
      verification_status: "pass",
    },
  ],
  dafny: {
    stdout: "Dafny program verifier finished with 0 errors",
    stderr: "src/Module1.dfy(42,7): Error: postcondition might not hold",
  },
  graph: {
    nodes: [
      { id: "Module1", status: "TAINTED" },
      { id: "Module2", status: "CLEAN" },
      { id: "Module3", status: "DIRTY" },
    ],
    edges: [
      { from: "Module1", to: "Module2" },
      { from: "Module2", to: "Module3" },
    ],
  },
  metrics: {
    duration_ms: 120000,
    cpu_ms: 45000,
    mem_mb: 512,
  },
}

const dir = path.dirname(out)
mkdirSync(dir, { recursive: true })

await Bun.write(out, `${JSON.stringify(run)}\n`)
console.log(`wrote ${out}`)

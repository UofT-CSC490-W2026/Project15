import type { Paths } from "../../types"
import { parseOutput } from "./parse"
import { ensure, save } from "./state"

export async function verify(paths: Paths, input: { targets?: string[]; full?: boolean; dafny_command?: string }) {
  const store = await ensure(paths)
  const all = store.graph.nodes
  const targets =
    input.targets && input.targets.length > 0
      ? input.targets
      : input.full
        ? all
        : all.filter((file) => {
            const flags = store.state.statuses[file]?.flags ?? []
            return flags.includes("DIRTY") || flags.includes("TAINTED") || flags.includes("STALE") || flags.length === 0
          })

  if (targets.length === 0) return "No changed .dfy files found to verify."

  const proc = Bun.spawn([input.dafny_command || "dafny", "verify", ...targets], {
    cwd: paths.root,
    stdout: "pipe",
    stderr: "pipe",
  })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const code = await proc.exited
  const output = [stdout, stderr].filter(Boolean).join("\n").trim()
  const diagnostics = parseOutput(output)
  const failed = new Set(diagnostics.map((item) => item.file))
  if (code !== 0 && failed.size === 0) targets.forEach((item) => failed.add(item))
  const passed = targets.filter((item) => !failed.has(item))
  for (const file of targets) {
    const flags = new Set(store.state.statuses[file]?.flags ?? [])
    flags.delete("DIRTY")
    flags.delete("TAINTED")
    flags.delete("STALE")
    flags.delete("VERIFIED")
    flags.delete("FAILED")
    flags.add(failed.has(file) ? "FAILED" : "VERIFIED")
    store.state.statuses[file] = { flags: Array.from(flags).sort() }
  }
  store.state.last_verify = {
    time: Date.now(),
    targets,
    passed,
    failed: Array.from(failed),
  }
  await save(paths, store)
  return [
    `Targets: ${targets.length}`,
    `Passed: ${passed.length}`,
    `Failed: ${failed.size}`,
    failed.size > 0 ? `Status: failed` : `Status: ok`,
    output,
  ]
    .filter(Boolean)
    .join("\n")
}

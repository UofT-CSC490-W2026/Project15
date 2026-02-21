import z from "zod"
import path from "path"
import { Tool } from "../tool"
import { Instance } from "@/project/instance"
import { ensure, save } from "./state"
import { parseOutput } from "./parse"
import { Filesystem } from "@/util/filesystem"

function getFilesToVerify(
  store: { state: { statuses: Record<string, { flags: string[] }> }; graph: { nodes: string[] } },
  options: { targets?: string[]; full?: boolean },
): string[] {
  const all = store.graph.nodes

  // If specific targets provided, verify those
  if (options.targets && options.targets.length > 0) {
    return options.targets.filter((file) => all.includes(file))
  }

  // If full verify requested, verify everything
  if (options.full) {
    return all
  }

  // Otherwise, incremental: verify only STALE, DIRTY, or TAINTED files
  return all.filter((file) => {
    const status = store.state.statuses[file]
    if (!status) return true // No status = needs verification
    const flags = status.flags
    return flags.includes("STALE") || flags.includes("DIRTY") || flags.includes("TAINTED")
  })
}

export const DafnyVerifyTool = Tool.define("dafny_verify", {
  description:
    "Run Dafny verification and update cached status. By default, only verifies changed files (incremental). Use full=true to verify all files.",
  parameters: z.object({
    targets: z.array(z.string()).optional().describe("Optional list of specific Dafny files to verify."),
    full: z
      .boolean()
      .optional()
      .describe("If true, verify all files. If false or omitted, only verify changed files (incremental)."),
    timeoutSeconds: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Optional timeout (in seconds) for the verification process."),
  }),
  async execute(params, ctx) {
    const store = await ensure({ mode: "full" })

    // Normalize targets if provided
    const normalizedTargets = (params.targets ?? [])
      .map((value) => {
        const withExt = value.endsWith(".dfy") ? value : value + ".dfy"
        if (path.isAbsolute(withExt)) {
          if (!Filesystem.contains(Instance.worktree, withExt)) return undefined
          return path.relative(Instance.worktree, withExt)
        }
        return path.normalize(withExt)
      })
      .filter((value): value is string => Boolean(value))

    // Determine which files to verify
    const list = getFilesToVerify(store, {
      targets: normalizedTargets,
      full: params.full,
    })

    if (list.length === 0) {
      const hasFiles = store.graph.nodes.length > 0
      const output = hasFiles
        ? "No changed .dfy files found to verify. Use full=true to verify all files."
        : "No .dfy files found to verify."
      return {
        title: "dafny verify",
        metadata: {
          files: 0,
          targets: [],
          passed: [],
          failed: [],
        },
        output,
      }
    }

    const command = ["dafny", "verify", ...list]
    await ctx.ask({
      permission: "bash",
      patterns: [command.join(" "), "dafny --version"],
      always: ["dafny verify *", "dafny --version"],
      metadata: {
        command,
      },
    })

    store.state.verifying = {
      time: Date.now(),
      targets: list,
      full: Boolean(params.full),
    }
    await save(store)

    try {
      const proc = Bun.spawn(command, {
        cwd: Instance.worktree,
        stdout: "pipe",
        stderr: "pipe",
        signal: ctx.abort,
      })

      const timeoutMs = (params.timeoutSeconds ?? 120) * 1000
      const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), timeoutMs))
      const exited = proc.exited.then(() => "exit" as const)

      const outcome = await Promise.race([timeout, exited])
      if (outcome === "timeout") {
        proc.kill()
        store.state.verifying = undefined
        await save(store)
        return {
          title: "dafny verify",
          metadata: {
            files: list.length,
            targets: list,
            passed: [],
            failed: [],
            timeoutSeconds: params.timeoutSeconds ?? 120,
          },
          output: [
            `Verification timed out after ${params.timeoutSeconds ?? 120}s.`,
            `Status: timeout`,
            `Files: ${list.join(", ") || "-"}`,
            "Suggested next steps:",
            "- Re-run with smaller scope (pass targets or edit fewer files).",
            "- Increase Dafny's per-assertion limit with --verification-time-limit.",
            "- Split large methods/lemmas or add intermediate asserts to guide the prover.",
          ].join("\n"),
        }
      }

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      const output = [stdout, stderr].filter((value) => value.trim()).join("\n")
      const diagnostics = parseOutput(output)
      const failed = new Set(diagnostics.map((item) => item.file))

      if (exitCode !== 0 && failed.size === 0) {
        list.forEach((file) => failed.add(file))
      }

      const passed = list.filter((file) => !failed.has(file))

      list.forEach((file) => {
        const entry = store.state.statuses[file] ?? { flags: [] }
        const flags = new Set(entry.flags)
        flags.delete("STALE")
        if (failed.has(file)) {
          flags.add("FAILED")
          flags.delete("VERIFIED")
        }
        if (!failed.has(file)) {
          flags.add("VERIFIED")
          flags.delete("FAILED")
          flags.delete("DIRTY")
          flags.delete("TAINTED")
        }
        const unresolved = store.graph.unresolved[file]
        if (unresolved && unresolved.length > 0) flags.add("UNKNOWN")
        if (!unresolved || unresolved.length === 0) flags.delete("UNKNOWN")
        store.state.statuses[file] = { flags: Array.from(flags.values()).sort() }
      })

      const ver = Bun.spawn(["dafny", "--version"], {
        cwd: Instance.worktree,
        stdout: "pipe",
        stderr: "pipe",
        signal: ctx.abort,
      })

      const verText = await new Response(ver.stdout).text()
      await ver.exited
      const verLine = verText.trim().split(/\r?\n/)[0]
      if (verLine) {
        if (!store.state.dafny) store.state.dafny = {}
        store.state.dafny.version = verLine
      }

      store.state.lastVerify = {
        time: Date.now(),
        targets: list,
        passed,
        failed: Array.from(failed.values()),
        command: command.join(" "),
      }

      store.state.verifying = undefined
      await save(store)

      const firstFailure = diagnostics[0]
      const failureLine = firstFailure
        ? `${firstFailure.file}${firstFailure.line ? `:${firstFailure.line}:${firstFailure.column ?? 0}` : ""} ${firstFailure.message}`
        : ""
      const summary = [
        `Targets: ${list.length}`,
        `Files: ${list.join(", ") || "-"}`,
        `Passed: ${passed.length}`,
        `Failed: ${failed.size}`,
        `Status: ${failed.size > 0 ? "failed" : "ok"}`,
        ...(failureLine ? [`First failure: ${failureLine}`] : []),
      ]
      const details = diagnostics.map((item) => {
        const location = item.line ? `:${item.line}:${item.column ?? 0}` : ""
        return `${item.file}${location} ${item.message}`
      })

      return {
        title: "dafny verify",
        metadata: {
          files: list.length,
          targets: list,
          passed,
          failed: Array.from(failed.values()),
        },
        output: summary.concat(details).join("\n"),
      }
    } finally {
      if (store.state.verifying) {
        store.state.verifying = undefined
        await save(store)
      }
    }
  },
})

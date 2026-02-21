import path from "path"
import { Instance } from "@/project/instance"
import { Filesystem } from "@/util/filesystem"
import type { Flag, Store } from "./state"
import { ensure, save, updateHash } from "./state"
import { updateGraph } from "./graph"

export type Impact = {
  edited: string
  tainted: string[]
  unknown: string[]
  stale: string[]
  summary: string
}

function flagsFor(state: Store["state"], file: string) {
  const entry = state.statuses[file]
  if (!entry) return new Set<Flag>()
  return new Set(entry.flags)
}

function setFlags(state: Store["state"], file: string, flags: Set<Flag>) {
  state.statuses[file] = {
    flags: Array.from(flags.values()).sort(),
  }
}

// OPTIMIZATION: Use pre-computed reverse edges from graph
function getReverseDeps(graph: Store["graph"]): Map<string, string[]> {
  // Convert from Record to Map for the existing BFS algorithm
  const reverse = new Map<string, string[]>()
  for (const [dep, sources] of Object.entries(graph.reverse)) {
    reverse.set(dep, sources)
  }
  return reverse
}

function list(value: string[]) {
  if (value.length === 0) return "[]"
  return `[${value.join(", ")}]`
}

function applyImpact(store: Store, edited: string) {
  const reverse = getReverseDeps(store.graph)
  const queue = [edited]
  const tainted = new Set<string>()

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index]
    const next = reverse.get(current) ?? []
    for (const item of next) {
      if (tainted.has(item)) continue
      tainted.add(item)
      queue.push(item)
    }
  }

  const editedFlags = flagsFor(store.state, edited)
  editedFlags.add("DIRTY")
  editedFlags.add("STALE")
  editedFlags.delete("VERIFIED")
  editedFlags.delete("FAILED")
  editedFlags.delete("TAINTED")

  const hasUnknown = (store.graph.unresolved[edited] ?? []).length > 0
  if (hasUnknown) editedFlags.add("UNKNOWN")
  if (!hasUnknown) editedFlags.delete("UNKNOWN")
  setFlags(store.state, edited, editedFlags)

  const taintedList = Array.from(tainted.values()).toSorted()
  for (const file of taintedList) {
    const flags = flagsFor(store.state, file)
    flags.add("TAINTED")
    flags.add("STALE")
    flags.delete("VERIFIED")
    flags.delete("FAILED")
    flags.delete("DIRTY")
    if (hasUnknown) flags.add("UNKNOWN")
    setFlags(store.state, file, flags)
  }

  const stale = Object.entries(store.state.statuses)
    .filter(([, value]) => value.flags.includes("STALE"))
    .map(([file]) => file)
    .toSorted()

  const unknown = Object.entries(store.state.statuses)
    .filter(([, value]) => value.flags.includes("UNKNOWN"))
    .map(([file]) => file)
    .toSorted()

  const summary = `Impact: edited ${edited} -> tainted: ${list(taintedList)}, unknown: ${list(unknown)}, stale: ${list(stale)}`

  return {
    edited,
    tainted: taintedList,
    unknown,
    stale,
    summary,
  }
}

export async function onWrite(file: string) {
  const store = await ensure({ mode: "fast" })
  const absolute = path.isAbsolute(file) ? file : path.join(Instance.worktree, file)
  if (!Filesystem.contains(Instance.worktree, absolute)) return
  const relative = path.relative(Instance.worktree, absolute)
  await updateGraph(store.graph, relative)
  await updateHash(store, relative)
  const impact = applyImpact(store, relative)
  await save(store)
  return impact
}

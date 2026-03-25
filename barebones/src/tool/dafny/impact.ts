import path from "path"
import type { Paths } from "../../types"
import { ensure, save } from "./state"

function rel(root: string, file: string) {
  return path.relative(root, file).replaceAll("\\", "/")
}

export async function onWrite(paths: Paths, file: string) {
  if (!file.endsWith(".dfy")) return
  const store = await ensure(paths)
  const id = rel(paths.root, file)
  const seen = new Set<string>()
  const queue = [id]
  const dirty: string[] = []
  const tainted: string[] = []
  while (queue.length > 0) {
    const next = queue.shift()!
    if (seen.has(next)) continue
    seen.add(next)
    const entry = store.state.statuses[next] ?? { flags: [] }
    const flags = new Set(entry.flags)
    flags.delete("VERIFIED")
    flags.delete("FAILED")
    if (next === id) {
      flags.add("DIRTY")
      dirty.push(next)
    } else {
      flags.add("TAINTED")
      tainted.push(next)
    }
    store.state.statuses[next] = { flags: Array.from(flags).sort() }
    for (const dep of store.graph.reverse[next] ?? []) queue.push(dep)
  }
  await save(paths, store)
  return {
    dirty,
    tainted,
    summary: [`Dafny impact updated.`, `Dirty: ${dirty.join(", ") || "-"}`, `Tainted: ${tainted.join(", ") || "-"}`].join(
      "\n",
    ),
  }
}

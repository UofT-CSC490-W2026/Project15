import path from "path"
import type { Paths } from "../../types"
import { buildGraph, type Graph } from "./graph"

type Status = {
  flags: string[]
}

type State = {
  version: number
  root: string
  statuses: Record<string, Status>
  last_verify?: {
    time: number
    targets: string[]
    passed: string[]
    failed: string[]
  }
}

type Store = {
  graph: Graph
  state: State
}

const VERSION = 1

function graphFile(paths: Paths) {
  return path.join(paths.dafny, "graph.json")
}

function stateFile(paths: Paths) {
  return path.join(paths.dafny, "state.json")
}

function emptyState(root: string): State {
  return {
    version: VERSION,
    root,
    statuses: {},
  }
}

export async function readGraph(paths: Paths) {
  const data = await Bun.file(graphFile(paths))
    .json()
    .catch(() => undefined)
  if (!data) return undefined
  return data as Graph
}

export async function readState(paths: Paths) {
  const data = await Bun.file(stateFile(paths))
    .json()
    .catch(() => undefined)
  if (!data || data.version !== VERSION) return emptyState(paths.root)
  return data as State
}

export async function writeGraph(paths: Paths, graph: Graph) {
  await Bun.write(graphFile(paths), JSON.stringify(graph, null, 2))
}

export async function writeState(paths: Paths, state: State) {
  await Bun.write(stateFile(paths), JSON.stringify(state, null, 2))
}

export async function ensure(paths: Paths) {
  const existing = await readGraph(paths)
  const graph = existing ?? (await buildGraph(paths.root))
  const state = await readState(paths)
  if (!existing) await writeGraph(paths, graph)
  if (!(await Bun.file(stateFile(paths)).exists())) await writeState(paths, state)
  return { graph, state }
}

export async function save(paths: Paths, store: Store) {
  await Promise.all([writeGraph(paths, store.graph), writeState(paths, store.state)])
}

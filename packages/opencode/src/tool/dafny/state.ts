import path from "path"
import fs from "fs/promises"
import { Instance } from "@/project/instance"
import { Global } from "@/global"
import { Lock } from "@/util/lock"
import { Filesystem } from "@/util/filesystem"
import { $ } from "bun"
import { buildGraph, listFiles } from "./graph"

export type Flag = "DIRTY" | "TAINTED" | "VERIFIED" | "FAILED" | "STALE" | "UNKNOWN"

export type ParsedEntry = {
  hash: string
  edges: string[]
  unresolved: string[]
  external: string[]
  time: number
}

export type Graph = {
  version: number
  root: string
  nodes: string[]
  edges: Record<string, string[]>
  unresolved: Record<string, string[]>
  external: Record<string, string[]>
  reverse: Record<string, string[]> // NEW: cached reverse dependencies
  parsed: Record<string, ParsedEntry> // NEW: parsed dependency cache
  time: number
}

export type Status = {
  flags: Flag[]
}

export type State = {
  version: number
  root: string
  head?: string
  hashes: Record<string, string>
  statuses: Record<string, Status>
  verifying?: {
    time: number
    targets: string[]
    full: boolean
  }
  lastVerify?: {
    time: number
    targets: string[]
    passed: string[]
    failed: string[]
    command: string
  }
  dafny?: {
    version?: string
  }
}

export type Store = {
  dir: string
  graph: Graph
  state: State
}

const VERSION = 1

const store = Instance.state(async () => {
  const dir = await ensureDir()
  const graph = await readGraph(dir)
  const state = await readState(dir, graph.root)
  return {
    dir,
    graph,
    state,
  }
})

async function ensureDir() {
  const dir = path.join(Global.Path.state, "dafny", Instance.project.id)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

function graphFile(dir: string) {
  return path.join(dir, "graph.json")
}

function stateFile(dir: string) {
  return path.join(dir, "state.json")
}

function emptyGraph(): Graph {
  return {
    version: VERSION,
    root: Instance.worktree,
    nodes: [],
    edges: {},
    unresolved: {},
    external: {},
    reverse: {},
    parsed: {},
    time: Date.now(),
  }
}

function emptyState(root: string): State {
  return {
    version: VERSION,
    root,
    hashes: {},
    statuses: {},
  }
}

async function readGraph(dir: string) {
  const file = graphFile(dir)
  using _ = await Lock.read(file)
  const data = await Bun.file(file)
    .json()
    .catch(() => undefined)
  if (!data || data.version !== VERSION) return emptyGraph()
  return data as Graph
}

async function readState(dir: string, root: string) {
  const file = stateFile(dir)
  using _ = await Lock.read(file)
  const data = await Bun.file(file)
    .json()
    .catch(() => undefined)
  if (!data || data.version !== VERSION) return emptyState(root)
  return data as State
}

async function writeGraph(dir: string, graph: Graph) {
  const file = graphFile(dir)
  using _ = await Lock.write(file)
  await Bun.write(file, JSON.stringify(graph, null, 2))
}

async function writeState(dir: string, state: State) {
  const file = stateFile(dir)
  using _ = await Lock.write(file)
  await Bun.write(file, JSON.stringify(state, null, 2))
}

function sameList(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

function sameHashes(a: Record<string, string>, b: Record<string, string>) {
  const keysA = Object.keys(a).sort()
  const keysB = Object.keys(b).sort()
  if (!sameList(keysA, keysB)) return false
  return keysA.every((key) => a[key] === b[key])
}

function changedFiles(prev: Record<string, string>, next: Record<string, string>) {
  const changed: string[] = []
  for (const [file, hash] of Object.entries(next)) {
    if (prev[file] !== hash) changed.push(file)
  }
  return changed
}

async function gitHead() {
  if (Instance.project.vcs !== "git") return undefined
  const result = await $`git rev-parse HEAD`.cwd(Instance.worktree).quiet().nothrow().text()
  const head = result.trim()
  if (!head) return undefined
  return head
}

async function getDafnyVersion(): Promise<string | undefined> {
  try {
    const proc = Bun.spawn(["dafny", "--version"], {
      cwd: Instance.worktree,
      stdout: "pipe",
      stderr: "pipe",
    })
    const stdout = await new Response(proc.stdout).text()
    await proc.exited
    const version = stdout.trim().split(/\r?\n/)[0]
    return version || undefined
  } catch {
    return undefined
  }
}

async function hashFile(file: string) {
  const buffer = await Bun.file(file)
    .arrayBuffer()
    .catch(() => new ArrayBuffer(0))
  const hash = await crypto.subtle.digest("SHA-256", buffer)
  return Buffer.from(hash).toString("hex")
}

async function hashFiles(files: string[]) {
  const entries = await Promise.all(
    files.map(async (file) => {
      const full = path.join(Instance.worktree, file)
      const value = await hashFile(full)
      return [file, value] as const
    }),
  )
  return Object.fromEntries(entries)
}

function flagsFor(file: string, graph: Graph): Flag[] {
  const flags: Flag[] = ["STALE"]
  const unresolved = graph.unresolved[file]
  if (unresolved && unresolved.length > 0) flags.push("UNKNOWN")
  return flags
}

function getFlags(state: State, graph: Graph, file: string) {
  const entry = state.statuses[file]
  if (!entry) return new Set<Flag>(flagsFor(file, graph))
  return new Set(entry.flags)
}

function setFlags(state: State, file: string, flags: Set<Flag>) {
  state.statuses[file] = {
    flags: Array.from(flags.values()).sort(),
  }
}

function markDirty(state: State, graph: Graph, file: string) {
  const flags = getFlags(state, graph, file)
  flags.add("DIRTY")
  flags.add("STALE")
  flags.delete("VERIFIED")
  flags.delete("FAILED")
  flags.delete("TAINTED")
  const unresolved = graph.unresolved[file]
  if (unresolved && unresolved.length > 0) flags.add("UNKNOWN")
  if (!unresolved || unresolved.length === 0) flags.delete("UNKNOWN")
  setFlags(state, file, flags)
}

function markTainted(state: State, graph: Graph, file: string) {
  const flags = getFlags(state, graph, file)
  flags.add("TAINTED")
  flags.add("STALE")
  flags.delete("VERIFIED")
  flags.delete("FAILED")
  flags.delete("DIRTY")
  const unresolved = graph.unresolved[file]
  if (unresolved && unresolved.length > 0) flags.add("UNKNOWN")
  if (!unresolved || unresolved.length === 0) flags.delete("UNKNOWN")
  setFlags(state, file, flags)
}

function applyHashImpact(state: State, graph: Graph, edited: string[]) {
  const reverse = graph.reverse
  const tainted = new Set<string>()

  for (const file of edited) {
    const queue = [file]
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index]
      const next = reverse[current] ?? []
      for (const item of next) {
        if (tainted.has(item)) continue
        tainted.add(item)
        queue.push(item)
      }
    }
  }

  for (const file of edited) {
    markDirty(state, graph, file)
  }

  for (const file of tainted) {
    if (edited.includes(file)) continue
    markTainted(state, graph, file)
  }
}

function resetStatuses(state: State, graph: Graph) {
  state.statuses = Object.fromEntries(graph.nodes.map((file) => [file, { flags: flagsFor(file, graph) }]))
  state.lastVerify = undefined
}

export async function ensure(options?: { mode?: "fast" | "full" }) {
  const value = await store()
  const head = await gitHead()
  const dafnyVersion = await getDafnyVersion()

  const files = await listFiles()
  const graphStale = value.graph.version !== VERSION || value.graph.root !== Instance.worktree
  const graphMismatch = !sameList(value.graph.nodes, files)
  // OPTIMIZATION: Pass existing graph to reuse parsed cache
  if (graphStale || graphMismatch) value.graph = await buildGraph(files, value.graph)

  const headMismatch = Boolean(head && value.state.head && head !== value.state.head)
  const dafnyVersionMismatch = Boolean(
    dafnyVersion && value.state.dafny?.version && dafnyVersion !== value.state.dafny?.version,
  )
  const mode = options?.mode ?? "full"
  const hashes =
    mode === "full" || graphStale || graphMismatch ? await hashFiles(value.graph.nodes) : value.state.hashes
  const hashMismatch = mode === "full" ? !sameHashes(value.state.hashes, hashes) : false

  // Reset statuses if: graph changed, git changed, or Dafny version changed
  if (graphStale || graphMismatch || headMismatch || dafnyVersionMismatch) {
    resetStatuses(value.state, value.graph)
  }

  if (!graphStale && !graphMismatch && !headMismatch && !dafnyVersionMismatch && hashMismatch) {
    const changed = changedFiles(value.state.hashes, hashes)
    if (changed.length > 0) applyHashImpact(value.state, value.graph, changed)
  }

  value.state.root = Instance.worktree
  if (head) value.state.head = head
  value.state.hashes = hashes

  // Track Dafny version
  if (dafnyVersion) {
    if (!value.state.dafny) value.state.dafny = {}
    value.state.dafny.version = dafnyVersion
  }

  await writeGraph(value.dir, value.graph)
  await writeState(value.dir, value.state)

  return value
}

export async function save(store: Store) {
  await writeGraph(store.dir, store.graph)
  await writeState(store.dir, store.state)
}

export async function updateHash(store: Store, file: string) {
  const full = path.join(Instance.worktree, file)
  if (!Filesystem.contains(Instance.worktree, full)) return
  store.state.hashes[file] = await hashFile(full)
}

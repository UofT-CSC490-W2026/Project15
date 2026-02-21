import path from "path"
import { Instance } from "@/project/instance"
import { Filesystem } from "@/util/filesystem"
import type { Graph, ParsedEntry } from "./state"

const IGNORE = new Set([".git", ".opencode", "node_modules", "bin", "obj", "dist", "build", "out", "coverage"])

function ignored(file: string) {
  return file.split(/[\\/]/).some((part) => IGNORE.has(part))
}

export async function listFiles() {
  const glob = new Bun.Glob("**/*.dfy")
  const files: string[] = []
  for await (const file of glob.scan({
    cwd: Instance.worktree,
    onlyFiles: true,
    followSymlinks: true,
    dot: true,
  })) {
    if (ignored(file)) continue
    files.push(path.normalize(file))
  }
  files.sort()
  return files
}

type Parsed = {
  edges: string[]
  unresolved: string[]
  external: string[]
}

// OPTIMIZATION: Quick hash function for content comparison
async function quickHash(file: string): Promise<string> {
  const buffer = await Bun.file(path.join(Instance.worktree, file))
    .arrayBuffer()
    .catch(() => new ArrayBuffer(0))
  // Use first 1KB + file size as quick hash (much faster than SHA-256)
  const sample = buffer.slice(0, 1024)
  const size = buffer.byteLength
  const hash = await crypto.subtle.digest("SHA-256", sample)
  return `${size}:${Buffer.from(hash).toString("hex", 0, 8)}`
}

async function resolveInclude(spec: string, from: string) {
  const base = path.dirname(path.join(Instance.worktree, from))
  const absolute = path.isAbsolute(spec) ? spec : path.resolve(base, spec)
  const resolved = absolute.endsWith(".dfy") ? absolute : absolute + ".dfy"
  if (!Filesystem.contains(Instance.worktree, resolved)) return { external: spec }
  const exists = await Bun.file(resolved)
    .exists()
    .then((value) => value)
    .catch(() => false)
  if (!exists) return { unresolved: spec }
  return { resolved: path.relative(Instance.worktree, resolved) }
}

function isPathSpec(spec: string) {
  if (spec.startsWith(".")) return true
  if (spec.startsWith("/")) return true
  if (spec.includes("/")) return true
  if (spec.includes("\\")) return true
  return false
}

async function resolveImport(spec: string, from: string) {
  if (isPathSpec(spec)) {
    const base = path.dirname(path.join(Instance.worktree, from))
    const absolute = path.isAbsolute(spec) ? spec : path.resolve(base, spec)
    const resolved = absolute.endsWith(".dfy") ? absolute : absolute + ".dfy"
    if (!Filesystem.contains(Instance.worktree, resolved)) return { external: spec }
    const exists = await Bun.file(resolved)
      .exists()
      .then((value) => value)
      .catch(() => false)
    if (!exists) return { unresolved: spec }
    return { resolved: path.relative(Instance.worktree, resolved) }
  }

  const candidate = path.join(Instance.worktree, spec.replaceAll(".", path.sep) + ".dfy")
  const exists = await Bun.file(candidate)
    .exists()
    .then((value) => value)
    .catch(() => false)
  if (exists) return { resolved: path.relative(Instance.worktree, candidate) }
  return { external: spec }
}

// OPTIMIZATION: Parse with cache lookup
async function parseFile(file: string, cache?: Record<string, ParsedEntry>): Promise<Parsed> {
  const absolute = path.join(Instance.worktree, file)

  // OPTIMIZATION: Check cache first using quick hash
  const currentHash = await quickHash(file)
  const cached = cache?.[file]
  if (cached && cached.hash === currentHash) {
    // Cache hit! Return cached result
    return {
      edges: cached.edges,
      unresolved: cached.unresolved,
      external: cached.external,
    }
  }

  const text = await Bun.file(absolute)
    .text()
    .catch(() => "")
  if (!text) return { edges: [], unresolved: [], external: [] }

  const edges: string[] = []
  const unresolved: string[] = []
  const external: string[] = []

  const include = /\binclude\s+"([^"]+)"/g
  for (const match of text.matchAll(include)) {
    const spec = match[1]
    if (!spec) continue
    const result = await resolveInclude(spec, file)
    if ("resolved" in result && result.resolved) edges.push(path.normalize(result.resolved))
    if ("external" in result && result.external) external.push(result.external)
    if ("unresolved" in result && result.unresolved) unresolved.push(result.unresolved)
  }

  const imp = /\bimport\s+(?:opened\s+)?(?:"([^"]+)"|([A-Za-z0-9_./\\]+))/g
  for (const match of text.matchAll(imp)) {
    const spec = match[1] || match[2]
    if (!spec) continue
    const result = await resolveImport(spec, file)
    if ("resolved" in result && result.resolved) edges.push(path.normalize(result.resolved))
    if ("external" in result && result.external) external.push(result.external)
    if ("unresolved" in result && result.unresolved) unresolved.push(result.unresolved)
  }

  const result = {
    edges: Array.from(new Set(edges)).toSorted(),
    unresolved: Array.from(new Set(unresolved)).toSorted(),
    external: Array.from(new Set(external)).toSorted(),
  }

  // OPTIMIZATION: Update cache
  if (cache) {
    cache[file] = {
      hash: currentHash,
      edges: result.edges,
      unresolved: result.unresolved,
      external: result.external,
      time: Date.now(),
    }
  }

  return result
}

// OPTIMIZATION: Build reverse dependency map
function buildReverseEdges(edges: Record<string, string[]>): Record<string, string[]> {
  const reverse: Record<string, string[]> = {}
  for (const [source, deps] of Object.entries(edges)) {
    for (const dep of deps) {
      if (!reverse[dep]) reverse[dep] = []
      reverse[dep].push(source)
    }
  }
  // Sort for consistency
  for (const key of Object.keys(reverse)) {
    reverse[key].sort()
  }
  return reverse
}

export async function buildGraph(files?: string[], existingGraph?: Graph): Promise<Graph> {
  const nodes = files ?? (await listFiles())

  // OPTIMIZATION: Reuse existing parsed cache
  const parsedCache: Record<string, ParsedEntry> = existingGraph?.parsed ?? {}
  const parsed = await Promise.all(nodes.map((file) => parseFile(file, parsedCache)))

  const edges: Record<string, string[]> = {}
  const unresolved: Record<string, string[]> = {}
  const external: Record<string, string[]> = {}

  nodes.forEach((file, index) => {
    const entry = parsed[index]
    edges[file] = entry.edges
    if (entry.unresolved.length > 0) unresolved[file] = entry.unresolved
    if (entry.external.length > 0) external[file] = entry.external
  })

  // OPTIMIZATION: Build reverse edges once
  const reverse = buildReverseEdges(edges)

  return {
    version: 1,
    root: Instance.worktree,
    nodes: nodes.toSorted(),
    edges,
    unresolved,
    external,
    reverse, // OPTIMIZATION: Pre-computed reverse edges
    parsed: parsedCache, // OPTIMIZATION: Persist parsed cache
    time: Date.now(),
  }
}

export async function updateGraph(graph: Graph, file: string) {
  const normalized = path.normalize(file)
  const parsed = await parseFile(normalized, graph.parsed)
  if (!graph.nodes.includes(normalized)) graph.nodes.push(normalized)
  graph.nodes.sort()
  graph.edges[normalized] = parsed.edges
  if (parsed.unresolved.length > 0) graph.unresolved[normalized] = parsed.unresolved
  if (parsed.unresolved.length === 0) delete graph.unresolved[normalized]
  if (parsed.external.length > 0) graph.external[normalized] = parsed.external
  if (parsed.external.length === 0) delete graph.external[normalized]

  // OPTIMIZATION: Rebuild reverse edges incrementally
  graph.reverse = buildReverseEdges(graph.edges)
  graph.time = Date.now()
}

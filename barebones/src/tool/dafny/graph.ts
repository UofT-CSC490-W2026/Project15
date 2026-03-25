import fs from "fs/promises"
import path from "path"

export type Graph = {
  root: string
  nodes: string[]
  edges: Record<string, string[]>
  reverse: Record<string, string[]>
  unresolved: Record<string, string[]>
  time: number
}

function rel(root: string, file: string) {
  return path.relative(root, file).replaceAll("\\", "/")
}

function parse(content: string) {
  return [...content.matchAll(/^\s*include\s+"([^"]+)"/gm)].map((x) => x[1])
}

export async function listFiles(root: string) {
  return Array.fromAsync(new Bun.Glob("**/*.dfy").scan({ cwd: root, absolute: true }))
}

export async function buildGraph(root: string): Promise<Graph> {
  const files = await listFiles(root)
  const nodes = files.map((file) => rel(root, file)).sort()
  const edges: Record<string, string[]> = {}
  const reverse: Record<string, string[]> = {}
  const unresolved: Record<string, string[]> = {}
  const set = new Set(nodes)
  for (const file of files) {
    const id = rel(root, file)
    const dir = path.dirname(file)
    const content = await fs.readFile(file, "utf8")
    const deps = parse(content)
      .map((item) => rel(root, path.resolve(dir, item)))
      .sort()
    edges[id] = deps.filter((item) => set.has(item))
    unresolved[id] = deps.filter((item) => !set.has(item))
    for (const dep of edges[id]) {
      if (!reverse[dep]) reverse[dep] = []
      reverse[dep].push(id)
    }
  }
  for (const key of Object.keys(reverse)) reverse[key].sort()
  return {
    root,
    nodes,
    edges,
    reverse,
    unresolved,
    time: Date.now(),
  }
}

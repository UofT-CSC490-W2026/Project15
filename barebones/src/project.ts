import fs from "fs/promises"
import path from "path"
import type { Paths } from "./types"

async function has(dir: string, name: string) {
  return Bun.file(path.join(dir, name)).exists()
}

export async function root(start = process.cwd()) {
  let dir = path.resolve(start)
  while (true) {
    if (await has(dir, ".git")) return dir
    const next = path.dirname(dir)
    if (next === dir) return path.resolve(start)
    dir = next
  }
}

export async function paths(start = process.cwd()): Promise<Paths> {
  const dir = await root(start)
  const barebones = path.join(dir, ".barebones")
  const dafny = path.join(barebones, "dafny")
  return {
    root: dir,
    barebones,
    dafny,
    db: path.join(barebones, "app.db"),
    config: path.join(barebones, "config.json"),
    auth: path.join(barebones, "auth.json"),
  }
}

export async function ensurePaths(start = process.cwd()) {
  const value = await paths(start)
  await Promise.all([fs.mkdir(value.barebones, { recursive: true }), fs.mkdir(value.dafny, { recursive: true })])
  return value
}

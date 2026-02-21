import { existsSync, readdirSync, statSync } from "fs"
import path from "path"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"

function arg(name: string) {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx === -1) return
  return process.argv[idx + 1]
}

const run = arg("run")
if (!run) throw new Error("missing --run <path>")

const artifacts = arg("artifacts")
const bucket = "project15-raw-chris"
const region = "ca-central-1"

const client = new S3Client({ region })

function key(id: string, date: string) {
  return `raw/runs/date=${date}/${id}.jsonl`
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = path.join(dir, entry)
    const stat = statSync(p)
    if (stat.isDirectory()) return walk(p)
    return [p]
  })
}

const raw = await Bun.file(run).text()
const first = raw.split(/\r?\n/).find(Boolean)
if (!first) throw new Error("run file is empty")
const parsed = JSON.parse(first) as { run_id: string; timestamp: string }
const date = new Date(parsed.timestamp).toISOString().slice(0, 10)

await client.send(
  new PutObjectCommand({
    Bucket: bucket,
    Key: key(parsed.run_id, date),
    Body: raw,
    ContentType: "application/jsonl",
  }),
)

if (artifacts && existsSync(artifacts)) {
  const files = walk(artifacts)
  for (const file of files) {
    const rel = path.relative(artifacts, file).replaceAll("\\", "/")
    const key = `raw/artifacts/${parsed.run_id}/${rel}`
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Bun.file(file).stream(),
      }),
    )
  }
}

if (artifacts && !existsSync(artifacts)) {
  console.log(`artifacts path not found, skipping: ${artifacts}`)
}

console.log(`uploaded run ${parsed.run_id} to s3://${bucket}`)

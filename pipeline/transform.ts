import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { RawRun, toRunRows } from "./schemas"

function arg(name: string) {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx === -1) return
  return process.argv[idx + 1]
}

const run = arg("run")
if (!run) throw new Error("missing --run <path>")

const bucket = "project15-clean-chris"
const region = "ca-central-1"
const client = new S3Client({ region })

const raw = await Bun.file(run).text()
const lines = raw.split(/\r?\n/).filter(Boolean)

for (const line of lines) {
  const parsed = JSON.parse(line) as RawRun
  const date = new Date(parsed.timestamp).toISOString().slice(0, 10)
  const rows = toRunRows(parsed)

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `curated/runs/date=${date}/${parsed.run_id}.jsonl`,
      Body: `${JSON.stringify(rows.run)}\n`,
      ContentType: "application/jsonl",
    }),
  )

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `curated/run_steps/date=${date}/run_id=${parsed.run_id}/part-000.jsonl`,
      Body: rows.steps.map((row) => JSON.stringify(row)).join("\n") + "\n",
      ContentType: "application/jsonl",
    }),
  )

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `curated/verification_results/date=${date}/run_id=${parsed.run_id}/part-000.jsonl`,
      Body: rows.verification.map((row) => JSON.stringify(row)).join("\n") + "\n",
      ContentType: "application/jsonl",
    }),
  )

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `curated/errors/date=${date}/run_id=${parsed.run_id}/part-000.jsonl`,
      Body: rows.errors.map((row) => JSON.stringify(row)).join("\n") + "\n",
      ContentType: "application/jsonl",
    }),
  )

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `curated/graph_snapshots/date=${date}/run_id=${parsed.run_id}/part-000.jsonl`,
      Body: rows.graph.map((row) => JSON.stringify(row)).join("\n") + "\n",
      ContentType: "application/jsonl",
    }),
  )
}

console.log(`uploaded curated data to s3://${bucket}`)

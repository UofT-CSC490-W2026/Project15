# Data Pipeline (Assignment Part 3)

This folder contains a minimal, working data-processing pipeline for agentic CLI runs.
It uses two S3 buckets:

- raw (dirty): `project15-raw-chris`
- clean (curated): `project15-clean-chris`

Region: `ca-central-1`

## Layout

Dirty bucket:

- `raw/runs/date=YYYY-MM-DD/run_id.jsonl`
- `raw/artifacts/run_id/` (diffs, logs, optional snapshot zip)

Clean bucket:

- `curated/runs/date=YYYY-MM-DD/run_id.jsonl`
- `curated/run_steps/date=YYYY-MM-DD/run_id=.../part-000.jsonl`
- `curated/verification_results/date=YYYY-MM-DD/run_id=.../part-000.jsonl`
- `curated/errors/date=YYYY-MM-DD/run_id=.../part-000.jsonl`
- `curated/graph_snapshots/date=YYYY-MM-DD/run_id=.../part-000.jsonl`

## Pipeline Diagram

```
CLI Run
  -> JSONL + artifacts (local)
  -> S3 Dirty Bucket (raw)
  -> Transform (normalize + derive metrics)
  -> S3 Clean Bucket (curated)
  -> Athena/Glue (optional)
```

## Scripts

1. Emit a sample run (local JSONL):

```bash
bun run pipeline/emit_run.ts --out ./out/run.jsonl
```

2. Upload raw data:

```bash
bun run pipeline/upload_raw.ts --run ./out/run.jsonl --artifacts ./out/artifacts
```

3. Transform and upload clean data:

```bash
bun run pipeline/transform.ts --run ./out/run.jsonl
```

## When It Runs

- Ingestion: every CLI run (append-only to raw)
- Cleaning: event-driven (S3 PUT trigger) or on demand (script)
- Use cases:
  - Debugging: inspect raw JSONL and artifacts
  - Analytics: query curated tables (pass/fail, regressions, repair success)

## Schemas

See `pipeline/schemas.ts` for raw + clean row shapes and normalization.

## Next Steps (Not Implemented)

- Write curated data as Parquet (optimize Athena/warehouse)
- Glue Data Catalog + Athena table definitions
- Deduplication and late-arrival handling
- Join with previous runs to compute regressions across history

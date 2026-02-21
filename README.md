# Agentic Coding CLI integrated with Formal Verification via Dafny

This project adds a Dafny-focused workflow to OpenCode so you can open any Dafny repo and ask the agent to make verification pass. It provides dependency graphing, impact analysis, and verification status propagation while using the existing OpenCode CLI/TUI/web UI.

---

## What It Does

This fork ships a Dafny extension for OpenCode with:

- A **Dafny agent** (`dafny`) specialized for verification and proof repair
- **Graph + impact analysis** for `.dfy` files
- **Verification tooling** that runs Dafny and surfaces status changes
- **Impact events** emitted after edits, visible in the TUI/web UI
- **State persistence** under OpenCode's global state directory

It reuses the existing `opencode` CLI/TUI/web UI and does **not** introduce a new CLI.

---

## Goals (MVP)

- Open any Dafny repo in OpenCode and ask the agent to make verification pass
- Build a Dafny dependency graph (via `include` and best-effort `import`)
- Propagate verification status and impact after edits
- Keep all UX in OpenCode: `opencode` (TUI), `opencode run`, `opencode web`

---

## Dafny Behavior Summary

- **Graph nodes**: `.dfy` files under the worktree (excluding build artifacts)
- **Edges**: `include "path"` and best-effort `import` resolution
- **Unknown deps**: unresolved relative includes are tracked as UNKNOWN
- **Statuses**: `DIRTY`, `TAINTED`, `VERIFIED`, `FAILED`, `STALE`, `UNKNOWN`
- **Verification**: runs Dafny in the worktree via the existing shell tool
- **Impact**: emits a single "Impact" event after each write

---

## Integration Points

- **Agent**: new `dafny` agent configuration and system prompt
- **Tools**: new Dafny graph/verify/impact tools under `packages/opencode/src/tool/dafny`
- **UI**: impact emitted as a normal tool/message event for TUI/web UI rendering
- **Storage**: persisted under OpenCode global state with invalidation rules

---

## Developer Notes

- Use the existing stack (Bun, TypeScript, Hono)
- Keep changes localized to `packages/opencode` unless a new package is necessary
- Tests must run from package dirs (not repo root)
- The JavaScript SDK is regenerated via:

```bash
./packages/sdk/js/script/build.ts
```

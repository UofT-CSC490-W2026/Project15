OpenCode Dafny Extension (revised)

Context
This repo already ships the `opencode` CLI and a local TUI. Instead of building a new CLI, the goal is to add a Dafny-focused extension that plugs into the existing OpenCode runtime, agents, and tool system.

High-level goal (MVP)
Provide a Dafny-focused workflow inside OpenCode so a user can open any Dafny repo and ask the agent to make verification pass. The extension should surface:

- A Dafny dependency graph
- Impact analysis after edits
- Verification status propagation

The experience should work through the existing CLI/TUI:

- `opencode` (TUI)
- `opencode run ...` (headless / scripted)
- `opencode web` (web UI)

Scope change vs previous idea

- Do NOT build a new `codepilot` CLI.
- Reuse OpenCode’s CLI/TUI, server, permissions, and tool protocol.
- Ship a Dafny-specific agent + tools + UI events.

Proposed integration points

- Agent: add a Dafny agent configuration (e.g. `dafny`) with a specialized system prompt and permissions.
- Tools: add or extend tools in `packages/opencode/src/tool` for Dafny graph building, verification, and impact reporting.
- UI: emit a single human-readable “Impact” event after each write, as a normal message/tool event so the TUI/web UI can display it.
- Storage: persist the graph and state under OpenCode’s global state dir with clear invalidation rules.

Constraints (updated)

- Use the repo’s existing stack (Bun, TypeScript, Hono).
- Avoid introducing a second CLI or parallel agent loop.
- Keep changes localized to `packages/opencode` plus any new package if needed.
- Tests should run from package dirs (not repo root).

Behavior (Dafny-specific)

- Repo discovery: use OpenCode’s existing instance/worktree resolution; no separate root discovery required.
- Graph:
  - Nodes: `.dfy` files under the worktree, excluding build artifacts.
  - Edges: `include "path"` and best-effort `import` resolution.
  - Track UNKNOWN deps for unresolved relative includes.
- Status:
  - DIRTY, TAINTED, VERIFIED, FAILED, STALE, UNKNOWN.
  - Update on write and verify, then emit one “Impact” event.
- Verify:
  - Run Dafny verification in the worktree via the existing shell tool.
  - Parse output best-effort; do not invent diagnostics.

CLI/TUI UX

- Default: user runs `opencode` and the `dafny` agent is selected by default when Dafny is available. If Dafny is not on PATH, OpenCode falls back to the first non-subagent (typically `build`).
- `opencode run --agent dafny "Fix the failing proofs"` should work end-to-end.
- Tool execution should be visible in the TUI/web UI using existing event streams.

Deliverable (revised)
Implement the Dafny extension inside OpenCode:

- Agent definition + prompt
- Tools for graph/impact/verify
- Minimal state persistence and invalidation
- TUI/web event output for “Impact”

Concrete implementation plan (targets in this repo)

1. Agent definition and prompt

- Add a new built-in agent entry in `packages/opencode/src/agent/agent.ts`:
  - name: `dafny`
  - mode: `primary`
  - permissions: allow `read`, `list`, `grep`, `glob`, `bash`, `write` (ask/deny as needed), and `tool` calls for the new Dafny tools.
  - description: “Dafny verification and proof repair agent.”
- Add a Dafny system prompt under `packages/opencode/src/agent/prompt/dafny.txt`:
  - Require repo inspection before edits.
  - Require small edits.
  - After each edit, run verify and loop until failures clear for targets.
  - Final answer must include: changes, verify command, status summary.

2. Dafny tools

- Create a dedicated tool module folder, e.g. `packages/opencode/src/tool/dafny/`.
- Implement these tools (API aligned with existing tool interface):
  - `dafny_graph`:
    - Input: `{ root?: string }`
    - Output: nodes, edges, unresolved markers.
  - `dafny_verify`:
    - Input: `{ targets?: string[] }`
    - Output: per-file status and diagnostics.
  - `dafny_impact`:
    - Input: `{ filePath: string }`
    - Output: tainted list, stale list, unknown list, and a human-readable summary.
- Register tools in the tool index (`packages/opencode/src/tool/tool.ts` or equivalent registry).

3. Graph + status storage

- Store under OpenCode global state (per project id):
  - `${Global.Path.state}/dafny/<projectId>/graph.json`
  - `${Global.Path.state}/dafny/<projectId>/state.json`
- Graph content:
  - Nodes: `.dfy` files under worktree excluding build artifacts.
  - Edges: `include "..."` + best-effort `import` resolution.
  - Mark UNKNOWN for unresolved relative includes.
- State content:
  - Per-file statuses: DIRTY, TAINTED, VERIFIED, FAILED, STALE, UNKNOWN.
  - File hashes and last verify summary.
  - Dafny version for invalidation.
- Invalidation:
  - If git HEAD changes or file hash differs from cache, mark STALE and rebuild/refresh graph.
  - If Dafny version changes, reset verify statuses to STALE.

4. Tool execution flow

- On `write` tool success:
  - Update graph edges for that file.
  - Run impact analysis.
  - Update statuses.
  - Emit a single “Impact” event.
- Implement “Impact” as a normal tool output or as a structured message event so the TUI/web UI renders it consistently.

5. Verify flow

- Run Dafny verification through the existing shell tool in the worktree.
- Parse output best-effort (file/line/col/message when possible).
- Update per-file statuses based on targets and results.

6. UI/TUI integration

- If needed, add a simple formatter in `packages/opencode/src/cli/cmd/run.ts` to render `dafny.impact` nicely (similar to existing tool renderers).
- Web/TUI should display the impact as a distinct event; avoid extra UI components for MVP.

7. Tests

- Add tests under `packages/opencode` (not repo root).
- Avoid network calls in tests.
- Cover:
  - Graph parsing of `include` and `import`
  - Impact propagation rules
  - Verify parsing (fixtures for Dafny output)

Proposed file list (initial)

- `packages/opencode/src/agent/prompt/dafny.txt` (new)
- `packages/opencode/src/tool/dafny/graph.ts` (new)
- `packages/opencode/src/tool/dafny/verify.ts` (new)
- `packages/opencode/src/tool/dafny/impact.ts` (new)
- `packages/opencode/src/tool/dafny/state.ts` (new, cache + status helpers)
- `packages/opencode/src/tool/dafny/parse.ts` (new, Dafny output parsing)
- `packages/opencode/src/tool/tool.ts` (register tools)
- `packages/opencode/src/agent/agent.ts` (register agent)
- `packages/opencode/src/cli/cmd/run.ts` (optional: render dafny tools)

Notes

- Dafny cache uses OpenCode global state dir.
- `dafny` is the default agent.
- Default agent selection falls back when Dafny is missing.

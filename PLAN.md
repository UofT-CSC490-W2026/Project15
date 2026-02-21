OpenCode repo summary (how it works)

Overview
- This is a Bun-based monorepo for the OpenCode AI coding agent. It ships a CLI that can run a TUI locally, host a headless API server, or open a web UI. It exposes a client/server architecture so other clients (web, desktop, SDKs) can drive the same server.

Top-level workflow
1. Entry point: `packages/opencode/src/index.ts` sets up logging, environment flags, and one-time DB migration. It registers CLI commands with yargs (run, serve, web, attach, etc.).
2. The server: `packages/opencode/src/server/server.ts` builds a Hono app with CORS/auth, route modules, and an SSE event stream. It can also proxy requests to `app.opencode.ai` for the web UI when running in server mode.
3. Sessions and agents: CLI commands (notably `run`) create or continue a session via the SDK, then stream events from the server. Agents define permissions and model configuration, and can be customized in config.
4. Tools and permissions: Tool implementations live in `packages/opencode/src/tool`. Permission rules (read/write, external dirs, plan mode, etc.) live under `packages/opencode/src/permission`.
5. Storage: data is stored in SQLite using Bun + Drizzle (`packages/opencode/src/storage/db.ts`), with migrations in `packages/opencode/migration`. A JSON-to-SQLite migration runs on first launch if needed.

Key packages
- `packages/opencode`: Core business logic, CLI, server, TUI, storage, providers, tools, permissions, and routing.
- `packages/opencode/src/cli/cmd/tui`: TUI implementation (SolidJS + opentui), plus attach/thread commands.
- `packages/app`: Shared web UI components (SolidJS). Used by the web and desktop clients.
- `packages/desktop`: Tauri wrapper around the web UI.
- `packages/sdk/js`: JavaScript SDK; regenerated via `./packages/sdk/js/script/build.ts`.
- `packages/plugin`: Plugin runtime package (used by core for extensibility).
- `packages/slack`: Slack integration.
- `packages/web`: Documentation site (Astro Starlight).
- `packages/console`: Console/marketing site app (SolidStart).
- `packages/containers`: Container images used in CI or Linux jobs.

Server surface and routes
- The server exposes REST + SSE endpoints under `/project`, `/session`, `/provider`, `/mcp`, `/tui`, `/pty`, `/config`, etc. It publishes an OpenAPI spec at `/doc`.
- Auth uses optional basic auth (env flags). CORS allows localhost, tauri, and `*.opencode.ai`, plus any configured whitelist.

CLI behavior
- `bun dev` from repo root runs `packages/opencode/src/index.ts` (same interface as the published `opencode` binary).
- `opencode serve` starts the headless API server.
- `opencode web` starts the server and opens the web UI.
- `opencode run` creates/continues a session, optionally attaches files, and streams back tool and text events.

Agents, models, and skills
- Built-in agents (build, plan, general, explore) are defined in `packages/opencode/src/agent/agent.ts` with permissions and defaults.
- Provider/model handling is in `packages/opencode/src/provider`. Auth config is in `packages/opencode/src/auth`.
- Skills live under `packages/opencode/src/skill`, and can be discovered/loaded at runtime.

Developer entry points
- `bun dev` starts the TUI against `packages/opencode`.
- `bun dev serve` starts the headless server.
- `bun run --cwd packages/app dev` starts the web UI (requires server running).
- `bun run --cwd packages/desktop tauri dev` runs the desktop app.

If you want a deeper section (for example: the session lifecycle, provider API shapes, or tool execution flow), tell me which area and I will expand this file.

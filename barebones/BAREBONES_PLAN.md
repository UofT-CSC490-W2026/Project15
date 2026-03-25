# Barebones Agentic CLI Plan

## Goal

Build a new, minimal CLI that keeps the useful parts of this fork:

- terminal-first agent loop
- Dafny-focused agent behavior
- local file editing and shell execution
- Dafny graph / verify / impact tools

and drops most upstream product surface:

- TUI
- web app
- desktop app
- MCP
- GitHub integration
- server routes
- multi-product workspace assumptions
- broad provider and auth support

The intent is not to preserve OpenCode parity. The intent is to produce a small codebase that is easy to test, easy to explain, and aligned with the actual course project.

## What A Barebones Version Should Do

### User flow

1. User runs a terminal command such as:

```bash
barebones "make verification pass"
```

or:

```bash
barebones
```

for an interactive REPL-style session.

2. The CLI determines the project root / current working directory.
3. The CLI loads minimal config.
4. The CLI selects one model provider and one default model.
5. The CLI creates a session in memory or on disk.
6. The CLI sends the system prompt, tool definitions, and conversation history to the model.
7. The model responds with either:
   - plain assistant text
   - tool calls
8. The runtime executes tool calls, appends tool results, and loops.
9. The runtime stops when the model returns a normal final answer or a maximum step limit is reached.
10. The CLI prints the final answer and exits.

### Core runtime behavior

A barebones version needs:

- a single primary agent, probably `dafny`
- one main conversation loop
- tool-call execution
- file read / write / edit capability
- shell command capability
- session history handling
- step limit / loop guard
- basic error handling
- concise terminal output

### Minimal tool set

The first version should likely support only:

- `read`
- `write`
- `edit` or `apply_patch`
- `ls`
- `grep`
- `glob`
- `bash`
- `dafny_graph`
- `dafny_verify`
- `dafny_impact`

Optional later additions:

- `todo`
- `question`
- `task` for subagents
- `webfetch` / `websearch`

### Dafny-specific behavior

The barebones version should preserve:

- detecting `.dfy` files in the repo
- building a dependency graph
- tracking affected files after edits
- incremental verification
- full verification on request
- surfacing verification failures in a compact, readable format
- storing enough state to avoid recomputing everything every turn

### Minimum persistence

The simplest acceptable persistence model is:

- SQLite for primary application state
- separate project-scoped Dafny state for derived analysis data
- or no persistence at first, with only in-memory conversation state during prototyping

For a longer-term version, SQLite is the better choice for durable app state. Derived Dafny analysis state can live outside the database because it is project-scoped and recomputable.

### Configuration

The barebones version should support only a small config surface:

- model provider
- model id
- AWS auth source
- max steps
- optional Bedrock region / profile / endpoint
- optional Dafny command path

Avoid trying to preserve the full `opencode.json` schema.

### Agent and model setup

Version 1 should assume:

- one primary agent: `dafny`
- one model provider: AWS Bedrock

The first version does not need a general multi-provider abstraction. It can hardcode a Bedrock-backed `dafny` agent and keep the model layer narrow.

Suggested model setup behavior:

- load one configured Bedrock model id
- load Bedrock region from config first, then environment, then default
- optionally load AWS profile from config or environment
- optionally load custom Bedrock endpoint from config
- initialize the model once per session
- keep the agent definition simple and local to the barebones app

Suggested Bedrock auth sources for v1:

- AWS credential chain
- `AWS_PROFILE`
- access key env vars
- web identity / role env vars

Possible later addition:

- Bedrock bearer token support

The simplest acceptable v1 behavior is:

- if Bedrock credentials are not available, fail clearly at startup
- do not attempt broad provider autodiscovery
- do not support unrelated providers

### Output / UX

The CLI should print:

- assistant messages
- tool activity in a readable compact format
- diffs or file writes when useful
- Dafny verification summaries
- final answer

The output does not need rich TUI rendering.

### Terminal UI compromise

There is a useful middle ground between:

- a plain stdout-only CLI
- the full current OpenCode TUI

The middle ground is:

- keep a terminal UI
- make it shallow and Dafny-specific

This version should keep:

- a single conversation screen
- prompt input at the bottom
- scrolling conversation history
- readable tool activity blocks
- compact Dafny verification and impact rendering
- a small status line for cwd, model, or step count

This version should drop:

- multiple screens or routes
- session browser
- theme engine
- dialog system
- complex focus management
- web/server sync
- desktop/web parity
- generalized event bus dependencies
- large shared state graphs

Recommended direction:

- not a plain one-shot CLI if usability matters
- not the full OpenCode TUI if code size and coverage simplicity matter
- a small custom terminal UI dedicated to the Dafny workflow

Suggested minimal terminal UI features:

- one active conversation
- one input field
- rendered assistant text
- rendered tool calls
- rendered verification summaries
- only simple keyboard shortcuts if truly needed

Suggested terminal UI features to avoid at first:

- tabs
- panes
- attach / thread switching
- modal dialogs
- theme customization
- command palette
- remote session sync
- background server coordination

### Safety / guardrails

Even in a minimal version, keep:

- a maximum step count
- explicit tool schemas
- file access scoped to the worktree
- command execution limited to the local repo unless deliberately allowed

Possible simplification:

- do not build a full permission engine at first
- just gate shell execution and file writes with a simple policy

## Suggested Architecture

## `barebones/` phase

This folder is currently for planning only.

## Likely future package layout

If implemented as a new standalone package, a reasonable shape would be:

```text
packages/barebones/
  src/
    cli.ts
    config.ts
    session.ts
    loop.ts
    provider.ts
    prompt.ts
    tool/
      tool.ts
      registry.ts
      read.ts
      write.ts
      edit.ts
      ls.ts
      grep.ts
      glob.ts
      bash.ts
      dafny/
        graph.ts
        graph_tool.ts
        impact.ts
        impact_tool.ts
        parse.ts
        state.ts
        verify.ts
```

## Functional modules needed

### 1. CLI entrypoint

Responsibilities:

- parse command line arguments
- support one-shot mode and maybe interactive mode
- load config
- call the main loop
- render results to terminal

### 2. Model provider wrapper

Responsibilities:

- initialize AWS Bedrock
- expose one `generate/stream` path
- convert tool definitions into the model SDK format

Recommendation:

- support exactly one provider first
- make Bedrock the only supported provider in v1
- add others only if required

### 3. Agent prompt

Responsibilities:

- define the Dafny-focused system prompt
- define tool usage expectations
- define stop conditions

Recommendation:

- define a single built-in `dafny` agent
- bind it directly to the configured Bedrock model

### 4. Session / conversation state

Responsibilities:

- store messages
- append tool results
- enforce max steps
- optionally serialize run history

Recommendation:

- use SQLite as the main backing store
- avoid a separate JSON storage layer for core state

### 5. Tool framework

Responsibilities:

- define tools
- validate parameters
- execute handlers
- normalize outputs

### 6. Dafny state layer

Responsibilities:

- cache graph and status state
- update impact after writes
- track verification state

Recommendation:

- keep Dafny analysis state separate from the main app database
- store it per project
- treat it as derived state that can be rebuilt if needed
- keep it versioned and structured

## What We Can Copy From The Current Repo

This section is about code that is conceptually reusable. It does not mean copy entire modules blindly.

### High-value code to copy with light adaptation

These are the strongest candidates.

- [`packages/opencode/src/tool/dafny/graph.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/tool/dafny/graph.ts)
- [`packages/opencode/src/tool/dafny/parse.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/tool/dafny/parse.ts)
- [`packages/opencode/src/tool/dafny/impact.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/tool/dafny/impact.ts)
- [`packages/opencode/src/tool/dafny/state.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/tool/dafny/state.ts)
- [`packages/opencode/src/tool/dafny/graph_tool.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/tool/dafny/graph_tool.ts)
- [`packages/opencode/src/tool/dafny/impact_tool.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/tool/dafny/impact_tool.ts)
- [`packages/opencode/src/tool/dafny/verify.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/tool/dafny/verify.ts)
- the Bedrock-specific setup logic from [`packages/opencode/src/provider/provider.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/provider/provider.ts)

Reason:

- this is the project-specific value you added
- these files are already narrow in scope
- these are easier to justify in coverage and in the report
- the current repo already contains Bedrock auth and model wiring logic that can be reduced into a much smaller provider module

### Useful utilities that may be copied selectively

- [`packages/opencode/src/tool/tool.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/tool/tool.ts)
- [`packages/opencode/src/tool/read.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/tool/read.ts)
- [`packages/opencode/src/tool/write.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/tool/write.ts)
- [`packages/opencode/src/tool/edit.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/tool/edit.ts)
- [`packages/opencode/src/tool/bash.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/tool/bash.ts)
- [`packages/opencode/src/tool/glob.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/tool/glob.ts)
- [`packages/opencode/src/tool/grep.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/tool/grep.ts)
- [`packages/opencode/src/tool/ls.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/tool/ls.ts)
- [`packages/opencode/src/util/filesystem.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/util/filesystem.ts)
- [`packages/opencode/src/util/git.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/util/git.ts)
- [`packages/opencode/src/util/iife.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/util/iife.ts)
- [`packages/opencode/src/util/defer.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/util/defer.ts)

Reason:

- these are local building blocks
- they are easier to extract than the session/server stack

### Prompt material worth reusing

- [`packages/opencode/src/agent/prompt/dafny.txt`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/agent/prompt/dafny.txt)

Reason:

- it contains domain behavior already tailored to the project

Copying the text is lower risk than copying the entire `Agent` subsystem.

### Bedrock wiring worth reusing conceptually

The current repo already supports Bedrock through:

- region handling
- profile handling
- endpoint overrides
- AWS credential chain loading
- Bedrock-specific model id adjustment logic

These behaviors should be reused conceptually, but implemented inside a much smaller Bedrock-only module for `barebones`.

### Possible terminal UI ideas to borrow, but not preserve wholesale

If a lightweight terminal UI is built, these may be worth reviewing for formatting or interaction ideas only:

- [`packages/opencode/src/cli/cmd/run.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/cli/cmd/run.ts)
- [`packages/opencode/src/cli/ui.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/cli/ui.ts)
- [`packages/opencode/src/cli/cmd/tui`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/cli/cmd/tui)

Reason:

- these may contain useful rendering ideas
- the current TUI should be treated as reference material, not as a subsystem to carry over directly

## What We Should Rewrite Ourselves

These parts are better rewritten for a small CLI instead of copied.

### 1. CLI entrypoint

Do not copy:

- [`packages/opencode/src/index.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/index.ts)

Reason:

- it wires in many unrelated commands
- it assumes the full product
- it increases surface area immediately

Write a much smaller `cli.ts` from scratch.

### 2. Main session loop

Do not copy wholesale:

- [`packages/opencode/src/session/prompt.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/session/prompt.ts)
- [`packages/opencode/src/session/index.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/session/index.ts)
- [`packages/opencode/src/session/message-v2.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/session/message-v2.ts)
- [`packages/opencode/src/session/processor.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/session/processor.ts)

Reason:

- these files carry a lot of upstream architecture
- they are tied to storage, events, permissions, and product features you do not need
- a barebones loop can be an order of magnitude smaller

Recommendation:

- reimplement the loop from scratch
- only port small helper ideas where useful

### 3. Agent registry

Do not copy wholesale:

- [`packages/opencode/src/agent/agent.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/agent/agent.ts)

Reason:

- only a fraction is needed
- the current version includes config merging, permissions, hidden agents, title generation, summary generation, plugin hooks, and more

Recommendation:

- define one hardcoded `dafny` agent first

### 4. Full provider abstraction

Do not copy wholesale:

- [`packages/opencode/src/provider/provider.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/provider/provider.ts)
- [`packages/opencode/src/provider/models.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/provider/models.ts)
- [`packages/opencode/src/provider/transform.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/provider/transform.ts)

Reason:

- this code supports many providers and auth modes
- it is a lot of complexity for little value in the barebones version

Recommendation:

- implement a single-provider wrapper
- make it Bedrock-only in v1
- add others later only if the course project needs them

### 5. Configuration system

Do not copy wholesale:

- [`packages/opencode/src/config/config.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/config/config.ts)

Reason:

- the config system is broad and upstream-oriented
- a tiny config schema is enough

### 6. Persistence and database

Do not copy:

- [`packages/opencode/src/storage`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/storage)
- [`packages/opencode/src/control`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/control)
- [`packages/opencode/src/session/session.sql.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/session/session.sql.ts)
- [`packages/opencode/src/project/project.sql.ts`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/project/project.sql.ts)

Reason:

- the DB is heavy for the project scope
- a much smaller SQLite schema is enough initially

Recommendation:

- use SQLite for durable application records
- keep Dafny graph/status state outside the main DB as project-specific derived state

### 7. Permission engine

Do not copy wholesale:

- [`packages/opencode/src/permission`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/permission)

Reason:

- powerful, but too much machinery for a first pass

Recommendation:

- start with simple guard logic inside tool execution

### 8. Optional upstream product systems

Do not copy:

- [`packages/opencode/src/mcp`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/mcp)
- [`packages/opencode/src/server`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/server)
- [`packages/opencode/src/share`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/share)
- [`packages/opencode/src/skill`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/skill)
- [`packages/opencode/src/plugin`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/plugin)
- [`packages/opencode/src/lsp`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/lsp)
- [`packages/opencode/src/acp`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/acp)
- [`packages/opencode/src/ide`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/ide)
- [`packages/opencode/src/scheduler`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/scheduler)

Reason:

- these are outside the core course project
- they add maintenance burden without helping the main loop

### 9. Full TUI subsystem

Do not copy wholesale:

- [`packages/opencode/src/cli/cmd/tui`](/Users/chris/Developer/school/csc490/Project15/packages/opencode/src/cli/cmd/tui)

Reason:

- the current TUI is much broader than the project needs
- it is tightly coupled to the larger OpenCode product surface
- it will inflate the new codebase quickly

Recommendation:

- build a much smaller custom terminal UI if terminal UX matters
- keep it single-screen and Dafny-specific

## Copy vs Rewrite Summary

### Copy first

- Dafny graph / impact / verify implementation
- small file and shell utilities
- the Dafny system prompt
- a very small subset of tool definitions if extraction is clean

### Rewrite first

- CLI entrypoint
- conversation loop
- session representation
- Bedrock-only provider wrapper
- config loader
- output renderer
- terminal UI shell if you want an interactive interface

## Minimum Viable Barebones Scope

If the goal is to get to a working replacement quickly, the first implementation should include only:

- one command: `barebones [message]`
- one agent: `dafny`
- one provider: AWS Bedrock
- one session loop
- these tools:
  - `read`
  - `write`
  - `bash`
  - `ls`
  - `grep`
  - `glob`
- `dafny_graph`
- `dafny_verify`
- `dafny_impact`
- SQLite-backed core state
- separate project-scoped Dafny state files
- no full TUI
- no web
- no MCP
- no plugin system

## Persistence Split

### Store in SQLite

- projects
- sessions
- messages
- tool calls and tool outputs
- user-visible session metadata

These are durable application records and should survive across runs.

### Store outside SQLite as project-scoped Dafny state

- dependency graph
- file hashes
- verification status flags
- last verification run metadata
- other derived analysis artifacts

Reason:

- this state is tied to a specific project
- it is derived from the repository
- it can be recomputed
- it is not the main conversational record

### Suggested location for Dafny state

Either:

- a project-local directory such as `.barebones/dafny/`

or:

- a global app state directory keyed by project id

Examples:

- `.barebones/dafny/graph.json`
- `.barebones/dafny/state.json`

## Recommended Product Shape

For this project, the best compromise is likely:

- a small custom terminal UI
- a minimal agent loop
- a Bedrock-only model layer
- only the Dafny-oriented tools and local file/shell tools

Not recommended:

- plain CLI if usability matters a lot
- full OpenCode TUI if code size and coverage simplicity matter

export AWS_BEARER_TOKEN_BEDROCK=bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFTSUFURkdVRzNGTExYTkFXSVY3JTJGMjAyNjAzMjQlMkZjYS1jZW50cmFsLTElMkZiZWRyb2NrJTJGYXdzNF9yZXF1ZXN0JlgtQW16LURhdGU9MjAyNjAzMjRUMjA0OTQzWiZYLUFtei1FeHBpcmVzPTQzMjAwJlgtQW16LVNlY3VyaXR5LVRva2VuPUlRb0piM0pwWjJsdVgyVmpFTlglMkYlMkYlMkYlMkYlMkYlMkYlMkYlMkYlMkYlMkZ3RWFER05oTFdObGJuUnlZV3d0TVNKSE1FVUNJUUNISzVHTTBuaCUyRiUyQnRCQ2NyOTNaeDI4Mmo5TSUyRnpVampKdWUzc1pHQUFhMGN3SWdaTWMlMkJ4a0pWdDRsN2o2d00yNDlBU0xMVDRVb2hZZG1XaEdBWEl3a212MGdxcXdRSW52JTJGJTJGJTJGJTJGJTJGJTJGJTJGJTJGJTJGJTJGQVJBQUdnd3lNVGN6TkRBNE9UTTFNallpREtPUlBMS1Y2THF1R3YlMkY3eHlyJTJGQTBIdEJMUXhCYlZzZTJTYWZsc0g5MDRjOTRLbjNISFdSRGdZbEZJRlhMeGlJRHZQcjJDV0syJTJGTzU4dlRwYkt3aUxoeUpvY0U4WmFJTFF0eUtqbUlieXlWOUkwUVpIcURaVjAxb0N3RjVPN3lnNWVUR1YxaFk3dTklMkJQb3Yxb3g5UkJZSks3U3ZkQVVhZWFvc2pQRVJNZWx1WWhzMGxBN3FnUjVyT1UxaE03SnI4TUFaVEhXNGJkV1FvNERXYUdJS1RiOUt6U3kySFhEc1JHejUyTXMlMkJqdFd1N2RsY1ZRWHdoRGFGWTRuTHNtRmRPM0o5SUNtT1lQVHJMYnZjMXY2VHczaFJuY1BtUTRFbEo3Qlcybk9SWjAwbEZFQnBuSnh6SHJvMUVZTiUyRmNKaWRaNUowTXJjcWYlMkJwRTZtJTJCQlkzWkt3WXAyMDV1WVltUnlkYnBxSGNhUkt5QzRZQkNmbEExc21SMWw0U1BsVFdFTEpjaVZHYk0xRUFHTXg3NHMzSmwlMkZxdUlVWmxDNzFvNzZuJTJCOHVSMWRtd0NFSiUyRmJSRnpETjNwV3NsJTJGcGNaZ0NsTlJhMWkwMEtweVhMSnNHTmRPT01CMG56NUhXQlVFV1A2VEgwTGFEJTJCT0RXU0NyeGhvZ0haSGVjUkhmYnlDSSUyRjNYWG11aUtxV1ZTTHlUNVZNSFlsdTVIcTg4bjN6JTJCcnVQZ29OZ2t6JTJGUWMzNXA1aGEyRXpxeENvQzZQN3NUUURHQXVpM3pMV2pDc3BoWVNUV2pHWEp0M0VQRFRWYmNzZFlKZ1BhQXZZOHRjdmRjaUswR1pZQXZxem1peVluRkUlMkJtQXdPblkyb3h3YVFCaXFIamZMWVBtdDUxZTdpMW14eFgzU1V6UGFJZHBNM3JEb1BqMWFHUjRRU21PbXJ0OCUyQlNac3c3OSUyQkx6Z1k2d3dLMkNhWTBKWXJaSFM4WU1UWXZ2OGtmbHhDazNPREt5emo1TUJubG1xc21EdldLQnFMdWJPNmtQdW9CbXhEMGdncGlVWEtjbFVPT2FEYmpFYnVsR3RhJTJGQXcwbnJlSjZxMXIycURpdFFTdUVxSEZvTUZGYmt4VDNTMWVNZGtRRDlwcHFjdUVBNFlDWmVNa0NiQSUyRmplY2EzJTJCWlJIWWFXJTJGOEtlYlpIQVFSenlyMkhFRXFCZUFpZGE0aEVVNzhwUWE0Z2VKTHhObkRRaWxVSGJWd0VlVGF1R1NZMDJkUW9zSEU1dElHcjRCSU8zR0FGTmRkYkVHVFB5ejRZTWQzSDdaeVBXUyUyQm9ENkhEZ3IzTlNTR3pVdkRVb3lUTlB2SE5Rd1g0WkNnQ3hHTXBCa1FVd09aJTJGSXNRcFNMY3pzcHJJdzZCSmpjR1llVkQwNjA4JTJCRjF5OWlVSk9UVHVNN0UlMkZFaFNCRHpOdjYyaE05Tkx2cyUyQjk0cHppVldHSEEwMzNWQTYzeXNPcFNiUVI3U2N5OVNSSGNHVzhwcHViRHpmNndqZ3kyMVN1Z0tNMU9vdDZhdjMxZ0ElM0QlM0QmWC1BbXotU2lnbmF0dXJlPWNlMzI3ZjVjODNkNTZmMmYzZTgzYmJkNjZiYjIwNGFiYWY4ZTJjYjlmZTFlOGMxYTdhMjhkMDFmMDEwZTE4MWMmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JlZlcnNpb249MQ==

## Recommended Build Order

1. Define the smallest CLI command surface.
2. Implement a tiny session/message model.
3. Implement the model loop with tool calls.
4. Implement file and shell tools.
5. Port Dafny graph / impact / verify logic.
6. Add on-disk JSON persistence only if needed.
7. Add tests around the real used flow.

## Why This Is A Better Course Fit

A barebones rewrite gives:

- a smaller codebase boundary
- more meaningful coverage numbers
- less inherited upstream complexity
- clearer ownership of the code being evaluated
- easier explanation in demos and the report

The tradeoff is implementation time, but the resulting project will be much easier to defend academically than a large fork where most code is unused.

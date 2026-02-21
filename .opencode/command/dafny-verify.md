---
description: Run Dafny verification for changed files
---

Run the `dafny_verify` tool with `{ "full": false }` for the current worktree.
Do not edit files automatically.

If the tool output indicates a timeout or any failures:
- summarize the first failure (file, line, message)
- propose a minimal fix
- ask the user for approval before making edits

If verification succeeds, respond with a 1-2 sentence summary.

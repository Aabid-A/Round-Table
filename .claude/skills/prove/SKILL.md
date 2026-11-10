---
name: prove
description: Use after building or fixing runtime behavior, before shipping. Records evidence of the failure before the fix and the success after it, as screenshots, command output or logs, so a reviewer doesn't have to trust the agent.
---

# Prove

A reviewer should be able to see the change work without running it.

## Steps

1. **Run the repo checks** from `AGENTS.md` ("Checks in this repo"). Fix failures.
2. **Capture BEFORE** (cheapest while the bug still exists): reproduce the
   problem and save evidence in `.artifacts/<task>/before.*`.
   - UI: screenshot with whatever the harness offers (a browser tool or computer
     use). With none, run a headless Playwright script (Node) instead; it works
     with any harness. If you can capture nothing, say so in the evidence file.
   - CLI/API: exact command and output.
   - Performance: a measured number.
3. **Make the fix.**
4. **Capture AFTER** the same way into `.artifacts/<task>/after.*`, same steps.
5. **Write `.artifacts/<task>/evidence.md`:** what was reproduced, what changed,
   a before/after pair per behavior, and what you could NOT verify.

## Rules

- If you can't reproduce a reported bug, say so. Don't fix a bug you haven't seen.
- Docs-only changes: verify links and runnable examples instead.
- Keep `.artifacts/` gitignored. Upload screenshots only to a host the user
  approves; public hosts are not for sensitive UI.
- Never claim a pass you didn't observe.

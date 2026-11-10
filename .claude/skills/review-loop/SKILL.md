---
name: review-loop
description: Use after opening a PR to iterate on review feedback until the gate passes (no unresolved actionable findings, or a 5/5 score from a review bot), within an iteration cap. Replaces a manual "run the reviewer again" habit.
---

# Review Loop

Success: the current commit passes the gate with no unresolved actionable
findings. Default cap: **5 iterations**. The user can set another cap.

## Choose a gate

Pick one in `AGENTS.md` under Conventions. Default is **A**.

- **A. Independent review (no paid tools).** Get a review from a context that
  did not write the code, on `git diff origin/main...`. In order of preference:
  a separate reviewer agent or subagent if your harness has them; a second
  session or a different model run from the command line; or, as a last resort,
  re-read the diff cold against the checklist below. Ask for correctness bugs,
  security issues, missing tests and duplicated logic, each with file, line and
  a concrete failure scenario. For UI diffs, also check against the `ui-design`
  skill (tokens, states, accessibility, consistency). Drop findings you can't
  confirm in the code.
- **B. Review bot (e.g. Greptile).** Comment the bot's trigger on the PR, wait
  for a score tied to the *current* commit (ignore stale ones), and read its
  findings via `gh pr view` / `gh api`. For Greptile you can install the
  vendored `greploop` skill and use it instead of this one.

## Cycle

1. Run the gate on the current commit.
2. If it passes, stop and report.
3. Fix each real finding in your own branch. If a finding is wrong, reply with
   the reason; don't silently ignore it.
4. Rerun checks, commit, push (`--force-with-lease` only if you rebased).
5. Go to 1 until pass or the cap.

## Stopping honestly

At the cap, a timeout, or a missing integration: stop and report the real
score, the open findings and what is left. Don't raise the cap or claim success.

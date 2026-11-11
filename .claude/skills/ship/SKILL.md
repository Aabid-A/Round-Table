---
name: ship
description: Use when a code change is done and proven and the task calls for a pull request. Commits, rebases, pushes, opens the PR with evidence, runs the review loop, and ends by giving the PR URL. Never merges.
---

# Ship

Only ship when the task calls for a PR. A plan, review or local experiment does
not imply publishing.

## Steps

1. Confirm you're on your task branch, not `main` (`git branch --show-current`).
2. Review your own diff (`git diff origin/main...`). Remove debug code and
   unrelated edits.
3. **Commit in small steps** as you build, not once at the end. Each commit
   is one logical change a reader can follow on its own: a type, a function
   with its tests, a CLI flag, a docs update, a review fix. Rules:
   - Typecheck and tests pass at every commit.
   - Tests go in the same commit as the code they cover.
   - Subject: imperative, under 70 characters, starting with the area, e.g.
     `engine: break vote ties with a revote`. Body: why, in a line or two.
   - Never mix a refactor, a feature and formatting in one commit.
   - Review fixes are new commits that name the finding. Don't squash or
     amend pushed commits; the history is how the owner follows the work.
   - A milestone is usually 5 to 20 commits. One giant commit is a defect.
4. `git fetch origin && git rebase origin/main`, then rerun the checks.
5. `git push -u origin <branch>`. After a rebase of an already-pushed branch,
   `--force-with-lease` only.
6. **Open the PR** (`gh pr create`). The body has:
   - What changed and why.
   - How it was tested, with the before/after evidence from `/prove`.
   - Risks and follow-up work.
   Edit the title and body for plain language before posting.
7. Run `/review-loop` for code or executable-workflow changes.
8. Present the PR URL and the real review result.

## Never

- Merge, unless the user explicitly asks.
- Push to `main` or use plain `--force`.
- Report a review pass that didn't happen.

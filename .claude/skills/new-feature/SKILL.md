---
name: new-feature
description: Use before editing any repository for a feature, fix or docs change. Creates an isolated git worktree and branch from origin/main, or keeps one already assigned to this task. Not needed for read-only work.
---

# New Feature

Each editing task gets its own worktree and branch from the latest
`origin/main`. Never build on `main` or reuse another task's work.

## Check existing isolation first

Run `git worktree list`, `git status --short` and `git branch --show-current`.
If the environment already gave this task a worktree, keep it and skip to step 5.

## Steps

1. `git fetch origin`
2. **Scope check.** `gh pr list`, then `gh pr diff <n> --name-only` for open PRs.
   Read overlapping diffs. Independent edits may proceed. Ask only if changes
   conflict in behavior, need unfinished work, or ownership is unclear.
3. **Name the task:** lowercase-with-hyphens plus a short suffix, e.g.
   `user-auth-0816a`. If the name exists, pick another. Never force or reuse.
4. **Create the worktree** outside the checkout or in a gitignored directory:
   ```bash
   git worktree add <worktrees-dir>/<task> -b agent/<task> origin/main
   ```
5. **Enter and verify:** `cd` into it; `git branch --show-current` must print the
   new branch, not `main`. Install dependencies inside the worktree if needed.

## Remember

- Worktrees don't isolate ports or shared databases. Check `lsof -i :<port>`.
- Keep the worktree until the PR is merged or closed. Then:
  `git worktree remove <path>` and `git branch -D agent/<task>`.

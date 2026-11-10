# Agent workflow (code factory)

This file is the factory. It tells any coding agent how to take a task from a
clean branch to a reviewed pull request. Skills hold the detail; this file
decides which skill runs when. Copy it into a repo and fill in "Checks in this
repo" and "Conventions".

## How to read this file

Works with any model and harness. Skills are named like `/new-feature`. If your
harness has slash commands, run them. If not, load the skill of that name from
the skills folder (`.claude/skills`, `.agents/skills`, `.cursor/skills`, or
wherever your harness keeps them) and follow it. Where a skill mentions a
capability your harness lacks (subagents, a browser, computer use), use the
fallback it names, and say in the PR what you could not do.

## Pick the parts that fit the task

- Read-only reviews, explanations and investigations: no worktree, commit or PR.
  If an investigation leads to edits, isolate those edits first.
- Code changes: all four steps below.
- Small docs edits: isolated branch plus content and link checks. No runtime
  evidence, no review loop.
- A request for a plan, review or experiment does not imply publishing it.

## Workflow

1. **Isolate.** Run `/new-feature` before any edit. Work in its own worktree and
   branch from `origin/main`. Never build on `main`.
2. **Build.** Follow `/code-structure` and the repo's existing architecture.
   Reuse existing functions before writing new ones.
   For any user-facing UI, also follow `/ui-design` (clean, calm, consistent;
   tokens, all states, accessibility).
3. **Prove.** Run the repo checks. For changed runtime behavior run `/prove`:
   capture the failure before the fix and the success after it. For UI changes
   run `/design-review`: screenshots at mobile and desktop, light and dark,
   across states, critiqued and fixed before shipping.
4. **Ship.** Run `/ship`: commit, rebase, push, open the PR with evidence, then
   `/review-loop` until the gate passes. End by presenting the PR URL.

Edit commit messages, PR text and docs for plain words and no filler before
posting them (`/unslop` if you have it).

## Periodic: untangle the codebase

`/untangle-codebase` is a whole-codebase refactor, not a per-task step. It is an
optional skill that is not bundled here; skip this section if you don't have
it. Run it only when the user asks, or suggest it when the repo has grown messy (copied
logic, a feature scattered across folders, many special cases) or after about
ten merged PRs. Rules for running it:

- Start from green checks on `origin/main`. Do it through `/new-feature`, in
  its own branch and PR, separate from any feature work.
- Behavior must stay the same. Run the checks and `/prove` at the end.
- Ask the user before it removes comments or tests. Never delete tests silently.
- Ship through `/ship` and `/review-loop` like any other change.

## Multi-agent rules

- Never commit to `main`. Never plain `--force`; only `--force-with-lease` on
  your own task branch.
- One worktree and branch per task and per agent. Never touch another agent's
  worktree, branch or uncommitted work.
- Scope check before starting: skim open PRs' changed files. Proceed on
  independent edits; stop and ask only when changes conflict in behavior or
  ownership is unclear.
- Worktrees do not isolate dev-server ports or shared databases. Confirm a port
  answers your process. Do not run schema experiments on a shared database.
- Regenerate lockfiles on conflict; never hand-merge them.
- If a conflict can't be resolved confidently, stop and report.
- Do not merge a PR unless asked. Keep the worktree until the PR is merged or
  closed.

## Done means

- Changes stay inside the task's scope.
- Checks pass on the final commit.
- The PR body says what changed, how it was tested (with evidence), risks and
  follow-ups.
- For UI changes, `/design-review` ran and its screenshots are in the PR.
- The review gate passed, or you report the real score, the open findings and
  why you stopped. Never claim success you didn't get.

## Conventions

- Language: TypeScript on Node 22, ESM.
- Branch prefix: `agent/`
- Review gate: A (independent review by a context that didn't write the code;
  see `.claude/skills/review-loop/SKILL.md`).
- Game logs are JSON files in `games/` (gitignored).
- The OpenRouter key is read from `OPENROUTER_API_KEY` at runtime. Never write
  it into a file.
- Game spec: `docs/GAME.md`. Architecture: `/code-structure`.

## Checks in this repo

- `npm ci`
- `npm run typecheck`
- `npm test`
- `git diff --check`

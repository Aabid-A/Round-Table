---
name: design-review
description: Use after building or changing UI, before shipping. Captures screenshots across widths, themes and states, critiques them against the ui-design rules, and fixes issues. Produces before/after screenshots for the PR.
---

# Design Review

Judge the UI by looking at it, not by reading the code.

## Steps

1. **Run the app** (check `lsof -i :<port>` so you're viewing your own server).
2. **Capture screenshots** with a browser tool (Playwright, `agent-browser`, or
   the available browser/computer tools) into `.artifacts/<task>/design/`:
   - widths: 375, 768, 1280
   - themes: light and dark
   - states: default, hover or focus, loading, empty, error, and a long-content
     case (long names, many items)
   For a change to an existing screen, capture BEFORE as well, from `origin/main`.
3. **Look at every screenshot** and score against `/ui-design`. Check:
   - Alignment and spacing consistent with the scale? Anything cramped or floating?
   - Clear hierarchy: can you tell what matters in two seconds?
   - Contrast, text size and line length legible?
   - Same components and tokens as the rest of the app? Nothing off-brand?
   - Broken layouts, overflow, clipped text, layout shift?
   - Keyboard focus visible? (tab through once)
4. **List issues** with severity (blocker, polish) and a screenshot reference.
5. **Fix blockers and polish**, re-capture, and repeat. Cap at 3 rounds.
6. **Write the result** into `.artifacts/<task>/design/review.md`: the
   screenshots, issues found and fixed, and anything left. Put the before/after
   table in the PR body.

## Honesty

- If you can't run the app or take screenshots, say so. Don't approve a design
  you haven't seen.
- Don't redesign beyond the task's scope. Note larger problems as follow-ups.

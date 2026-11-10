---
name: ui-design
description: Use when building or changing any user-facing UI (pages, components, forms, emails, dashboards). Sets the visual and UX standard - clean, calm, consistent - and requires design tokens, all UI states, and accessibility. EDIT the Taste section to match your own aesthetic.
---

# UI Design

The bar: a clean interface that looks deliberate. Calm, consistent, easy to scan.
Follow the project's existing design system first. Only fall back to this file
where the project has no convention.

## Taste (edit this to your preference)

- Minimal and quiet. Few colors, lots of whitespace, one accent color.
- Hierarchy through size, weight and spacing, not through borders and boxes.
- Restraint: no gratuitous gradients, shadows, emoji icons or decoration.
- Reference products to match: <!-- e.g. Linear, Vercel, Stripe, Notion -->
- If the repo has a `design-references/` folder, read its `STYLE.md` first, then
  any `sites/*.md` that matches the page type. Take the structure and feel, not
  a copy, and keep to the project's own tokens.

## Rules

1. **Tokens, not magic values.** Colors, spacing, radius, font sizes and shadows
   come from a token set (CSS variables or the theme file). Never hard-code a
   hex or a one-off pixel value in a component. If a token is missing, add it.
2. **Spacing scale.** Use a 4px base (4, 8, 12, 16, 24, 32, 48, 64). Align
   things to it. Group related items tightly and separate groups generously.
3. **Type.** One font family (two at most). 3 to 5 sizes. Body 14 to 16px, line
   height 1.5. Max line length about 65 characters. Left-align text.
4. **Color.** Neutral grays for structure, one accent for actions, semantic
   colors only for status. Text contrast at least 4.5:1 (3:1 for large text).
   Never use color alone to convey meaning.
5. **Light and dark.** Support both unless the project says otherwise. Define
   tokens for each; don't invert by hand.
6. **Every state.** For each component and screen build: default, hover, focus,
   active, disabled, loading, empty, error and success. Empty and error states
   say what happened and what to do next.
7. **Responsive.** Design for a 375px phone first, then widen. No horizontal
   scroll. Touch targets at least 44px.
8. **Accessibility.** Semantic HTML, labels on every input, visible focus rings,
   full keyboard use, alt text, `prefers-reduced-motion` respected.
9. **Motion.** Short (100 to 200ms), purposeful, ease-out. Only to explain a
   change of state.
10. **Copy.** Plain words. Buttons are verbs ("Save changes", not "Submit").
    Be consistent about naming across screens.
11. **Reuse components.** Search for an existing component before building one.
    Build new ones to compose, with variants and not boolean-prop pileups.

## UX checks

- The primary action on each screen is obvious. Only one primary button.
- Users always know where they are and how to go back.
- Destructive actions confirm or can be undone.
- Forms validate inline, keep input on error, and explain how to fix it.
- Nothing jumps: reserve space for loading content to avoid layout shift.

## Before finishing

Run `/design-review`. UI work is not done until it has screenshots at mobile
and desktop widths in light and dark, covering the non-default states.

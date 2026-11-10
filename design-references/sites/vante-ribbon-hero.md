---
name: vante-ribbon-hero
type: portfolio-hero
tags: [dark, 3d, three-js, scroll-driven, video, portfolio, agency, single-file]
source: https://motionsites.ai/?prompt=vante-ribbon-hero
free: true
---

# Vante - Video Ribbon Scroll Portfolio Hero

Full prompt (verbatim): [../prompts/vante-ribbon-hero.md](../prompts/vante-ribbon-hero.md)

## Screenshot
None saved yet. Add `img/vante-ribbon-hero.png`.

## What it is
Near-black scroll-driven portfolio hero (900vh track, sticky stage). Headline
"CRAFT IN / MOTION" slides across in opposite directions while a ribbon of eight
live video cards spirals through 3D on a fixed rail, then six cards land in a
3x2 grid with hover name pills. three.js 0.170, vanilla ES module, one file.

## What I like
- Quiet, exact, technical: `#0a0a0b` bg, warm off-white `#f4f1ea`, muted `#8d8b86`,
  hairlines at 14% ink.
- Type pairing: Inter Tight 400 headline at `clamp(40px, 6.7vw, 130px)` with
  tight -.055em tracking; IBM Plex Mono for all small labels.
- Pill buttons with 1px outlines that invert on hover; boxed pager arrows hanging from the top edge.
- The first frame is deliberately almost empty: glow, hairline with "+", only
  the end of the headline visible.
- One scroll number `p` drives everything and is smoothed (`p += (target - p) * .09`),
  so scrolling back reverses perfectly.

## Tokens
- Fonts: Inter Tight 400/500/600, IBM Plex Mono 400/500
- Colors: bg `#0a0a0b`, ink `#f4f1ea`, mid `#8d8b86`, line `rgba(244,241,234,.14)`
- Spacing: page gutters 32px (18px phone), top 26px, bottom 26px
- Radius: pills 99px, card corners 0.018 (shader)
- Motion: ease `1-(1-t)^3` for card landing; smoothstep for the rule; headline
  rise 34vh over the first 12% of scroll

## Techniques worth reusing
- Fixed rail + sliding ribbon (CatmullRom path sampled to a lookup table).
- Two-sided strip with `gl_FrontFacing` flip so video is never mirrored.
- Videos play only while their card is visible.
- Field of view recomputed below 16:9 so the horizontal view stays fixed.

## Use it for
Agency or studio portfolios, showreel heroes, scroll-driven reveals of a body
of work. Needs a performance plan: eight video textures plus WebGL.

---
name: vell-lookbook
type: fashion-landing
tags: [light, soft, depth, runway, fashion, drag, scroll-synced, single-file, vanilla-js]
source: https://motionsites.ai/?prompt=vell-lookbook
free: true
---

# Maison Vell - Runway Depth Lookbook

Full prompt (verbatim): [../prompts/vell-lookbook.md](../prompts/vell-lookbook.md)

Condensed reference, not the full prompt (which includes a complete single-file
implementation). Re-paste it for a 1:1 rebuild.

## Screenshot
None saved yet. Add `img/vell-lookbook.png`.

## What it is
Full-viewport fashion page. Six models stand in a line receding from the right
into blurred haze on the left. Drag, wheel or arrow keys walk the line forward:
the front model grows and exits behind the product column, a new one arrives
from the back. A 372px right rail of product cards scrolls in sync and loops. A
big "Look 15-20" number rolls over at bottom left.

## What I like
- Airy pale-blue gradient stage (`#f1f5fa` to `#e7eff6`) with a white fade at the bottom.
- Luxury typography: Michroma (wide, uppercase, tracked .14-.2em) for logo, nav,
  headings, labels and the look number; Inter for the paragraph and prices.
- Very small, very wide-tracked labels (9.5-15.5u) against one big element.
- Depth as a table: seven stops (x, feet y, height, blur, opacity) interpolated
  linearly, so depth looks designed and not computed.
- Soft elliptical floor shadows under each model.
- Rail cards alternate `#f3f6fa` and white; exactly three fit on screen; hearts
  and a plus that rotates 90 degrees on hover.
- Ring cursor that becomes a pill while dragging.

## Tokens
- Fonts: Michroma (display), Inter 400/500 (body)
- Colors: ink `#16191f`, mid `#737b86`, dim `#a4adb8`, line `#e6ebf0`, rail `#f3f6fa`, heart fill `#d8a7a0`
- Unit: `--u: min(100vw/1600, 100vh/900)` so the layout scales as one piece; `1px` at 820px and below
- Spacing: header padding 20/46/15u; rail 372u wide; intro at 46u, 36u
- Motion: `p += (target - p) * (1 - exp(-dt * .0072))`; snap on release; wheel
  adds `clamp(dx+dy, -120, 120) / 420` and rounds after 150ms idle
- Blur is divided by the layer scale so it looks the same at any depth
- Phone: rail becomes a 190px horizontal track of 160px cards

## Techniques worth reusing
- Sprite sheets cropped with nested SVG `viewBox` (all models from one image, all products from another).
- Layers are laid out once at 1.2x stage height; only `transform` changes, so they stay sharp.
- `wrap()` loop math for an endless track.
- Repaint only while the position is moving.

## Caveats
- Images come from a generated sprite sheet hosted via images.higgs.ai; for a
  real project, generate and host your own.
- Brand "Maison Vell" is fictional.

## Use it for
Fashion or luxury landing pages, collection browsers, anything with a "walk
through a series" feel. The one-variable-drives-everything pattern also suits timelines.

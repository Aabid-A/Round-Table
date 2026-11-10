---
name: fernhollow
type: hero-3d
tags: [dark, 3d, webgl, immersive, hero, studio, nature, audio, glow]
source: https://motionsites.ai/?prompt=fernhollow (flowervalley)
free: true
---

# Fernhollow - Night Flower Valley Hero

Full prompt (verbatim): [../prompts/fernhollow.md](../prompts/fernhollow.md)

Condensed reference, not the full prompt. The real prompt ships a very large
single HTML file (compiled engine chunks and assets inlined as base64).

## Screenshot
None saved yet. Add `img/flower-valley.png`.

## What it is
Full-screen hero for a fictional regenerative design studio. An interactive 3D
night valley of glowing flowers runs behind a centred cream headline "Grown, not
built." Wheel or touch flies the camera along a baked path, the mouse pushes
points away and tilts the camera, and hovering the arrow button slows the
flight and disperses the flowers into floating particles with muffled audio.

## What I like
- Black background, one cream color `#f5efe2`, and nothing else. The 3D scene supplies all the color.
- Tall condensed headline (Antonio 400, 158u, line-height .92) against small
  Manrope body: huge contrast in scale.
- Minimal UI: wordmark top left, three tracked uppercase links, one cream pill
  CTA, a round 58u arrow button, a "Scroll to wander" hint, a sound toggle.
- Interface fades in (1.6s) only after the 3D intro finishes; the loader is a
  single pulsing dot.
- Hover on the CTA changes the 3D scene itself, which ties the interface to the world.
- Ambient audio starts muted, with a clear toggle.

## Tokens
- Fonts: Antonio 400 (headline), Manrope 400/500 (everything else)
- Colors: bg `#000`, cream `#f5efe2`, dark-on-cream `#151510`
- Unit: `--u: min(100vw/1600, 100vh/900)`; `1px` at 820px and below
- Nav: 14.5u, uppercase, .16em tracking, 44u gaps; pill 46u tall
- Phone: headline `clamp(64px, 19vw, 96px)`, nav links hidden except the pill

## Techniques worth reusing
- Overlay UI at `pointer-events: none` except links and buttons.
- Loader and intro callbacks from the engine to gate the UI fade-in.
- Reduced-motion: stop the loader pulse.

## Caveats (important)
- The valley engine is Gladeye's compiled code from gladeye.com, "used with
  permission" in the prompt. It is not ours to redistribute or reuse in a
  real project. Treat this as an interface and mood reference only.
- Heavy: large bundle, WebGL, base64 assets. Needs a performance and
  fallback plan (static image, reduced motion) in a real build.

## Use it for
Studio or agency hero sections, immersive brand moments. For other projects,
copy the interface layer (type, spacing, fade-in choreography), not the engine.

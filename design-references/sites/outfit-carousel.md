---
name: outfit-carousel
type: ecommerce
tags: [light, minimal, 3d-ring, carousel, fashion, product-panel, custom-cursor, vanilla-js]
source: https://motionsites.ai/?prompt=outfit-carousel
free: true
---

# Outfit Carousel ("Try the Look." / Runway)

Full prompt (verbatim): [../prompts/outfit-carousel.md](../prompts/outfit-carousel.md)

Condensed reference, not the full prompt. The full prompt is about 14k words
(exact recreation of a Shopify custom element); re-paste it when you want a
1:1 rebuild.

## Screenshot
None saved yet. Add `img/outfit-carousel.png`.

## What it is
White-stage streetwear lookbook. Six full-body models stand on a turning 3D
ring (front model largest, outer figures blurred and smaller). Auto-advances
every 5s. Right column "In this look" lists the pieces with add buttons, size
pickers, and a bundle price + "Add full look to bag" CTA. "View look" popup with
numbered product pins. Local "styling bag" dialog.

## What I like (visual and UX traits)
- Almost monochrome: white stage and panel, near-black `#151413`, muted gray text
  `#66625c`, hairlines `#c8c8c8`. The product photos carry all the color.
- Square corners (radius 0) on buttons and thumbs. Pills only for size options.
- Thin type: Helvetica/Arial stack at weight 400. Headline 46px, tight
  tracking (-0.02em), small 10-13px labels in wide-tracked uppercase.
- Stage left, 380px product panel right, 1px divider between them.
- 01-06 progress ticks: the current tick widens and shows its name, and a fill
  bar runs over the autoplay duration.
- Custom cursor on desktop: an 84px glass ring that says "Drag", turns into
  "View" over the hero, and shrinks to a dot over links.
- Pins appear only in the popup, with a staggered spring pop-in and a pill tooltip.
- Phone: classic diagonal line of models, product rows become a horizontal snap
  carousel in a docked bottom panel, and size picker is a bottom sheet.

## Tokens
- Fonts: Helvetica, Arial, sans-serif; Inter 600 for header nav only
- Colors: stage/panel `#fff`, text `#151413`, muted `#66625c`, accent `#0e0e0e`, line `#c8c8c8`
- Spacing: panel padding 32px, header 88px tall (68px phone), thumb 92px (62px phone)
- Radius: buttons 0, size pills 30px, add button hover ring 20px
- Motion easings: `cubic-bezier(.16,1,.3,1)` (main), `.65,0,.35,1` (sweep),
  `.34,1.56,.64,1` (spring), `.32,.72,0,1` (sheet)
- Motion: spring K=95 critically damped; ring step 30deg; entrance 1.1-1.8s
  fades with blur(8px) to 0; light sweep (soft-light band) on each change
- Breakpoints: 750px (ring to classic), 1100px, 374px, landscape max-height 520px

## Techniques worth reusing
- One float position drives all models; depth blur and scale come from a ring formula.
- Respect `prefers-reduced-motion` everywhere (springs snap, no sweep, no autoplay).
- Hover-linking between pins and panel rows.
- Drag + velocity swipe, trackpad wheel with lock, keyboard arrows.

## Caveats
- Nike branding and Shopify store links: placeholder content from the prompt
  author. Replace with your own brand and assets for real use.
- Images were hosted on the prompt author's Vercel deployment; do not depend on them.

## Use it for
E-commerce lookbooks, outfit/product bundle pages, any "browse looks + buy the
pieces" flow. Not for dashboards.

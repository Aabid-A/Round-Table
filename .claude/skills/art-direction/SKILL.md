---
name: art-direction
description: Use before building or changing anything in the 3D game world (room, characters, lighting, camera, props, effects). The one written look for Round Table. Read it first so every scene belongs to the same game.
---

# Art Direction

Round Table is a game you sit inside, not a page with a tilt. The player
should feel they are at a table in a dark room with people they can't trust.
If the owner has put images in `design-references/game/`, look at them first;
they outrank this text.

## The world

- **Setting.** A round stone hall at night. One heavy round table, eight
  high-backed chairs, candles on the table, a fire somewhere behind. Walls
  fall away into darkness; the room is lit, the edges are not.
- **Characters.** Hooded, cloaked figures. Each wears a mask: one simple,
  bold shape per player, with its own colour and emblem, readable from across
  the table. No faces, no realistic bodies. Hands appear when a player acts.
- **You.** In first person you see your own hands, your side of the table
  and your mask's colour on your sleeve. You never see your own face.
- **Identity.** A player is recognised by mask shape, then colour, then name
  plate. Never by colour alone.

## Light and colour

- Warm, low light from candles and fire against cold, dark stone. Most of the
  frame is dark. Light says where to look.
- Palette: near-black blue stone, warm amber light, bone-white masks, one
  saturated accent per player. Traitor red is reserved for spectators and
  reveals.
- Day (round table) is the candles fully lit. Night is the candles going out
  one by one, leaving the fire's glow. Not a blue filter.
- Soft shadows on. Fog or darkness hides the far wall. Slight film grain and
  vignette; depth of field on close shots.

## Moments

Each needs its own staging; none is a text box.
- **Murder:** morning light finds an empty chair, the victim's mask on the
  table in front of it.
- **Whisper to you:** the sender leans in; the room dims around the two of you.
- **Accusation:** the speaker's hand points; heads turn to the accused.
- **Vote:** each player slides a token toward a name; tokens stay on the table.
- **Banishment:** the chair is pushed back, the figure leaves, the mask is
  turned over to show the role.
- **Recruitment:** a second mask is slid across the table in the dark.

## Camera

- First person: seated eye height, slight breathing sway, look follows the
  pointer within a comfortable arc, eases toward whoever speaks.
- Spectator: a director. Slow push-ins on speakers, over-the-shoulder on
  confrontations, wide for votes. Cuts on events, never mid-sentence.
- No free-floating orbit as the default view.

## Text in the world

Speech appears near the speaker, anchored in the scene and readable (see
`/ui-design` for type and contrast). Private notes look different in kind
(for example, written in the air beside the mask, visible only to
spectators). Menus and the HUD stay flat and quiet, per `/ui-design`.

## Fails the look

- Reads as flat cards, panels or avatars on a tilted plane.
- Default or unlit materials, a visible grid, a plain colour background.
- Evenly lit: no dark areas, no shadows.
- Humanoid models with stiff or sliding limbs, or generic stock characters.
- Emoji, clip-art icons, or UI chrome inside the world.
- Two players who can be confused at a glance.

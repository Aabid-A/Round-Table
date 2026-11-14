---
name: scene-3d
description: Use when writing or changing code under web/src/scene/ or anything rendered in WebGL. How to build the 3D world with three.js and react-three-fiber so it looks lit and solid, loads fast and runs on a laptop and a phone.
---

# Scene 3D

Build the world `/art-direction` describes, as a real WebGL scene. The scene
is driven by the `view` object (`web/src/scene/view.ts`): it draws what the
view says and never reads a game log or room state itself.

## Stack

- `three`, `@react-three/fiber`, `@react-three/drei`,
  `@react-three/postprocessing`. No other 3D, physics or animation library
  without the owner's say.
- The CSS 3D room is retired once the WebGL room covers a mode. Don't keep
  two worlds alive.

## Building things

1. **Geometry is real.** Table, chairs, masks, cloaks, candles, tokens and
   walls are meshes with thickness. Nothing in the world is a flat plane with
   a picture on it.
2. **Make it procedurally.** Build models from three.js geometry (lathe,
   extrude, shape, CSG-style composition) in `web/src/scene/models/`. No
   downloaded models. If an asset file is truly needed it must be CC0, kept
   in `web/public/assets/` with its source and licence in `ASSETS.md`.
3. **Materials are lit.** `MeshStandardMaterial` or `MeshPhysicalMaterial`
   with roughness and colour from tokens in `web/src/scene/palette.ts`. No
   `MeshBasicMaterial` in the world, no default grey.
4. **Light is designed.** Point lights at candles with flicker, a warm fire
   light, a faint cool fill. Shadows on for the key lights
   (`PCFSoftShadowMap`). Fog to black. No flat ambient wash above 0.15.
5. **Post-processing:** vignette, light bloom on flames, film grain, depth of
   field on close shots. Each can be switched off by the quality setting.
6. **Characters move.** Idle breathing, head turn toward the speaker, lean,
   point, slide a token. Animate with springs or eased tweens in `useFrame`;
   never teleport.

## Structure

- `scene/models/` one file per object, pure functions of props.
- `scene/stage/` lights, fog, effects, day and night.
- `scene/actors/` a seated figure and its poses.
- `scene/camera/` first-person and director rigs.
- `scene/moments/` one file per staged moment (murder, vote, banishment...).
- Game rules never live here.

## Performance and loading

- Budget: 60 fps on a mid laptop, 30 fps on a recent phone, under 150 draw
  calls, under 200k triangles, first frame within 3 s on a cold load.
- Instance repeated meshes (chairs, candles, tokens). Reuse geometries and
  materials. Dispose what you remove.
- Three quality levels (high, medium, low) chosen from a quick frame-time
  probe; low drops shadows and post-processing before it drops geometry.
- Lazy-load the scene bundle so the 2D pages stay light.

## Fallbacks and access

- No WebGL, `prefers-reduced-motion`, or a failed probe: the existing 2D page.
- Everything done in the scene can also be done by keyboard and is announced
  to screen readers through a live region. That region carries only what
  this viewer may know.
- Canvas text meets the contrast rules in `/ui-design`.

## Tests

- Unit-test models' and moments' inputs and the view-to-scene mapping.
- Playwright opens each mode with WebGL on (`--use-gl=swiftshader` or
  `--enable-unsafe-swiftshader`) and asserts the canvas drew: non-blank
  pixels, the expected number of seated figures via a `data-` debug hook.
- Then run `/playtest`. Passing tests do not mean it looks right.

## Never

- Put hidden information into the scene graph "but invisible". If the viewer
  may not know it, it is not in the view object.
- Claim a frame rate you did not measure, or one measured only in headless
  software rendering without saying so.

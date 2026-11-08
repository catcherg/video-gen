---
description: Render and visually inspect an episode's busiest frames before a full render
argument-hint: <slug> [frames...]
---

Check frames for episode: $ARGUMENTS

1. Read `src/episodes/<slug>/timeline.ts` and `physics.ts`. If no frames were given, choose them: each camera key arrival, the midpoint of each `via` move, one frame in every label window, each caption change, and frames just before and after every slow-to-real-speed change. Frame = time × fps.
2. Run `npm run stills <slug> <frames...>`.
3. Open every PNG in `out/<slug>/stills/` with the Read tool and look at it. Do not rely on the fact that the command succeeded.
4. For each frame report any of these: camera inside or passing through geometry; label or HUD overlapping the subject; a label behind the HUD or clipped at a frame edge; caption covering the key part being explained; a number on screen that disagrees with physics.
5. List problems by frame number, with the fix you recommend in `timeline.ts` or `overlay.tsx`. If there are none, say the episode is clear to render.

Do not start a full render from this command.

---
description: Scaffold a new episode from the template and wire up its physics
argument-hint: <slug> [topic]
---

Create a new episode: $ARGUMENTS

1. Run `npm run new-episode <slug> -- --title "<title>"`. Use lowercase letters, digits and hyphens for the slug.
2. Read `CLAUDE.md`, then fill in `videos/<slug>/physics.ts` first. Research real specs and firing orders and list a source for each in the file's top comment. If a figure is single-sourced or from forums, say so there and tell the user.
3. Replace the other TODOs: `meta.ts` description, `timeline.ts` camera keys and captions (original wording, numbers built from physics), and `audio.ts` voices.
4. Define `toneChecks` from what the engine should actually sound like. Do not assume the firing frequency is dominant when firing is uneven per bank.
5. Run `npm test`, `npm run typecheck`, `npm run audio <slug>` and `npm run verify-audio <slug>`.
6. Run the /check-frames workflow on the placeholder scene before building detailed geometry.

Keep `PlaceholderEngine` until the user asks for the full scene.

---
description: Scaffold a new video from the template and wire up its facts
argument-hint: <slug> [title]
---

Create a new video called `$ARGUMENTS`.

1. Run `npm run new-video <slug> -- --title "<title>"`. Use lowercase letters, digits and hyphens for the slug. Add `-- --kit engine` only for an engine video. The general template also generates the song and its song map.
2. Read `CLAUDE.md`, then fill in the facts in `videos/<slug>/spec.json` first. Research real figures and list a source and confidence level for each. If a figure is single-sourced or from forums, say so there and tell the user.
3. Ask the user to listen to `videos/<slug>/output/audio.wav`. Don't build visuals until they approve the song. Record its hash in the spec as `lockedWavSha256` and in `docs/PROJECT_STATUS.md`.
4. Write the story in `spec.json` (shots and captions), then `physics.ts`, `timeline.ts` and `scene.tsx`.
5. Run `npm test`, then `npm run check-video <slug>`, and fix everything it reports.
6. Follow the check-frames workflow before any full render.

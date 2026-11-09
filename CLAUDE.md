# Video Gen

A framework for short vertical explainer videos on any topic, in a pixel-art 3D style (1080×1920, 30 fps, about 30 s), with picture and music generated entirely from code. Stack: Remotion 4, @remotion/three, React Three Fiber, three.js, TypeScript.

It started as a series of engine explainers. Engines are now one kit among many that the framework will support. **End goal:** an interface where someone describes a video, uploads information, and gets back the finished video and an original song. See [Roadmap](#roadmap).

The full production process, with reasoning and worked formulas, is in [docs/VIDEO_PRODUCTION.md](docs/VIDEO_PRODUCTION.md). Read it before starting or substantially changing a video. `videos/v12` is the reference implementation.

Video status, approved song hashes, milestone progress and the backlog are in [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md). Read it at the start of any new work, and keep it up to date.

"Episode" in code and commands means one video.

## Non-negotiable rules

1. **Determinism.** Everything visible or audible is a pure function of the frame number. No clocks, `Math.random` or per-frame deltas. Use `hash` from `src/core/math.ts` in visuals and `createRng` in audio. Any frame must render identically in isolation.
2. **One source of facts per video.** Scene, HUD, labels, captions and audio read from the video's facts: the `facts` in `spec.json` and values computed from them in `physics.ts`. Never hard-code a number on screen that can be computed; build caption text from those values.
3. **Real claims.** Specs, dates, figures and frequencies must be correct, whatever the topic. Every fact needs a source and a confidence level, and every `physics.ts` starts with a comment listing its sources. If a figure is single-sourced, assumed or variant-specific, say so and tell the user. Never present an invented number as real.
4. **Original content only.** No copied captions or scripts from other creators. No brand logos, badges or trademarked designs on models. Generic cars are fine. Use uploaded material as a source of facts, not as content to copy.
5. **Check frames before any full render.** See the workflow below.
6. **Song first, then the animation.** Create the song and get it approved and locked before building any visuals. Then the animation adapts to the song, never the reverse: run `npm run song-map <slug>` on the finished WAV and take every visual hit (kicks, stabs, cuts, flashes, titles) from the generated `songMap.ts`, not from the song's schedule. If a hit does not line up, change the animation, not the song. A picture hit must never land before its sound, including the very first frames, where a fade-in delays the first hit.

## Framework rules

- **`src/core/` stays subject-neutral.** Nothing in it may import from a kit or a video, or mention a subject. A test enforces this. Anything specific to a subject belongs in `src/kits/<kit>/`.
- **Every video lives in one folder**, `videos/<slug>/`, with its generated files in the ignored `videos/<slug>/output/`. Nothing specific to a video goes anywhere else, and videos never import from each other.
- **The spec is plain data.** `spec.json` must stay JSON, because the AI pipeline will eventually write it. It is validated every time it loads.
- **Generated code gets no special trust.** Code written by AI goes through the same tests, frame checks and approvals as code written by hand. Compiling is not evidence that a shot works.
- **People approve what cannot be measured.** Timing, overlaps and numbers can be checked automatically. Song taste and whether a shot explains the idea need a person.

## Roadmap

Update the status of each milestone in `docs/PROJECT_STATUS.md`.

1. **Core split, umbrella folder and spec.**
   - Reorganise the repository so all generated videos sit under one umbrella folder, `videos/`, with each video's source and generated output together.
   - Separate the subject-neutral core from an engine kit.
   - Define the video spec, and have it drive V12's format, song grid, facts and captions.
   - Prove every finished video is byte-identical afterwards, in both frames and audio.
2. **Generic visual library.** Shape, motion and layout tools, general diagrams (charts, timelines, flows, comparisons, maps), and automated code checks for generated scenes.
3. **Song generator.** Style and structure in, a seeded and repeatable WAV out, with `song-map` running automatically.
4. **First non-machine video from a spec.** "Why the sky is blue", then a history or finance topic to test sourcing.
5. **AI pipeline.** Uploads become facts, then a story, a spec and scene code, with automatic retries when checks fail.
6. **Interface and render workers.** Describe, upload, approve the song, review frames, download the video.

## Layout

```
videos/           Umbrella folder: one folder per generated video
  registry.ts     Every video is listed here; Root.tsx registers one Composition each
  <slug>/
    spec.json     optional for now: format, question, song grid, sourced facts, shot list, captions
    meta.ts       title, description, fps, duration, size (derived from spec.json when there is one)
    physics.ts    computed values and sources; for engines, RPM curve, slow-motion, firing order, toneChecks
    geometry.ts   model dimensions and world placement, shared by scene and overlay
    scene.tsx     3D scene inside <PixelStage>
    timeline.ts   camera keys, captions, label windows, shot focus, diagram windows
    overlay.tsx   2D layer: callouts, HUD, captions, diagrams, flashes
    song.ts       optional: bars, kicks and other musical data shared by audio and visuals
    songMap.ts    generated by song-map: the video frame on which each hit is actually audible
    audio.ts      mix settings or a full song
    index.tsx     makeEpisode(slug, Scene, Overlay)
    physics.test.ts  tests for the video's numbers
    output/       ignored: audio.wav, <slug>.mp4, <slug>-preview.mp4, stills/
src/core/         Subject-neutral: spec, camera rig + projection, PixelStage, Lam + DimContext, Captions,
                  Callout, DiagramPanel, Tag, Flashes, fonts, base theme, WAV encoding, music synthesis
src/kits/engine/  Engine kit: fourStroke physics + testkit, engineAudio, HUD, engine diagrams, part colours,
                  parts/ (PistonRod, Crankshaft, ValveTrain, Headers, F1*, Garage, cars/, Gallery, ...)
public/           fonts/, and videos -> ../videos (symlink so Remotion can serve each video's output/)
docs/             VIDEO_PRODUCTION.md (production playbook), PROJECT_STATUS.md (status, songs, backlog)
scripts/          audio, song-map, stills, render, verify-audio, new-episode
templates/        Files copied by new-episode (currently an engine video)
poc/              Original proof of concept, kept for reference. Not part of the build.
```

Units in engine scenes: 1 = 10 cm.

## Commands

```bash
npm run studio                       # Remotion Studio preview
npm run new-episode <slug>           # scaffold and register a new video
npm test                             # spec, boundary and physics tests
npm run typecheck
npm run audio <slug>                 # writes videos/<slug>/output/audio.wav
npm run song-map <slug>              # measures the WAV, writes videos/<slug>/songMap.ts for the animation
npm run stills <slug> <frames...>    # writes videos/<slug>/output/stills/still_NNNN.png
npm run verify-audio <slug>          # FFT check against physics, within 1%
npm run render <slug>                # audio, then videos/<slug>/output/<slug>.mp4 (1 tab, byte-reproducible)
npm run render <slug> -- --fast      # videos/<slug>/output/<slug>-preview.mp4 (4 tabs, about 2.5× faster)
npx remotion still parts-gallery out/gallery.png   # eyeball the engine kit's car models
```

Final renders use one browser tab on purpose. With more tabs, a few frames differ by about 0.05% of pixels between runs, which breaks rule 1 in the strict sense. Use `--fast` for previews only.

GL settings live in `render-settings.ts`. `angle` uses the Mac's GPU.

## The video spec

`spec.json` is defined and validated by `src/core/spec.ts`. In V12 it drives:

- `format`, `title`, `description`: `meta.ts` is derived from them.
- `song`: tempo, beats per bar and bars, read by `physics.ts`. It also records the approved WAV's hash.
- `facts`: each has a value, sources and a confidence level. `physics.ts` reads its inputs from them.
- `captions`: timed in seconds, or bars and beats. `{token}` placeholders are filled from values the video computes, so text can't disagree with physics.

`shots` is the shot list. The renderer doesn't read it yet, but tests check it against the video's real diagram windows. Camera moves and the 3D scene stay in code.

## Check frames before rendering

Before any full render:

1. Pick the busiest moments: every camera arrival, every label window, each caption change, the slow-to-real-speed transitions.
2. `npm run stills <slug> <frames...>`, then open and look at each PNG. Inspect at least one at full size, because some problems don't show in thumbnails.
3. Confirm the camera never passes through geometry, including during moves between keys. Check the midpoint of every `via` move.
4. Confirm nothing stands between the camera and the subject, and that the subject sits between the HUD and the captions.
5. Confirm no label or HUD element overlaps the subject, sits behind the HUD or a caption, or is clipped at the frame edge. No leader line may cross another line or a label.
6. Confirm every number on screen agrees with the facts, and that diagrams match the 3D scene at a known moment.
7. Fix `timeline.ts` or `overlay.tsx` and re-check. Then render.

After rendering, run `npm run verify-audio <slug>`.

## Adding a video

The scaffold currently produces an engine video. A general template arrives with Milestones 2 to 4.

1. Run `npm run new-episode <slug> -- --title "Title"`, or use `/new-episode`. It copies `templates/episode/` and registers the video. The scaffold works as-is with a placeholder inline-4, so fix TODOs one at a time and keep it running.
2. Replace the placeholders in `physics.ts` first. Add sources. Use `createFourStroke` for four-stroke engines, with `firingAnglesDeg` if the engine is odd-fire.
3. Define `toneChecks`: real-speed sections held at constant RPM, clear of ramps and whooshes. `expectedHz` is what should be dominant, and it is not always the firing frequency. With uneven firing per bank, pan each bank to its own side with `pulsePan`, set `channel` on the check, and predict the tone with `dominantPulseHz`. `videos/v8-cross-flat` does this.
4. Add `physics.test.ts` with `describeFourStroke`.
5. Build the scene from the kit's `parts/`, replacing `PlaceholderEngine`. Add new reusable models to the kit, not to the video.
6. Create the song, get it approved, record its hash, then run `npm run song-map <slug>`. Do this before building shots.
7. Follow the check-frames workflow, then render.

## Production rules

These define the finished quality level. Follow them for every full video, in this order. Rules marked *Engine kit* apply to engine videos; the rest apply to every topic. Reasoning and formulas are in [docs/VIDEO_PRODUCTION.md](docs/VIDEO_PRODUCTION.md).

**Story and facts**

- Answer one question per video: hook, explain in steps, payoff. *Engine kit:* hook, slow down, explain, return to real speed, payoff.
- Source each fact separately, and record its confidence when it is single-sourced, forum-sourced, assumed or variant-specific. Tell the user about weak sources.
- Check that related facts agree with each other, not only that a citation exists. *Engine kit:* firing order, crank layout and bank alternation must agree.
- Never present an invented number as real. Label illustrative values on screen.

**Beat grid**

- Pick a BPM where `60 × fps / BPM` is a whole number, and make the duration a whole number of bars.
- Use `beatT`/`barT` for times.
- *Engine kit:* choose the tempo from the engine: `SLOW = redline bangs per second / ((BPM / 60) × subdivision)`. Derive `SLOW` rather than typing it.
- *Engine kit:* use RPM steps of redline divided by powers of two, so each halving moves up one note value. Change slowed RPM only on bar lines, in steps, and never ramp while slowed.
- *Engine kit:* use `phaseLockT` on a downbeat, and add a test that every slowed bang is on the grid.

**Song**

- Make a real song with chords, bass, drums, melody and an arrangement that builds with the story.
- Put shared musical data in the video's `song.ts`, read by both `audio.ts` and the visuals.
- Timing can be measured but taste cannot. Get the user's approval on the song before building on it.
- Once approved, record the WAV's SHA-256 in `docs/PROJECT_STATUS.md` and confirm it is unchanged after any later work.
- *Engine kit:* turn slowed firing events into drum hits directly from the bang list, so they cannot drift.
- *Engine kit:* tune the song to the engine (`SONG_A4_HZ`) and keep the lead below the engine's note.
- *Engine kit:* give `toneChecks` a `minHz`/`maxHz` band above the music so `verify-audio` measures the engine.

**Shots**

- Write a shot list first: bar number, one subject, caption and diagram for each shot.
- Put every camera arrival, caption change, label and flash on a bar or beat.
- Keep the subject between the HUD (y=484) and the captions (y=1290). At 40° field of view, camera distance is about 3.3 × subject height.
- The scene and overlay must use the same `cameraAt`.

**Detail**

- Model how the subject really behaves, and make things touch where they touch in reality.
- Build only what can be seen: art pixels per unit ≈ `960 / (0.73 × camera distance)` at pixel size 2. Below about 3 art pixels a part won't read.
- Prioritise detail that explains the process over decoration.
- Keep environment props on the far side of the subject from the camera, and put reusable models in the kit.

**Clarity**

- One subject per shot: `focusAt` names it, and `DimContext` fades the rest and drops their fine detail.
- Colour means a job. Define colours once in the kit's `theme.ts`, and use them in 3D, callouts and diagrams alike.
- Show what is invisible, such as gas coloured by stroke.
- Name things with `core/Callout.tsx`, one per beat, in the same top-to-bottom order as the subject. Compute which way the axes run in a shot before choosing label sides.
- Explain with a live panel in `core/DiagramPanel.tsx`, driven by the facts.

**Changing finished work**

- Record what must not change before starting: stills, the audio hash, or both.
- Prove refactors neutral by byte comparison. Keep intentional changes in a separate commit and report which frames changed.
- Visual-only work must leave `audio.ts`, `song.ts` and physics timing alone.

**Publishing**

- Before a public push, scan staged files for keys and personal data, and all history for a new repo.
- Use a GitHub no-reply address. Keep generated media and unlicensed third-party files out of the repo.

## Things to preserve

- Audio synthesis order matters. `createRng` output depends on call order, so reordering synthesis steps changes the WAV.
- `scene.tsx` and `overlay.tsx` must use the same `cameraAt`, or labels drift off their parts.
- The `public/videos` symlink is how Remotion reaches each video's `output/audio.wav`. Keep it if `public/` is reorganised.
- The Remotion agent skills cover general Remotion API usage. This file overrides them for this project. They are not stored in this repo; restore them into `.claude/skills/` with `npx skills experimental_install`, which reads `skills-lock.json`.

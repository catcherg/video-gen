# Video Gen

Video Gen generates 8-bit reels: someone describes a video, uploads information about the subject, and gets back a finished vertical reel (1080×1920, 30 fps, about 30 s) and an original song, on any topic. Picture and music are generated entirely from code. Stack: Remotion 4, @remotion/three, React Three Fiber, three.js, TypeScript.

**What this is becoming:** a local interface for generating those reels, installed on each person's own computer. The machinery underneath already works from one command: `npm run generate` goes from a brief and uploads to a finished video with nobody editing code, stopping for a person to approve the facts, the song and the frames. The interface is a layer on top of that command, and it is the remaining milestone. See [Roadmap](#roadmap).

Engines were the first subject and are now one kit. Everything else in the framework works for any topic.

[README.md](README.md) is the guide for people using it. The full production process, with reasoning and worked formulas, is in [docs/VIDEO_PRODUCTION.md](docs/VIDEO_PRODUCTION.md). Read that before starting or substantially changing a video. `videos/v12` is the reference for quality, and `videos/sky-blue` is the simplest example of a video on a general topic.

Video status, approved song hashes, milestone progress and the backlog are in [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md). Read it at the start of any new work, and keep it up to date.

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
- **Generated code gets no special trust.** Code written by AI goes through the same tests, frame checks and approvals as code written by hand, and must pass `npm run check-video`. Compiling is not evidence that a shot works. Static rules can be bypassed, so generated code only ever runs inside the containment in `scripts/lib/sandbox.ts`.
- **New videos keep text in the safe zone.** Place headlines, diagrams and captions with `REGIONS` from `core/layout.ts`. The finished videos predate this and keep their original layout so they don't change.
- **People approve what cannot be measured.** Timing, overlaps and numbers can be checked automatically. Song taste and whether a shot explains the idea need a person.

## Roadmap

Update the status of each milestone in `docs/PROJECT_STATUS.md`.

**Ready for the interface when:** one command takes a description and uploads and produces a reel, with nobody editing code. The interface is then a layer on top of that command.

1. **Core split, umbrella folder and spec.**
   - Reorganise the repository so all generated videos sit under one umbrella folder, `videos/`, with each video's source and generated output together.
   - Separate the subject-neutral core from an engine kit.
   - Define the video spec, and have it drive V12's format, song grid, facts and captions.
   - Prove every finished video is byte-identical afterwards, in both frames and audio.
2. **Product decisions.** Done; recorded under [Product decisions](#product-decisions).
3. **Generic visual library.** Shape, motion and layout tools, general diagrams (charts, timelines, flows, comparisons, maps), code checks for generated scenes, shared Reels and TikTok safe zones, and a palette for each video set in its spec.
4. **Song generator.** Style and structure in, a seeded and repeatable WAV out, with the data `song-map` needs generated too, so it runs automatically. Two styles: deep bass house by default, and dubstep for slower, more dramatic videos. Tempos must land on whole frames: at 30 fps, 14 frames a beat is about 128.6 BPM for house and 13 frames is about 138.5 BPM for dubstep. Check that bass hits still read on phone speakers, which reproduce little sub-bass. The user listens across both styles and several seeds.
5. **Non-machine videos from specs.** "Why the sky is blue", then a history or finance topic to test sourcing. Neither may need changes to framework code.
6. **Automated checks.** Replace the manual reviews: frame checks, overlaps, on-screen numbers, drum timing and frame comparison. The pipeline can't retry on its own without these.
7. **AI pipeline, run headless.** Uploads become facts, then a story, a spec and scene code, with automatic retries when checks fail. It is one command with resumable stages that stop for approval of facts, song and frames; those stops become the interface's screens. Track the cost and time per video. Decide how each person gets AI access without sharing the owner's key, given that nothing is hosted.
8. **Sandboxing and licensing.** Required before friends and family use it.
   - Isolate generated code from the network and file system, because an uploaded document could steer what gets written and the code runs on the user's own computer.
   - Keep AI credentials out of anything shared with other people.
   - Re-check Remotion's licence if use ever goes beyond friends and family. It is free for individuals and for-profit companies with up to 3 employees, larger companies need a paid licence, and selling a modified copy of Remotion is not allowed.
   - Add a licence to this repository, and set a policy for the rights to uploaded material.
9. **Identity cleanup.** Done: a README, this framing, the `video-gen` package, "video" in code and commands, a general template, and every video on a spec.
10. **Local interface.** One command starts it and prompts the user to open a local page. On that page they describe, upload, approve the song, review frames and download the video. Renders run on the same computer. Setup must be simple enough for non-developers, and must be tested on computers other than this Mac, including ones without a strong GPU. Renders need to repeat on one computer, but not match byte for byte between computers.

## Product decisions

Decided by the user. Later milestones build on these.

- **8-bit is only a visual style:** pixelated rendering and pixel type. It does not restrict colours or music.
- **Colours change with the type of video.** There is no fixed framework palette; each video sets its own.
- **All music is extremely bass-heavy EDM,** with very impactful, punchy bass hits. Deep bass house is the default, and dubstep is the option for slower, more dramatic videos.
- **Musical inspiration is Odd Mob and Subtronics.** Take inspiration from the style only. Never copy their melodies, vocals, samples or track structures, and keep their names out of what appears in a video.
- **Users are friends and family.** It is not a public product.
- **Everyone installs it on their own computer.** Renders run locally, through a local page the user is prompted to open. Nothing is hosted.
- **Everyone uses their own Claude access:** an API key that `npm run set-key` stores outside the repository, readable only by that account, or their own signed-in Claude plan with `--engine claude-code`. Never put a key in this repository.

## Layout

```
videos/           Umbrella folder: one folder per generated video
  registry.ts     Every video is listed here; Root.tsx registers one Composition each
  <slug>/
    spec.json     format, question, song grid, palette, sourced facts, shot list, captions
    meta.ts       title, description, fps, duration, size (derived from spec.json when there is one)
    physics.ts    computed values and sources; for engines, RPM curve, slow-motion, firing order, toneChecks
    geometry.ts   model dimensions and world placement, shared by scene and overlay
    scene.tsx     3D scene inside <PixelStage>
    timeline.ts   camera keys, captions, label windows, shot focus, diagram windows
    overlay.tsx   2D layer: callouts, HUD, captions, diagrams, flashes
    song.ts       optional: bars, kicks and other musical data shared by audio and visuals
    songMap.ts    generated by song-map: the video frame on which each hit is actually audible
    audio.ts      mix settings or a full song
    index.tsx     makeVideo(slug, Scene, Overlay, palette)
    physics.test.ts  tests for the video's numbers
    output/       ignored: audio.wav, <slug>.mp4, <slug>-preview.mp4, stills/
src/core/         Subject-neutral: spec, palette, layout (safe zones and regions), motion, shapes (3D blocks, particles),
                  diagrams/ (bar, line, timeline, flow, comparison, tile map), camera rig + projection, PixelStage,
                  Lam + DimContext, Captions, Headline, Callout, DiagramPanel, Tag, Flashes, fonts, base theme,
                  WAV encoding, music synthesis, music/ (song generator: plan, render, voices), VisualGallery (dev preview)
src/kits/engine/  Engine kit: fourStroke physics + testkit, engineAudio, HUD, engine diagrams, part colours,
                  parts/ (PistonRod, Crankshaft, ValveTrain, Headers, F1*, Garage, cars/, Gallery, ...)
public/           fonts/, and videos -> ../videos (symlink so Remotion can serve each video's output/)
docs/             VIDEO_PRODUCTION.md (production playbook), PROJECT_STATUS.md (status, songs, backlog),
                  UPLOAD_POLICY.md, THIRD_PARTY.md, licenses/
scripts/          audio, song-map, song-samples, stills, render, verify-audio, check-video, check-scene, compare-frames, new-video,
                  generate, set-key, pipeline/ (stages, model client, prompts)
templates/        video/ is the general template, also used by the AI pipeline; engine/ is the engine kit's template
poc/              Original proof of concept, kept for reference. Not part of the build.
```

Units in engine scenes: 1 = 10 cm.

## Commands

```bash
npm run studio                       # Remotion Studio preview
npm run new-video <slug>             # scaffold and register a new video, with a first song (-- --kit engine for an engine video)
npm test                             # spec, boundary and physics tests
npm run typecheck
npm run audio <slug>                 # writes videos/<slug>/output/audio.wav
npm run song-map <slug>              # measures the WAV, writes videos/<slug>/songMap.ts for the animation
npm run song-samples                 # writes generated songs to out/song-samples and measures them (-- --seeds 8 --bars 18)
npm run stills <slug> <frames...>    # writes videos/<slug>/output/stills/still_NNNN.png
npm run verify-audio <slug>          # FFT check against physics, within 1%
npm run set-key                      # save your own Claude API key, outside this repository
npm run generate -- <slug> --brief "..." [--upload file]   # make a video with AI, stopping for your approval (see The AI pipeline)
npm run check-video <slug>           # every automated check; writes videos/<slug>/output/checks.json (-- --quick skips the browser)
npm run check-scene <slug>           # code rules, then frames rendered in opposite orders must match (-- --static for code only)
npm run compare-frames <slug>        # renders every frame and compares with a saved baseline, ignoring render noise (-- --save to save one)
npm run render <slug>                # audio, then videos/<slug>/output/<slug>.mp4 (1 tab)
npm run render <slug> -- --fast      # videos/<slug>/output/<slug>-preview.mp4 (4 tabs, about 2.5× faster)
npx remotion still parts-gallery out/gallery.png   # eyeball the engine kit's car models
npx remotion still visual-gallery out/visual-gallery.png --frame=52   # eyeball the visual library; sections change every 60 frames
```

Final renders use one browser tab on purpose. With more tabs, a few frames differ by about 0.05% of pixels between runs, which breaks rule 1 in the strict sense. Use `--fast` for previews only.

One tab is not always byte-exact either. `v12` and `v8-cross-flat` have matched on every comparison, but two renders of `f1-v8` from the same code can differ on a few dozen of its 1,008 frames, by under 0.004% of pixels. So if a byte comparison fails, use `compare-frames` or render the old code again as a control before calling it a regression. The cause is unknown; see the backlog.

GL settings live in `render-settings.ts`. `angle` uses the Mac's GPU.

## The video spec

Every video has a `spec.json`, defined and validated by `src/core/spec.ts`. It drives:

- `format`, `title`, `description`: `meta.ts` is derived from them.
- `song`: tempo, beats per bar and bars, read by `physics.ts`. It also records the approved WAV's hash.
- `facts`: each has a value, sources and a confidence level. `physics.ts` reads its inputs from them.
- `captions`: timed in seconds, or bars and beats. `{token}` placeholders are filled from values the video computes, so text can't disagree with physics.
- `palette`: a preset for the type of video (`machines`, `science`, `nature`, `history`, `finance`, `health`, `space`), or a full palette, which is rejected if its text would be hard to read.

A spec can generate its song by adding `song.generator`: `{ "style": "house" | "dubstep", "seed": 1 }`, plus optional `rootMidi` and `sections` to put the drop on the video's payoff. The video then needs no `audio.ts` or `song.ts`: `npm run audio` and `npm run song-map` work from the spec, and `songMap.ts` gains `impactFrames` for each drop. Use 14 frames a beat for house and 13 for dubstep at 30 fps.

Specs can also define `diagrams`: named general diagrams drawn by `core/diagrams/Diagram.tsx`. A number in one can be written as `{"fact": "id"}`. Validation enforces text limits so that every label fits. No video uses these yet.

`shots` is the shot list. The renderer doesn't read it yet, but tests check it against the video's real diagram windows. Camera moves and the 3D scene stay in code.

## The AI pipeline

`npm run generate` makes a video in six stages: facts, story, song, scene, frames, render. It stops for a person to approve the facts, the song and the frames, and resumes from saved state in `videos/<slug>/output/pipeline/`. Those stops become the interface's screens. To send a stage back, use `--revise <stage> --note "..."`.

- Each answer is checked before it's used. Facts must cite an upload or a URL that a search really returned. Scene code goes through the static rules before it's written or run, then typecheck and `check-video`, and failures go back to the model. After 4 failed attempts the code is renamed `.rejected` and unregistered, so other videos still build.
- Spending is tracked per call, and the run stops at `--max-usd` (default $10).
- Uploads and web pages are data, never instructions. Keep them that way in any prompt change.
- Generated code is contained by `scripts/lib/sandbox.ts`. In Node it runs from a pre-bundled file under Node's permission system, with no file writes, network, subprocesses or environment. In the browser, a page policy and a wrapper that blocks outside hosts confine it to the render's own server. Never import a generated video's code directly in a script, and don't open one in Remotion Studio, which isn't guarded.
- Remaining limits: Remotion runs Chrome with its own sandbox off, so a browser exploit wouldn't be contained. A page could still navigate to another port on the same computer, and Windows gets the page policy only.
- `--fixture answers.json` replaces the model with scripted answers, at no cost.
- `--engine claude-code` runs on the signed-in Claude plan instead of API credit. It needs `claude auth login`, and PDF uploads need the API engine for now. Dollar figures then show API-equivalent value.
- Long stages print progress, with a heartbeat every 30 seconds while the model works. A scene attempt can take over 15 minutes. `--status` shows what's happening now, and a second run on a video that's already being worked on is refused. Don't pipe the command through `tail`, which hides all of this until the end.

## Check frames before rendering

Run `npm run check-video <slug>` first. It validates the spec and code rules, traces caption numbers to the facts, checks that captions stay up long enough, and compares the WAV, song map and MP4 for sync. On sampled frames it measures the real page for text off the frame or outside the safe zone, overlaps, diagram text that spills or collides, leader lines that cross things, and an empty subject region. Errors fail the video. Videos made before the safe zones only get warnings for layout.

It can't tell whether a shot explains its idea, whether a label points at the right thing, or whether the camera passes through geometry. So a person or a vision review still looks at the frames.

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

`npm run generate` is the normal way: see [The AI pipeline](#the-ai-pipeline). To make one by hand:

1. Run `npm run new-video <slug> -- --title "Title"`, or use `/new-video`. It copies `templates/video/`, registers the video, generates a first song and writes its song map. The result passes `check-video` with placeholder shapes, so fix TODOs one at a time and keep it running.
2. Get the song approved, changing the seed in `spec.json` if needed. Record its hash as `lockedWavSha256` and in `docs/PROJECT_STATUS.md`, then run `npm run song-map <slug>`. Do this before building shots.
3. Replace the placeholder fact in `spec.json` with real facts, each with sources and a confidence level.
4. Write the shots and captions in `spec.json`, then `physics.ts` (with its sources comment), `timeline.ts` and `scene.tsx`. Put reusable models in a kit, not in the video.
5. Follow the check-frames workflow, then render.

### Engine videos

Add `-- --kit engine` to copy `templates/engine/` instead, which works as-is with a placeholder inline-4 and a placeholder music bed.

1. Replace the placeholder facts in `spec.json` first, and the speeds in `physics.ts`. Add sources. Use `createFourStroke` for four-stroke engines, with `firingAnglesDeg` if the engine is odd-fire.
2. Define `toneChecks`: real-speed sections held at constant RPM, clear of ramps and whooshes. `expectedHz` is what should be dominant, and it is not always the firing frequency. With uneven firing per bank, pan each bank to its own side with `pulsePan`, set `channel` on the check, and predict the tone with `dominantPulseHz`. `videos/v8-cross-flat` does this.
3. Extend `physics.test.ts`, which uses `describeFourStroke`.
4. Build the scene from the kit's `parts/`, replacing `PlaceholderEngine`. Add new reusable models to the kit, not to the video.
5. Create the song, get it approved, record its hash, then run `npm run song-map <slug>`. Do this before building shots.
6. Follow the check-frames workflow, then render.

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

- Make a real song with chords, bass, drums, melody and an arrangement that builds with the story. New songs follow the styles in [Product decisions](#product-decisions).
- Put shared musical data in the video's `song.ts`, read by both `audio.ts` and the visuals.
- Generated songs must pass `song-samples`' measurements: no clipping, at least 80% of the energy in the bass, hits that jump at least 5 dB through a simulated phone speaker, and a drop that jumps at least 6 dB. Passing only shows a song isn't broken.
- Timing can be measured but taste cannot. Get the user's approval on the song before building on it.
- Once approved, record the WAV's SHA-256 in `docs/PROJECT_STATUS.md` and confirm it is unchanged after any later work.
- *Engine kit:* turn slowed firing events into drum hits directly from the bang list, so they cannot drift.
- *Engine kit:* tune the song to the engine (`SONG_A4_HZ`) and keep the lead below the engine's note.
- *Engine kit:* give `toneChecks` a `minHz`/`maxHz` band above the music so `verify-audio` measures the engine.

**Shots**

- Write a shot list first: bar number, one subject, caption and diagram for each shot.
- Put every camera arrival, caption change, label and flash on a bar or beat.
- Keep the subject in `REGIONS.subject`. *Engine kit:* the finished videos keep it between the HUD (y=484) and the captions (y=1290). At 40° field of view, camera distance is about 3.3 × subject height.
- The scene and overlay must use the same `cameraAt`.

**Detail**

- Model how the subject really behaves, and make things touch where they touch in reality.
- Build only what can be seen: art pixels per unit ≈ `960 / (0.73 × camera distance)` at pixel size 2. Below about 3 art pixels a part won't read.
- Prioritise detail that explains the process over decoration.
- Keep environment props on the far side of the subject from the camera, and put reusable models in the kit.

**Clarity**

- One subject per shot: `focusAt` names it, and `DimContext` fades the rest and drops their fine detail.
- Colour means a job. Choose the palette for the type of video in the spec, read it with `usePalette`, and use the same colours in 3D, callouts and diagrams alike. *Engine kit:* part colours are defined once in the kit's `theme.ts`.
- Show what is invisible, such as gas coloured by stroke.
- Name things with `core/Callout.tsx`, one per beat, in the same top-to-bottom order as the subject. Compute which way the axes run in a shot before choosing label sides.
- Explain with a live diagram from `core/diagrams/Diagram.tsx`, driven by the facts. Diagram text must read at phone size: check a still scaled down to about 450 pixels wide. *Engine kit:* engine diagrams sit in `core/DiagramPanel.tsx`.

**Changing finished work**

- Record what must not change before starting: stills, the audio hash, or both.
- Prove refactors neutral by byte comparison, or with `compare-frames`, which tells real changes from render noise. Keep intentional changes in a separate commit and report which frames changed.
- Visual-only work must leave `audio.ts`, `song.ts` and physics timing alone.

**Publishing**

- Before a public push, scan staged files for keys and personal data, and all history for a new repo.
- Use a GitHub no-reply address. Keep generated media and unlicensed third-party files out of the repo.

## Things to preserve

- Audio synthesis order matters. `createRng` output depends on call order, so reordering synthesis steps changes the WAV.
- `scene.tsx` and `overlay.tsx` must use the same `cameraAt`, or labels drift off their parts.
- The `public/videos` symlink is how Remotion reaches each video's `output/audio.wav`. Keep it if `public/` is reorganised.
- The Remotion agent skills cover general Remotion API usage. This file overrides them for this project. They are not stored in this repo; restore them into `.claude/skills/` with `npx skills experimental_install`, which reads `skills-lock.json`.

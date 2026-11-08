# Engine Reels

Short vertical "how engines work" explainers in a pixel-art 3D style (1080×1920, 30 fps, about 30 s), generated entirely from code. Stack: Remotion 4, @remotion/three, React Three Fiber, three.js, TypeScript.

An episode is mostly a new physics file, a new 3D model and a new timeline.

## Non-negotiable rules

1. **Determinism.** Everything visible or audible is a pure function of the frame number. No clocks, `Math.random` or per-frame deltas. Use `hash` from `src/core/math.ts` in visuals and `createRng` in audio. Any frame must render identically in isolation.
2. **One physics source per episode.** Scene, HUD, labels, captions and audio read from the episode's `physics.ts`. Never hard-code a number on screen that physics can compute; build caption text from physics values.
3. **Real numbers.** Engine specs, firing orders and frequencies must be correct. Every `physics.ts` starts with a comment listing its sources. If a figure is single-sourced or variant-specific, say so in that comment.
4. **Original content only.** No copied captions or scripts from other creators. No brand logos, badges or trademarked designs on models. Generic cars are fine.
5. **Check frames before any full render.** See the workflow below.

## Layout

```
src/core/       Shared engine: fourStroke physics, camera rig + projection, PixelStage (canvas, lights, pixel pass),
                HUD blocks, Captions, Tag, Flashes, fonts, theme, audio synthesis
src/parts/      Reusable models: PistonRod, Crankshaft, ValveTrain, Headers, BlockShell, cars/, Gallery (dev preview)
src/episodes/
  registry.ts   Every episode is listed here; Root.tsx registers one Composition each
  <slug>/
    meta.ts       title, description, fps, duration, size
    physics.ts    specs + sources, RPM curve, slow-motion, firing order, toneChecks
    geometry.ts   model dimensions and world placement, shared by scene and overlay
    scene.tsx     3D scene built from parts inside <PixelStage>
    timeline.ts   camera keys, captions, label windows
    overlay.tsx   2D layer: labels, HUD, captions, flashes
    audio.ts      mix settings for renderEngineAudio
    index.tsx     makeEpisode(slug, Scene, Overlay)
    physics.test.ts  calls describeFourStroke
scripts/        audio, stills, render, verify-audio, new-episode
templates/      Files copied by new-episode
poc/            Original proof of concept, kept for reference. Not part of the build.
```

Units in 3D scenes: 1 = 10 cm.

## Commands

```bash
npm run studio                       # Remotion Studio preview
npm run new-episode <slug>           # scaffold and register a new episode
npm test                             # physics tests
npm run typecheck
npm run audio <slug>                 # writes public/<slug>/audio.wav
npm run stills <slug> <frames...>    # writes out/<slug>/stills/still_NNNN.png
npm run verify-audio <slug>          # FFT check against physics, within 1%
npm run render <slug>                # audio, then out/<slug>.mp4 (1 tab, byte-reproducible)
npm run render <slug> -- --fast      # out/<slug>-preview.mp4 (4 tabs, about 2.5× faster)
npx remotion still parts-gallery out/gallery.png   # eyeball the reusable car models
```

Final renders use one browser tab on purpose. With more tabs, a few frames differ by about 0.05% of pixels between runs, which breaks rule 1 in the strict sense. Use `--fast` for previews only.

GL settings live in `render-settings.ts`. `angle` uses the Mac's GPU.

## Check frames before rendering

Before any full render:

1. Pick the busiest moments: every camera arrival, every label window, each caption change, the slow-to-real-speed transitions.
2. `npm run stills <slug> <frames...>`, then open and look at each PNG.
3. Confirm the camera never passes through geometry, including during moves between keys. Check the midpoint of every `via` move.
4. Confirm no label or HUD element overlaps the subject, sits behind the HUD, or is clipped at the frame edge.
5. Fix `timeline.ts` or `overlay.tsx` and re-check. Then render.

After rendering, run `npm run verify-audio <slug>`.

## Adding an episode

1. Run `npm run new-episode <slug> -- --title "Title"`, or use `/new-episode`. It copies `templates/episode/` and registers the episode. The scaffold works as-is with a placeholder inline-4, so fix TODOs one at a time and keep it running.
2. Replace the placeholders in `physics.ts` first. Add sources. Use `createFourStroke` for four-stroke engines, with `firingAnglesDeg` if the engine is odd-fire.
3. Define `toneChecks`: real-speed sections held at constant RPM, clear of ramps and whooshes. `expectedHz` is what should be dominant, and it is not always the firing frequency. With uneven firing per bank, pan each bank to its own side with `pulsePan`, set `channel` on the check, and predict the tone with `dominantPulseHz`. `episodes/v8-cross-flat` does this.
4. Add `physics.test.ts` with `describeFourStroke`.
5. Build the scene from `src/parts/`, replacing `PlaceholderEngine`. Add new reusable models to `parts/`, not to the episode.
6. Follow the check-frames workflow, then render.

## Keeping a song in sync

`episodes/v12` shows the pattern for a soundtrack that is locked to the engine:

- Choose the tempo in `physics.ts` so firing events fall on a musical grid while slowed. In the V12, 150 BPM makes redline exactly 32nd notes, which is why `SLOW` is derived (43.5×) and RPM steps are redline divided by powers of two.
- Change slowed RPM only on bar lines, in steps rather than ramps. A ramp would drift the bangs off the grid.
- Use `phaseLockT` on a downbeat, and set `durationS` to a whole number of bars.
- Turn slowed firing events into drum hits directly from the bang list, so they cannot drift.
- Put bars, kicks and other shared musical data in the episode's `song.ts`, read by both `audio.ts` and the visuals.
- Tune the song to the engine (`SONG_A4_HZ`), and give `toneChecks` a `minHz`/`maxHz` band above the bass, chords and lead so `verify-audio` measures the engine.

## Keeping shots clear

Detail is only useful if the viewer knows where to look. `episodes/v12` uses these tools:

- **One subject per shot.** `focusAt` in `timeline.ts` names the shot's subject; `DimContext` fades everything else back, and faded parts drop their fine detail.
- **Colour means a job.** Part and stroke colours live in `core/theme.ts` and are the same in 3D, callouts and diagrams.
- **Callouts** (`core/Callout.tsx`) sit in fixed screen columns. List them in the same top-to-bottom order as their parts so leader lines don't cross, and bring them in on beats.
- **Diagrams** (`core/diagrams.tsx`) sit under the captions and take their values from physics. If a value is illustrative rather than sourced, say so on screen, as the valve-timing panel does.

## Things to preserve

- Audio synthesis order matters. `createRng` output depends on call order, so reordering synthesis steps changes the WAV.
- `scene.tsx` and `overlay.tsx` must use the same `cameraAt`, or labels drift off their parts.
- The Remotion agent skills cover general Remotion API usage. This file overrides them for this project. They are not stored in this repo; restore them into `.claude/skills/` with `npx skills experimental_install`, which reads `skills-lock.json`.

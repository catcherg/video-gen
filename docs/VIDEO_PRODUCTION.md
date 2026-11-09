# Video Production Playbook

How to make a reel at the quality of the finished V12 video: 1080×1920, 30 fps, about 30 seconds, generated entirely from code.

The process was worked out on engine videos, so many of the examples and formulas below are about engines. The stages and gates apply to every topic. `videos/sky-blue` shows them on a video with no engine in it, and `CLAUDE.md` marks which rules only apply to the engine kit.

`videos/v12` is the reference implementation. When this document and the code disagree, trust the code and fix this document. The rules that every session must follow are summarised in [CLAUDE.md](../CLAUDE.md).

## The pipeline

Work through the stages in order. Each one has a gate, and later stages are expensive to redo if an earlier gate was skipped.

| # | Stage | Produces | Gate before moving on |
|---|---|---|---|
| 1 | Pick one idea | A single question the video answers | The answer fits in one sentence |
| 2 | Establish the facts | Sourced specs in `physics.ts` | Every number has a source and a confidence level |
| 3 | Build the physics | RPM curve, firing events, derived values | Physics tests pass |
| 4 | Lock the beat grid | BPM, slow factor, bar map | Every slowed bang lands on the grid |
| 5 | Write the song | `song.ts` and `audio.ts` | `verify-audio` passes and the user likes it |
| 6 | Plan the shots | Camera keys, captions, one subject per shot | Every shot has a named subject and a bar number |
| 7 | Model the detail | Parts in the kit, such as `src/kits/engine/parts/` | Detail is visible at the shot's camera distance |
| 8 | Add clarity | Focus, colour, callouts, diagrams | A viewer can tell where to look with the sound off |
| 9 | Review frames | Stills at the busiest moments | The full checklist below is clear |
| 10 | Render and verify | `videos/<slug>/output/<slug>.mp4` | Tests, audio check and video properties pass |
| 11 | Publish | Commit and push | Secret scan is clean |

## 1. Pick one idea

A 30-second video can carry one idea. The V12 reel answers "what makes the scream?" and every shot builds toward its answer: 870 bangs a second become one note.

Structure the video as hook, slow down, explain in steps, return to real speed, payoff. The return to real speed is where the viewer gets the reward for the explanation, so it needs a matching moment in the music.

## 2. Establish the facts

Accuracy is what makes these videos worth watching, and the proof of concept got it wrong: it used the firing order of an older Lamborghini V12.

- Search for each spec separately. Prefer manufacturer data, then reputable technical press, then forums.
- List every source in the comment at the top of `physics.ts`.
- Record confidence. If a figure is single-sourced, forum-sourced or applies to one variant only, say so in that comment and tell the user.
- Sanity-check against the engineering, not only the citation. One listed Ford Voodoo firing order would have required an unusual crank, and a source claimed it matched a cross-plane engine, so it was rejected. Check that the firing order, crank layout and bank alternation all agree with each other.
- Never present an invented number as real. If a value is illustrative, label it on screen, as the "SCHEMATIC" valve-timing panel does.

## 3. Build the physics

`physics.ts` is the only source of truth. The scene, HUD, labels, captions, diagrams and audio all read from it.

- Use `createFourStroke`, with `firingAnglesDeg` for odd-fire engines.
- Derive values rather than typing them. Crank radius comes from stroke, and caption text is built from physics, for example `` `${fmtInt(REDLINE)} RPM` ``.
- Add `physics.test.ts` using `describeFourStroke`. It checks firing rate, firing order coverage, crank continuity and timestamp order.
- Everything must be a pure function of the frame number. Use `hash` for visuals and `createRng` for audio. Never use clocks, `Math.random` or per-frame deltas.

## 4. Lock the beat grid

This is what makes the music feel welded to the engine. Before this approach only 15% of bangs landed near a music step, off by 63 ms on average. Afterwards every drum hit measured was within 3 ms of the beat.

**Choose the tempo from the engine, not the other way round.**

Slowed firing rate is `(RPM / 60) × (cylinders / 2) / SLOW`. Pick a BPM, then solve for the slow factor that puts redline on a note value:

```
SLOW = redline bangs per second / ((BPM / 60) × subdivision)
V12:   870 / (2.5 × 8) = 43.5, which makes redline exactly 32nd notes at 150 BPM
```

Then use RPM steps of redline divided by powers of two. Each halving moves up one note value, so 32nds, 16ths, 8ths and quarter notes are literally the engine at full, half, quarter and eighth of redline.

Grid rules:

- Pick a BPM where `60 × fps / BPM` is a whole number, so beats land on frames. At 30 fps, 150 BPM gives 12 frames per beat. 90, 100, 120 and 180 also work.
- Make the duration a whole number of bars. The V12 is 20 bars at 1.6 s, exactly 32 s.
- Change slowed RPM only on bar lines, and in steps. A ramp drifts every later bang off the grid.
- Lock the crank phase to a downbeat with `phaseLockT`.
- Express times with `beatT` and `barT` as a single division, so they match the crank table exactly.
- Add tests that every slowed bang is on the grid. See `videos/v12/physics.test.ts`.

On an engine with even firing and alternating banks, bank A falls on beats 1 and 3 and bank B on beats 2 and 4, which gives a natural kick and snare. For odd-fire engines, voice the real bangs and keep only the rest of the kit on the grid.

## 5. Write the song

The soundtrack has to be a real song: chords, bass, drums, a melody and an arrangement that builds.

- **Bangs are the drums.** In slow motion, turn each firing event into a drum hit directly from the bang list, so it cannot drift.
- **Tune the song to the engine.** Set A4 to half the redline note, so the engine's tone is the song's tonic. See `SONG_A4_HZ`.
- **Map the arrangement to the story.** Each doubling of RPM is a musical build. The largest drop in the song lands at the return to redline.
- **Keep the engine audible as an instrument.** In the intro, carve its note into a rhythm with throttle stabs. In the chorus, duck it under each kick.
- **Share the structure.** Bars, kicks and stabs live in the video's `song.ts`, read by both the audio and the visuals.
- **Check the engine separately from the music.** Give `toneChecks` a `minHz` and `maxHz` band above the bass, chords and lead. Keep the lead melody below the engine's note.
- **Uneven engines need per-bank analysis.** Pan each bank with `pulsePan`, set `channel` on the check, and predict the tone with `dominantPulseHz`.

Synthesis order matters. `createRng` output depends on call order, so reordering steps changes the WAV.

The computer cannot hear the result. Timing, tuning and balance can be measured, but only a person can decide whether the song is good, so get the user's approval before building on it.

**Once a song is approved, lock it.** Record its hash in [PROJECT_STATUS.md](PROJECT_STATUS.md) before touching anything else, and compare afterwards:

```bash
shasum -a 256 videos/<slug>/output/audio.wav
```

## 6. Plan the shots

Write a shot list before moving any camera. Each shot needs a bar number, a subject, a caption and a diagram.

| Bars | V12 shot | Subject | Diagram |
|---|---|---|---|
| 0–1 | Car exterior | The hook | None |
| 2–3 | Engine rises, top view | Layout and banks | Firing order |
| 4–6 | Head-on front pair | The four strokes | Cylinder and stroke dial |
| 7–9 | Level side view | Crank and rods | Crank, end on |
| 10–11 | Above | Cams and valves | Valve timing |
| 12–13 | Wide | The whole engine at redline | Firing order |
| 14–15 | Pull back | Return to real speed | Exhaust pulses |
| 16–19 | Car exterior | The payoff | Exhaust pulses |

- Put every camera arrival, caption change, label and flash on a bar or beat.
- Add a small zoom on each kick by wrapping the rig in `cameraAt`. The overlay must use the same function, or labels drift off their parts.
- Keep the subject inside the clear band, between the HUD (ends at y=484) and the captions (start at y=1290). That leaves 790 px.
- Work out camera distance before guessing. At 40° field of view, a subject `H` units tall needs a distance of about `3.3 × H` to fill the band. Crank to cam is 5.5 units, so the camera sits about 18 units away.

## 7. Model the detail

Use real kinematics, and make parts meet where they meet in a real engine. Cam lobes in the V12 are sized so the nose touches the follower exactly at full valve lift.

**Only build detail that can be seen.** With a pixel size of 2, the frame is 540×960 art pixels. At 40° field of view:

```
art pixels per unit ≈ 960 / (0.73 × camera distance)
```

At 20 units that is about 66 per unit, so a 0.05-unit part is roughly 3 art pixels, about the smallest that reads. Spend modelling effort on parts the camera gets close to.

- Build reusable parts in the kit, such as `src/kits/engine/parts/`, not inside a video.
- Give moving parts real motion from physics: pistons, rods, crank, cams at half speed, valves, chain, pulleys.
- Add layers in order of explanatory value. Things that show the process, such as gas, sparks, fuel and exhaust, matter more than decoration.
- Environment props belong on the far side of the car from the camera.
- Compute any moving part's direction before building it. The original engine cover swung down through the car because a hinge rotation had the wrong sign.

## 8. Add clarity

Detail without hierarchy is noise. The clearest version of the V12 came from these tools, and they should all be applied together.

- **One subject per shot.** `focusAt` in `timeline.ts` names the subject. `DimContext` fades everything else, and faded parts drop their fine detail.
- **Colour means a job.** Part and stroke colours are defined once in `src/core/theme.ts` and used in 3D, callouts and diagrams alike. Intake is blue, exhaust is red, the crank is gold, and each bank has its own rod colour.
- **Show what is invisible.** The gas in the cylinder is coloured by stroke and gets denser under compression.
- **Name the parts.** `src/core/Callout.tsx` draws a label in a fixed screen column with a leader line to the part. Bring labels in one per beat.
- **Explain with a live diagram.** `src/core/diagrams/Diagram.tsx` draws general diagrams for any topic. For engines, `src/kits/engine/diagrams.tsx` panels sit below the captions and take their values from the same physics as the scene.
- **Sharpen the image.** The V12 uses `pixelSize={2}` with stronger outline settings than the default.

Callout layout rules:

- List labels in the same top-to-bottom order as the parts they point to, so leader lines do not cross.
- Work out which way the axes run in each shot before choosing sides. The screen-right vector is `forward × up`, so in the V12 side shot +x is screen-left.
- Never let a leader line pass through another label.

## 9. Review frames

Render stills before every full render, and open each one. A command that succeeds says nothing about how the frame looks.

```bash
npm run stills <slug> <frames...>
```

Check every camera arrival, the midpoint of every `via` move, each label window, each caption change, and both sides of every speed change.

For each frame:

- [ ] The camera is not inside or passing through anything.
- [ ] Nothing stands between the camera and the subject.
- [ ] No label sits behind the HUD, is clipped at an edge, or is hidden behind a caption.
- [ ] No leader line crosses another line or a label.
- [ ] The subject is inside the clear band.
- [ ] Every number on screen agrees with physics.
- [ ] Inspect at least one frame at full size. Some problems do not show in thumbnails.

Problems that have actually happened, and what to look for:

| Problem | Cause | Fix |
|---|---|---|
| Lift posts blocked the car | Props placed on the camera's side | Keep props on the far side |
| Hoist chains crossed top-down shots and nearly hit the camera | Rigging above the engine | Lift from below with a ram |
| A dust mote filled part of the frame | Particle spawned near the camera | Confine particles away from camera paths |
| Open cover read as a white slab | Top face turned toward the camera | Fold fully flat and line the inner face |
| Cylinder labels hid behind the HUD | Projected label had no limits | Clamp with `keepClear` |
| Tag vanished behind a caption | Anchor projected into the caption band | Move the anchor |
| Leader lines tangled | Labels not ordered by height | Order labels to match their parts |
| Flywheel labelled on the wrong side | Assumed axis direction | Compute screen direction |
| Diagram disagreed with the 3D crank | Missing bank-angle offset | Check diagrams against the scene at a known moment |

## 10. Render and verify

```bash
npm test
npm run typecheck
npm run render <slug>
npm run verify-audio <slug>
```

- Final renders use one browser tab, because multiple tabs change a few frames slightly between runs. Use `npm run render <slug> -- --fast` for previews only.
- Confirm the MP4 is the expected size, frame count and duration, and that it has audio.
- GPU rendering uses `angle`, set in `render-settings.ts`.

Sync should be measured on the finished MP4, since that is what people hear. In the V12 this was done with a one-off script that detected drum onsets and measured their distance from the beat. That script is not in the repo yet.

## 11. Changing a finished video

- Record what must not change before starting: stills, the audio hash, or both.
- Refactors must be provably neutral. Compare PNGs byte for byte, and render every frame on both sides for the strongest proof.
- Keep intentional changes in a separate commit from refactors, and report exactly which frames changed.
- Physics changes can move the audio. Visual-only work should leave `audio.ts`, `song.ts` and the timing in `physics.ts` alone.

## 12. Publish

Before anything is pushed publicly:

- Scan the staged files, and all history for a new public repo, for keys and personal data.
- Use a GitHub no-reply address for commits.
- Keep generated audio and video out of the repo.
- Do not commit third-party files without a clear license. Remotion's skills are restored from `skills-lock.json` instead.
- Keep models and captions original, with no logos, badges or copied scripts.

## Definition of done

- [ ] One idea, answered by the end of the video
- [ ] Every spec sourced, with confidence noted
- [ ] All on-screen numbers derived from physics
- [ ] Slowed bangs on the musical grid, proven by tests
- [ ] Song approved by a person, then locked by hash
- [ ] Every shot has one subject, a label set and a diagram where useful
- [ ] Frame checklist clear, including a full-size inspection
- [ ] Tests, typecheck and `verify-audio` pass
- [ ] Final render made with one tab
- [ ] Publishing checks clear

## Reference: the finished V12

| Measure | Value |
|---|---|
| Length | 960 frames, 20 bars, 32 s |
| Tempo | 150 BPM, 12 frames per beat |
| Slow motion | 43.5× |
| Slowed firing rates | 2.5, 5, 10 and 20 bangs per second |
| Engine note | 870 Hz, the song's tonic A |
| Drum timing in the finished MP4 | Within 3 ms of the beat |
| Engine tone against its octave | 4.6 to 5.7 dB clear |
| Final render | About 66 s on an M2, 31 MB |

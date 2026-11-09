# Project Status

Where each video stands, which songs are locked, and what is left to do. Update this file whenever one of those changes.

## Framework milestones

The goal is an interface that turns a description and uploaded information into a finished video and song, on any topic. Details are in the Roadmap section of `CLAUDE.md`.

| # | Milestone | State | Notes |
|---|---|---|---|
| 1 | Core split, umbrella folder and spec | Done | All three videos and WAVs were byte-identical before and after. V12 is the only video on the spec so far. |
| 2 | Product decisions | Done | Recorded in `CLAUDE.md`. Everyone installs it on their own computer. |
| 3 | Generic visual library | Not started | Includes the safe zones from the backlog, and a palette per video. |
| 4 | Song generator | Not started | Deep bass house by default, dubstep as the option for slower, dramatic videos. |
| 5 | Non-machine videos from specs | Not started | "Why the sky is blue", then a history or finance topic. |
| 6 | Automated checks | Not started | Includes the sync and frame-comparison scripts from the backlog. |
| 7 | AI pipeline, run headless | Not started | Must settle how each person gets AI access without sharing the owner's key. |
| 8 | Sandboxing and licensing | Not started | Required before friends and family use it. |
| 9 | Identity cleanup | Not started | At the start of interface work: README, 8-bit reel framing in `CLAUDE.md`, renames, general template. |
| 10 | Local interface | Not started | One command starts it and prompts the user to open a local page. Renders run on the same computer. Needs simple setup, tested beyond this Mac. |

Known gaps after Milestone 1:

- `f1-v8` and `v8-cross-flat` still use a hand-written `meta.ts` and captions, not a spec.
- `new-episode` still scaffolds an engine video without a spec.
- V12's camshaft and valve counts are marked `assumed` in `spec.json`, because no source was ever recorded for them. Find one.

## Episodes

| Episode | State | Notes |
|---|---|---|
| `v12` | Finished | The reference for quality. Song approved by the user. |
| `f1-v8` | Finished | Honda RA808E, 2008 F1 2.4 L V8, sourced from the Honda R&D Technical Review F1 special. Deep bass house song, approved and locked. Stroke, crank type and firing order are not in the Honda papers: see the source notes in `physics.ts`. |
| `v8-cross-flat` | Stub | Physics, camera, captions and audio checks are wired up. Geometry is still `PlaceholderEngine`, and its audio is not a full song yet. |

## Locked songs

These songs are approved. Do not change them without asking the user. After any work on the episode, regenerate the WAV and confirm the hash still matches:

```bash
npm run audio v12
shasum -a 256 videos/v12/output/audio.wav
```

| Episode | Approved WAV SHA-256 |
|---|---|
| `v12` | `888e4c9f260f1523857f3dddcf311369b134cc05e5cabfbaf695c3d3bf19bfd6` |
| `f1-v8` | `db3c0a963368a75578b9fedf9f24b8a906f91133c34deb56688adb10e52dad1f` |

## Backlog

Nothing here has been started. Suggested order: safe zones first, because that changes the layout of every episode. Leave 60 fps until the visuals settle, since it invalidates frame-based checks.

1. **Reels and TikTok safe zones.** Now part of Milestone 3. The HUD starts at y=150, captions at y=1290, and the diagram panel runs from y=1478 to y=1758, so platform buttons may cover parts of them. Move the positions into a shared safe-area setting in `src/core/`, then check them against each platform's current guidance and a real upload.
2. **Build the full V8 scene.** Replace `PlaceholderEngine` with detailed parts and a car, and give it a real song that follows the beat-grid rules. Make it clear that the HUD shows the firing rate while captions give the per-bank note. During the camera swings around frames 190 and 585, pistons reach the frame edge.
3. **End-card and branding slot.** Add an optional end card to `makeEpisode`, with its length in `meta.ts` so the video and audio fades move with it. Use the user's own branding only.
4. **Subtitle export.** Captions are already timed data with physics-derived text, so a `subtitles <slug>` script can write SRT or VTT from `timeline.ts`.
5. **60 fps option.** Physics and camera run on time, so they carry over. The seeded flicker uses the frame number and would need retuning, render time roughly doubles, crank strobing at real speed changes, and frame numbers in checks need redoing.
6. **F1 V8 sources.** Find a published stroke, crank type and firing order for the Honda RA808E, plus the reading convention for the "19/64" valve timing in the valvetrain paper. The video currently labels the firing order as typical.
7. **Better sources.** Find factory documents for the L539 firing order and bank numbering, the SVJ's 8,700 rpm limit, the F136 firing order, and real L539 valve timing to replace the panel labelled "SCHEMATIC".
8. **Sync and frame-comparison scripts.** Now part of Milestone 6. The checks that measured drum timing on the finished MP4 and compared every frame between renders were one-off scripts and are not in the repo. Add them under `scripts/`.
9. **Fully repeatable multi-tab renders.** Find out why a few frames differ by about 0.05% of pixels with several tabs. If that is fixed, final renders could use four tabs and take well under half the time.

## Done from the original backlog

- **Better car body:** real engine bay, split folding cover, and added body detail.
- **Nicer music bed:** replaced by the original V12 song, locked to the engine.
- **Wider `verify-audio` margin on the V12:** the engine note is now 4.6 to 5.7 dB clear of its octave, up from 1.2 dB.

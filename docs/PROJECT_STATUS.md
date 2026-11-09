# Project Status

Where each video stands, which songs are locked, and what is left to do. Update this file whenever one of those changes.

## Framework milestones

The goal is an interface that turns a description and uploaded information into a finished video and song, on any topic. Details are in the Roadmap section of `CLAUDE.md`.

| # | Milestone | State | Notes |
|---|---|---|---|
| 1 | Core split, umbrella folder and spec | Done | All three videos and WAVs were byte-identical before and after. V12 is the only video on the spec so far. |
| 2 | Product decisions | Done | Recorded in `CLAUDE.md`. Everyone installs it on their own computer. |
| 3 | Generic visual library | Done | Palettes, safe zones, motion, 3D shapes, six diagram types and `check-scene`. Only the gallery uses them so far; Milestone 5 is the first real test. |
| 4 | Song generator | Done | Deep bass house by default, dubstep as the option for slower, dramatic videos. The user approved six samples; their hashes are under Locked songs. |
| 5 | Non-machine videos from specs | Done | `sky-blue` and `voc-economics` are approved. Neither needed framework changes. The gaps they exposed are listed below. |
| 6 | Automated checks | Done | `check-video` and `compare-frames`. Tested against deliberately broken layouts. They found three problems in finished videos, listed below. |
| 7 | AI pipeline, run headless | Built, waiting on a real run | `npm run generate`. Dry-run end to end with scripted answers. It has never called the real model, because that needs a key and spends money. Each person uses their own key. |
| 8 | Sandboxing and licensing | Not started | Required before friends and family use it. |
| 9 | Identity cleanup | Not started | At the start of interface work: README, 8-bit reel framing in `CLAUDE.md`, renames, general template. |
| 10 | Local interface | Not started | One command starts it and prompts the user to open a local page. Renders run on the same computer. Needs simple setup, tested beyond this Mac. |

Known gaps after Milestone 1:

- `f1-v8` and `v8-cross-flat` still use a hand-written `meta.ts` and captions, not a spec.
- `new-episode` still scaffolds an engine video without a spec.
- V12's camshaft and valve counts are marked `assumed` in `spec.json`, because no source was ever recorded for them. Find one.

Known gaps after Milestone 3:

- The safe zones come from conflicting third-party guides, because neither platform's own page was found. Test them with a real upload to each platform.
- The finished videos keep their original layout, so parts of their captions and diagrams still sit where platform buttons can cover them.
- The tile map draws tiles it is given. There is no built-in world or country map yet.
- Automated checks trace numbers typed into captions, but not literal numbers in hand-written diagrams. They are also not a sandbox (Milestone 8).

Found by `check-video` in approved videos. The user chose to leave these as they are, so the caption timings keep `sky-blue` and `voc-economics` reporting as failed:

- `f1-v8`, around frame 384: the "58.5 MM" label runs off the right edge of the frame.
- `sky-blue`: "THE SKY BLUE?" is only complete for 0.16 s.
- `voc-economics`: the caption about the debts passing to the Dutch state is only complete for 0.22 s.

Found while making `sky-blue`. None blocked the video, but each is manual work the AI pipeline (Milestone 7) will trip over:

- Spec diagrams can only read facts, not computed values, so this video builds its diagrams in `timeline.ts`.
- `new-episode` only makes engine videos, so the files were written by hand.
- Placing a subject inside the safe zone needs a manual camera offset, and callout positions are tuned by eye. A core helper for aiming a subject into a region would remove the first.
- Shot titles aren't part of the spec.
- A video with no `toneChecks` passes `verify-audio` without checking anything.
- The caption fit check estimates token width. `voc-economics` still uses the one-letter tokens it needed before this was fixed.
- `check-video` can't judge whether a shot explains its idea, whether a label points at the right thing, or whether the camera passes through geometry. A vision review in Milestone 7 could cover part of this.
- The tile map has no real geography, so the route map is drawn by hand and labelled schematic.

## Episodes

| Episode | State | Notes |
|---|---|---|
| `v12` | Finished | The reference for quality. Song approved by the user. |
| `f1-v8` | Finished | Honda RA808E, 2008 F1 2.4 L V8, sourced from the Honda R&D Technical Review F1 special. Deep bass house song, approved and locked. Stroke, crank type and firing order are not in the Honda papers: see the source notes in `physics.ts`. |
| `sky-blue` | Finished | Approved by the user. "Why the sky is blue". First video with no engine code, built from core tools only, with a generated song. The blue and red wavelengths are representative picks, so the ratio is worded as "about". |
| `voc-economics` | Finished | Approved by the user. The Dutch East India Company's rise and collapse, with a generated dubstep song. Mostly secondary sources; see the source notes in `spec.json`. Spice markups are left out because published figures conflict. |
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
| `sky-blue` | `5478366b55088680e020746cb84f25bbc40d7846b3b5106e4d58d40ac7757b42` (the approved `house-seed2` sample) |
| `voc-economics` | `ccbe26888eb19cf0e0ecd0ea5762eec2fe94f6b689e2e4079dad56f460a8befd` (the approved `dubstep-seed1` sample) |

### Approved generator samples

The user approved these 18-bar samples from `npm run song-samples`. If work on `src/core/music/` changes a hash on this Mac, the generator's sound has changed, so ask the user to listen again.

| Sample | WAV SHA-256 |
|---|---|
| `house-seed1` | `9592fc073190576ce1aa9f91307d8b5a84e00c7b173bc2f5d3b51ad8cd150b74` |
| `house-seed2` | `5478366b55088680e020746cb84f25bbc40d7846b3b5106e4d58d40ac7757b42` |
| `house-seed3` | `5fcf20c7beb1f9a4faa102bc5e594360e8a41cb281b7ea323c737094ae21bd9a` |
| `dubstep-seed1` | `ccbe26888eb19cf0e0ecd0ea5762eec2fe94f6b689e2e4079dad56f460a8befd` |
| `dubstep-seed2` | `43270dee375019188d0a53a52b4f6a884250fcf2a45fb352b86aa8e04ef55a64` |
| `dubstep-seed3` | `4e0087938ceffb43ae2d7a26aa2304eb1b713cb62ad068b7f3cd445860344a90` |

## Backlog

Nothing here has been started. Suggested order: safe zones first, because that changes the layout of every episode. Leave 60 fps until the visuals settle, since it invalidates frame-based checks.

1. **Reels and TikTok safe zones.** The shared setting is done in Milestone 3; moving the finished videos into it and testing a real upload are not. The HUD starts at y=150, captions at y=1290, and the diagram panel runs from y=1478 to y=1758, so platform buttons may cover parts of them. Move the positions into a shared safe-area setting in `src/core/`, then check them against each platform's current guidance and a real upload.
2. **Build the full V8 scene.** Replace `PlaceholderEngine` with detailed parts and a car, and give it a real song that follows the beat-grid rules. Make it clear that the HUD shows the firing rate while captions give the per-bank note. During the camera swings around frames 190 and 585, pistons reach the frame edge.
3. **End-card and branding slot.** Add an optional end card to `makeEpisode`, with its length in `meta.ts` so the video and audio fades move with it. Use the user's own branding only.
4. **Subtitle export.** Captions are already timed data with physics-derived text, so a `subtitles <slug>` script can write SRT or VTT from `timeline.ts`.
5. **60 fps option.** Physics and camera run on time, so they carry over. The seeded flicker uses the frame number and would need retuning, render time roughly doubles, crank strobing at real speed changes, and frame numbers in checks need redoing.
6. **F1 V8 sources.** Find a published stroke, crank type and firing order for the Honda RA808E, plus the reading convention for the "19/64" valve timing in the valvetrain paper. The video currently labels the firing order as typical.
7. **Better sources.** Find factory documents for the L539 firing order and bank numbering, the SVJ's 8,700 rpm limit, the F136 firing order, and real L539 valve timing to replace the panel labelled "SCHEMATIC".
8. **Sync and frame-comparison scripts.** Done in Milestone 6: see `check-video` and `compare-frames`.
9. **Fully repeatable renders.** `f1-v8` varies between one-tab renders of the same code, on up to about 40 of its 1,008 frames and by under 0.004% of pixels, in frames 98, 447, 781-785 and 924-992. It isn't visible, but it makes byte comparisons of that video unreliable, so Milestone 6's frame comparison needs to allow for it. Multi-tab renders vary more. Find out why a few frames differ by about 0.05% of pixels with several tabs. If that is fixed, final renders could use four tabs and take well under half the time.

## Done from the original backlog

- **Better car body:** real engine bay, split folding cover, and added body detail.
- **Nicer music bed:** replaced by the original V12 song, locked to the engine.
- **Wider `verify-audio` margin on the V12:** the engine note is now 4.6 to 5.7 dB clear of its octave, up from 1.2 dB.

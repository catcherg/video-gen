# Project Status

Where each episode stands, which songs are locked, and what is left to do. Update this file whenever one of those changes.

## Episodes

| Episode | State | Notes |
|---|---|---|
| `v12` | Finished | The reference for quality. Song approved by the user. |
| `v8-cross-flat` | Stub | Physics, camera, captions and audio checks are wired up. Geometry is still `PlaceholderEngine`, and its audio is not a full song yet. |

## Locked songs

These songs are approved. Do not change them without asking the user. After any work on the episode, regenerate the WAV and confirm the hash still matches:

```bash
npm run audio v12
shasum -a 256 public/v12/audio.wav
```

| Episode | Approved WAV SHA-256 |
|---|---|
| `v12` | `888e4c9f260f1523857f3dddcf311369b134cc05e5cabfbaf695c3d3bf19bfd6` |

## Backlog

Nothing here has been started. Suggested order: safe zones first, because that changes the layout of every episode. Leave 60 fps until the visuals settle, since it invalidates frame-based checks.

1. **Reels and TikTok safe zones.** The HUD starts at y=150, captions at y=1290, and the diagram panel runs from y=1478 to y=1758, so platform buttons may cover parts of them. Move the positions into a shared safe-area setting in `src/core/`, then check them against each platform's current guidance and a real upload.
2. **Build the full V8 scene.** Replace `PlaceholderEngine` with detailed parts and a car, and give it a real song that follows the beat-grid rules. Make it clear that the HUD shows the firing rate while captions give the per-bank note. During the camera swings around frames 190 and 585, pistons reach the frame edge.
3. **End-card and branding slot.** Add an optional end card to `makeEpisode`, with its length in `meta.ts` so the video and audio fades move with it. Use the user's own branding only.
4. **Subtitle export.** Captions are already timed data with physics-derived text, so a `subtitles <slug>` script can write SRT or VTT from `timeline.ts`.
5. **60 fps option.** Physics and camera run on time, so they carry over. The seeded flicker uses the frame number and would need retuning, render time roughly doubles, crank strobing at real speed changes, and frame numbers in checks need redoing.
6. **Better sources.** Find factory documents for the L539 firing order and bank numbering, the SVJ's 8,700 rpm limit, the F136 firing order, and real L539 valve timing to replace the panel labelled "SCHEMATIC".
7. **Sync and frame-comparison scripts.** The checks that measured drum timing on the finished MP4 and compared every frame between renders were one-off scripts and are not in the repo. Add them under `scripts/`.
8. **Fully repeatable multi-tab renders.** Find out why a few frames differ by about 0.05% of pixels with several tabs. If that is fixed, final renders could use four tabs and take well under half the time.

## Done from the original backlog

- **Better car body:** real engine bay, split folding cover, and added body detail.
- **Nicer music bed:** replaced by the original V12 song, locked to the engine.
- **Wider `verify-audio` margin on the V12:** the engine note is now 4.6 to 5.7 dB clear of its octave, up from 1.2 dB.

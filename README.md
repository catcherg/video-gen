# Video Gen

Describe a video, upload what you know about the subject, and get back a finished 8-bit explainer reel with an original song.

Every video is vertical (1080×1920, 30 fps, about 30 seconds) and pixel-art 3D. All of the picture and all of the music are generated from code, so there are no stock clips, samples or recorded audio. The music is extremely bass-heavy EDM: deep bass house by default, or dubstep for slower, more dramatic videos.

Colours change with the type of video. "8-bit" describes only the pixelated rendering and pixel type.

**Status:** the whole process works from one command, and the local page for it is the next piece of work. There is no hosted version and there won't be one. Everyone installs it on their own computer and renders there. So far it has only been tested on one Mac.

## Contents

- [How a video gets made](#how-a-video-gets-made)
- [Setup](#setup)
- [Make a video with AI](#make-a-video-with-ai)
- [Make a video by hand](#make-a-video-by-hand)
- [How it is built](#how-it-is-built)
- [The checks](#the-checks)
- [Commands](#commands)
- [Security and limits](#security-and-limits)
- [Finished videos](#finished-videos)
- [Licence](#licence)

## How a video gets made

A single command, `npm run generate`, runs six stages. It stops at three of them for a person to approve the work, because some things can't be measured.

| Stage | What happens | Who decides it's good |
|---|---|---|
| Facts | Claude reads your uploads and searches the web. Every fact needs a real source and a confidence level. | **You approve** |
| Story | The facts become one question, a hook, a shot list and timed captions. | Automatic checks |
| Song | A seeded generator writes an original song, and the exact moment of every hit is measured from the audio. | **You approve** |
| Scene | Claude writes the 3D scene and overlay to fit the song. The code is checked, and failures go back to Claude to fix. | Automatic checks |
| Frames | Sample frames are rendered so you can look at them. | **You approve** |
| Render | The final MP4 is rendered and its audio and picture are checked for sync. | Automatic checks |

The order matters: the song is locked first, and then the animation adapts to it. Every kick, cut and flash in the picture comes from where that hit is actually audible in the finished song.

## Setup

You need:

- [Node.js](https://nodejs.org/) 22.13 or newer. It has been developed on Node 26.
- Either a Claude API key, or a Claude plan you can sign in to.
- A Mac, ideally. Other systems haven't been tested yet, and on Windows part of the code containment doesn't apply (see [Security and limits](#security-and-limits)).

```bash
git clone https://github.com/catcherg/video-gen.git
```

```bash
cd video-gen
```

```bash
npm install
```

Remotion downloads its own copy of headless Chrome the first time you render, and ffmpeg comes with it.

Then give the tool access to Claude, in one of two ways. Each person uses their own.

**An API key.** This stores the key outside the repository, in a file only your account can read. It's billed per use.

```bash
npm run set-key
```

**A Claude plan.** Sign in, then add `--engine claude-code` to the `generate` command. Usage comes out of your plan and the dollar figures shown are what the same work would have cost on the API. PDF uploads need the API key for now.

```bash
claude auth login
```

To check that everything works before spending anything:

```bash
npm test
```

```bash
npm run typecheck
```

## Make a video with AI

Start with a slug (the video's folder name) and a one-line brief. Uploads are optional, and you can add several.

```bash
npm run generate -- black-holes --brief "How a black hole bends light" --upload notes.txt --engine claude-code
```

It stops when it needs you and tells you what to look at. Approve and carry on:

```bash
npm run generate -- black-holes --approve facts
```

```bash
npm run generate -- black-holes --approve song
```

```bash
npm run generate -- black-holes --approve frames
```

Or send a stage back with a note:

```bash
npm run generate -- black-holes --revise story --note "Open on the photo of the shadow, not the definition"
```

The finished video is at `videos/black-holes/output/black-holes.mp4`.

Good to know:

- **Cost.** The first real run came to about $7.34 at API prices and 24 minutes of model time, nearly all of it on the scene code. A run stops when it reaches `--max-usd`, which is $10 by default.
- **Time.** One attempt at the scene can take more than 15 minutes. The command prints progress and a heartbeat every 30 seconds. Don't pipe it through `tail`, which hides all of that until the end.
- **Stopping and resuming.** Progress is saved in `videos/<slug>/output/pipeline/`. Run the same command again to continue. `--status` shows what's happening now.
- **Retries.** If scene code fails four times, it's renamed `.rejected` and unregistered, so your other videos still build.
- **Trying it for free.** `--fixture answers.json` replaces Claude with scripted answers.

Read [docs/UPLOAD_POLICY.md](docs/UPLOAD_POLICY.md) before uploading. Uploads are sources of facts, and only that: what's in them is never treated as instructions, and the video says things in its own words.

## Make a video by hand

```bash
npm run new-video black-holes -- --title "How Black Holes Bend Light"
```

This creates `videos/black-holes/` from the general template, registers it, generates a first song and measures it. It builds and passes every check straight away, with placeholder shapes. Add `-- --kit engine` to start from the engine template instead.

From there:

1. Listen to `videos/black-holes/output/audio.wav`. If you don't like it, change the seed in `spec.json` and run `npm run audio` and `npm run song-map` again. Approve the song before building anything on it.
2. Replace the placeholder facts in `spec.json` with real ones, each with a source.
3. Write the shots and captions in `spec.json`, then fill in `physics.ts`, `timeline.ts` and `scene.tsx`.
4. Run `npm run studio` to preview, then `npm run check-video black-holes`.
5. Look at sample frames with `npm run stills black-holes 60 400 700`.
6. Run `npm run render black-holes`.

[docs/VIDEO_PRODUCTION.md](docs/VIDEO_PRODUCTION.md) explains the full process and the reasoning behind it. `videos/sky-blue` is a short example of a video on a general topic, and `videos/v12` is the reference for the highest quality.

## How it is built

The stack is [Remotion](https://www.remotion.dev/) 4, React Three Fiber, three.js and TypeScript.

```
videos/            One folder per video, with its source and generated output together
  registry.ts      Lists every video
  <slug>/
    spec.json      The plain-data description of the video
    physics.ts     Numbers computed from the facts, and the list of sources
    timeline.ts    Camera, captions, titles and diagram windows
    scene.tsx      The 3D scene
    overlay.tsx    The 2D layer: captions, labels and diagrams
    songMap.ts     Generated: the frame on which each hit is audible
    output/        Ignored by git: audio.wav, the MP4, stills
src/core/          Everything that works for any subject
src/kits/engine/   Models and physics for engine videos
scripts/           Commands, including the AI pipeline in scripts/pipeline/
templates/         video/ for any subject, engine/ for engine videos
docs/              Production process, project status, upload policy, third-party notices
```

**The spec.** Each video has a `spec.json` holding its format, song, palette, facts, shots and captions. It's plain JSON because the AI pipeline writes it, and it's validated every time it's loaded. A caption can contain a `{token}` that's filled from a computed value, so the words can't disagree with the numbers:

```json
{ "from": { "bar": 6 }, "to": { "bar": 12 }, "lines": ["BLUE LIGHT SCATTERS", "{ratio} TIMES MORE"], "size": "compact" }
```

**One source of facts.** The scene, labels, captions and audio all read from the facts. Each fact records a value, its sources and a confidence level (`primary`, `secondary`, `single-source`, `assumed` or `illustrative`). An invented number can't be presented as real.

**Determinism.** Everything visible or audible is a pure function of the frame number. There are no clocks, unseeded randomness or per-frame deltas, so any frame can be rendered alone and comes out the same.

**The song generator.** Style, seed and structure go in, and a repeatable WAV comes out. House runs at 14 video frames a beat (about 128.6 BPM) and dubstep at 13 (about 138.5 BPM), so that beats land on whole frames. Songs are measured to confirm they don't clip, that at least 80% of the energy is in the bass, that hits still jump through a simulated phone speaker, and that the drop lands. Whether a song is any good is for a person to judge.

**The visual library.** `src/core/` has 3D shapes, motion helpers, a palette for each type of video, safe zones that keep text clear of the Reels and TikTok buttons, and six diagram types drawn from the facts: bar, line, timeline, flow, comparison and map.

**Kits.** `src/core/` can't mention a subject or import from a kit, and a test enforces that. Anything specific to a subject goes in `src/kits/<kit>/`. Engines are the first kit.

## The checks

`npm run check-video <slug>` runs every automatic check and writes the results to `videos/<slug>/output/checks.json`.

- The spec is valid and the code follows the rules.
- Every number in a caption traces back to a fact.
- Captions stay up long enough to read.
- The WAV matches its locked hash, and the song map and MP4 are in sync with it.
- On sampled frames, the real page is measured for text off the frame or outside the safe zone, overlaps, diagram text that spills or collides, leader lines that cross things, and an empty subject area.
- Frames rendered alone and in opposite orders come out the same.

It can't tell whether a shot explains its idea, whether a label points at the right thing, or whether the song is good. That's why a person approves the frames and the song.

## Commands

| Command | What it does |
|---|---|
| `npm run studio` | Opens the Remotion preview |
| `npm run generate -- <slug> --brief "..."` | Makes a video with AI |
| `npm run new-video <slug>` | Creates a video from a template |
| `npm run audio <slug>` | Writes the song to `output/audio.wav` |
| `npm run song-map <slug>` | Measures the WAV and writes `songMap.ts` |
| `npm run song-samples` | Writes and measures sample songs in `out/song-samples` |
| `npm run stills <slug> <frames...>` | Renders chosen frames to PNG |
| `npm run check-video <slug>` | Runs every automatic check |
| `npm run check-scene <slug>` | Runs code rules and the frame-order test |
| `npm run compare-frames <slug>` | Compares every frame with a saved baseline |
| `npm run verify-audio <slug>` | Checks an engine video's tones against its physics |
| `npm run render <slug>` | Renders the final MP4 |
| `npm run render <slug> -- --fast` | Renders a quicker preview |
| `npm run set-key` | Saves your Claude API key |
| `npm test`, `npm run typecheck` | Runs the tests and type checks |

## Security and limits

AI-written code runs on your own computer, and an uploaded document could try to steer what gets written. So generated code gets no special trust:

- It has to pass the same tests and checks as code written by hand.
- In Node, it runs under Node's permission system with no file writes, network, subprocesses or environment.
- In the browser, a page policy and a wrapper that blocks outside hosts confine it to the render's own server.
- Your Claude credentials are removed from every child process.
- Your API key is stored outside this repository, readable only by your account.

Some limits remain. Remotion runs Chrome with Chrome's own sandbox turned off, so a browser exploit wouldn't be contained. A page could still navigate to another port on the same computer. Windows gets the page policy only. Don't open a generated video in Remotion Studio, because the Studio isn't guarded.

Facts come from the sources Claude finds, and Claude can get them wrong. Whoever publishes a video is responsible for checking the facts shown at the approval step.

## Finished videos

| Video | Subject | Music |
|---|---|---|
| `v12` | How a V12 works, the reference for quality | Written for the engine |
| `f1-v8` | Honda's 2008 Formula 1 V8 | Deep bass house, written for the engine |
| `sky-blue` | Why the sky is blue | Generated house |
| `voc-economics` | The rise and collapse of the Dutch East India Company | Generated dubstep |
| `why-cats-purr` | Why cats purr, made entirely by the AI pipeline | Generated house |

`v8-cross-flat` is an unfinished stub comparing cross-plane and flat-plane V8s. Generated media isn't committed, so run `npm run render <slug>` to make any of these.

[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) has the current state of each video, the milestones and the backlog.

## Licence

Copyright (c) 2026 catchergriffin. All rights reserved: see [LICENSE](LICENSE). Remotion has its own licence, and the fonts have theirs. See [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md).

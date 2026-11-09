---
description: Render a video to MP4 after checking frames, tests and audio
argument-hint: <slug> [--fast]
---

Render video: $ARGUMENTS

1. Run `npm test` and `npm run typecheck`. Stop if either fails.
2. If frames have not been checked since the last change to this video's scene, timeline or overlay, run the /check-frames workflow first and stop to report any problems.
3. Run `npm run render <slug>`, adding `-- --fast` only if `--fast` was requested. A `--fast` render is a preview only and is not byte-reproducible.
4. Run `npm run verify-audio <slug>`. A failure means the audio does not match physics, so report it rather than shipping the file.
5. Report the output path, render time, duration, and the verify-audio result. Show the user the MP4.

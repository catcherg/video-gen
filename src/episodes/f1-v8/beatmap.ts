// The hits the picture follows, measured from the finished song by `npm run song-map f1-v8`.
// Visuals read these rather than the song's schedule, so a hit lands when it can actually be heard.
import { SONG_MAP } from "./songMap";

const toSeconds = (frames: number[]) => frames.map((f) => f / SONG_MAP.fps);

export const KICKS = toSeconds(SONG_MAP.kickFrames);
export const STABS = toSeconds(SONG_MAP.stabFrames);
/** Nothing is shown before the first thing you can hear. */
export const FIRST_HIT = Math.min(KICKS[0], STABS[0]);

const sinceLast = (times: number[], t: number) => {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo === 0 ? Infinity : t - times[lo - 1];
};

/** 1 on a kick, decaying to 0. Use for anything that should hit with the drums. */
export const kickPulse = (t: number, decayS = 0.12) => Math.exp(-sinceLast(KICKS, t) / decayS);
/** 1 on a hook throttle stab, decaying to 0. */
export const stabPulse = (t: number, decayS = 0.14) => Math.exp(-sinceLast(STABS, t) / decayS);

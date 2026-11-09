// The song's structure, shared by the soundtrack and the visuals so they cannot drift apart.
// Beats are 14 video frames, bars 56 frames. One bar is 16 steps.
import { BARS, barT, beatT, BEATS_PER_BAR } from "./physics";

export type Section = "hook" | "reveal" | "groove" | "roll" | "tension" | "rise" | "drop" | "outro";

export const sectionOfBar = (bar: number): Section => {
  if (bar < 2) return "hook";
  if (bar < 4) return "reveal";
  if (bar < 6) return "groove";
  if (bar < 10) return "roll";
  if (bar < 12) return "tension";
  if (bar < 14) return "rise";
  return bar < 17 ? "drop" : "outro";
};

export const barAt = (t: number) => Math.max(0, Math.min(BARS - 1, Math.floor(t / barT(1))));
export const beatInBar = (t: number) => Math.floor(t / beatT(1)) % BEATS_PER_BAR;

/** Four on the floor, except the build's last bar and the outro. */
const kickBeats = (): number[] => {
  const beats: number[] = [];
  for (let beat = 0; beat < BARS * BEATS_PER_BAR; beat++) {
    const section = sectionOfBar(Math.floor(beat / BEATS_PER_BAR));
    if (section === "outro") {
      if (beat === 68 || beat === 70) beats.push(beat);
    } else if (beat < 52 || beat >= 56) beats.push(beat);
  }
  return beats;
};

export const KICKS = kickBeats().map(beatT);

/** Throttle stabs in the hook, a 3-3-2 rhythm in eighth notes. */
export const STAB_EIGHTHS = [0, 3, 6];
export const STABS = [0, 1].flatMap((bar) => STAB_EIGHTHS.map((e) => beatT(bar * BEATS_PER_BAR + e / 2)));

/** One bass note: start step, length in steps, MIDI note, and whether it is a falling "yoi". */
export type RiffNote = [step: number, len: number, midi: number, dive?: boolean];

/** The growl riff in the drop, one bar per entry. Absolute notes, all in D# minor. */
export const DROP_RIFF: RiffNote[][] = [
  [[0, 3, 39], [3, 1, 39], [6, 2, 51, true], [9, 1, 39], [10, 2, 42], [13, 1, 39], [14, 2, 46]],
  [[0, 3, 35], [3, 1, 35], [6, 2, 47, true], [9, 1, 35], [10, 2, 39], [13, 1, 35], [14, 2, 37]],
  [[0, 3, 37], [3, 1, 37], [6, 2, 49, true], [9, 1, 37], [10, 2, 41], [13, 1, 37], [14, 1, 42], [15, 1, 46]],
];

/** The growl pattern while the engine is at half redline, relative to the bar's root. */
export const ROLL_RIFF: [step: number, len: number, semis: number][] = [
  [2, 2, 0],
  [5, 1, 0],
  [6, 2, 0],
  [10, 2, 0],
  [13, 1, 12],
  [14, 2, 0],
];

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

const GROWL_TIMES = [0, 1, 2].flatMap((i) => DROP_RIFF[i].map(([step]) => barT(14 + i) + beatT(step / 4)));

/** 1 on a kick, decaying to 0. Use for anything that should hit with the drums. */
export const kickPulse = (t: number, decayS = 0.12) => Math.exp(-sinceLast(KICKS, t) / decayS);
/** 1 on a hook throttle stab, decaying to 0. */
export const stabPulse = (t: number, decayS = 0.14) => Math.exp(-sinceLast(STABS, t) / decayS);
/** 1 on a growl note in the drop, decaying to 0. */
export const growlPulse = (t: number, decayS = 0.1) => Math.exp(-sinceLast(GROWL_TIMES, t) / decayS);

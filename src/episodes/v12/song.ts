// The song's structure, shared by the soundtrack and the visuals so they cannot drift apart.
// Bars are 1.6 s and beats 0.4 s (12 video frames), set by physics.BPM.
import { BARS, barT, beatT, BEATS_PER_BAR } from "./physics";

export type Section = "intro" | "reveal" | "verse" | "build1" | "build2" | "build3" | "rise" | "chorus" | "outro";

export const sectionOfBar = (bar: number): Section => {
  if (bar < 2) return "intro";
  if (bar < 4) return "reveal";
  if (bar < 8) return "verse";
  if (bar < 10) return "build1";
  if (bar < 12) return "build2";
  if (bar < 14) return "build3";
  if (bar < 16) return "rise";
  return bar < 19 ? "chorus" : "outro";
};

export const barAt = (t: number) => Math.max(0, Math.min(BARS - 1, Math.floor(t / barT(1))));
export const beatInBar = (t: number) => Math.floor(t / beatT(1)) % BEATS_PER_BAR;

/** Beat numbers with a kick: every beat when the song drives, on 1 and 3 while the engine carries the backbeat. */
const kickBeats = (): number[] => {
  const beats: number[] = [];
  for (let beat = 0; beat < BARS * BEATS_PER_BAR; beat++) {
    const section = sectionOfBar(Math.floor(beat / BEATS_PER_BAR));
    if (section === "intro" || section === "rise" || section === "chorus") beats.push(beat);
    else if (section === "outro") {
      if (beat === 76 || beat === 78) beats.push(beat);
    } else if (beat % 2 === 0) beats.push(beat);
  }
  return beats;
};

export const KICKS = kickBeats().map(beatT);

/** Throttle stabs in the intro, a 3-3-2 rhythm in eighth notes. */
export const STAB_EIGHTHS = [0, 3, 6];
export const STABS = [0, 1].flatMap((bar) => STAB_EIGHTHS.map((e) => beatT(bar * BEATS_PER_BAR + e / 2)));

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
export const kickPulse = (t: number, decayS = 0.11) => Math.exp(-sinceLast(KICKS, t) / decayS);
/** 1 on an intro throttle stab, decaying to 0. */
export const stabPulse = (t: number, decayS = 0.14) => Math.exp(-sinceLast(STABS, t) / decayS);

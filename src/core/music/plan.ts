// Turns a style, a seed and a structure into a complete written-out song. Pure data, with no audio,
// so visuals and song-map can read a song's hits without synthesising it. All patterns here are original.
import { createRng } from "../audio";

export type SongStyle = "house" | "dubstep";
export type SectionKind = "hook" | "groove" | "build" | "drop" | "break" | "outro";
export type SongSection = { kind: SectionKind; bars: number };

export type SongRequest = {
  style: SongStyle;
  seed: number;
  fps: number;
  /** Beats land on whole video frames, so tempo is set in frames. */
  framesPerBeat: number;
  bars: number;
  /** Lowest note of the key, as a MIDI note. Leave out to let the seed choose. */
  rootMidi?: number;
  /** Leave out for the style's default shape. Lets a video put its drop on its payoff. */
  sections?: SongSection[];
};

/** 14 frames at 30 fps is about 128.6 BPM; 13 frames is about 138.5 BPM. */
export const STYLE_FRAMES_PER_BEAT: Record<SongStyle, number> = { house: 14, dubstep: 13 };

export const BEATS_PER_BAR = 4;
const MIN_BARS = 8;
const LOWEST_ROOT = 24;
const HIGHEST_ROOT = 36;
const SECTION_KINDS: SectionKind[] = ["hook", "groove", "build", "drop", "break", "outro"];

export const defaultSections = (bars: number): SongSection[] => {
  const hook = 2;
  const build = 2;
  const outro = 1;
  const drop = Math.max(2, Math.round(bars * 0.3));
  return [
    { kind: "hook", bars: hook },
    { kind: "groove", bars: bars - hook - build - drop - outro },
    { kind: "build", bars: build },
    { kind: "drop", bars: drop },
    { kind: "outro", bars: outro },
  ];
};

/** Every problem with a song request. An empty list means it can be planned. */
export const validateSongRequest = (r: Partial<SongRequest>): string[] => {
  const errors: string[] = [];
  const whole = (v: unknown) => typeof v === "number" && Number.isInteger(v);
  if (r.style !== "house" && r.style !== "dubstep") errors.push("style: must be house or dubstep");
  if (!whole(r.seed)) errors.push("seed: must be a whole number");
  if (!whole(r.fps) || (r.fps as number) <= 0) errors.push("fps: must be a positive whole number");
  if (!whole(r.framesPerBeat) || (r.framesPerBeat as number) <= 0) errors.push("framesPerBeat: must be a positive whole number");
  if (!whole(r.bars) || (r.bars as number) < MIN_BARS) errors.push(`bars: needs at least ${MIN_BARS}`);
  if (r.rootMidi !== undefined && (!whole(r.rootMidi) || r.rootMidi < LOWEST_ROOT || r.rootMidi > HIGHEST_ROOT)) errors.push(`rootMidi: must be from ${LOWEST_ROOT} to ${HIGHEST_ROOT}`);
  if (errors.length > 0) return errors;
  const sections = r.sections ?? defaultSections(r.bars as number);
  if (!Array.isArray(sections) || sections.length === 0) return ["sections: needs at least one section"];
  if (sections.some((s) => !SECTION_KINDS.includes(s?.kind) || !whole(s?.bars) || s.bars <= 0)) errors.push(`sections: each needs a kind (${SECTION_KINDS.join(", ")}) and a positive whole number of bars`);
  else {
    if (sections.reduce((sum, s) => sum + s.bars, 0) !== r.bars) errors.push("sections: bars must add up to the song's bars");
    if (!sections.some((s) => s.kind === "drop")) errors.push("sections: needs a drop");
    if (sections[sections.length - 1].kind === "build") errors.push("sections: can't end on a build");
  }
  return errors;
};

export type NoteEvent = { beat: number; beats: number; midi: number };
export type SubEvent = NoteEvent & { fromMidi?: number; glideS?: number; vel?: number };
export type BassEvent = NoteEvent & { energy: number; dive?: boolean; /** Filter sweeps per beat, for wobble bass. */ wobble?: number };
export type HatEvent = { beat: number; vel: number; decayS: number; pan: number };
export type HitEvent = { beat: number; vel: number };

export type SongPlan = {
  style: SongStyle;
  seed: number;
  fps: number;
  beatS: number;
  bpm: number;
  bars: number;
  durationS: number;
  rootMidi: number;
  sections: (SongSection & { fromBar: number })[];
  kicks: HitEvent[];
  /** Claps in house, snares in dubstep. */
  backbeats: HitEvent[];
  rolls: HitEvent[];
  hats: HatEvent[];
  crashes: HitEvent[];
  sub: SubEvent[];
  bass: BassEvent[];
  pads: { bar: number; midis: number[]; vel: number }[];
  stabs: NoteEvent[];
  lead: (NoteEvent & { energy: number })[];
  risers: { fromBeat: number; toBeat: number; vel: number; rising: boolean }[];
  /** Enormous single hits, at the start of each drop. */
  impacts: number[];
  /** Beats the picture should punch on, besides the kicks. */
  accents: number[];
};

const ROOTS: Record<SongStyle, number[]> = { house: [26, 27, 28, 29, 30], dubstep: [25, 26, 27, 28, 29] };
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const PROGRESSIONS: Record<SongStyle, number[][]> = {
  house: [[0, 5, 6, 0], [0, 0, 5, 6], [0, 6, 5, 6], [0, 3, 5, 6]],
  dubstep: [[0, 0, 1, 0], [0, 0, 6, 1], [0, 2, 0, 1], [0, 1, 0, 6]],
};
/** [start step, length in steps] within a bar of 16. */
const HOUSE_RHYTHMS: [number, number][][] = [
  [[0, 3], [3, 1], [6, 2], [9, 1], [10, 2], [13, 1], [14, 2]],
  [[0, 2], [3, 2], [6, 1], [7, 2], [10, 2], [12, 1], [14, 2]],
  [[2, 2], [4, 1], [6, 2], [10, 1], [11, 2], [14, 2]],
  [[0, 1], [2, 3], [6, 2], [8, 1], [10, 3], [14, 1], [15, 1]],
];
/** [start step, length in steps, filter sweeps per beat]. */
const DUBSTEP_RHYTHMS: [number, number, number][][] = [
  [[0, 4, 2], [4, 2, 4], [6, 2, 4], [8, 3, 3], [11, 1, 8], [12, 4, 2]],
  [[0, 3, 4], [3, 3, 4], [6, 2, 2], [8, 4, 1], [12, 2, 4], [14, 2, 8]],
  [[0, 2, 8], [2, 2, 8], [4, 4, 3], [8, 2, 4], [10, 2, 4], [12, 4, 2]],
  [[0, 6, 3], [6, 2, 8], [8, 2, 4], [10, 2, 4], [12, 3, 3], [15, 1, 8]],
];
/** Scale positions above the chord's root, weighted towards the root. */
const RIFF_DEGREES = [0, 0, 0, 7, 2, 4, 6];
const LEAD_DEGREES = [0, 2, 3, 4, 7, 9];
const LEAD_RHYTHMS: [number, number][][] = [
  [[2, 1], [3, 1], [4, 2], [6, 2], [10, 1], [11, 1], [12, 3]],
  [[0, 3], [3, 1], [4, 4], [10, 2], [12, 2], [14, 2]],
  [[2, 2], [4, 2], [8, 2], [11, 1], [12, 4]],
];

/** The hook's 3-3-2 rhythm, in eighth notes. */
const HOOK_EIGHTHS = [0, 3, 6];

export const planSong = (request: SongRequest): SongPlan => {
  const errors = validateSongRequest(request);
  if (errors.length > 0) throw new Error(`Invalid song request:\n  ${errors.join("\n  ")}`);
  const { style, seed, fps, framesPerBeat, bars } = request;
  // Neighbouring seeds start out too alike, so spread them across the generator's range first.
  const rnd = createRng(Math.imul(seed + 1, 0x9e3779b1) ^ 0x85ebca6b);
  const pick = <T,>(items: T[]): T => items[Math.floor(rnd() * items.length)];
  const dubstep = style === "dubstep";

  const rootMidi = request.rootMidi ?? pick(ROOTS[style]);
  const scale = dubstep ? PHRYGIAN : MINOR;
  const semis = (degree: number) => scale[((degree % 7) + 7) % 7] + 12 * Math.floor(degree / 7);
  /** A chord's bass note, always within reach of the sub. */
  const bassOf = (degree: number) => {
    const offset = semis(degree);
    return rootMidi + (offset > 7 ? offset - 12 : offset);
  };

  const progression = pick(PROGRESSIONS[style]);
  const houseRiff = pick(HOUSE_RHYTHMS);
  const dubRiff = pick(DUBSTEP_RHYTHMS);
  const riffLength = dubstep ? dubRiff.length : houseRiff.length;
  const riffDegrees = Array.from({ length: riffLength }, () => pick(RIFF_DEGREES));
  const riffTurn = Array.from({ length: 2 }, () => pick(RIFF_DEGREES));
  const leadRhythms = [pick(LEAD_RHYTHMS), pick(LEAD_RHYTHMS)];
  const leadNotes = leadRhythms.map((r) => r.map(() => pick(LEAD_DEGREES)));

  const sections = (request.sections ?? defaultSections(bars)).reduce<(SongSection & { fromBar: number })[]>((out, s) => {
    const last = out[out.length - 1];
    return [...out, { ...s, fromBar: last ? last.fromBar + last.bars : 0 }];
  }, []);

  const plan: SongPlan = {
    style,
    seed,
    fps,
    beatS: framesPerBeat / fps,
    bpm: (60 * fps) / framesPerBeat,
    bars,
    durationS: (bars * BEATS_PER_BAR * framesPerBeat) / fps,
    rootMidi,
    sections,
    kicks: [],
    backbeats: [],
    rolls: [],
    hats: [],
    crashes: [],
    sub: [],
    bass: [],
    pads: [],
    stabs: [],
    lead: [],
    risers: [],
    impacts: [],
    accents: [],
  };

  const stepBeat = (bar: number, step: number) => bar * BEATS_PER_BAR + step / 4;
  const addHat = (beat: number, vel: number, decayS: number, pan = 0.5) => plan.hats.push({ beat, vel, decayS, pan });

  /** One bar of the main bass riff. `energy` runs from 0 (held back) to 1 (full drop). */
  const addRiff = (bar: number, degree: number, energy: number, phraseBar: number) => {
    const base = bassOf(degree) + 12;
    const note = (i: number) => {
      const isTurn = phraseBar % 4 === 3 && i >= riffLength - 2;
      const d = isTurn ? riffTurn[i - (riffLength - 2)] : riffDegrees[i];
      return base + (semis(degree + d) - semis(degree));
    };
    if (dubstep) dubRiff.forEach(([step, len, rate], i) => plan.bass.push({ beat: stepBeat(bar, step), beats: (len / 4) * 0.97, midi: note(i), energy, wobble: rate, dive: step === 11 || rate === 8 }));
    else houseRiff.forEach(([step, len], i) => plan.bass.push({ beat: stepBeat(bar, step), beats: (len / 4) * 0.94, midi: note(i), energy, dive: step === 6 }));
  };

  const addPad = (bar: number, degree: number, vel: number) => {
    plan.pads.push({ bar, vel, midis: [0, 2, 4, 6].map((d) => rootMidi + 24 + semis(degree + d)) });
  };

  const addLeadPhrase = (bar: number, phrase: number, energy: number, octave: number) => {
    const i = phrase % 2;
    leadRhythms[i].forEach(([step, len], k) => plan.lead.push({ beat: stepBeat(bar, step), beats: (len / 4) * 0.9, midi: rootMidi + octave + semis(leadNotes[i][k]), energy }));
  };

  for (const section of sections) {
    for (let bar = section.fromBar; bar < section.fromBar + section.bars; bar++) {
      const inSection = bar - section.fromBar;
      const degree = progression[inSection % progression.length];
      const bass = bassOf(degree);
      const start = bar * BEATS_PER_BAR;
      const last = bar === section.fromBar + section.bars - 1;

      switch (section.kind) {
        case "hook":
          for (const eighth of HOOK_EIGHTHS) {
            const beat = start + eighth / 2;
            plan.kicks.push({ beat, vel: 1 });
            plan.accents.push(beat);
            plan.sub.push({ beat, beats: dubstep ? 1.4 : 1.25, midi: rootMidi, fromMidi: rootMidi + 12, glideS: 0.03 });
            if (inSection % 2 === 1 || eighth > 0) plan.bass.push({ beat, beats: 0.45, midi: rootMidi + (eighth === 6 ? 24 : 12), energy: 0.75, dive: eighth === 6, wobble: dubstep ? 4 : undefined });
          }
          plan.backbeats.push({ beat: start + (dubstep ? 2 : 3), vel: 0.9 });
          if (!dubstep) plan.backbeats.push({ beat: start + 1, vel: 0.75 });
          for (let b = 0; b < 4; b++) addHat(start + b + 0.5, 0.5, 0.07);
          break;

        case "groove": {
          if (dubstep) {
            plan.kicks.push({ beat: start, vel: 1 });
            plan.backbeats.push({ beat: start + 2, vel: 0.95 });
            plan.sub.push({ beat: start, beats: 3.8, midi: bass, glideS: 0.04 });
            for (let s = 2; s < 16; s += 4) addHat(stepBeat(bar, s), 0.34, 0.05, 0.6);
          } else {
            for (let b = 0; b < 4; b++) {
              plan.kicks.push({ beat: start + b, vel: 1 });
              if (b % 2 === 1) plan.backbeats.push({ beat: start + b, vel: 0.8 });
              addHat(start + b + 0.25, 0.16, 0.02, 0.42);
              addHat(start + b + 0.5, 0.42, 0.07, 0.58);
              addHat(start + b + 0.75, 0.16, 0.02, 0.42);
              plan.sub.push({ beat: start + b + 0.5, beats: 0.45, midi: bass, glideS: 0.02 });
            }
          }
          const open = section.bars > 1 ? inSection / (section.bars - 1) : 1;
          addPad(bar, degree, 0.26);
          if (inSection >= section.bars / 2 || dubstep) addRiff(bar, degree, 0.3 + 0.3 * open, inSection);
          if (!dubstep) for (const s of [3, 6, 11, 14]) for (const d of [0, 2, 4]) plan.stabs.push({ beat: stepBeat(bar, s), beats: 0.3, midi: rootMidi + 36 + semis(degree + d) });
          addLeadPhrase(bar, inSection, 0.5, dubstep ? 36 : 48);
          break;
        }

        case "break":
          addPad(bar, degree, 0.34);
          plan.sub.push({ beat: start, beats: 3.8, midi: bass, glideS: 0.05, vel: 0.8 });
          addLeadPhrase(bar, inSection, 0.4, dubstep ? 36 : 48);
          for (let b = 0; b < 4; b++) addHat(start + b + 0.5, 0.26, 0.06);
          break;

        case "build": {
          const open = (inSection + 1) / section.bars;
          addPad(bar, degree, 0.3);
          if (inSection === 0) plan.risers.push({ fromBeat: start, toBeat: start + section.bars * BEATS_PER_BAR - 1, vel: 0.5, rising: true });
          // The final beat is left empty, so the drop lands out of silence.
          const roll = last ? BEATS_PER_BAR - 1 : BEATS_PER_BAR;
          for (let b = 0; b < roll; b++) {
            const per = last ? (b < 2 ? 4 : 8) : 2;
            for (let s = 0; s < per; s++) plan.rolls.push({ beat: start + b + s / per, vel: 0.22 + 0.5 * ((inSection + b / BEATS_PER_BAR) / section.bars) });
            if (!last || !dubstep) plan.kicks.push({ beat: start + b, vel: 0.85 });
          }
          if (!last) plan.sub.push({ beat: start, beats: 3.9, midi: bass, vel: 0.85 });
          else plan.sub.push({ beat: start, beats: 3, midi: rootMidi + 24, fromMidi: rootMidi, glideS: 0.7 });
          for (let s = 0; s < 16 && !(last && s >= 12); s++) if (s % 4 !== 0) plan.bass.push({ beat: stepBeat(bar, s), beats: 0.2, midi: bass + 12 + (s % 4 === 3 ? 12 : 0), energy: 0.4 + 0.5 * open, wobble: dubstep ? 8 : undefined });
          break;
        }

        case "drop": {
          if (inSection === 0) {
            plan.impacts.push(start);
            plan.crashes.push({ beat: start, vel: 1 });
            plan.risers.push({ fromBeat: start, toBeat: start + 3, vel: 0.28, rising: false });
          }
          if (dubstep) {
            plan.kicks.push({ beat: start, vel: 1.15 }, { beat: start + 1.5, vel: 1 });
            plan.backbeats.push({ beat: start + 2, vel: 1.15 });
            plan.accents.push(start + 2);
            for (let b = 0; b < 4; b++) addHat(start + b + 0.5, 0.46, 0.06, b % 2 ? 0.62 : 0.38);
            plan.sub.push({ beat: start, beats: 3.85, midi: bass, glideS: 0.03, fromMidi: inSection === 0 ? rootMidi + 24 : undefined });
          } else {
            for (let b = 0; b < 4; b++) {
              plan.kicks.push({ beat: start + b, vel: bar === section.fromBar && b === 0 ? 1.15 : 1 });
              if (b % 2 === 1) plan.backbeats.push({ beat: start + b, vel: 1 });
              addHat(start + b + 0.25, 0.26, 0.022, 0.38);
              addHat(start + b + 0.5, 0.7, 0.1, 0.55);
              addHat(start + b + 0.75, 0.26, 0.022, 0.62);
            }
            plan.sub.push({ beat: start, beats: 3.75, midi: bass, glideS: 0.03, fromMidi: inSection === 0 ? rootMidi + 24 : undefined });
            for (const s of [2, 5, 10, 13]) for (const d of [0, 2, 4]) plan.stabs.push({ beat: stepBeat(bar, s), beats: 0.3, midi: rootMidi + 36 + semis(degree + d) });
            addLeadPhrase(bar, inSection, 1, 36);
          }
          addRiff(bar, degree, 1, inSection);
          break;
        }

        case "outro":
          plan.kicks.push({ beat: start, vel: 1 });
          plan.backbeats.push({ beat: start + 2, vel: 0.7 });
          plan.sub.push({ beat: start, beats: 2, midi: rootMidi, vel: 0.95 });
          plan.sub.push({ beat: start + 2, beats: 1.7, midi: rootMidi - 12 < LOWEST_ROOT ? rootMidi : rootMidi - 12, fromMidi: rootMidi, glideS: 0.32, vel: 0.85 });
          if (inSection === 0) plan.crashes.push({ beat: start, vel: 0.55 });
          break;
      }
      if (section.kind !== "drop" && inSection === 0 && section.kind !== "outro" && bar > 0) plan.crashes.push({ beat: start, vel: 0.45 });
    }
  }

  const byBeat = <T extends { beat: number }>(items: T[]) => items.sort((a, b) => a.beat - b.beat);
  byBeat(plan.kicks);
  byBeat(plan.backbeats);
  plan.accents.sort((a, b) => a - b);
  return plan;
};

/** The moments a picture should hit on, in seconds, in the shape song-map reads. */
export const songHits = (plan: SongPlan) => ({
  KICKS: plan.kicks.map((k) => k.beat * plan.beatS),
  STABS: plan.accents.map((beat) => beat * plan.beatS),
  IMPACTS: plan.impacts.map((beat) => beat * plan.beatS),
});

// The soundtrack: an original deep bass house track in D# minor, at a tempo and tuning taken
// from the engine. The sub's root is the engine's redline note five octaves down, and while
// slowed every firing event is a drum hit, so the kick pattern is literally the engine.
import { SAMPLE_RATE, type VideoAudio, type Rng } from "../../src/core/audio";
import { defaultEngineAudio, renderEngineAudio, type EngineAudioSettings, type SongTrack } from "../../src/kits/engine/engineAudio";
import { applyGain, clap, growl, houseKick, sidechain, subLine, type SubNote } from "../../src/core/houseSynth";
import { crash, hat, midiHz, mixInto, newBus, pingPongDelay, playNote, riser, snare, type Bus, type Voice } from "../../src/core/synth";
import { meta } from "./meta";
import { BANGS, barT, BARS, beatT, DROP, isBankA, isSlowed, isSlowedBang, SLOW_START, SONG_A4_HZ, SUB_HZ } from "./physics";
import { DROP_RIFF, KICKS, ROLL_RIFF, sectionOfBar, STABS } from "./song";

const hz = (midi: number) => midiHz(midi, SONG_A4_HZ);
const STEP = beatT(0.25);
const at16th = (bar: number, step: number) => barT(bar) + beatT(step / 4);

const SUB_ROOT = 27; // D#1, the engine's note five octaves down

type Chord = { root: number; tones: number[] };
const Dsm: Chord = { root: 27, tones: [51, 54, 58, 61] }; // D#m7
const B: Chord = { root: 35, tones: [47, 51, 54, 58] }; // Bmaj7
const Cs: Chord = { root: 37, tones: [49, 53, 56, 59] }; // C#7

const chordOfBar = (bar: number): Chord => {
  const section = sectionOfBar(bar);
  if (section === "roll") return [Dsm, Dsm, B, Cs][bar - 6];
  if (section === "tension") return bar === 10 ? Dsm : Cs;
  if (section === "drop") return [Dsm, B, Cs][bar - 14];
  return Dsm;
};

const PAD: Voice = { wave: "saw", detune: 1.007, cutoffHz: 520, cutoffEnvHz: 240, filterTau: 0.5, attackS: 0.12, decayTau: 0.8, sustain: 0.85, releaseS: 0.3 };
const REESE: Voice = { wave: "saw", detune: 1.013, cutoffHz: 620, cutoffEnvHz: 500, filterTau: 0.9, attackS: 0.03, decayTau: 1, sustain: 0.9, releaseS: 0.12 };
const ORGAN: Voice = { wave: "square", detune: 1.004, cutoffHz: 950, cutoffEnvHz: 2100, filterTau: 0.035, attackS: 0.002, decayTau: 0.08, sustain: 0.05, releaseS: 0.05 };
const PLUCK: Voice = { wave: "pulse", detune: 1.005, cutoffHz: 1100, cutoffEnvHz: 1700, filterTau: 0.06, attackS: 0.003, decayTau: 0.16, sustain: 0.25, releaseS: 0.08 };

/** Every slowed firing event becomes a drum hit, chosen from where it falls in the bar. */
const addBangDrums = (drums: Bus, perc: Bus, rnd: Rng) => {
  for (const b of BANGS) {
    if (!isSlowedBang(b.t)) continue;
    const step = Math.round(b.t / beatT(0.25));
    const onBeat = step % 4 === 0;
    const beat = Math.round(step / 4);
    const bar = Math.floor(beat / 4);
    const section = sectionOfBar(bar);
    const pan = isBankA(b.cyl) ? 0.6 : 0.4;
    if (onBeat) {
      houseKick(drums, b.t, 1, rnd, SUB_HZ);
      if (beat % 2 === 1 && bar >= 4) clap(perc, b.t, 0.8, rnd);
    } else if (step % 2 === 0) {
      hat(perc, b.t, 0.55, section === "tension" ? 0.1 : 0.075, rnd, pan);
    } else {
      const progress = (b.t - barT(10)) / (barT(12) - barT(10));
      hat(perc, b.t, 0.22 + 0.3 * progress, 0.022, rnd, pan);
      if (progress > 0.5) snare(perc, b.t, 0.1 + 0.3 * (progress - 0.5), rnd, pan);
    }
  }
};

const addGridDrums = (drums: Bus, perc: Bus, rnd: Rng) => {
  for (const t of KICKS) if (!isSlowed(t)) houseKick(drums, t, t === DROP ? 1.15 : 1, rnd, SUB_HZ);
  for (let beat = 0; beat < BARS * 4; beat++) {
    const t = beatT(beat);
    const bar = Math.floor(beat / 4);
    const section = sectionOfBar(bar);
    if (section === "hook") {
      if (beat % 2 === 1) clap(perc, t, 0.75, rnd);
      hat(perc, beatT(beat + 0.5), 0.5, 0.07, rnd);
    } else if (section === "groove") {
      hat(perc, beatT(beat + 0.25), 0.16, 0.02, rnd, 0.42);
      hat(perc, beatT(beat + 0.5), 0.42, 0.07, rnd, 0.58);
      hat(perc, beatT(beat + 0.75), 0.16, 0.02, rnd, 0.42);
    } else if (section === "drop") {
      if (beat % 2 === 1) clap(perc, t, 1, rnd);
      hat(perc, beatT(beat + 0.5), 0.7, 0.1, rnd, 0.55);
      hat(perc, beatT(beat + 0.25), 0.26, 0.022, rnd, 0.38);
      hat(perc, beatT(beat + 0.75), 0.26, 0.022, rnd, 0.62);
    }
  }
  // The roll tightens through the rise and stops one beat short, leaving the engine alone.
  for (let beat = 48; beat < 55; beat++) {
    const per = beat < 52 ? 2 : beat < 54 ? 4 : 8;
    for (let s = 0; s < per; s++) snare(perc, beatT(beat + s / per), 0.22 + 0.075 * (beat - 48) + (0.05 * s) / per, rnd);
  }
  for (const bar of [2, 6, 10, 14]) crash(perc, barT(bar), bar === 14 ? 1 : 0.5, rnd);
  crash(perc, barT(17), 0.6, rnd);
};

const subNotes = (): SubNote[] => {
  const notes: SubNote[] = STABS.map((t) => ({ t, durS: beatT(1.25), hz: SUB_HZ, fromHz: SUB_HZ * 2, glideS: 0.03 }));
  const note = (bar: number, step: number, len: number, midi: number, extra: Partial<SubNote> = {}) =>
    notes.push({ t: at16th(bar, step), durS: STEP * len, hz: hz(midi), ...extra });

  for (let bar = 2; bar < BARS; bar++) {
    const section = sectionOfBar(bar);
    const root = Math.min(chordOfBar(bar).root, 37);
    if (section === "reveal") {
      // The slowdown is one long dive from high up to the bottom of the mix.
      if (bar === 2) note(bar, 0, 16, SUB_ROOT, { fromHz: SUB_HZ * 8, glideS: 0.16 });
      else note(bar, 0, 16, SUB_ROOT);
    } else if (section === "groove") {
      for (const s of [2, 6, 10, 14]) note(bar, s, 2, bar === 5 && s === 14 ? 30 : SUB_ROOT, { glideS: 0.02 });
    } else if (section === "roll") {
      for (const [step, len] of ROLL_RIFF) note(bar, step, len, root);
    } else if (section === "tension") {
      for (let s = 0; s < 16; s++) if (s % 4 !== 0) note(bar, s, 0.95, root);
    } else if (section === "rise") {
      // One long climb over the rise. It cuts out with the drums for the last beat.
      if (bar === 12) notes.push({ t: barT(12), durS: beatT(7), hz: hz(SUB_ROOT + 24), fromHz: SUB_HZ, glideS: 1.6 });
    } else if (section === "drop") {
      // Sustained, so the sidechain carves the pump. Each bar slides into the next root.
      const next = bar < 16 ? Math.min(chordOfBar(bar + 1).root, 37) : SUB_ROOT;
      note(bar, 0, 15, root, bar === 14 ? { fromHz: SUB_HZ * 4, glideS: 0.07 } : { glideS: 0.03 });
      note(bar, 15, 1, next, { glideS: 0.035 });
    } else {
      note(bar, 0, 8, SUB_ROOT);
      notes.push({ t: at16th(bar, 8), durS: beatT(1.6), hz: SUB_HZ / 2, fromHz: SUB_HZ, glideS: 0.32, vel: 0.85 });
    }
  }
  return notes;
};

/** "oo" opening to "ah" and closing again over the note: the classic wah shape. */
const wow = (centre: number, span: number) => (u: number) => centre + span * (Math.sin(Math.PI * u) - 0.5);
/** Starts on "ee" and falls to "oo", for the falling notes. */
const yoi = (u: number) => 0.95 - 0.95 * Math.min(1, u * 1.5);

const addGrowl = (b: Bus) => {
  // A two-note tease at the end of the hook.
  growl(b, at16th(1, 12), STEP * 2, hz(39), 0.55, { vowel: wow(0.45, 0.5) });
  growl(b, at16th(1, 14), STEP * 2, hz(51), 0.7, { vowel: yoi, diveSemis: 7 });

  for (let bar = 6; bar < 10; bar++) {
    const open = (bar - 6) / 3;
    const root = chordOfBar(bar).root + (chordOfBar(bar).root === 27 ? 12 : 0);
    for (const [step, len, semis] of ROLL_RIFF) growl(b, at16th(bar, step), STEP * len * 0.92, hz(root + semis), 0.38 + 0.3 * open, { vowel: wow(0.22 + 0.25 * open, 0.3 + 0.2 * open), drive: 3 + 2.5 * open });
  }
  for (let bar = 10; bar < 12; bar++) {
    const root = chordOfBar(bar).root + (chordOfBar(bar).root === 27 ? 12 : 0);
    for (let s = 0; s < 16; s++) {
      if (s % 4 === 0) continue;
      const progress = (bar - 10 + s / 16) / 2;
      growl(b, at16th(bar, s), STEP * 0.85, hz(root + (s % 4 === 3 ? 12 : 0)), 0.55 + 0.35 * progress, { vowel: () => 0.25 + 0.7 * progress, drive: 5 + 3 * progress });
    }
  }
  DROP_RIFF.forEach((riff, i) => {
    for (const [step, len, midi, dive] of riff) {
      growl(b, at16th(14 + i, step), STEP * len * 0.94, hz(midi), 1, dive ? { vowel: yoi, diveSemis: 7, drive: 8, resonance: 9 } : { vowel: wow(0.42, 0.6), drive: 7, resonance: 8 });
    }
  });
};

const addReese = (b: Bus) => {
  for (let bar = 2; bar < 6; bar++) playNote(b, barT(bar), barT(1) * 0.97, hz(chordOfBar(bar).root + 12), bar < 4 ? 0.75 : 0.5, REESE);
};

const addChords = (pads: Bus, stabs: Bus) => {
  for (let bar = 2; bar < 12; bar++) {
    const padVel = bar < 6 ? 0.22 : 0.3;
    for (const midi of chordOfBar(bar).tones) playNote(pads, barT(bar), barT(1) * 0.98, hz(midi), padVel, PAD);
  }
  for (const bar of [6, 7, 8, 9]) for (const s of [3, 6, 11, 14]) for (const midi of chordOfBar(bar).tones) playNote(stabs, at16th(bar, s), STEP * 1.2, hz(midi + 12), 0.2, ORGAN);
  for (const bar of [14, 15, 16]) for (const s of [2, 5, 10, 13]) for (const midi of chordOfBar(bar).tones) playNote(stabs, at16th(bar, s), STEP * 1.2, hz(midi + 12), 0.3, ORGAN);
};

/** Lead notes as [16th step, length in 16ths, MIDI note]. All below the engine's note, D#6. */
type Phrase = [number, number, number][];
const VERSE_MOTIF: Phrase[] = [
  [[0, 3, 70], [3, 1, 73], [4, 4, 75]],
  [[2, 2, 73], [4, 2, 70], [8, 4, 66]],
  [[0, 3, 71], [3, 1, 73], [4, 4, 75]],
  [[2, 2, 77], [4, 2, 73], [8, 4, 68]],
];
const DROP_HOOK: Phrase[] = [
  [[2, 1, 75], [3, 1, 75], [4, 2, 73], [6, 2, 70], [10, 1, 70], [11, 1, 73], [12, 3, 75]],
  [[2, 1, 78], [3, 1, 78], [4, 2, 75], [6, 2, 71], [10, 1, 71], [11, 1, 75], [12, 3, 73]],
  [[2, 1, 77], [3, 1, 77], [4, 2, 73], [6, 2, 68], [10, 1, 73], [11, 1, 75], [12, 2, 77], [14, 2, 78]],
];

const addLead = (b: Bus) => {
  VERSE_MOTIF.forEach((phrase, i) => {
    for (const [step, len, midi] of phrase) playNote(b, at16th(6 + i, step), STEP * len * 0.9, hz(midi), 0.3 + 0.05 * i, PLUCK);
  });
  DROP_HOOK.forEach((phrase, i) => {
    for (const [step, len, midi] of phrase) growl(b, at16th(14 + i, step), STEP * len * 0.9, hz(midi - 12), 0.55, { vowel: () => 0.5, drive: 1.6, resonance: 5, highpassHz: 260, attackS: 0.006, releaseS: 0.05 });
  });
  growl(b, barT(17), STEP * 8, hz(63), 0.55, { vowel: (u) => 0.5 - 0.4 * u, drive: 1.6, resonance: 5, highpassHz: 260, attackS: 0.006, releaseS: 0.25 });
};

const buildEngineGain = (n: number): Float32Array => {
  const gain = new Float32Array(n).fill(1);
  const applyEnvelope = (t: number, lengthS: number, shape: (age: number) => number) => {
    const from = Math.round(t * SAMPLE_RATE);
    const to = Math.min(n, from + Math.round(lengthS * SAMPLE_RATE));
    for (let i = from; i < to; i++) gain[i] = Math.min(gain[i], shape((i - from) / SAMPLE_RATE));
  };
  // Hook: throttle stabs carve the engine's note into the 3-3-2 rhythm.
  STABS.forEach((t, k) => {
    const next = STABS[k + 1] ?? SLOW_START;
    applyEnvelope(t, next - t, (age) => 0.25 + 0.75 * Math.exp(-age / 0.17));
  });
  // Drop: the engine ducks under every kick so it pumps with the track.
  for (const t of KICKS) if (t >= DROP) applyEnvelope(t, beatT(1), (age) => 1 - 0.6 * Math.exp(-age / 0.09));
  return gain;
};

const buildSong = (n: number, rnd: Rng): SongTrack => {
  const drums = newBus(n);
  const perc = newBus(n);
  const sub = newBus(n);
  const growlBus = newBus(n);
  const reese = newBus(n);
  const pads = newBus(n);
  const stabs = newBus(n);
  const lead = newBus(n);
  const fx = newBus(n);

  addBangDrums(drums, perc, rnd);
  addGridDrums(drums, perc, rnd);
  subLine(sub, subNotes(), 1.8);
  addGrowl(growlBus);
  addReese(reese);
  addChords(pads, stabs);
  addLead(lead);
  riser(fx, barT(1), SLOW_START, 0.35, true, rnd);
  riser(fx, barT(12), DROP - beatT(1), 0.42, true, rnd);
  riser(fx, DROP, DROP + beatT(3), 0.28, false, rnd);

  const echo = newBus(n);
  pingPongDelay(lead, echo, beatT(0.75), 0.36);
  pingPongDelay(stabs, echo, beatT(0.75), 0.3);

  // Heavy sidechain: the sub vanishes under the kick and swells back, which is the pump.
  applyGain(sub, sidechain(n, KICKS, 1, 0.055, 0.05));
  const midDuck = sidechain(n, KICKS, 0.8, 0.03, 0.075);
  for (const bus of [growlBus, reese]) applyGain(bus, midDuck);
  const padDuck = sidechain(n, KICKS, 0.7, 0.02, 0.12);
  for (const bus of [pads, stabs]) applyGain(bus, padDuck);

  const master = newBus(n);
  mixInto(master, drums, 0.68);
  mixInto(master, perc, 0.62);
  mixInto(master, sub, 0.6);
  mixInto(master, growlBus, 0.52);
  mixInto(master, reese, 0.5);
  mixInto(master, pads, 0.17);
  mixInto(master, stabs, 0.32);
  mixInto(master, lead, 0.34);
  mixInto(master, echo, 0.12);
  mixInto(master, fx, 0.36);
  return { L: master.L, R: master.R, engineGain: buildEngineGain(n) };
};

export const settings: EngineAudioSettings = {
  ...defaultEngineAudio,
  bed: undefined,
  voiceOf: (cyl) => (isBankA(cyl) ? { thumpHz: 110, pan: 0.58, pulseGain: 1.0 } : { thumpHz: 92, pan: 0.42, pulseGain: 1.0 }),
  pulse: { ...defaultEngineAudio.pulse, decayLevel: 0.8, ringLevel: 0.2 },
  whooshes: [],
  mix: { ...defaultEngineAudio.mix, pulseGain: 0.34, thumpGain: 0.14, fadeOutS: 0.7, masterDrive: 0.6, targetPeak: 0.92 },
};

const audio: VideoAudio = {
  render: () => renderEngineAudio({ durationS: meta.durationS, bangs: BANGS, isSlowed: isSlowedBang, settings, song: buildSong }),
};

export default audio;

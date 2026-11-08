// The soundtrack: an original chiptune-rock song in A minor at the engine's own tempo and tuning.
// While slowed, every firing event is a drum hit, so the song's rhythm is the engine.
import { defaultEngineAudio, renderEngineAudio, SAMPLE_RATE, type EngineAudioSettings, type EpisodeAudio, type Rng, type SongTrack } from "../../core/audio";
import { crash, hat, kick, midiHz, mixInto, newBus, pingPongDelay, playNote, riser, snare, tom, type Bus, type Voice } from "../../core/synth";
import { meta } from "./meta";
import { BANGS, barT, BARS, beatT, DROP, isRightBank, isSlowed, REAL_SPEED_START, SLOW_START, SONG_A4_HZ } from "./physics";
import { KICKS, sectionOfBar, STABS } from "./song";

const hz = (midi: number) => midiHz(midi, SONG_A4_HZ);

type Chord = { root: number; tones: number[] };
const Am: Chord = { root: 45, tones: [57, 60, 64] };
const F: Chord = { root: 41, tones: [53, 57, 60] };
const C: Chord = { root: 48, tones: [55, 60, 64] };
const G: Chord = { root: 43, tones: [55, 59, 62] };
const PROGRESSION = [Am, F, C, G];

const chordOfBar = (bar: number): Chord => {
  if (bar < 2 || bar === 19) return Am;
  if (bar === 15) return G;
  if (bar >= 16) return PROGRESSION[bar - 16];
  return PROGRESSION[(bar - 2) % 4];
};

const BASS: Voice = { wave: "saw", detune: 1.004, cutoffHz: 260, cutoffEnvHz: 1100, filterTau: 0.09, attackS: 0.003, decayTau: 0.18, sustain: 0.55, releaseS: 0.04 };
const PAD: Voice = { wave: "saw", detune: 1.006, cutoffHz: 900, cutoffEnvHz: 500, filterTau: 0.4, attackS: 0.08, decayTau: 0.6, sustain: 0.8, releaseS: 0.25 };
const ARP: Voice = { wave: "square", detune: 1, cutoffHz: 1500, cutoffEnvHz: 2600, filterTau: 0.05, attackS: 0.002, decayTau: 0.09, sustain: 0.1, releaseS: 0.03 };
const LEAD: Voice = { wave: "pulse", detune: 1.003, cutoffHz: 1900, cutoffEnvHz: 1800, filterTau: 0.1, attackS: 0.006, decayTau: 0.3, sustain: 0.7, releaseS: 0.06, vibratoHz: 5.5, vibratoDepth: 0.006 };
const STAB: Voice = { wave: "saw", detune: 1.008, cutoffHz: 1100, cutoffEnvHz: 2400, filterTau: 0.07, attackS: 0.002, decayTau: 0.14, sustain: 0.25, releaseS: 0.06 };

const SIXTEENTH = beatT(0.25);
const barStart = (bar: number) => barT(bar);
const at16th = (bar: number, step: number) => barStart(bar) + beatT(step / 4);

/** Lead notes as [16th step, length in 16ths, MIDI note]. Kept below the engine's note. */
type Phrase = [number, number, number][];

const HOOK: Phrase[] = [
  [[0, 3, 76], [3, 1, 74], [4, 2, 72], [6, 2, 69], [8, 2, 72], [10, 2, 74], [12, 4, 76]],
  [[0, 3, 77], [3, 1, 76], [4, 2, 72], [6, 2, 69], [8, 4, 72], [12, 2, 69], [14, 2, 72]],
  [[0, 3, 76], [3, 1, 72], [4, 2, 67], [6, 2, 72], [8, 2, 76], [10, 2, 74], [12, 4, 72]],
];
const VERSE: Phrase[] = [
  [[0, 6, 69], [6, 2, 72], [8, 6, 76], [14, 2, 74]],
  [[0, 6, 72], [6, 2, 69], [8, 8, 65]],
  [[0, 6, 67], [6, 2, 72], [8, 6, 76], [14, 2, 74]],
  [[0, 4, 71], [4, 4, 67], [8, 8, 74]],
];

const addPhrase = (b: Bus, bar: number, phrase: Phrase, vel: number, pan = 0.5) => {
  for (const [step, length, midi] of phrase) playNote(b, at16th(bar, step), SIXTEENTH * length * 0.92, hz(midi), vel, LEAD, pan);
};

/** Every slowed firing event becomes a drum hit, chosen from where it falls in the bar. */
const addBangDrums = (drums: Bus, rnd: Rng) => {
  for (const b of BANGS) {
    if (!isSlowed(b.t)) continue;
    const step32 = Math.round(b.t / beatT(0.125));
    const onBeat = step32 % 8 === 0;
    const beat = Math.round(step32 / 8);
    const bar = Math.floor(beat / 4);
    const section = sectionOfBar(bar);
    const pan = isRightBank(b.cyl) ? 0.62 : 0.38;

    if (onBeat) {
      if (beat % 2 === 0) kick(drums, b.t, 0.95, rnd);
      else snare(drums, b.t, 0.8, rnd, pan);
    } else if (section === "build1") {
      hat(drums, b.t, 0.5, 0.05, rnd, pan);
      tom(drums, b.t, isRightBank(b.cyl) ? 150 : 200, 0.26, pan);
    } else if (section === "build2") {
      if (step32 % 4 === 0) hat(drums, b.t, 0.55, 0.12, rnd, pan);
      else hat(drums, b.t, 0.4, 0.035, rnd, pan);
    } else {
      const progress = (b.t - barT(12)) / (barT(14) - barT(12));
      snare(drums, b.t, 0.14 + 0.42 * progress, rnd, pan);
    }
  }
};

const addGridDrums = (drums: Bus, rnd: Rng) => {
  for (const t of KICKS) if (!isSlowed(t)) kick(drums, t, 1, rnd);
  for (let beat = 0; beat < BARS * 4; beat++) {
    const t = beatT(beat);
    const bar = Math.floor(beat / 4);
    const section = sectionOfBar(bar);
    if (section === "intro") {
      if (beat % 2 === 1) snare(drums, t, 0.55, rnd);
      hat(drums, beatT(beat + 0.5), 0.42, 0.05, rnd, 0.42);
    } else if (section === "rise") {
      hat(drums, t, 0.5, 0.05, rnd);
      hat(drums, beatT(beat + 0.5), 0.5, 0.05, rnd, 0.42);
      if (bar === 14 && beat % 2 === 1) snare(drums, t, 0.7, rnd);
      if (bar === 15) {
        for (let step = 0; step < 4; step++) snare(drums, beatT(beat + step / 4), 0.22 + 0.11 * (beat % 4) + 0.04 * step, rnd);
      }
    } else if (section === "chorus") {
      if (beat % 2 === 1) snare(drums, t, 0.95, rnd);
      hat(drums, beatT(beat + 0.5), 0.6, 0.16, rnd, 0.6);
      hat(drums, t, 0.32, 0.04, rnd, 0.4);
    }
  }
  for (const bar of [2, 8, 10, 12, 16, 19]) crash(drums, barStart(bar), bar === 16 ? 0.9 : 0.55, rnd);
};

const addBass = (b: Bus) => {
  for (const t of STABS) playNote(b, t, beatT(0.5), hz(33), 0.95, BASS);
  for (let bar = 2; bar < BARS; bar++) {
    const root = chordOfBar(bar).root - 12;
    const section = sectionOfBar(bar);
    const note = (step: number, len: number, midi: number, vel = 0.9) => playNote(b, at16th(bar, step), SIXTEENTH * len * 0.9, hz(midi), vel, BASS);
    if (section === "reveal") {
      note(0, 6, root);
      note(8, 6, root);
    } else if (section === "verse") {
      for (let beat = 0; beat < 4; beat++) note(beat * 4, 3, root);
    } else if (section === "build1") {
      for (let e = 0; e < 8; e++) note(e * 2, 1.7, root);
    } else if (section === "build2") {
      for (let e = 0; e < 8; e++) note(e * 2, 1.7, e % 2 === 0 ? root : root + 12);
    } else if (section === "build3" || section === "rise") {
      for (let s = 0; s < 16; s++) note(s, 0.9, s % 4 === 0 ? root : root + 12, 0.75);
    } else if (section === "chorus") {
      for (let e = 0; e < 8; e++) note(e * 2, 1.7, e % 2 === 0 ? root : root + 12, 1);
    } else {
      note(0, 12, root, 1);
    }
  }
};

const addChords = (pads: Bus, stabs: Bus) => {
  for (let bar = 2; bar < BARS; bar++) {
    const { tones } = chordOfBar(bar);
    const section = sectionOfBar(bar);
    const padVel = section === "reveal" ? 0.3 : section === "verse" ? 0.34 : section === "chorus" || section === "outro" ? 0.42 : 0.3;
    for (const midi of tones) playNote(pads, barStart(bar), barT(1) * (section === "outro" ? 0.95 : 0.98), hz(midi), padVel, PAD);
    if (section === "chorus") {
      for (const step of [0, 3, 6, 10, 12]) for (const midi of tones) playNote(stabs, at16th(bar, step), SIXTEENTH * 1.3, hz(midi), 0.3, STAB);
    }
  }
  // Intro stabs follow the engine's throttle stabs.
  for (const t of STABS) for (const midi of Am.tones) playNote(stabs, t, beatT(0.5), hz(midi), 0.3, STAB);
};

/** Sixteenth-note arpeggio. Its filter opens as the engine doubles. */
const addArp = (b: Bus) => {
  const PATTERN = [0, 1, 2, 3, 2, 1, 2, 3];
  for (let bar = 4; bar < 14; bar++) {
    const { tones } = chordOfBar(bar);
    const notes = [...tones, tones[0] + 12];
    const open = (bar - 4) / 10;
    const voice = { ...ARP, cutoffHz: 1200 + 2200 * open };
    for (let s = 0; s < 16; s++) playNote(b, at16th(bar, s), SIXTEENTH * 0.8, hz(notes[PATTERN[s % 8]]), 0.22 + 0.16 * open, voice, s % 2 === 0 ? 0.35 : 0.65);
  }
};

const addLead = (b: Bus) => {
  for (let bar = 4; bar < 8; bar++) addPhrase(b, bar, VERSE[bar - 4], 0.34);
  for (let bar = 16; bar < 19; bar++) addPhrase(b, bar, HOOK[bar - 16], 0.5);
  playNote(b, barStart(19), barT(1) * 0.9, hz(69), 0.5, LEAD);
};

const buildEngineGain = (n: number): Float32Array => {
  const gain = new Float32Array(n).fill(1);
  const applyEnvelope = (t: number, lengthS: number, shape: (age: number) => number) => {
    const from = Math.round(t * SAMPLE_RATE);
    const to = Math.min(n, from + Math.round(lengthS * SAMPLE_RATE));
    for (let i = from; i < to; i++) gain[i] = Math.min(gain[i], shape((i - from) / SAMPLE_RATE));
  };
  // Intro: the throttle stabs carve the engine's note into the 3-3-2 rhythm.
  STABS.forEach((t, k) => {
    const next = STABS[k + 1] ?? SLOW_START;
    applyEnvelope(t, next - t, (age) => 0.3 + 0.7 * Math.exp(-age / 0.16));
  });
  // Chorus: the engine ducks under every kick so the song pumps around the note.
  for (const t of KICKS) if (t >= DROP) applyEnvelope(t, beatT(1), (age) => 1 - 0.5 * Math.exp(-age / 0.08));
  return gain;
};

const buildSong = (n: number, rnd: Rng): SongTrack => {
  const drums = newBus(n);
  const bass = newBus(n);
  const pads = newBus(n);
  const stabs = newBus(n);
  const arp = newBus(n);
  const lead = newBus(n);
  const fx = newBus(n);

  addBangDrums(drums, rnd);
  addGridDrums(drums, rnd);
  addBass(bass);
  addChords(pads, stabs);
  addArp(arp);
  addLead(lead);
  riser(fx, barT(1), SLOW_START, 0.35, true, rnd);
  riser(fx, barT(12), REAL_SPEED_START, 0.3, true, rnd);
  riser(fx, barT(15), DROP, 0.5, true, rnd);

  // Dotted-eighth echoes: they fall on the 16th-note grid, so even the tails stay in time.
  const echo = newBus(n);
  pingPongDelay(lead, echo, beatT(0.75), 0.38);
  pingPongDelay(arp, echo, beatT(0.75), 0.25);

  // Pads and stabs duck under each kick.
  const duck = new Float32Array(n).fill(1);
  for (const t of KICKS) {
    const from = Math.round(t * SAMPLE_RATE);
    for (let i = from; i < Math.min(n, from + Math.round(0.3 * SAMPLE_RATE)); i++) {
      duck[i] = Math.min(duck[i], 1 - 0.55 * Math.exp(-(i - from) / SAMPLE_RATE / 0.08));
    }
  }
  for (const bus of [pads, stabs]) {
    for (let i = 0; i < n; i++) {
      bus.L[i] *= duck[i];
      bus.R[i] *= duck[i];
    }
  }

  const master = newBus(n);
  mixInto(master, drums, 0.62);
  mixInto(master, bass, 0.42);
  mixInto(master, pads, 0.3);
  mixInto(master, stabs, 0.42);
  mixInto(master, arp, 0.3);
  mixInto(master, lead, 0.34);
  mixInto(master, echo, 0.13);
  mixInto(master, fx, 0.32);
  return { L: master.L, R: master.R, engineGain: buildEngineGain(n) };
};

export const settings: EngineAudioSettings = {
  ...defaultEngineAudio,
  bed: undefined,
  voiceOf: (cyl) => (isRightBank(cyl) ? { thumpHz: 104, pan: 0.62, pulseGain: 1.0 } : { thumpHz: 90, pan: 0.38, pulseGain: 0.86 }),
  // Less resonance than the default, so the engine's note stands clear of its octave.
  pulse: { ...defaultEngineAudio.pulse, decayLevel: 0.8, ringLevel: 0.2 },
  whooshes: [],
  mix: { ...defaultEngineAudio.mix, pulseGain: 0.5, thumpGain: 0.3, masterDrive: 0.85, targetPeak: 0.9 },
};

const audio: EpisodeAudio = {
  render: () => renderEngineAudio({ durationS: meta.durationS, bangs: BANGS, isSlowed, settings, song: buildSong }),
};

export default audio;

// Synthesises a planned song. The order of the synthesis steps below is part of the song: the seeded
// noise depends on it, so reordering them changes the WAV.
import { createRng, SAMPLE_RATE as SR, type StereoAudio } from "../audio";
import { applyGain, clap, growl, houseKick, sidechain, subLine, type GrowlOptions, type SubNote } from "../houseSynth";
import { crash, hat, midiHz, mixInto, newBus, pingPongDelay, playNote, riser, snare, type Voice } from "../synth";
import type { SongPlan, SongStyle } from "./plan";
import { impact, kickTop, wobble } from "./voices";

const A4 = 440;
const hz = (midi: number) => midiHz(midi, A4);

const PAD: Voice = { wave: "saw", detune: 1.007, cutoffHz: 520, cutoffEnvHz: 240, filterTau: 0.5, attackS: 0.12, decayTau: 0.8, sustain: 0.85, releaseS: 0.3 };
const ORGAN: Voice = { wave: "square", detune: 1.004, cutoffHz: 950, cutoffEnvHz: 2100, filterTau: 0.035, attackS: 0.002, decayTau: 0.08, sustain: 0.05, releaseS: 0.05 };
const PLUCK: Voice = { wave: "pulse", detune: 1.005, cutoffHz: 1100, cutoffEnvHz: 1700, filterTau: 0.06, attackS: 0.003, decayTau: 0.16, sustain: 0.25, releaseS: 0.08 };

/** "oo" opening to "ah" and closing again over the note. */
const wow = (centre: number, span: number) => (u: number) => centre + span * (Math.sin(Math.PI * u) - 0.5);
/** Starts on "ee" and falls to "oo". */
const yoi = (u: number) => 0.95 - 0.95 * Math.min(1, u * 1.5);

type Mix = { drums: number; punch: number; perc: number; sub: number; bass: number; pads: number; stabs: number; lead: number; echo: number; fx: number; impact: number; drive: number };

const MIX: Record<SongStyle, Mix> = {
  house: { drums: 0.78, punch: 0.6, perc: 0.66, sub: 0.74, bass: 0.56, pads: 0.15, stabs: 0.3, lead: 0.3, echo: 0.1, fx: 0.3, impact: 0.5, drive: 0.72 },
  dubstep: { drums: 0.8, punch: 1.3, perc: 0.7, sub: 0.72, bass: 1.0, pads: 0.16, stabs: 0.3, lead: 0.26, echo: 0.12, fx: 0.32, impact: 0.8, drive: 0.74 },
};

const TARGET_PEAK = 0.92;
const FADE_IN_S = 0.002;
const FADE_OUT_S = 0.7;

/** The song as stereo audio. Every run with the same plan gives the same samples. */
export const renderSong = (plan: SongPlan): StereoAudio => {
  const n = Math.ceil(plan.durationS * SR);
  const rnd = createRng(plan.seed ^ 0x5eed1234);
  const at = (beat: number) => beat * plan.beatS;
  const dubstep = plan.style === "dubstep";
  const rootHz = hz(plan.rootMidi);
  /** The kick's tail sits on the song's root, an octave up if the root is too low to carry. */
  const kickTailHz = rootHz < 42 ? rootHz * 2 : rootHz;

  const drums = newBus(n);
  const punch = newBus(n);
  const perc = newBus(n);
  const sub = newBus(n);
  const bass = newBus(n);
  const pads = newBus(n);
  const stabs = newBus(n);
  const lead = newBus(n);
  const fx = newBus(n);
  const impacts = newBus(n);

  for (const k of plan.kicks) {
    houseKick(drums, at(k.beat), k.vel, rnd, kickTailHz, dubstep ? 0.5 : 0.44);
    kickTop(punch, at(k.beat), k.vel, rnd);
  }
  for (const b of plan.backbeats) {
    clap(perc, at(b.beat), b.vel, rnd);
    if (dubstep) snare(perc, at(b.beat), b.vel * 1.25, rnd);
  }
  for (const r of plan.rolls) snare(perc, at(r.beat), r.vel, rnd);
  for (const h of plan.hats) hat(perc, at(h.beat), h.vel, h.decayS, rnd, h.pan);
  for (const c of plan.crashes) crash(perc, at(c.beat), c.vel, rnd);
  for (const beat of plan.impacts) impact(impacts, at(beat), rootHz, 1, rnd);

  const subNotes: SubNote[] = plan.sub.map((s) => ({ t: at(s.beat), durS: at(s.beats), hz: hz(s.midi), vel: s.vel, fromHz: s.fromMidi === undefined ? undefined : hz(s.fromMidi), glideS: s.glideS }));
  if (subNotes.length > 0) subLine(sub, subNotes, 2.2);

  for (const b of plan.bass) {
    const t = at(b.beat);
    const durS = at(b.beats);
    if (b.wobble !== undefined) {
      wobble(bass, t, durS, hz(b.midi), 0.45 + 0.55 * b.energy, { ratePerS: b.wobble / plan.beatS, drive: 3 + 6 * b.energy, resonance: 5 + 3 * b.energy, highHz: 900 + 3200 * b.energy, diveSemis: b.dive ? 7 : 0 });
    } else {
      const options: GrowlOptions = b.dive ? { vowel: yoi, diveSemis: 7, drive: 3 + 5 * b.energy, resonance: 9 } : { vowel: wow(0.22 + 0.2 * b.energy, 0.3 + 0.3 * b.energy), drive: 3 + 4 * b.energy, resonance: 8 };
      growl(bass, t, durS, hz(b.midi), 0.4 + 0.6 * b.energy, options);
    }
  }

  const barS = at(4);
  for (const p of plan.pads) for (const midi of p.midis) playNote(pads, at(p.bar * 4), barS * 0.98, hz(midi), p.vel, PAD);
  for (const s of plan.stabs) playNote(stabs, at(s.beat), at(s.beats), hz(s.midi), 0.24, ORGAN);
  for (const l of plan.lead) {
    if (l.energy >= 1) growl(lead, at(l.beat), at(l.beats), hz(l.midi), 0.55, { vowel: () => 0.5, drive: 1.6, resonance: 5, highpassHz: 260, attackS: 0.006, releaseS: 0.05 });
    else playNote(lead, at(l.beat), at(l.beats), hz(l.midi), 0.34 * l.energy + 0.14, PLUCK);
  }
  for (const r of plan.risers) riser(fx, at(r.fromBeat), at(r.toBeat), r.vel, r.rising, rnd);

  const echo = newBus(n);
  pingPongDelay(lead, echo, at(0.75), 0.36);
  pingPongDelay(stabs, echo, at(0.75), 0.3);

  // The pump: bass and pads get out of the way of every kick, and in dubstep of every snare too.
  const kickTimes = plan.kicks.map((k) => at(k.beat));
  const duckTimes = dubstep ? [...kickTimes, ...plan.backbeats.map((b) => at(b.beat))].sort((a, b) => a - b) : kickTimes;
  applyGain(sub, sidechain(n, kickTimes, 1, 0.055, 0.05));
  // Dubstep's bass plays straight through its kicks, so it has to get further out of the way.
  applyGain(bass, sidechain(n, duckTimes, dubstep ? 0.96 : 0.8, dubstep ? 0.045 : 0.03, 0.075));
  const padDuck = sidechain(n, duckTimes, 0.7, 0.02, 0.12);
  applyGain(pads, padDuck);
  applyGain(stabs, padDuck);

  const m = MIX[plan.style];
  const master = newBus(n);
  mixInto(master, drums, m.drums);
  mixInto(master, punch, m.punch);
  mixInto(master, perc, m.perc);
  mixInto(master, sub, m.sub);
  mixInto(master, bass, m.bass);
  mixInto(master, pads, m.pads);
  mixInto(master, stabs, m.stabs);
  mixInto(master, lead, m.lead);
  mixInto(master, echo, m.echo);
  mixInto(master, fx, m.fx);
  mixInto(master, impacts, m.impact);

  let peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const envelope = Math.min(1, t / FADE_IN_S) * Math.min(1, (plan.durationS - t) / FADE_OUT_S);
    master.L[i] = Math.tanh(master.L[i] * m.drive) * envelope;
    master.R[i] = Math.tanh(master.R[i] * m.drive) * envelope;
    peak = Math.max(peak, Math.abs(master.L[i]), Math.abs(master.R[i]));
  }
  const norm = TARGET_PEAK / peak;
  return { L: master.L, R: master.R, norm, summary: `${plan.style}, seed ${plan.seed}, ${plan.durationS.toFixed(1)} s, ${plan.bpm.toFixed(1)} BPM, root MIDI ${plan.rootMidi}, peak norm ${norm.toFixed(2)}` };
};

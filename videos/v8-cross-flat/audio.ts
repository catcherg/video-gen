import { type EpisodeAudio } from "../../src/core/audio";
import { defaultEngineAudio, renderEngineAudio, type EngineAudioSettings } from "../../src/kits/engine/engineAudio";
import { meta } from "./meta";
import { CROSS, engineAt, FLAT, isSlowed, PULSE_TAU_S, REAL_SPEED_START, SLOW_START, type V8 } from "./physics";

// Flat-plane cylinders get this offset in the merged bang list so voiceOf can tell the engines apart.
const FLAT_CYL_OFFSET = 100;

const onScreenBangs = (v8: V8, offset: number) => v8.engine.bangs.filter((b) => engineAt(b.t) === v8).map((b) => ({ t: b.t, cyl: b.cyl + offset }));
const bangs = [...onScreenBangs(CROSS, 0), ...onScreenBangs(FLAT, FLAT_CYL_OFFSET)].sort((a, b) => a.t - b.t);

const isRightBank = (cyl: number) => (cyl > FLAT_CYL_OFFSET ? FLAT.isRight(cyl - FLAT_CYL_OFFSET) : CROSS.isRight(cyl));

export const settings: EngineAudioSettings = {
  ...defaultEngineAudio,
  // Each bank is hard-panned so its own pulse spacing stays audible.
  voiceOf: (cyl) => (isRightBank(cyl) ? { thumpHz: 104, pan: 0.85, pulseGain: 1, pulsePan: 1 } : { thumpHz: 90, pan: 0.15, pulseGain: 1, pulsePan: 0 }),
  // A plain decaying pulse with no resonance, so the spectrum follows the firing pattern.
  pulse: { ...defaultEngineAudio.pulse, decayTau: PULSE_TAU_S, decayLevel: 1, ringLevel: 0, noiseAmp: 0.05 },
  mix: { ...defaultEngineAudio.mix, bedGainReal: 0.05 },
  whooshes: [
    { at: SLOW_START, rising: false },
    { at: REAL_SPEED_START, rising: true },
  ],
};

const audio: EpisodeAudio = {
  render: () => renderEngineAudio({ durationS: meta.durationS, bangs, isSlowed, settings }),
};

export default audio;

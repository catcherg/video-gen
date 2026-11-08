import { renderEngineAudio, type EngineAudioSettings, type EpisodeAudio } from "../../core/audio";
import { meta } from "./meta";
import { BANGS, isRightBank, isSlowed, REAL_SPEED_START, SLOW_START } from "./physics";

export const settings: EngineAudioSettings = {
  seed: 1234567,
  // The two banks differ slightly, which adds a growl at half the firing frequency.
  voiceOf: (cyl) => (isRightBank(cyl) ? { thumpHz: 104, pan: 0.62, pulseGain: 1.0 } : { thumpHz: 90, pan: 0.38, pulseGain: 0.86 }),
  thump: {
    lengthS: 0.26,
    sweepHz: 60,
    sweepTau: 0.012,
    bodyAmp: 0.75,
    bodyTau: 0.055,
    clickAmp: 0.45,
    clickTau: 0.005,
    snapAmp: 0.18,
    snapHz: 2100,
    snapTau: 0.004,
  },
  pulse: {
    lengthS: 0.006,
    decayTau: 0.0007,
    decayLevel: 0.55,
    ringLevel: 0.45,
    ringHz: 1500,
    noiseAmp: 0.12,
    noiseTau: 0.002,
    jitterMin: 0.9,
    jitterRange: 0.2,
  },
  shaping: { dcCoef: 0.0015, lowpassHz: 4200, drive: 1.6 },
  // A minor, 120 BPM: A2 F2 C3 G2, one 2-second bar each.
  bed: {
    barS: 2,
    stepS: 0.25,
    stepDecay: 4,
    bassAmp: 0.5,
    bass: [110.0, 87.31, 130.81, 98.0],
    chords: [
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [261.63, 329.63, 392.0],
      [196.0, 246.94, 293.66],
    ],
    padAmp: 0.06,
    detunedAmp: 0.04,
    detune: 1.003,
    rightGain: 0.96,
  },
  whooshes: [
    { at: SLOW_START, rising: false },
    { at: REAL_SPEED_START, rising: true },
  ],
  mix: {
    bedGainSlowed: 0.32,
    bedGainReal: 0.16,
    pulseGain: 0.55,
    thumpGain: 0.8,
    fadeInS: 0.08,
    fadeOutS: 0.6,
    masterDrive: 0.9,
    targetPeak: 0.72, // headroom so AAC encoding can't clip
  },
};

const audio: EpisodeAudio = {
  render: () => renderEngineAudio({ durationS: meta.durationS, bangs: BANGS, isSlowed, settings }),
};

export default audio;

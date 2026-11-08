import { defaultEngineAudio, renderEngineAudio, type EngineAudioSettings, type EpisodeAudio } from "../../core/audio";
import { meta } from "./meta";
import { BANGS, isRightBank, isSlowed, REAL_SPEED_START, SLOW_START } from "./physics";

export const settings: EngineAudioSettings = {
  ...defaultEngineAudio,
  // The two banks differ slightly, which adds a growl at half the firing frequency.
  voiceOf: (cyl) => (isRightBank(cyl) ? { thumpHz: 104, pan: 0.62, pulseGain: 1.0 } : { thumpHz: 90, pan: 0.38, pulseGain: 0.86 }),
  whooshes: [
    { at: SLOW_START, rising: false },
    { at: REAL_SPEED_START, rising: true },
  ],
};

const audio: EpisodeAudio = {
  render: () => renderEngineAudio({ durationS: meta.durationS, bangs: BANGS, isSlowed, settings }),
};

export default audio;

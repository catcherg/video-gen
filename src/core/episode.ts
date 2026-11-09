export type EpisodeMeta = {
  /** Folder name under videos/, and the Remotion composition id. */
  slug: string;
  title: string;
  description: string;
  fps: number;
  durationS: number;
  width: number;
  height: number;
};

export type EpisodeProps = { withAudio?: boolean };

/**
 * One section of the finished audio whose dominant pitch must match a prediction.
 * `channel` analyses one stereo side. Default is mono.
 * `minHz` and `maxHz` narrow the search when music shares the mix, so the check measures the right sound.
 */
export type ToneCheck = { label: string; from: number; to: number; expectedHz: number; channel?: "left" | "right"; minHz?: number; maxHz?: number };

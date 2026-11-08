export type EpisodeMeta = {
  /** Folder name under src/episodes, the Remotion composition id, and the public/ audio folder. */
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
 * One real-speed section the audio must match. Picked to avoid rev ramps and whooshes.
 * `channel` analyses one stereo side, for episodes that pan each bank to its own side. Default is mono.
 */
export type ToneCheck = { label: string; from: number; to: number; expectedHz: number; channel?: "left" | "right" };

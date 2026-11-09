import { AbsoluteFill, Audio, staticFile } from "remotion";
import type { EpisodeProps } from "./episode";
import { C } from "./theme";

/** Builds an episode's composition component from its scene and overlay. */
export const makeEpisode =
  (slug: string, Scene: React.FC, Overlay: React.FC): React.FC<EpisodeProps> =>
  ({ withAudio = true }) => (
    <AbsoluteFill style={{ background: C.bg }}>
      <Scene />
      <Overlay />
      {withAudio ? <Audio src={staticFile(`videos/${slug}/output/audio.wav`)} /> : null}
    </AbsoluteFill>
  );

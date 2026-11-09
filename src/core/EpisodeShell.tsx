import { AbsoluteFill, Audio, staticFile } from "remotion";
import type { EpisodeProps } from "./episode";
import { DEFAULT_PALETTE, PaletteContext, type Palette } from "./palette";

/** Builds a video's composition component from its scene, overlay and palette. */
export const makeEpisode =
  (slug: string, Scene: React.FC, Overlay: React.FC, palette: Palette = DEFAULT_PALETTE): React.FC<EpisodeProps> =>
  ({ withAudio = true }) => (
    <PaletteContext.Provider value={palette}>
      <AbsoluteFill style={{ background: palette.background }}>
        <Scene />
        <Overlay />
        {withAudio ? <Audio src={staticFile(`videos/${slug}/output/audio.wav`)} /> : null}
      </AbsoluteFill>
    </PaletteContext.Provider>
  );

import { Composition } from "remotion";
import { EPISODES } from "../videos/registry";
import { PartsGallery } from "./kits/engine/parts/Gallery";

export const RemotionRoot: React.FC = () => (
  <>
    {EPISODES.map(({ meta, load }) => (
      <Composition
        key={meta.slug}
        id={meta.slug}
        lazyComponent={load}
        durationInFrames={meta.fps * meta.durationS}
        fps={meta.fps}
        width={meta.width}
        height={meta.height}
        defaultProps={{ withAudio: false }}
      />
    ))}
    <Composition id="parts-gallery" component={PartsGallery} durationInFrames={30} fps={30} width={1080} height={1920} />
  </>
);

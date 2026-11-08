import { Composition } from "remotion";
import { DURATION_FRAMES, FPS } from "./physics";
import { V12Reel } from "./V12Reel";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="V12Reel"
    component={V12Reel}
    durationInFrames={DURATION_FRAMES}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={{ withAudio: false }}
  />
);

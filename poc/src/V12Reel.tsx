import { AbsoluteFill, Audio, staticFile } from "remotion";
import { Overlay } from "./overlay/Overlay";
import { Scene } from "./scene/Scene";
import { C } from "./scene/palette";

export const V12Reel: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Scene />
    <Overlay />
    {withAudio ? <Audio src={staticFile("audio.wav")} /> : null}
  </AbsoluteFill>
);

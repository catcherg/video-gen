// The 2D layer: shot titles, the live diagram and captions, all inside the safe zone.
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Captions } from "../../src/core/Captions";
import { Diagram } from "../../src/core/diagrams/Diagram";
import { Flashes } from "../../src/core/Flashes";
import { useFonts } from "../../src/core/fonts";
import { Headline } from "../../src/core/Headline";
import { REGIONS } from "../../src/core/layout";
import { fadeWindow, progress } from "../../src/core/motion";
import { barT } from "./physics";
import { CAPTIONS, DIAGRAMS, END_FADE_FROM, IMPACTS, SHOT_WINDOWS, TITLES } from "./timeline";

export const Overlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  useFonts();

  const shot = SHOT_WINDOWS.find((s) => t >= s.from && t < s.to);
  const title = TITLES.find((x) => t >= x.from && t < x.to);
  const diagram = shot?.diagram ? DIAGRAMS[shot.diagram] : undefined;

  return (
    <AbsoluteFill>
      {title ? <Headline t={t} at={title.from} text={title.text} /> : null}
      {diagram && shot ? <Diagram spec={diagram} progress={progress(t, shot.from + 0.05, shot.from + Math.min(barT(1), (shot.to - shot.from) * 0.75))} fade={fadeWindow(t, shot.from, shot.to, 0.1)} /> : null}
      <Captions t={t} captions={CAPTIONS} region={REGIONS.caption} />
      <Flashes t={t} at={IMPACTS} endFadeFrom={END_FADE_FROM} />
    </AbsoluteFill>
  );
};

// The 2D layer: shot titles, labels, the live diagram and captions, all inside the safe zone.
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Callout } from "../../src/core/Callout";
import { keepClear, makeProjector } from "../../src/core/camera";
import { Captions } from "../../src/core/Captions";
import { Diagram } from "../../src/core/diagrams/Diagram";
import { Flashes } from "../../src/core/Flashes";
import { useFonts } from "../../src/core/fonts";
import { Headline } from "../../src/core/Headline";
import { REGIONS, SAFE } from "../../src/core/layout";
import { fadeWindow, progress } from "../../src/core/motion";
import { barT, beatT } from "./physics";
import { cameraAt, CAPTIONS, DIAGRAMS, END_FADE_FROM, IMPACTS, MOLECULES, SETS, SHOT_WINDOWS, TITLES } from "./timeline";

const project = makeProjector(cameraAt);
const SIDE_MARGIN = 190;

type Label = { from: number; to: number; x: number; y: number; text: string; point: [number, number, number] };

/** The molecule nearest the label, so the leader line stays short. */
const LABELLED = MOLECULES.reduce((best, m) => (Math.hypot(m[0] + 1.3, m[1] - 1.5) < Math.hypot(best[0] + 1.3, best[1] - 1.5) ? m : best));

// Label columns stay inside the safe zone. Each points at something in the set the camera is on.
const LABELS: Label[] = [
  { from: barT(4) + beatT(2), to: barT(6), x: 300, y: 450, text: "AIR MOLECULE", point: [SETS.air + LABELLED[0], LABELLED[1], LABELLED[2]] },
  { from: barT(14) + beatT(1), to: barT(16), x: 770, y: 640, text: "NOT TO SCALE", point: [SETS.space + 9, 7, 1] },
];

export const Overlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width: w, height: h } = useVideoConfig();
  const t = frame / fps;
  useFonts();

  const shot = SHOT_WINDOWS.find((s) => t >= s.from && t < s.to);
  const title = TITLES.find((x) => t >= x.from && t < x.to);
  const diagram = shot?.diagram ? DIAGRAMS[shot.diagram] : undefined;

  return (
    <AbsoluteFill>
      {title ? <Headline t={t} at={title.from} text={title.text} /> : null}
      {LABELS.filter((l) => t >= l.from && t < l.to).map((l) => {
        const p = keepClear(project(new THREE.Vector3(...l.point), t, w, h), w, SAFE.top, SIDE_MARGIN);
        return <Callout key={l.text} x={l.x} y={l.y} px={p.x} py={p.y} text={l.text} size={26} />;
      })}
      {diagram && shot ? <Diagram spec={diagram} progress={progress(t, shot.from + 0.1, shot.from + barT(1))} fade={fadeWindow(t, shot.from, shot.to, 0.1)} /> : null}
      <Captions t={t} captions={CAPTIONS} region={REGIONS.caption} />
      <Flashes t={t} at={IMPACTS} endFadeFrom={END_FADE_FROM} />
    </AbsoluteFill>
  );
};

// Dev-only composition for eyeballing the visual library in every palette, with the safe zones drawn on top.
// npm run stills is for videos; use: npx remotion still visual-gallery out/visual-gallery.png --frame=50
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { makeCameraRig } from "./camera";
import { Captions } from "./Captions";
import { Diagram } from "./diagrams/Diagram";
import type { DiagramSpec } from "./diagrams/spec";
import { useFonts } from "./fonts";
import { Headline } from "./Headline";
import { FRAME, REGIONS, SAFE } from "./layout";
import { fadeWindow, progress } from "./motion";
import { PaletteContext, PALETTES, usePalette, type Palette } from "./palette";
import { PixelStage } from "./PixelStage";
import { Arrow3D, Ball, Bar, Block, Cone, Floor, Particles, Ring, Tube } from "./shapes";

const SECTION_S = 2;

const MAP_ROWS = [
  "......##########........",
  "....##############......",
  "...################.....",
  "....###########.........",
  ".....#######......++....",
  "......####......++++++..",
  ".......##......++++++++.",
  "...............++++++...",
];

const SECTIONS: { palette: Palette; headline: string; caption: string[]; diagram: DiagramSpec }[] = [
  {
    palette: PALETTES.science,
    headline: "BAR CHART",
    caption: ["BLUE LIGHT SCATTERS", "ABOUT FOUR TIMES MORE"],
    diagram: { type: "bar", title: "SAMPLE VALUES", unit: "UNITS", bars: [{ label: "BLUE", value: 4.4 }, { label: "GREEN", value: 2.1 }, { label: "RED", value: 1 }] },
  },
  {
    palette: PALETTES.finance,
    headline: "LINE CHART",
    caption: ["TWO LINES THAT RISE", "AT DIFFERENT SPEEDS"],
    diagram: { type: "line", title: "SAMPLE GROWTH", xLabel: "YEAR", series: [{ label: "FAST", points: [[2000, 10], [2005, 22], [2010, 48], [2015, 90], [2020, 160]] }, { label: "SLOW", points: [[2000, 10], [2010, 24], [2020, 41]] }] },
  },
  {
    palette: PALETTES.history,
    headline: "TIMELINE",
    caption: ["FIVE MOMENTS,", "IN ORDER"],
    diagram: { type: "timeline", title: "SAMPLE EVENTS", events: [{ when: "1450", label: "FIRST STEP" }, { when: "1600", label: "SECOND STEP" }, { when: "1760", label: "THE BIG CHANGE" }, { when: "1900", label: "FOURTH" }, { when: "2000", label: "TODAY" }] },
  },
  {
    palette: PALETTES.health,
    headline: "FLOW",
    caption: ["ONE STEP LEADS", "TO THE NEXT"],
    diagram: { type: "flow", title: "SAMPLE PROCESS", steps: ["SIGNAL ARRIVES", "CELL RESPONDS", "MEMORY FORMS", "FASTER NEXT TIME"] },
  },
  {
    palette: PALETTES.nature,
    headline: "COMPARISON",
    caption: ["TWO THINGS,", "SIDE BY SIDE"],
    diagram: { type: "comparison", title: "SAMPLE COMPARISON", left: "FOREST", right: "DESERT", rows: [{ label: "RAIN", left: "HIGH", right: "VERY LOW" }, { label: "SHADE", left: "PLENTY", right: "ALMOST NONE" }, { label: "NIGHTS", left: "MILD", right: "COLD" }] },
  },
  {
    palette: PALETTES.space,
    headline: "TILE MAP",
    caption: ["A JOURNEY", "ACROSS THE TILES"],
    diagram: { type: "map", title: "SAMPLE MAP", rows: MAP_ROWS, markers: [{ col: 7, row: 2, label: "START" }, { col: 19, row: 6, label: "END" }], route: [[7, 2], [12, 3], [15, 5], [19, 6]] },
  },
];

export const VISUAL_GALLERY_FRAMES = SECTIONS.length * SECTION_S * 30;

const cameraAt = makeCameraRig([
  { t: 0, pos: [15, 11, 20], target: [0, 5, 0], fov: 40 },
  { t: VISUAL_GALLERY_FRAMES / 30, pos: [20, 11, 13], target: [0, 5, 0], fov: 40 },
]);

const Shapes: React.FC<{ t: number }> = ({ t }) => {
  const { series, accent } = usePalette();
  return (
    <>
      <Floor />
      <Block position={[-6, 1.5, 0]} size={[3, 3, 3]} color={series[0]} />
      <Ball position={[0, 2, 0]} radius={2} color={series[1]} />
      <Cone position={[6, 2, 0]} radius={1.8} height={4} color={series[2]} />
      <Ring position={[0, 8.5, -2]} radius={2.4} tube={0.45} color={series[3]} />
      <Bar from={[-7, 5, -2]} to={[-3, 9, -2]} radius={0.3} color={accent} />
      <Arrow3D from={[3, 6, -2]} to={[7.5, 9.5, -2]} radius={0.28} color={accent} glow={0.4} />
      <Tube points={[[-9, 0.6, 4], [-4, 1.6, 7], [2, 0.8, 6], [8, 1.8, 8]]} radius={0.35} color={series[4 % series.length]} />
      <Particles t={t} count={70} seed={7} origin={[-10, 0.5, -6]} box={[20, 13, 12]} velocity={[0.9, 0.4, 0]} size={0.24} colors={series} glow={0.5} />
    </>
  );
};

const Guides: React.FC = () => {
  const { alert } = usePalette();
  const line = `2px dashed ${alert}`;
  return (
    <>
      <div style={{ position: "absolute", left: SAFE.left, top: SAFE.top, width: SAFE.right - SAFE.left, height: SAFE.buttonsFrom - SAFE.top, boxSizing: "border-box", border: line, borderBottom: "none" }} />
      <div style={{ position: "absolute", left: SAFE.left, top: SAFE.buttonsFrom, width: SAFE.rightBesideButtons - SAFE.left, height: SAFE.bottom - SAFE.buttonsFrom, boxSizing: "border-box", border: line, borderTop: "none" }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: FRAME.w, height: SAFE.top, background: "rgba(0,0,0,0.25)" }} />
      <div style={{ position: "absolute", left: 0, top: SAFE.bottom, width: FRAME.w, height: FRAME.h - SAFE.bottom, background: "rgba(0,0,0,0.25)" }} />
    </>
  );
};

export const VisualGallery: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  useFonts();
  const index = Math.min(SECTIONS.length - 1, Math.floor(t / SECTION_S));
  const section = SECTIONS[index];
  const from = index * SECTION_S;
  const to = from + SECTION_S;
  return (
    <PaletteContext.Provider value={section.palette}>
      <AbsoluteFill style={{ background: section.palette.background }}>
        <PixelStage t={t} cameraAt={cameraAt} pixelSize={3}>
          <Shapes t={t} />
        </PixelStage>
        <Headline t={t} at={from} text={section.headline} />
        <Diagram spec={section.diagram} progress={progress(t, from + 0.1, to - 0.5)} fade={fadeWindow(t, from, to, 0.08)} />
        <Captions t={t} region={REGIONS.caption} captions={[{ from, to, lines: section.caption, size: "compact" }]} />
        <Guides />
      </AbsoluteFill>
    </PaletteContext.Provider>
  );
};

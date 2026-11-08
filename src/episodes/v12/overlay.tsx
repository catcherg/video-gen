import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { keepClear, makeProjector } from "../../core/camera";
import { Captions } from "../../core/Captions";
import { strokeName } from "../../core/engine/fourStroke";
import { Flashes } from "../../core/Flashes";
import { useFonts } from "../../core/fonts";
import { EngineHud, HUD_BOTTOM, type EngineHudConfig } from "../../core/hud";
import { Tag } from "../../core/Tag";
import { UI } from "../../core/theme";
import { CAMS_LABEL_D, crownWorld, cylPoint, engineOrigin } from "./geometry";
import { CYLINDERS, cycleAt, DROP, engine, isSlowed, REAL_SPEED_START, REDLINE, SLOW, SLOW_START, TACH_MAX, TACH_RED_FROM } from "./physics";
import { beatInBar } from "./song";
import { cameraAt, CAPTIONS, END_FADE_FROM, HUD_IN, SHOW_BANK_LABELS, SHOW_CRANK_TAG, SHOW_CYL_NUMBERS, SHOW_STROKE_TAG } from "./timeline";

const project = makeProjector(cameraAt);

// Half of a cylinder-number tag's height and width, plus a small gap.
const CYL_TAG_CLEARANCE = 30;
const CYL_TAG_MARGIN = 46;

const HUD_CONFIG: EngineHudConfig = {
  engine,
  isSlowed,
  slow: SLOW,
  hudIn: HUD_IN,
  realSpeedStart: REAL_SPEED_START,
  redline: REDLINE,
  tachMax: TACH_MAX,
  tachRedFrom: TACH_RED_FROM,
  beatAt: beatInBar,
};

const Labels: React.FC<{ t: number; w: number; h: number }> = ({ t, w, h }) => {
  const out: React.ReactNode[] = [];
  const slowed = isSlowed(t);
  if (SHOW_CYL_NUMBERS(t)) {
    for (let cyl = 1; cyl <= CYLINDERS; cyl++) {
      const projected = project(cylPoint(cyl, CAMS_LABEL_D, t), t, w, h);
      if (!projected.visible) continue;
      const p = keepClear(projected, w, HUD_BOTTOM + CYL_TAG_CLEARANCE, CYL_TAG_MARGIN);
      const hot = slowed ? cycleAt(cyl, t) < 110 : false;
      out.push(<Tag key={`c${cyl}`} x={p.x} y={p.y} text={`${cyl}`} hot={hot} size={24} />);
    }
  }
  if (SHOW_BANK_LABELS(t)) {
    // anchored just outside each bank's exhaust headers, kept on screen
    const r = project(engineOrigin(t).add(new THREE.Vector3(-1.5, -0.5, -3.4)), t, w, h);
    const l = project(engineOrigin(t).add(new THREE.Vector3(-1.5, -0.5, 3.4)), t, w, h);
    const clampX = (x: number) => Math.min(w - 170, Math.max(170, x));
    out.push(<Tag key="rb" x={clampX(r.x)} y={r.y} text="RIGHT BANK" size={30} />);
    out.push(<Tag key="lb" x={clampX(l.x)} y={l.y} text="LEFT BANK" size={30} />);
  }
  if (SHOW_STROKE_TAG(t)) {
    const c = cycleAt(1, t);
    const p = project(crownWorld(1, t), t, w, h);
    const name = strokeName(c);
    out.push(<div key="lead" style={{ position: "absolute", left: p.x, top: p.y - 3, width: 150, height: 6, background: UI.cream }} />);
    out.push(<Tag key="st" x={p.x + 150 + 120} y={p.y} text={`CYL 1: ${name}`} hot={name === "BANG"} size={32} />);
  }
  if (SHOW_CRANK_TAG(t)) {
    const p = project(engineOrigin(t).add(new THREE.Vector3(-0.8, 0, 0)), t, w, h);
    out.push(<div key="ckl" style={{ position: "absolute", left: p.x - 3, top: p.y, width: 6, height: 170, background: UI.cream }} />);
    out.push(<Tag key="ck" x={p.x} y={p.y + 190} text="CRANKSHAFT" size={30} />);
  }
  return <>{out}</>;
};

export const Overlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  useFonts();
  return (
    <AbsoluteFill>
      <Labels t={t} w={width} h={height} />
      <EngineHud t={t} config={HUD_CONFIG} />
      <Captions t={t} captions={CAPTIONS} />
      <Flashes t={t} at={[SLOW_START, REAL_SPEED_START, DROP]} endFadeFrom={END_FADE_FROM} />
    </AbsoluteFill>
  );
};

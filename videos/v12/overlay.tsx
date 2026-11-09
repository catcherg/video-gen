import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Callout } from "../../src/core/Callout";
import { keepClear, makeProjector } from "../../src/core/camera";
import { Captions } from "../../src/core/Captions";
import { CrankEndView, CylinderSchematic, DiagramPanel, FiringMap, PulseTrain, StrokeReadout, StrokeWheel, ValveTimingStrip } from "../../src/kits/engine/diagrams";
import { strokeName } from "../../src/kits/engine/fourStroke";
import { Flashes } from "../../src/core/Flashes";
import { useFonts } from "../../src/core/fonts";
import { EngineHud, HUD_BOTTOM, type EngineHudConfig } from "../../src/kits/engine/hud";
import { D2R, fmtInt } from "../../src/core/math";
import { Tag } from "../../src/core/Tag";
import { C, FONT, STROKE_COLORS, UI } from "../../src/kits/engine/theme";
import { valveBump } from "../../src/kits/engine/parts/ValveTrain";
import { bankAngle, CAM_DIST, CAMS_LABEL_D, CRANK_R, crownWorld, cylLocal, cylPoint, cylX, DECK, engineOrigin, PIN_TO_CROWN, PISTON_R, wristDist } from "./geometry";
import {
  BANGS,
  bangsPerSecond,
  BANK_ANGLE_DEG,
  barT,
  beatT,
  CRANK_PINS,
  crankAt,
  CYLINDERS,
  cycleAt,
  DROP,
  engine,
  EXHAUST_VALVE,
  FIRING_ORDER,
  firstBangAfter,
  INTAKE_VALVE,
  isRightBank,
  isSlowed,
  REAL_SPEED_START,
  REDLINE,
  rpmAt,
  SLOW,
  SLOW_START,
  TACH_MAX,
  TACH_RED_FROM,
} from "./physics";
import { beatInBar } from "./song";
import { cameraAt, CAPTIONS, END_FADE_FROM, HUD_IN, panelAt, SHOW_BANK_LABELS, SHOW_CRANK_TAG, SHOW_CYL_NUMBERS, SHOW_STROKE_TAG } from "./timeline";

const project = makeProjector(cameraAt);

// Half of a cylinder-number tag's height and width, plus a small gap.
const CYL_TAG_CLEARANCE = 30;
const CYL_TAG_MARGIN = 46;
const VALVE_LIFT_UNITS = 0.22;

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

const STROKE_TEXT: Record<string, string> = {
  BANG: "BURNING FUEL SHOVES THE PISTON DOWN",
  EXHAUST: "THE PISTON PUSHES SPENT GAS OUT",
  INTAKE: "THE PISTON DRAWS IN AIR AND FUEL",
  SQUEEZE: "THE PISTON COMPRESSES THE MIXTURE",
};

const RIGHT_BANK = [...FIRING_ORDER].filter(isRightBank).sort((a, b) => a - b);
const LEFT_BANK = [...FIRING_ORDER].filter((c) => !isRightBank(c)).sort((a, b) => a - b);

/** Distinct crank-pin directions, in degrees from the first. */
const pinAngleSet = () => {
  const angles = CRANK_PINS.map(([right]) => (((-engine.fireOffset[right] % 360) + 360) % 360));
  return [...new Set(angles)].sort((a, b) => a - b);
};
const PIN_ANGLES = pinAngleSet();

const activeSlot = (t: number) => {
  const i = firstBangAfter(t + 1e-6) - 1;
  if (i < 0) return 0;
  return FIRING_ORDER.indexOf(BANGS[i].cyl);
};

const Panel: React.FC<{ t: number }> = ({ t }) => {
  const panel = panelAt(t);
  if (!panel) return null;
  const { kind, fade } = panel;
  if (kind === "stroke") {
    const c = cycleAt(1, t);
    const cm = c % 360;
    const w = wristDist(cm);
    const stroke = strokeName(c);
    return (
      <DiagramPanel title="INSIDE CYLINDER 1" fade={fade}>
        <CylinderSchematic
          stroke={stroke}
          crown={w + PIN_TO_CROWN}
          wrist={w}
          pin={[CRANK_R * Math.cos(cm * D2R), CRANK_R * Math.sin(cm * D2R)]}
          deck={DECK}
          boreR={PISTON_R}
          crankR={CRANK_R}
          inLift={valveBump(c, INTAKE_VALVE.open, INTAKE_VALVE.close) * VALVE_LIFT_UNITS}
          exLift={valveBump(c, EXHAUST_VALVE.open, EXHAUST_VALVE.close) * VALVE_LIFT_UNITS}
          sparking={c < 18}
        />
        <StrokeWheel c={c} />
        <StrokeReadout cylinder={1} stroke={stroke} text={STROKE_TEXT[stroke]} />
      </DiagramPanel>
    );
  }
  if (kind === "crank") {
    const slot = activeSlot(t);
    const cyl = FIRING_ORDER[slot];
    const right = isRightBank(cyl) ? cyl : cyl - 6;
    const hotAngle = (((-engine.fireOffset[right] % 360) + 360) % 360);
    return (
      <DiagramPanel title="CRANKSHAFT, END ON" fade={fade}>
        {/* Pin angles are measured from the right bank's bore, which leans -30° from vertical. */}
        <CrankEndView arms={PIN_ANGLES} bankHalfDeg={BANK_ANGLE_DEG / 2} spinDeg={(crankAt(t) % 360) - BANK_ANGLE_DEG / 2} hotArm={PIN_ANGLES.indexOf(hotAngle)} />
        <div style={{ flex: 1, fontFamily: FONT.display, fontSize: 40, lineHeight: 1.1 }}>
          <div style={{ color: C.crankGold }}>{`${CRANK_PINS.length} PINS AT ${360 / PIN_ANGLES.length}° SPACING`}</div>
          <div>EACH PIN CARRIES ONE ROD</div>
          <div>
            FROM <span style={{ color: C.rodRight }}>EACH</span> <span style={{ color: C.rodLeft }}>BANK</span>
          </div>
          <div style={{ fontFamily: FONT.label, fontSize: 22, color: UI.dim, marginTop: 10 }}>WHITE = THE PIN FIRING NOW</div>
        </div>
      </DiagramPanel>
    );
  }
  if (kind === "valves") {
    return (
      <DiagramPanel title="VALVE TIMING, CYLINDER 1 (SCHEMATIC)" fade={fade}>
        <ValveTimingStrip c={cycleAt(1, t)} intake={[INTAKE_VALVE.open, INTAKE_VALVE.close]} exhaust={[EXHAUST_VALVE.open, EXHAUST_VALVE.close]} />
      </DiagramPanel>
    );
  }
  if (kind === "firing") {
    return (
      <DiagramPanel title="FIRING ORDER" fade={fade}>
        <FiringMap rightBank={RIGHT_BANK} leftBank={LEFT_BANK} order={FIRING_ORDER} activeIndex={activeSlot(t)} note={`EVERY ${720 / CYLINDERS}°`} />
      </DiagramPanel>
    );
  }
  const hz = bangsPerSecond(rpmAt(t));
  return (
    <DiagramPanel title="12 MILLISECONDS OF EXHAUST" fade={fade}>
      <PulseTrain hz={hz} windowMs={12} />
      <div style={{ flex: 1, fontFamily: FONT.display, textAlign: "right" }}>
        <div style={{ fontSize: 64, color: UI.yellow, lineHeight: 1 }}>{(1000 / hz).toFixed(1)} MS</div>
        <div style={{ fontSize: 34, lineHeight: 1.05, marginTop: 6 }}>BETWEEN BANGS</div>
      </div>
    </DiagramPanel>
  );
};

type CalloutDef = { from: number; to: number; x: number; y: number; text: string; color?: string; point: (t: number) => THREE.Vector3 };

const LEFT_X = 158;
const RIGHT_X = 922;

const beatWindow = (start: number, end: number) => ({ from: beatT(start), to: beatT(end) });

const CALLOUTS: CalloutDef[] = [
  // The strokes shot, built up one part per beat.
  // Labels run top to bottom in the same order as their parts, so leader lines don't cross.
  { ...beatWindow(19, 26.5), x: LEFT_X, y: 560, text: "CAMSHAFT", color: C.camLobe, point: (t) => cylLocal(1, -0.2, CAM_DIST, -0.24, t) },
  { ...beatWindow(20, 26.5), x: LEFT_X, y: 700, text: "SPARK PLUG", point: (t) => cylLocal(1, 0, DECK + 0.45, 0, t) },
  { ...beatWindow(21, 26.5), x: LEFT_X, y: 840, text: "EXHAUST VALVE", color: C.exhaust, point: (t) => cylLocal(1, -0.2, DECK + 0.3, -0.24, t) },
  { ...beatWindow(22, 26.5), x: LEFT_X, y: 980, text: "PISTON", point: (t) => cylLocal(1, 0, wristDist(cycleAt(1, t) % 360) + 0.1, -PISTON_R, t) },
  { ...beatWindow(23, 26.5), x: LEFT_X, y: 1120, text: "CON ROD", color: C.rodRight, point: (t) => cylLocal(1, 0, wristDist(cycleAt(1, t) % 360) * 0.55, 0, t) },
  { ...beatWindow(19.5, 26.5), x: 540, y: 528, text: "INTAKE VALVE", color: C.intake, point: (t) => cylLocal(1, 0.2, DECK + 0.3, 0.24, t) },
  // The crank shot. +x is screen-left here, so the flywheel end is on the left.
  { ...beatWindow(29, 39), x: LEFT_X, y: 560, text: "FLYWHEEL", point: (t) => engineOrigin(t).add(new THREE.Vector3(3.86, 0.5, 0)) },
  { ...beatWindow(30, 39), x: RIGHT_X, y: 560, text: "PISTON", point: (t) => cylLocal(2, 0, wristDist(cycleAt(2, t) % 360) + 0.2, -PISTON_R, t) },
  { ...beatWindow(31, 39), x: LEFT_X, y: 1200, text: "COUNTERWEIGHT", point: (t) => engineOrigin(t).add(new THREE.Vector3(pinX(4) + 0.36, -0.55, 0)) },
  { ...beatWindow(32, 39), x: RIGHT_X, y: 1220, text: "MAIN BEARING", color: C.bearing, point: (t) => engineOrigin(t).add(new THREE.Vector3(-2.24, -0.3, 0)) },
  // The cam shot.
  { ...beatWindow(41, 47.5), x: LEFT_X, y: 1200, text: "INTAKE CAM", color: C.intake, point: (t) => cylLocal(11, 0, CAM_DIST, -0.24, t) },
  { ...beatWindow(42, 47.5), x: RIGHT_X, y: 1200, text: "EXHAUST CAM", color: C.exhaust, point: (t) => cylLocal(5, 0, CAM_DIST, -0.24, t) },
  { ...beatWindow(43, 47.5), x: RIGHT_X, y: 560, text: "TIMING CHAIN", point: (t) => cylLocal(1, -0.68, CAM_DIST + 0.28, 0, t) },
];

function pinX(row: number) {
  const [right, left] = CRANK_PINS[row];
  return (cylX(right) + cylX(left)) / 2;
}

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
    out.push(<Callout key="st" x={RIGHT_X - 30} y={840} px={p.x} py={p.y} text={`CYL 1: ${name}`} color={STROKE_COLORS[name]} hot={name === "BANG"} size={30} />);
  }
  if (SHOW_CRANK_TAG(t)) {
    const p = project(engineOrigin(t).add(new THREE.Vector3(-1.2, 0, 0)), t, w, h);
    out.push(<Callout key="ck" x={630} y={1130} px={p.x} py={p.y} text="CRANKSHAFT" color={C.crankGold} size={30} />);
  }
  for (const def of CALLOUTS) {
    if (t < def.from || t >= def.to) continue;
    const p = project(def.point(t), t, w, h);
    out.push(<Callout key={`${def.text}${def.from}`} x={def.x} y={def.y} px={p.x} py={p.y} text={def.text} color={def.color} />);
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
      <Panel t={t} />
      <Flashes t={t} at={[SLOW_START, REAL_SPEED_START, DROP]} endFadeFrom={END_FADE_FROM} />
    </AbsoluteFill>
  );
};

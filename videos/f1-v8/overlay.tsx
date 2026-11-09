import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Callout } from "../../src/core/Callout";
import { keepClear, makeProjector } from "../../src/core/camera";
import { Captions } from "../../src/core/Captions";
import { AirSpringSection, CrankEndView, CylinderSchematic, DiagramPanel, FiringMap, PulseTrain, StrokeReadout, StrokeWheel, ValveTimingStrip } from "../../src/kits/engine/diagrams";
import { strokeName } from "../../src/kits/engine/fourStroke";
import { Flashes } from "../../src/core/Flashes";
import { useFonts } from "../../src/core/fonts";
import { EngineHud, HUD_BOTTOM, MiniHud, type EngineHudConfig } from "../../src/kits/engine/hud";
import { D2R } from "../../src/core/math";
import { Tag } from "../../src/core/Tag";
import { C, FONT, STROKE_COLORS, UI } from "../../src/kits/engine/theme";
import { valveBump } from "../../src/kits/engine/parts/ValveTrain";
import { AIR_RAIL_Y, AIR_RAIL_Z, CASTING, CAM_DIST, CAM_U, CRANK_R, crownWorld, cylLocal, cylPoint, cylX, DECK, engineOrigin, GEAR_X, INTAKE_LIFT, EXHAUST_LIFT, PIN_TO_CROWN, PISTON_R, HERO_Z, heroS, VALVE_DX, VALVE_STACK, VALVE_TILT, VALVE_Z, valvePoint, wristDist } from "./geometry";
import {
  AIR_BOTTLE_CC,
  BANGS,
  bangsPerSecond,
  BORE_MM,
  BANK_ANGLE_DEG,
  barT,
  beatT,
  CRANK_HEIGHT_MM,
  CRANK_PINS,
  crankAt,
  CYLINDERS,
  cycleAt,
  DROP,
  engine,
  EXHAUST_VALVE,
  FIRING_ORDER,
  firstBangAfter,
  INTAKE_LIFT_MM,
  INTAKE_VALVE,
  INTAKE_VALVE_MM,
  isBankA,
  isSlowed,
  REAL_SPEED_START,
  REDLINE,
  rpmAt,
  SLOW,
  SLOW_START,
  STROKE_MM,
  TACH_MAX,
  TACH_RED_FROM,
} from "./physics";
import { FIRST_HIT, kickPulse, STABS } from "./beatmap";
import { beatInBar } from "./song";
import { cameraAt, CAPTIONS, COMPACT_HUD, END_FADE_FROM, HOOK_END, HOOK_LINES, HUD_IN, panelAt, SHOW_BANK_LABELS, SHOW_CRANK_TAG, SHOW_CYL_NUMBERS, SHOW_STROKE_TAG } from "./timeline";

const project = makeProjector(cameraAt);
const CYL_TAG_CLEARANCE = 30;
const CYL_TAG_MARGIN = 46;
const PIANO_TOP_MIDI = 89;

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
  pianoHi: PIANO_TOP_MIDI,
};

const STROKE_TEXT: Record<string, string> = {
  BANG: "BURNING FUEL SHOVES THE PISTON DOWN",
  EXHAUST: "THE PISTON PUSHES SPENT GAS OUT",
  INTAKE: "THE PISTON DRAWS IN AIR AND FUEL",
  SQUEEZE: "THE PISTON SQUEEZES IT 13 TO 1",
};

const BANK_A = FIRING_ORDER.filter(isBankA).sort((a, b) => a - b);
const BANK_B = FIRING_ORDER.filter((c) => !isBankA(c)).sort((a, b) => a - b);

const pinAngleSet = () => {
  const angles = CRANK_PINS.map(([a]) => ((-engine.fireOffset[a] % 360) + 360) % 360);
  return [...new Set(angles)].sort((x, y) => x - y);
};
const PIN_ANGLES = pinAngleSet();

const activeSlot = (t: number) => {
  const i = firstBangAfter(t + 1e-6) - 1;
  if (i < 0) return 0;
  return FIRING_ORDER.indexOf(BANGS[i].cyl);
};

const PULSE_WINDOW_MS = 8;

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
          inLift={valveBump(c, INTAKE_VALVE.open, INTAKE_VALVE.close) * INTAKE_LIFT}
          exLift={valveBump(c, EXHAUST_VALVE.open, EXHAUST_VALVE.close) * EXHAUST_LIFT}
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
    const a = isBankA(cyl) ? cyl : cyl - 4;
    const hotAngle = ((-engine.fireOffset[a] % 360) + 360) % 360;
    return (
      <DiagramPanel title="CRANKSHAFT, END ON" fade={fade}>
        <CrankEndView arms={PIN_ANGLES} bankHalfDeg={BANK_ANGLE_DEG / 2} spinDeg={(crankAt(t) % 360) - BANK_ANGLE_DEG / 2} hotArm={PIN_ANGLES.indexOf(hotAngle)} />
        <div style={{ flex: 1, fontFamily: FONT.display, fontSize: 40, lineHeight: 1.1 }}>
          <div style={{ color: C.crankGold }}>{`${CRANK_PINS.length} PINS, ${360 / PIN_ANGLES.length}° APART`}</div>
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
      <DiagramPanel title="VALVE TIMING, CYLINDER 1" fade={fade}>
        <ValveTimingStrip c={cycleAt(1, t)} intake={[INTAKE_VALVE.open, INTAKE_VALVE.close]} exhaust={[EXHAUST_VALVE.open, EXHAUST_VALVE.close]} />
      </DiagramPanel>
    );
  }
  if (kind === "air") {
    const lift01 = valveBump(cycleAt(1, t), INTAKE_VALVE.open, INTAKE_VALVE.close);
    return (
      <DiagramPanel title="AIR SPRING, INTAKE VALVE" fade={fade}>
        <AirSpringSection lift01={lift01} liftUnits={INTAKE_LIFT} color={C.intake} />
        <div style={{ flex: 1, fontFamily: FONT.display, lineHeight: 1.05 }}>
          <div style={{ fontSize: 58, color: C.air }}>{(lift01 * INTAKE_LIFT_MM).toFixed(1)} MM LIFT</div>
          <div style={{ fontSize: 38, marginTop: 6 }}>THE VALVE PUSHES DOWN.</div>
          <div style={{ fontSize: 38 }}>THE TRAPPED AIR PUSHES BACK.</div>
          <div style={{ fontFamily: FONT.label, fontSize: 21, color: UI.dim, marginTop: 10 }}>FED BY A {AIR_BOTTLE_CC} CM³ AIR BOTTLE</div>
        </div>
      </DiagramPanel>
    );
  }
  if (kind === "firing") {
    return (
      <DiagramPanel title="FIRING ORDER (TYPICAL FLAT-PLANE V8)" fade={fade}>
        <FiringMap rightBank={BANK_A} leftBank={BANK_B} order={FIRING_ORDER} activeIndex={activeSlot(t)} note={`EVERY ${720 / CYLINDERS}°`} />
      </DiagramPanel>
    );
  }
  const hz = bangsPerSecond(rpmAt(t));
  return (
    <DiagramPanel title={`${PULSE_WINDOW_MS} MILLISECONDS OF EXHAUST`} fade={fade}>
      <PulseTrain hz={hz} windowMs={PULSE_WINDOW_MS} />
      <div style={{ flex: 1, fontFamily: FONT.display, textAlign: "right" }}>
        <div style={{ fontSize: 64, color: UI.yellow, lineHeight: 1 }}>{(1000 / hz).toFixed(2)} MS</div>
        <div style={{ fontSize: 34, lineHeight: 1.05, marginTop: 6 }}>BETWEEN BANGS</div>
      </div>
    </DiagramPanel>
  );
};

type CalloutDef = { from: number; to: number; x: number; y: number; text: string; color?: string; point: (t: number) => THREE.Vector3 };

const PING_S = 0.32;
const LEFT_X = 170;
const RIGHT_X = 910;
const beatWindow = (start: number, end: number) => ({ from: beatT(start), to: beatT(end) });

// Bank A's inner side (+z local) is the intake side. Front valve of the pair: dxSign -1.
/** A point on the car, in the car's own frame, wherever it has got to on the track. */
const onCar = (x: number, y: number, z: number) => (t: number) => new THREE.Vector3(x - heroS(t), y, HERO_Z + z);

/** Partway along the front intake finger, from the valve toward its pivot. */
const fingerPoint = (t: number) => {
  const u = VALVE_STACK.padTop - 0.04;
  const w = 0.26;
  const tilt = VALVE_TILT;
  return cylLocal(1, -VALVE_DX, DECK + u * Math.cos(tilt) - w * Math.sin(tilt), VALVE_Z + u * Math.sin(tilt) + w * Math.cos(tilt), t);
};

const CALLOUTS: CalloutDef[] = [
  // The strokes shot, built up one part per beat, top to bottom.
  { ...beatWindow(16.5, 23.8), x: RIGHT_X, y: 380, text: "CAM", color: C.camLobe, point: (t) => valvePoint(1, -1, 1, CAM_U - 0.12, t) },
  { ...beatWindow(17, 23.8), x: RIGHT_X, y: 560, text: "INTAKE VALVE", color: C.intake, point: (t) => valvePoint(1, -1, 1, 0.3, t) },
  { ...beatWindow(18, 23.8), x: RIGHT_X, y: 930, text: "PISTON", point: (t) => cylLocal(1, 0, wristDist(cycleAt(1, t) % 360) + 0.1, PISTON_R, t) },
  { ...beatWindow(19, 23.8), x: RIGHT_X, y: 1180, text: "CON ROD", color: C.rodRight, point: (t) => cylLocal(1, 0, wristDist(cycleAt(1, t) % 360) * 0.55, 0, t) },
  { ...beatWindow(19.5, 23.8), x: LEFT_X, y: 660, text: "EXHAUST VALVE", color: C.exhaust, point: (t) => valvePoint(1, -1, -1, 0.3, t) },
  { ...beatWindow(20, 23.8), x: LEFT_X, y: 480, text: "SPARK PLUG", point: (t) => cylLocal(1, 0, DECK + 0.26, 0, t) },
  { ...beatWindow(21, 23.8), x: LEFT_X, y: 1235, text: "OIL JET", color: C.warm, point: (t) => cylLocal(1, -0.3, 0.62, -0.3, t) },
  { ...beatWindow(22, 23.8), x: RIGHT_X, y: 780, text: "WATER JACKET", color: "#2f86ea", point: (t) => cylLocal(1, CASTING.faceX, 1.05, CASTING.boreR + 0.17, t) },
  // The crank shot. +x is screen-left here.
  { ...beatWindow(25, 31.5), x: RIGHT_X, y: 420, text: "PISTON", point: (t) => cylLocal(3, 0, wristDist(cycleAt(3, t) % 360) + 0.1, -PISTON_R, t) },
  { ...beatWindow(26, 31.5), x: LEFT_X, y: 1180, text: "COUNTERWEIGHT", point: (t) => engineOrigin(t).add(new THREE.Vector3(cylX(4) + 0.33, -0.42, 0)) },
  { ...beatWindow(28, 31.5), x: LEFT_X, y: 420, text: "OIL SPRAY", color: C.warm, point: (t) => engineOrigin(t).add(new THREE.Vector3(cylX(4) - 0.2, 0.55, -0.2)) },
  // The gear shot: the whole train, then one bank.
  { ...beatWindow(32.5, 35.8), x: LEFT_X, y: 400, text: "CAM GEAR", color: C.camLobe, point: (t) => cylLocal(1, GEAR_X - cylX(1), CAM_DIST, 0.44, t) },
  { ...beatWindow(33, 35.8), x: RIGHT_X, y: 800, text: "IDLER GEARS", color: C.gear, point: (t) => cylLocal(1, GEAR_X - cylX(1), 1.2, 0, t) },
  { ...beatWindow(33.5, 35.8), x: 540, y: 1220, text: "CRANK GEAR", color: C.crankGold, point: (t) => engineOrigin(t).add(new THREE.Vector3(GEAR_X, -0.16, 0)) },
  // The head section.
  { ...beatWindow(36.5, 39.8), x: RIGHT_X, y: 380, text: "CAM LOBE", color: C.camLobe, point: (t) => valvePoint(1, -1, 1, CAM_U - 0.14, t) },
  { ...beatWindow(37, 39.8), x: RIGHT_X, y: 620, text: "FINGER FOLLOWER", color: C.finger, point: (t) => fingerPoint(t) },
  { ...beatWindow(37.5, 39.8), x: LEFT_X, y: 1120, text: "VALVE", color: C.exhaust, point: (t) => valvePoint(1, -1, -1, 0.4, t) },
  { ...beatWindow(38, 39.8), x: RIGHT_X, y: 840, text: "AIR LINE", color: C.air, point: (t) => cylLocal(1, -VALVE_DX, AIR_RAIL_Y, AIR_RAIL_Z, t) },
  // The air spring. Labels hold through both bars, top to bottom.
  { ...beatWindow(40.5, 47.8), x: RIGHT_X, y: 380, text: "AIR LINE", color: C.air, point: (t) => cylLocal(1, -VALVE_DX, AIR_RAIL_Y, AIR_RAIL_Z, t) },
  { ...beatWindow(41, 47.8), x: RIGHT_X, y: 620, text: "PISTON", point: (t) => valvePoint(1, -1, 1, VALVE_STACK.pistonTop - valveBump(cycleAt(1, t), INTAKE_VALVE.open, INTAKE_VALVE.close) * INTAKE_LIFT, t) },
  { ...beatWindow(42, 47.8), x: RIGHT_X, y: 880, text: "COMPRESSED AIR", color: C.air, point: (t) => valvePoint(1, -1, 1, VALVE_STACK.chamberFloor + 0.1, t) },
  { ...beatWindow(43, 47.8), x: RIGHT_X, y: 1130, text: "PTFE SEAL", point: (t) => valvePoint(1, -1, 1, VALVE_STACK.chamberFloor + 0.02, t) },
  // The car, a part per beat on each shot of the race.
  { ...beatWindow(60, 62), x: LEFT_X, y: 620, text: "REAR WING", color: C.red, point: onCar(20.3, 9.7, 3) },
  { ...beatWindow(60.5, 62), x: RIGHT_X, y: 1140, text: "DIFFUSER", point: onCar(19.8, 1.6, -3) },
  { ...beatWindow(62, 64), x: LEFT_X, y: 1180, text: "FRONT WING", color: C.red, point: onCar(-26.5, 1.4, 6) },
  { ...beatWindow(62.5, 64), x: RIGHT_X, y: 620, text: "GROOVED TYRE", point: onCar(-15.5, 6.7, 8.5) },
  { ...beatWindow(64, 66), x: RIGHT_X, y: 640, text: "AIRBOX", point: onCar(0.5, 10, 0) },
  { ...beatWindow(64.5, 66), x: LEFT_X, y: 1180, text: "SIDEPOD", color: C.red, point: onCar(5, 5.3, -5.1) },
];

const Labels: React.FC<{ t: number; w: number; h: number }> = ({ t, w, h }) => {
  const out: React.ReactNode[] = [];
  const slowed = isSlowed(t);
  if (SHOW_CYL_NUMBERS(t)) {
    for (let cyl = 1; cyl <= CYLINDERS; cyl++) {
      const projected = project(cylPoint(cyl, CAM_DIST + 1.05, t), t, w, h);
      if (!projected.visible) continue;
      const p = keepClear(projected, w, HUD_BOTTOM + CYL_TAG_CLEARANCE, CYL_TAG_MARGIN);
      out.push(<Tag key={`c${cyl}`} x={p.x} y={p.y} text={`${cyl}`} hot={slowed && cycleAt(cyl, t) < 110} size={24} />);
    }
  }
  if (SHOW_BANK_LABELS(t)) {
    // Right bank (cylinders 1-4) is on screen-right in this shot, left bank (5-8) on screen-left.
    const a = project(cylPoint(4, CAM_DIST, t), t, w, h);
    const b = project(cylPoint(6, CAM_DIST, t), t, w, h);
    out.push(<Callout key="ba" x={RIGHT_X - 30} y={1150} px={a.x} py={a.y} text="RIGHT BANK" color={C.rodRight} size={26} />);
    out.push(<Callout key="bb" x={LEFT_X + 10} y={640} px={b.x} py={b.y} text="LEFT BANK" color={C.rodLeft} size={26} />);
  }
  if (SHOW_STROKE_TAG(t)) {
    const c = cycleAt(1, t);
    const p = project(crownWorld(1, t), t, w, h);
    const name = strokeName(c);
    out.push(<Callout key="st" x={LEFT_X + 20} y={880} px={p.x} py={p.y} text={name} color={STROKE_COLORS[name]} hot={name === "BANG"} size={30} />);
  }
  if (SHOW_CRANK_TAG(t)) {
    const p = project(engineOrigin(t).add(new THREE.Vector3(-0.53, 0, 0)), t, w, h);
    out.push(<Callout key="ck" x={720} y={1210} px={p.x} py={p.y} text="FLAT-PLANE CRANK" color={C.crankGold} size={28} />);
  }
  for (const def of CALLOUTS) {
    if (t < def.from || t >= def.to) continue;
    const p = project(def.point(t), t, w, h);
    out.push(<Callout key={`${def.text}${def.from}`} x={def.x} y={def.y} px={p.x} py={p.y} text={def.text} color={def.color} />);
    // A ring pings out from the part as its label lands, so the eye goes to it.
    const age = t - def.from;
    if (age < PING_S) {
      const u = age / PING_S;
      out.push(
        <svg key={`ping${def.text}${def.from}`} width={w} height={h} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
          <circle cx={p.x} cy={p.y} r={10 + 70 * u} fill="none" stroke={def.color ?? UI.cream} strokeWidth={6 * (1 - u) + 1} opacity={1 - u} />
        </svg>,
      );
    }
  }
  for (const d of DIMENSIONS) {
    if (t < d.from || t >= d.to) continue;
    out.push(<Dimension key={d.text} a={project(d.a(t), t, w, h)} b={project(d.b(t), t, w, h)} text={d.text} color={d.color ?? UI.yellow} />);
  }
  return <>{out}</>;
};

type DimensionDef = { from: number; to: number; text: string; a: (t: number) => THREE.Vector3; b: (t: number) => THREE.Vector3; color?: string };

/** Real measurements drawn on the parts, in the style of a technical drawing. */
const DIMENSIONS: DimensionDef[] = [
  { ...beatWindow(20, 23.8), text: `BORE ${BORE_MM} MM`, color: UI.yellow, a: (t) => cylLocal(1, -0.2, DECK + 0.02, -CASTING.boreR, t), b: (t) => cylLocal(1, -0.2, DECK + 0.02, CASTING.boreR, t) },
  { ...beatWindow(21, 23.8), text: `STROKE ${Math.round(STROKE_MM * 10) / 10} MM`, color: UI.yellow, a: (t) => cylLocal(1, -0.2, wristDist(0) + PIN_TO_CROWN, -CASTING.boreR - 0.5, t), b: (t) => cylLocal(1, -0.2, wristDist(180) + PIN_TO_CROWN, -CASTING.boreR - 0.5, t) },
  { ...beatWindow(25, 27.8), text: `${CRANK_HEIGHT_MM} MM`, color: UI.yellow, a: (t) => engineOrigin(t).add(new THREE.Vector3(-2.7, 0, -1.2)), b: (t) => engineOrigin(t).add(new THREE.Vector3(-2.7, CASTING.sumpY, -1.2)) },
  { ...beatWindow(38, 39.8), text: `${INTAKE_VALVE_MM} MM`, color: UI.yellow, a: (t) => valvePoint(1, -1, 1, 0.03, t).add(new THREE.Vector3(0, -0.14, -0.14)), b: (t) => valvePoint(1, -1, 1, 0.03, t).add(new THREE.Vector3(0, 0.14, 0.14)) },
];

const Dimension: React.FC<{ a: { x: number; y: number }; b: { x: number; y: number }; text: string; color: string }> = ({ a, b, text, color }) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 16;
  const ny = (dx / len) * 16;
  const tick = (p: { x: number; y: number }, key: string) => <line key={key} x1={p.x - nx} y1={p.y - ny} x2={p.x + nx} y2={p.y + ny} stroke={color} strokeWidth={4} />;
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={UI.ink} strokeWidth={9} />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={3} />
        {tick(a, "a")}
        {tick(b, "b")}
      </svg>
      <Tag x={(a.x + b.x) / 2} y={(a.y + b.y) / 2} text={text} hot size={22} />
    </>
  );
};

/** The hook's title: each word slams in on its own stab, then settles. */
const HookTitle: React.FC<{ t: number }> = ({ t }) => {
  if (t >= HOOK_END) return null;
  let index = 0;
  return (
    <div style={{ position: "absolute", top: 190, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      {HOOK_LINES.map((line) => (
        <div key={line.join()} style={{ display: "flex", gap: 22, justifyContent: "center" }}>
          {line.map((word) => {
            const at = STABS[index++];
            const age = t - at;
            if (age < 0) return <span key={word} style={{ visibility: "hidden", fontFamily: FONT.display, fontSize: 118, letterSpacing: 2, padding: "6px 22px 0" }}>{word}</span>;
            const pop = 1 + 0.42 * Math.exp(-age / 0.055);
            const hit = Math.exp(-age / 0.12);
            return (
              <span
                key={word}
                style={{
                  fontFamily: FONT.display,
                  fontSize: 118,
                  lineHeight: 1,
                  letterSpacing: 2,
                  padding: "6px 22px 0",
                  background: hit > 0.25 ? UI.yellow : UI.ink,
                  color: hit > 0.25 ? UI.ink : UI.cream,
                  border: `4px solid ${UI.cream}`,
                  boxShadow: `0 0 0 4px ${UI.ink}`,
                  transform: `scale(${pop})`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** A quick white wash on each hook kick, so the first seconds breathe with the drums. */
const HookPump: React.FC<{ t: number }> = ({ t }) => {
  if (t >= barT(2)) return null;
  return <AbsoluteFill style={{ background: "#ffffff", opacity: kickPulse(t, 0.07) * 0.16 }} />;
};

/** Where the numbers came from, shown once at the end. */
const Credit: React.FC<{ t: number }> = ({ t }) => {
  const a = Math.min(1, Math.max(0, (t - barT(17)) / 0.2));
  if (a <= 0 || t >= END_FADE_FROM + 0.5) return null;
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top: 1790, textAlign: "center", fontFamily: FONT.label, fontSize: 19, color: UI.dim, opacity: a }}>
      SOURCE: HONDA R&amp;D TECHNICAL REVIEW, F1 SPECIAL, 2009
    </div>
  );
};

export const Overlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  useFonts();
  return (
    <AbsoluteFill>
      {t < FIRST_HIT ? <AbsoluteFill style={{ background: UI.ink, zIndex: 10 }} /> : null}
      <Labels t={t} w={width} h={height} />
      {COMPACT_HUD(t) ? <MiniHud t={t} config={HUD_CONFIG} /> : <EngineHud t={t} config={HUD_CONFIG} />}
      <HookPump t={t} />
      <HookTitle t={t} />
      <Captions t={t} captions={CAPTIONS} />
      <Panel t={t} />
      <Credit t={t} />
      <Flashes t={t} at={[SLOW_START, REAL_SPEED_START, DROP]} endFadeFrom={END_FADE_FROM} />
    </AbsoluteFill>
  );
};


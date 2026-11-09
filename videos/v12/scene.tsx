import { useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { strokeName } from "../../src/kits/engine/fourStroke";
import { D2R, hash } from "../../src/core/math";
import { PixelStage } from "../../src/core/PixelStage";
import { C } from "../../src/kits/engine/theme";
import { FrontDrive, FuelRail, Harness, SideAncillaries } from "../../src/kits/engine/parts/Accessories";
import { BlockShell, CoilPack, CylinderLiner, DeckFrame } from "../../src/kits/engine/parts/BlockShell";
import { WedgeSupercar } from "../../src/kits/engine/parts/cars/WedgeSupercar";
import { Crankshaft, MainBearings } from "../../src/kits/engine/parts/Crankshaft";
import { Garage } from "../../src/kits/engine/parts/Garage";
import { ExhaustPulse, headerCurve, Headers, headerTube } from "../../src/kits/engine/parts/Headers";
import { Injector, SparkPlug, VelocityStack } from "../../src/kits/engine/parts/Induction";
import { DimContext } from "../../src/core/Lam";
import { CombustionFlash, crankPinInBank, GasColumn, PistonRod } from "../../src/kits/engine/parts/PistonRod";
import { CamCaps, CamLobes, CamShaft, Sprocket, TimingChain, Valves, valveBump } from "../../src/kits/engine/parts/ValveTrain";
import {
  bankAngle,
  CAM_DIST,
  coverAngleAt,
  CRANK_R,
  CYL_SPACING,
  cylX,
  DECK,
  ENGINE_X,
  engineOrigin,
  liftAt,
  LIFT,
  PIN_TO_CROWN,
  PISTON_H,
  PISTON_R,
  wristDist,
} from "./geometry";
import { crankAt, CRANK_PINS, cycleAt, CYLINDERS, EXHAUST_VALVE, FIRING_ORDER, INTAKE_VALVE, isRightBank, isSlowed, REDLINE, rpmAt } from "./physics";
import { kickPulse, stabPulse } from "./song";
import { cameraAt, focusAt, type FocusKind, headerGhost, SHOW_FRONT_DRIVE } from "./timeline";

const CYLS = [...FIRING_ORDER].sort((a, b) => a - b);
const VALVE_LIFT = 0.22;

/** How far each group of parts fades back in each kind of shot. */
const FOCUS: Record<FocusKind, { piston: number; top: number; crank: number; headers: number; drive: number }> = {
  none: { piston: 0, top: 0, crank: 0, headers: 0, drive: 0 },
  strokes: { piston: 0, top: 0, crank: 0.25, headers: 0.8, drive: 0.85 },
  crank: { piston: 0.45, top: 0.8, crank: 0, headers: 0.7, drive: 0.7 },
  cams: { piston: 0.75, top: 0, crank: 0.75, headers: 0.75, drive: 0.6 },
};

/** In the strokes shot only the front pair stays lit: cylinder 1 fully, its partner a little less. */
const STROKES_CYLINDER_DIM: Record<number, number> = { 1: 0, 7: 0.25 };
const OTHER_CYLINDERS_DIM = 0.88;

const Cylinder: React.FC<{ cyl: number; t: number; frame: number; pistonDim: number; topDim: number }> = ({ cyl, t, frame, pistonDim, topDim }) => {
  const c = cycleAt(cyl, t);
  const cm = c % 360;
  const w = wristDist(cm);
  const crown = w + PIN_TO_CROWN;
  const inner = isRightBank(cyl) ? 1 : -1;

  // Slowed: the flash follows the real firing. Real speed: too fast to see, so it pumps on the kick.
  const slowed = isSlowed(t);
  const realHeat = (0.3 + 0.7 * kickPulse(t)) * (0.45 + 0.55 * hash(frame, cyl));
  const heat = slowed ? (c < 110 ? 1 - c / 110 : 0) : realHeat;
  const flashAge = slowed ? c / 80 : hash(cyl * 3, frame) * 0.9;
  const firing = slowed ? c < 18 : kickPulse(t) > 0.7 && hash(cyl, frame) > 0.5;

  // Fuel and air only show while they can be followed by eye.
  const spray = slowed && c > 380 && c < 480 ? (c - 380) / 100 : -1;
  const air = slowed && c > 360 && c < 540 ? (c - 360) / 180 : -1;
  // Faded-back cylinders drop their fine parts so they stop competing with the subject.
  const showTop = topDim < 0.6;
  const showPiston = pistonDim < 0.8;

  return (
    <group position={[cylX(cyl), 0, 0]} rotation={[bankAngle(cyl), 0, 0]}>
      <DimContext.Provider value={pistonDim}>
        {showPiston ? (
          <PistonRod crown={crown} wrist={w} pin={crankPinInBank(cm, CRANK_R)} radius={PISTON_R} height={PISTON_H} heat={heat} rodColor={isRightBank(cyl) ? C.rodRight : C.rodLeft} />
        ) : null}
        <DeckFrame deck={DECK} spacing={CYL_SPACING} boreR={PISTON_R} />
        {slowed ? <GasColumn crown={crown} deck={DECK} radius={PISTON_R} c={c} stroke={strokeName(c)} /> : null}
      </DimContext.Provider>
      <DimContext.Provider value={topDim}>
        {showTop ? (
          <>
            {/* 4 valves: intake pair on the V side, exhaust pair outside */}
            <Valves
              deck={DECK}
              rows={[
                { side: inner, lift: valveBump(c, INTAKE_VALVE.open, INTAKE_VALVE.close) * VALVE_LIFT, color: C.intake },
                { side: -inner, lift: valveBump(c, EXHAUST_VALVE.open, EXHAUST_VALVE.close) * VALVE_LIFT, color: C.exhaust },
              ]}
            />
            <CamLobes
              camDist={CAM_DIST}
              c={c}
              rows={[
                { side: inner, peak: INTAKE_VALVE.peak, color: C.camLobe },
                { side: -inner, peak: EXHAUST_VALVE.peak, color: C.camLobe },
              ]}
            />
            <SparkPlug deck={DECK} crown={crown} firing={firing} seed={cyl + frame * 0.1} />
            <Injector deck={DECK} side={inner} spraying={spray} seed={cyl} />
            <VelocityStack deck={DECK} side={inner} drawing={air} seed={cyl} />
            <CoilPack y={CAM_DIST + 0.36} />
            <CombustionFlash crown={crown} age={flashAge} seed={cyl} />
          </>
        ) : null}
      </DimContext.Provider>
      {pistonDim < 0.5 ? <CylinderLiner y0={1.0} y1={DECK} r={PISTON_R + 0.05} heat={heat} /> : null}
    </group>
  );
};

const headerPoints = (cyl: number) => {
  const a = bankAngle(cyl);
  const dir = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
  const outward = new THREE.Vector3(0, -Math.sin(a), Math.cos(a)).multiplyScalar(isRightBank(cyl) ? -1 : 1);
  const x = cylX(cyl);
  const port = new THREE.Vector3(x, 0, 0).add(dir.clone().multiplyScalar(DECK + 0.3)).add(outward.clone().multiplyScalar(0.62));
  const side = Math.sign(outward.z);
  const p1 = port.clone().add(new THREE.Vector3(0, 0.05, side * 0.75));
  const p2 = new THREE.Vector3(x + 0.3, 0.4, side * 2.55);
  const p3 = new THREE.Vector3(x * 0.4 + 2.6, -0.9, side * 2.75);
  const p4 = new THREE.Vector3(4.4, -1.1, side * 2.3);
  return [port, p1, p2, p3, p4];
};

const CAMSHAFT_BANKS = [1, 7];
const RIGHT_BANK_HEADERS = CYLINDERS / 2;
const CHAIN_LINKS = 52;
const CRANK_SPROCKET_R = 0.26;
const CAM_SPROCKET_R = 0.2;
const CHAIN_SIDE = 0.24;

const chainCurve = () =>
  new THREE.CatmullRomCurve3(
    [
      [-CRANK_SPROCKET_R - 0.06, 0],
      [0, CRANK_SPROCKET_R + 0.1],
      [CAM_DIST * 0.5, 0.56],
      [CAM_DIST - 0.15, CHAIN_SIDE + CAM_SPROCKET_R + 0.1],
      [CAM_DIST + CAM_SPROCKET_R + 0.08, CHAIN_SIDE],
      [CAM_DIST + CAM_SPROCKET_R + 0.08, -CHAIN_SIDE],
      [CAM_DIST - 0.15, -CHAIN_SIDE - CAM_SPROCKET_R - 0.1],
      [CAM_DIST * 0.5, -0.56],
      [0, -CRANK_SPROCKET_R - 0.1],
    ].map(([y, z]) => new THREE.Vector3(0, y, z)),
    true,
  );

/** Rows of main bearings fall between crank throws. */
const journalXs = Array.from({ length: 7 }, (_, i) => (i - 3) * CYL_SPACING);
const camCapXs = Array.from({ length: 6 }, (_, i) => (i - 2.5) * CYL_SPACING);

const Engine: React.FC<{ t: number; frame: number; origin: THREE.Vector3 }> = ({ t, frame, origin }) => {
  const { tubes, curves, chain, chainLength } = useMemo(() => {
    const points = CYLS.map(headerPoints);
    const chainPath = chainCurve();
    return { tubes: points.map((p) => headerTube(p)), curves: points.map(headerCurve), chain: chainPath, chainLength: chainPath.getLength() };
  }, []);
  const pins = CRANK_PINS.map(([right, left]) => ({
    x: (cylX(right) + cylX(left)) / 2,
    alpha: bankAngle(right) + (cycleAt(right, t) % 360) * D2R,
  }));
  const ghost = headerGhost(t);
  const crankDeg = crankAt(t);
  const crankRad = (crankDeg % 360) * D2R;
  const camRad = ((crankDeg / 2) % 360) * D2R;
  // The chain moves the crank sprocket's circumference per revolution.
  const chainPhase = (((crankDeg / 360) * (2 * Math.PI * CRANK_SPROCKET_R)) / chainLength) % 1;
  const rpmHeat = rpmAt(t) / REDLINE;
  const glow = Math.max(0, rpmHeat * rpmHeat * 0.9 + (isSlowed(t) ? 0 : kickPulse(t) * 0.35));

  const { kind, amount } = focusAt(t);
  const dims = FOCUS[kind];
  const cylinderDim = (cyl: number) => (kind === "strokes" ? (STROKES_CYLINDER_DIM[cyl] ?? OTHER_CYLINDERS_DIM) * amount : 0);
  const showChain = !(kind === "strokes" && amount > 0.4) && !(kind === "crank" && amount > 0.4);
  return (
    <group position={origin}>
      <DimContext.Provider value={dims.crank * amount}>
        <Crankshaft pins={pins} throwR={CRANK_R} length={7.6} spin={crankRad} ends color={C.crankGold} weightColor={C.metal} />
        <MainBearings xs={journalXs} />
      </DimContext.Provider>
      {CYLS.map((cyl) => (
        <Cylinder key={cyl} cyl={cyl} t={t} frame={frame} pistonDim={Math.max(dims.piston * amount, cylinderDim(cyl))} topDim={Math.max(dims.top * amount, cylinderDim(cyl))} />
      ))}
      <DimContext.Provider value={dims.top * amount}>
        {CAMSHAFT_BANKS.map((ref) => (
          <group key={ref} rotation={[bankAngle(ref), 0, 0]}>
            {dims.top * amount < 0.6
              ? [1, -1].map((side) => (
                  <group key={side}>
                    <CamShaft x={(cylX(ref) + cylX(ref + 5)) / 2} camDist={CAM_DIST} side={side} length={6.9} color={C.camLobe} />
                    <CamCaps xs={camCapXs} camDist={CAM_DIST} side={side} />
                    {showChain ? <Sprocket x={cylX(ref) - 0.68} y={CAM_DIST} z={side * CHAIN_SIDE} r={CAM_SPROCKET_R} teeth={14} spin={camRad} /> : null}
                  </group>
                ))
              : null}
            {showChain ? (
              <>
                <group position={[cylX(ref) - 0.68, 0, 0]}>
                  <TimingChain curve={chain} links={CHAIN_LINKS} phase={chainPhase} />
                </group>
                <Sprocket x={cylX(ref) - 0.68} y={0} z={0} r={CRANK_SPROCKET_R} teeth={18} spin={crankRad} />
              </>
            ) : null}
            {dims.top * amount < 0.6 ? (
              <>
                <Harness x={(cylX(ref) + cylX(ref + 5)) / 2} y={CAM_DIST + 0.74} length={6.2} />
                <FuelRail x={(cylX(ref) + cylX(ref + 5)) / 2} y={DECK + 0.66} z={(isRightBank(ref) ? 1 : -1) * 0.5} length={6.3} />
              </>
            ) : null}
          </group>
        ))}
      </DimContext.Provider>
      <Headers tubes={tubes} ghost={(i) => (i < RIGHT_BANK_HEADERS ? ghost : 0)} glow={glow} dim={dims.headers * amount} />
      {isSlowed(t) && kind === "none"
        ? CYLS.map((cyl, i) => {
            if (i < RIGHT_BANK_HEADERS && ghost > 0.5) return null;
            const c = cycleAt(cyl, t);
            return <ExhaustPulse key={cyl} curve={curves[i]} head={c >= 180 && c < 420 ? (c - 180) / 200 : -1} seed={cyl + frame} />;
          })
        : null}
      {[1, -1].map((s) => (
        <mesh key={s} position={[5.1, -1.1, s * 2.3]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.36, 0.36, 1.5, 10]} />
          <meshLambertMaterial color="#8a4a2a" emissive="#ff3a10" emissiveIntensity={glow * 0.6 * (1 - dims.headers * amount)} flatShading />
        </mesh>
      ))}
      <DimContext.Provider value={dims.drive * amount}>
        <BlockShell showPan={ghost < 0.5} />
        <SideAncillaries />
      </DimContext.Provider>
      {SHOW_FRONT_DRIVE(t) ? <FrontDrive x={-4.02} crankSpin={crankRad} /> : null}
    </group>
  );
};

const BAY_FLOOR_Y = 2.7;

/** Hydraulic ram that lifts the engine out of the bay, from below so it never blocks the camera. */
const LiftRam: React.FC<{ origin: THREE.Vector3; amount: number }> = ({ origin, amount }) => {
  if (amount <= 0) return null;
  const top = origin.y - 1.6;
  const stage = (top - BAY_FLOOR_Y) / 2;
  return (
    <>
      <mesh position={[origin.x, BAY_FLOOR_Y + stage / 2, 0]}>
        <cylinderGeometry args={[1.05, 1.05, stage, 12]} />
        <meshLambertMaterial color="#5a5f8e" flatShading />
      </mesh>
      <mesh position={[origin.x, BAY_FLOOR_Y + stage * 1.5, 0]}>
        <cylinderGeometry args={[0.7, 0.7, stage, 12]} />
        <meshLambertMaterial color="#c4c8e4" flatShading />
      </mesh>
    </>
  );
};

export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const kick = kickPulse(t);
  const stab = stabPulse(t);
  const origin = engineOrigin(t);
  const realSpeed = !isSlowed(t);
  return (
    <PixelStage t={t} cameraAt={cameraAt} pixelSize={2} normalEdge={0.55} depthEdge={0.85}>
      <Garage t={t} pulse={kick} />
      <WedgeSupercar coverAngle={coverAngleAt(t)} pulse={Math.max(kick, stab)} squat={kick * 0.16} flame={realSpeed ? Math.max(stab, (rpmAt(t) / REDLINE) ** 2 * kick * 0.85) : 0} />
      <Engine t={t} frame={frame} origin={origin} />
      <LiftRam origin={new THREE.Vector3(ENGINE_X, origin.y, 0)} amount={liftAt(t) / LIFT} />
    </PixelStage>
  );
};

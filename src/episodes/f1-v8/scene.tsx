import { useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { strokeName } from "../../core/engine/fourStroke";
import { D2R, hash } from "../../core/math";
import { PixelStage } from "../../core/PixelStage";
import { C } from "../../core/theme";
import { CoilPack, CylinderLiner, DeckFrame } from "../../parts/BlockShell";
import { OpenWheeler } from "../../parts/cars/OpenWheeler";
import { Crankshaft, MainBearings } from "../../parts/Crankshaft";
import { BankCasting, BlueprintRoom, EngineSection, Mechanic } from "../../parts/F1Casting";
import { F1Block } from "../../parts/F1Block";
import { AirBottle, AirRail, CamCap, CounterweightInsert, FlameKernel, flowPhase, OilFling, OilJet, PortFlow } from "../../parts/F1Detail";
import { F1Valve, gearSpins, SpurGear } from "../../parts/F1Head";
import { Garage } from "../../parts/Garage";
import { StartGrid } from "../../parts/StartGrid";
import { ExhaustPulse, headerCurve, Headers, headerTube } from "../../parts/Headers";
import { Injector, SparkPlug, VelocityStack } from "../../parts/Induction";
import { FuelRail, Harness } from "../../parts/Accessories";
import { DimContext } from "../../parts/Lam";
import { CombustionFlash, crankPinInBank, GasColumn, PistonRod } from "../../parts/PistonRod";
import { valveBump } from "../../parts/ValveTrain";
import {
  AIR_RAIL_Y,
  AIR_RAIL_Z,
  bankAngle,
  bankGears,
  CASTING,
  CAM_DIST,
  CAM_U,
  CAM_Z,
  coverLiftAt,
  CRANK_R,
  CYL_SPACING,
  cylX,
  DECK,
  ENGINE_X,
  engineOrigin,
  EXHAUST_HEAD_R,
  EXHAUST_LIFT,
  GEAR_X,
  gridSlot,
  GRID_SLOTS,
  HERO_Z,
  heroDropY,
  heroS,
  heroV,
  INTAKE_HEAD_R,
  INTAKE_LIFT,
  landingPulse,
  LIFT,
  liftAt,
  lightsOnAt,
  PIN_TO_CROWN,
  PISTON_H,
  PISTON_R,
  rivalS,
  TRACK_FROM,
  VALVE_DX,
  VALVE_TILT,
  VALVE_Z,
  wristDist,
} from "./geometry";
import { AIR_BOTTLE_CC, BANGS, barT, crankAt, CRANK_PINS, cycleAt, CYLINDERS, DROP, EXHAUST_VALVE, FIRING_ORDER, firstBangAfter, INTAKE_VALVE, isBankA, isSlowed, REDLINE, rpmAt } from "./physics";
import { kickPulse, stabPulse } from "./beatmap";
import { growlPulse } from "./song";
import { cameraAt, focusAt, type FocusKind, headerGhost, SHOW_GEARS, STUDIO } from "./timeline";

const CYLS = [...FIRING_ORDER].sort((a, b) => a - b);
const CAM_HALF_WIDTH = (close: number, open: number) => (close - open) / 4;

/** How far each group of parts fades back in each kind of shot. */
const FOCUS: Record<FocusKind, { piston: number; top: number; crank: number; headers: number; gears: number }> = {
  none: { piston: 0, top: 0, crank: 0, headers: 0, gears: 0 },
  strokes: { piston: 0, top: 0, crank: 0.25, headers: 0.8, gears: 0.85 },
  crank: { piston: 0.45, top: 0.8, crank: 0, headers: 0.7, gears: 0.7 },
  gears: { piston: 0.75, top: 0.5, crank: 0.4, headers: 0.8, gears: 0 },
  head: { piston: 0.7, top: 0, crank: 0.8, headers: 0.85, gears: 0.85 },
  air: { piston: 0.8, top: 0, crank: 0.85, headers: 0.9, gears: 0.85 },
};

/** Cylinders that stay lit in the single-cylinder shots. */
const SINGLE_LIT: Partial<Record<FocusKind, Record<number, number>>> = {
  strokes: { 1: 0, 5: 0.3 },
  head: { 1: 0 },
  air: { 1: 0 },
};
const OTHER_CYLINDERS_DIM = 0.9;

const intakePoints = (inner: number, dx: number) =>
  [
    [dx, DECK + 0.08, inner * VALVE_Z],
    [dx, DECK + 0.21, inner * 0.55],
    [dx, DECK + 0.49, inner * 1.23],
    [dx, DECK + 0.76, inner * 1.68],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
const exhaustPoints = (inner: number, dx: number) =>
  [
    [dx, DECK + 0.08, -inner * VALVE_Z],
    [dx, DECK + 0.16, -inner * 0.43],
    [dx, DECK + 0.15, -inner * 0.98],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));

/** Port shapes for each bank side and each valve of a pair, built once. */
const PORTS = (() => {
  const build = (points: THREE.Vector3[], r: number) => {
    const curve = new THREE.CatmullRomCurve3(points);
    return { curve, tube: new THREE.TubeGeometry(curve, 14, r, 8, false) };
  };
  const table: Record<string, { intake: ReturnType<typeof build>; exhaust: ReturnType<typeof build> }> = {};
  for (const inner of [1, -1]) for (const dxs of [1, -1]) table[`${inner}${dxs}`] = { intake: build(intakePoints(inner, dxs * VALVE_DX), 0.13), exhaust: build(exhaustPoints(inner, dxs * VALVE_DX), 0.11) };
  return table;
})();

const Cylinder: React.FC<{ cyl: number; t: number; frame: number; pistonDim: number; topDim: number; airGlow: number; closeUp: boolean }> = ({ cyl, t, frame, pistonDim, topDim, airGlow, closeUp }) => {
  const c = cycleAt(cyl, t);
  const cm = c % 360;
  const w = wristDist(cm);
  const crown = w + PIN_TO_CROWN;
  const inner = isBankA(cyl) ? 1 : -1;

  const slowed = isSlowed(t);
  const realHeat = (0.3 + 0.7 * kickPulse(t)) * (0.45 + 0.55 * hash(frame, cyl));
  const heat = slowed ? (c < 110 ? 1 - c / 110 : 0) : realHeat;
  const flashAge = slowed ? c / 80 : hash(cyl * 3, frame) * 0.9;
  const firing = slowed ? c < 18 : kickPulse(t) > 0.7 && hash(cyl, frame) > 0.5;

  // Fuel and air would float in space in the valve close-ups, where the ports are cut away.
  const spray = slowed && !closeUp && c > 380 && c < 480 ? (c - 380) / 100 : -1;
  const air = slowed && !closeUp && c > 360 && c < 540 ? (c - 360) / 180 : -1;
  const showTop = topDim < 0.6;
  const showPiston = pistonDim < 0.8;

  const inLift = valveBump(c, INTAKE_VALVE.open, INTAKE_VALVE.close) * INTAKE_LIFT;
  const exLift = valveBump(c, EXHAUST_VALVE.open, EXHAUST_VALVE.close) * EXHAUST_LIFT;
  const inCam = ((c - INTAKE_VALVE.peak) / 2) * D2R;
  const exCam = ((c - EXHAUST_VALVE.peak) / 2) * D2R;

  return (
    <group position={[cylX(cyl), 0, 0]} rotation={[bankAngle(cyl), 0, 0]}>
      <DimContext.Provider value={pistonDim}>
        {showPiston ? <PistonRod crown={crown} wrist={w} pin={crankPinInBank(cm, CRANK_R)} radius={PISTON_R} height={PISTON_H} heat={heat} rodColor={isBankA(cyl) ? C.rodRight : C.rodLeft} /> : null}
        <DeckFrame deck={DECK} spacing={CYL_SPACING} boreR={PISTON_R} />
        {slowed ? <GasColumn crown={crown} deck={DECK} radius={PISTON_R} c={c} stroke={strokeName(c)} /> : null}
        {slowed && showPiston && pistonDim < 0.5 ? <OilJet y0={0.5} side={-inner} underside={crown - PISTON_H} frame={frame} seed={cyl} /> : null}
      </DimContext.Provider>
      <DimContext.Provider value={topDim}>
        {showTop ? (
          <>
            {/* In the valve close-ups only the nearest pair is drawn, so nothing stands in front of the subject. */}
            {(closeUp ? [-1] : [-1, 1]).map((dxs) => (
              <group key={dxs}>
                <F1Valve dx={dxs * VALVE_DX} deck={DECK} z0={inner * VALVE_Z} side={inner} tiltRad={VALVE_TILT} lift={inLift} maxLift={INTAKE_LIFT} headR={INTAKE_HEAD_R} color={C.intake} camU={CAM_U} camRad={inCam} camHalfWidthDeg={CAM_HALF_WIDTH(INTAKE_VALVE.close, INTAKE_VALVE.open)} airGlow={airGlow} airPhase={(frame * 0.06) % 1} />
                {airGlow > 0.5 ? null : <F1Valve dx={dxs * VALVE_DX} deck={DECK} z0={-inner * VALVE_Z} side={-inner} tiltRad={VALVE_TILT} lift={exLift} maxLift={EXHAUST_LIFT} headR={EXHAUST_HEAD_R} color={C.exhaust} camU={CAM_U} camRad={exCam} camHalfWidthDeg={CAM_HALF_WIDTH(EXHAUST_VALVE.close, EXHAUST_VALVE.open)} />}
              </group>
            ))}
            {slowed && topDim < 0.3 && airGlow < 0.5
              ? [-1].map((dxs) => (
                  <group key={`p${dxs}`}>
                    <PortFlow {...PORTS[`${inner}${dxs}`].intake} showTube={false} kind="INTAKE" phase={flowPhase(c, INTAKE_VALVE.open, INTAKE_VALVE.close)} seed={cyl * 3 + dxs} />
                    <PortFlow {...PORTS[`${inner}${dxs}`].exhaust} showTube={false} kind="EXHAUST" phase={flowPhase(c, EXHAUST_VALVE.open, EXHAUST_VALVE.close)} seed={cyl * 5 + dxs} />
                  </group>
                ))
              : null}
            {closeUp ? null : (
              <>
                <CamCap y={CAM_DIST + 0.02} z={CAM_Z} />
                <CamCap y={CAM_DIST + 0.02} z={-CAM_Z} />
              </>
            )}
            {slowed && topDim < 0.3 ? <FlameKernel c={c} deck={DECK} crown={crown} radius={PISTON_R} /> : null}
            {closeUp ? null : <SparkPlug deck={DECK - 0.02} crown={crown} firing={firing} seed={cyl + frame * 0.1} />}
            <group position={[0, 0.1, inner * 0.3]}>
              <Injector deck={DECK} side={inner} spraying={spray} seed={cyl} />
            </group>
            <group position={[0, 0.25, inner * 0.72]}>
              <VelocityStack deck={DECK} side={inner} drawing={air} seed={cyl} />
            </group>
            {closeUp ? null : <CoilPack y={CAM_DIST + 0.42} />}
            {closeUp ? null : <CombustionFlash crown={crown} age={flashAge} seed={cyl} />}
          </>
        ) : null}
      </DimContext.Provider>
      {pistonDim < 0.5 ? <CylinderLiner y0={0.92} y1={DECK} r={PISTON_R + 0.04} heat={heat} /> : null}
    </group>
  );
};

const headerPoints = (cyl: number) => {
  const a = bankAngle(cyl);
  const dir = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
  const outward = new THREE.Vector3(0, -Math.sin(a), Math.cos(a)).multiplyScalar(isBankA(cyl) ? -1 : 1);
  const x = cylX(cyl);
  const side = isBankA(cyl) ? -1 : 1;
  const port = new THREE.Vector3(x, 0, 0).add(dir.clone().multiplyScalar(DECK + 0.1)).add(outward.clone().multiplyScalar(0.6));
  const p1 = port.clone().add(outward.clone().multiplyScalar(0.55));
  const p2 = new THREE.Vector3(x + 0.25, 0.75, side * 2.45);
  const p3 = new THREE.Vector3(x * 0.4 + 1.6, 0.25, side * 2.75);
  const p4 = new THREE.Vector3(3.1, 0.3, side * 2.9);
  return [port, p1, p2, p3, p4];
};

const BOTTLE_R = 0.4;
const BOTTLE_L = AIR_BOTTLE_CC / (Math.PI * (BOTTLE_R * 10) ** 2) / 10; // cm³ over an 8 cm bore, in scene units
const CAMSHAFT_BANKS = [1, 5];
const BANK_A_HEADERS = CYLINDERS / 2;
const journalXs = Array.from({ length: 5 }, (_, i) => (i - 2) * CYL_SPACING);
const COUNTERWEIGHT_SCALE = 0.5 / 0.72; // the papers' 50 mm radius, on the part's 72 mm blank
const BLOCK_LENGTH = 4.6;
const REAR_GEAR_X = cylX(4) + 0.76;
const BANKS: [number, number][] = [
  [-1, 1],
  [1, 5],
];

const GearTrain: React.FC<{ crankRad: number }> = ({ crankRad }) => (
  <>
    {BANKS.map(([bank]) => {
      const gears = bankGears(bank);
      const spins = gearSpins(gears, crankRad);
      const rear = gears.slice(-3);
      const rearSpins = spins.slice(-3);
      return [
        ...gears.map((g, i) => (i === 0 && bank === 1 ? null : <SpurGear key={`${bank}${i}`} x={GEAR_X} y={g.y} z={g.z} r={g.r} teeth={g.teeth} spin={spins[i]} color={i === 0 ? C.crankGold : i >= gears.length - 2 ? C.camLobe : C.gear} />)),
        // Rear gears tie the free ends of the two cams together, which stiffens the shafts.
        ...rear.map((g, i) => <SpurGear key={`r${bank}${i}`} x={REAR_GEAR_X} y={g.y} z={g.z} r={g.r} teeth={g.teeth} spin={rearSpins[i]} color={C.metalLight} width={0.06} />),
      ];
    })}
  </>
);

const Engine: React.FC<{ t: number; frame: number; origin: THREE.Vector3 }> = ({ t, frame, origin }) => {
  const { tubes, curves, tailPipes } = useMemo(() => {
    const points = CYLS.map(headerPoints);
    const tail = (side: number) => headerTube([[4.15, 0.3, side * 2.9], [4.5, 0.7, side * 3.3], [4.1, 2.1, side * 4.4]].map(([x, y, z]) => new THREE.Vector3(x, y, z)), 0.3);
    return { tubes: points.map((p) => headerTube(p, 0.14)), curves: points.map(headerCurve), tailPipes: { 1: tail(1), [-1]: tail(-1) } as Record<number, THREE.BufferGeometry> };
  }, []);
  const pins = CRANK_PINS.map(([a, b]) => ({ x: (cylX(a) + cylX(b)) / 2, alpha: bankAngle(a) + (cycleAt(a, t) % 360) * D2R }));
  const ghost = headerGhost(t);
  const crankDeg = crankAt(t);
  const crankRad = crankDeg * D2R;
  const rpmHeat = rpmAt(t) / REDLINE;
  const glow = Math.max(0, rpmHeat * rpmHeat * 0.9 + (isSlowed(t) ? 0 : kickPulse(t) * 0.35));
  const { kind, amount } = focusAt(t);
  const dims = FOCUS[kind];
  const lit = SINGLE_LIT[kind];
  const cylinderDim = (cyl: number) => (lit ? (lit[cyl] ?? OTHER_CYLINDERS_DIM) * amount : 0);
  const topVisible = dims.top * amount < 0.6;
  const closeUpShot = (kind === "head" || kind === "air") && amount > 0.5;
  const lastBang = isSlowed(t) ? BANGS[firstBangAfter(t + 1e-6) - 1] : undefined;
  const firing = lastBang && t - lastBang.t < 0.3
    ? { position: new THREE.Vector3(cylX(lastBang.cyl), 0, 0).add(new THREE.Vector3(0, Math.cos(bankAngle(lastBang.cyl)), Math.sin(bankAngle(lastBang.cyl))).multiplyScalar(DECK - 0.1)), power: 1 - (t - lastBang.t) / 0.3 }
    : null;
  // The front row of the bank stays lit in the gear shot, so the gears lead to the cams they drive.
  return (
    <group position={origin}>
      <DimContext.Provider value={dims.crank * amount}>
        <Crankshaft pins={pins} throwR={CRANK_R} length={BLOCK_LENGTH + 0.2} spin={crankRad} webOffset={0.33} color={C.crankGold} weightColor={C.metal} weightScale={COUNTERWEIGHT_SCALE} />
        <MainBearings xs={journalXs} />
        {dims.crank * amount < 0.6
          ? pins.flatMap((pin, k) =>
              [-0.33, 0.33].map((dx) => <CounterweightInsert key={`${k}${dx}`} x={pin.x + dx} alpha={pin.alpha} radius={0.42} />),
            )
          : null}
        {isSlowed(t) && dims.crank * amount < 0.3 ? pins.map((pin, k) => <OilFling key={k} x={pin.x} alpha={pin.alpha} frame={frame} seed={k + 1} />) : null}
      </DimContext.Provider>
      {CYLS.map((cyl) => (
        <Cylinder key={cyl} cyl={cyl} t={t} frame={frame} closeUp={(kind === "head" || kind === "air") && amount > 0.5} airGlow={kind === "air" ? amount : 0} pistonDim={Math.max(dims.piston * amount, cylinderDim(cyl))} topDim={Math.max(dims.top * amount, cylinderDim(cyl))} />
      ))}
      <DimContext.Provider value={dims.top * amount}>
        {CAMSHAFT_BANKS.map((ref) =>
          topVisible ? (
            <group key={ref} rotation={[bankAngle(ref), 0, 0]}>
              {[1, -1].map((side) => (
                <mesh key={side} position={[(cylX(ref) + cylX(ref + 3)) / 2, CAM_DIST, side * CAM_Z]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.09, 0.09, BLOCK_LENGTH - 0.1, 8]} />
                  <meshLambertMaterial color={C.camLobe} flatShading />
                </mesh>
              ))}
              {[1, -1].map((side) => (
                <AirRail key={`air${side}`} x={(cylX(ref) + cylX(ref + 3)) / 2} y={AIR_RAIL_Y} z={side * AIR_RAIL_Z} length={BLOCK_LENGTH - 0.2} frame={frame} seed={ref + side} pulses={kind === "none"} />
              ))}
              <FuelRail x={(cylX(ref) + cylX(ref + 3)) / 2} y={DECK + 0.72} z={(isBankA(ref) ? 1 : -1) * 0.92} length={BLOCK_LENGTH - 0.3} />
              <Harness x={(cylX(ref) + cylX(ref + 3)) / 2} y={CAM_DIST + 0.74} length={BLOCK_LENGTH - 0.3} />
            </group>
          ) : null,
        )}
      </DimContext.Provider>
      {SHOW_GEARS(t) ? (
        <DimContext.Provider value={dims.gears * amount}>
          <GearTrain crankRad={crankRad} />
        </DimContext.Provider>
      ) : null}
      {/* the castings that hold it all together */}
      <EngineSection spec={CASTING} firstCylX={[cylX(1), cylX(5)]} bankRad={[bankAngle(1), bankAngle(5)]} pulse={isSlowed(t) ? kickPulse(t) : 0} />
      {CAMSHAFT_BANKS.map((ref) =>
        kind === "crank" && amount > 0.5 && isBankA(ref) ? null : (
          <group key={`cast${ref}`} rotation={[bankAngle(ref), 0, 0]}>
            <BankCasting spec={CASTING} x={(cylX(ref) + cylX(ref + 3)) / 2} length={BLOCK_LENGTH} showHead={topVisible} />
          </group>
        ),
      )}
      {/* the chamber that is firing lights up the castings around it */}
      {firing ? <pointLight position={firing.position} color={C.warm} intensity={firing.power * (closeUpShot ? 2.5 : 9)} distance={5} decay={1.5} /> : null}
      <Headers tubes={tubes} ghost={(i) => (kind === "strokes" || kind === "head" || kind === "air" ? amount : i < BANK_A_HEADERS ? ghost : 0)} glow={glow} dim={dims.headers * amount} />
      {isSlowed(t) && kind === "none"
        ? CYLS.map((cyl, i) => {
            const c = cycleAt(cyl, t);
            return <ExhaustPulse key={cyl} curve={curves[i]} head={c >= EXHAUST_VALVE.open && c < 420 ? (c - EXHAUST_VALVE.open) / 240 : -1} seed={cyl + frame} />;
          })
        : null}
      <DimContext.Provider value={dims.headers * amount}>
        {[1, -1].map((side) => (
          <group key={side}>
            <mesh position={[3.65, 0.3, side * 2.9]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.3, 0.42, 1.1, 10]} />
              <meshLambertMaterial color="#8a4a2a" emissive="#ff3a10" emissiveIntensity={glow * 0.6 * (1 - dims.headers * amount)} flatShading />
            </mesh>
            <mesh geometry={tailPipes[side]}>
              <meshLambertMaterial color={C.header} emissive="#ff3a10" emissiveIntensity={glow * 0.7 * (1 - dims.headers * amount)} flatShading />
            </mesh>
          </group>
        ))}
        <group position={[0.6, -0.42, -2.1]} visible={ghost < 0.5}>
          <AirBottle radius={BOTTLE_R} length={BOTTLE_L} />
        </group>
      </DimContext.Provider>
      <DimContext.Provider value={Math.max(dims.crank, dims.piston) * amount}>
        <F1Block length={BLOCK_LENGTH} bottom={-0.585} clutchX={BLOCK_LENGTH / 2 + 0.2} spin={crankRad} showSump={ghost < 0.5} />
      </DimContext.Provider>
    </group>
  );
};

/** Hydraulic ram that lifts the engine out of the car, from below so it never blocks the camera. */
const LiftRam: React.FC<{ origin: THREE.Vector3; amount: number }> = ({ origin, amount }) => {
  if (amount <= 0) return null;
  const floorY = 0.8;
  const top = origin.y - 0.6;
  const stage = (top - floorY) / 2;
  return (
    <>
      <mesh position={[origin.x, floorY + stage / 2, 0]}>
        <cylinderGeometry args={[0.8, 0.8, stage, 12]} />
        <meshLambertMaterial color="#5a5f8e" flatShading />
      </mesh>
      <mesh position={[origin.x, floorY + stage * 1.5, 0]}>
        <cylinderGeometry args={[0.5, 0.5, stage, 12]} />
        <meshLambertMaterial color="#c4c8e4" flatShading />
      </mesh>
    </>
  );
};

/** A ring that races across the ground on each kick at real speed: the bass, made visible. */
const BassRing: React.FC<{ pulse: number; x: number; z: number }> = ({ pulse, x, z }) => {
  if (pulse < 0.04) return null;
  const r = 14 + (1 - pulse) * 40;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.1, z]}>
      <ringGeometry args={[r, r + 0.9, 48]} />
      <meshBasicMaterial color="#35e0ff" transparent opacity={pulse * 0.75} depthWrite={false} />
    </mesh>
  );
};

/** Tyre smoke from the launch, and sparks from the floor on each kick once the car is at pace. All in the car's frame. */
const LaunchFx: React.FC<{ age: number; kick: number; frame: number; speed: number }> = ({ age, kick, frame, speed }) => {
  const smoke = age < 1.6 ? 1 - age / 1.6 : 0;
  return (
    <>
      {smoke > 0
        ? Array.from({ length: 22 }, (_, i) => {
            const side = i % 2 === 0 ? 1 : -1;
            const drift = (((frame * 0.11 + hash(i, 4)) % 1) + 1) % 1;
            const s = (2.4 + drift * 5) * smoke;
            return (
              <mesh key={i} position={[19 + drift * 22, 1.2 + drift * 6 * hash(i, 5), side * (7.5 + (hash(i, 6) - 0.5) * 6)]}>
                <boxGeometry args={[s, s, s]} />
                <meshBasicMaterial color={i % 3 === 0 ? "#f2f2fa" : "#b9bddc"} transparent opacity={0.8 * smoke * (1 - drift)} depthWrite={false} />
              </mesh>
            );
          })
        : null}
      {speed > 150 && kick > 0.15
        ? Array.from({ length: 12 }, (_, i) => {
            const a = hash(i, frame);
            return (
              <mesh key={i} position={[10 + a * 22, 0.25 + hash(i, frame + 1) * 1.6, (hash(frame, i) - 0.5) * 9]}>
                <boxGeometry args={[2.2, 0.22, 0.22]} />
                <meshBasicMaterial color={i % 2 === 0 ? C.hot : C.warm} />
              </mesh>
            );
          })
        : null}
    </>
  );
};

/** The crew working on the car during the hook, on its far side, bobbing with the song. */
const CREW: [number, number, number, string][] = [
  [-13, -13, Math.PI / 2, "#e5354b"],
  [8, -14, Math.PI / 2, "#e5354b"],
  [-22, -9.5, Math.PI / 3, "#c9cce4"],
  [18, -12.5, Math.PI / 2, "#c9cce4"],
  [27, 5, Math.PI, "#e5354b"],
];
const PitCrew: React.FC<{ kick: number; stab: number }> = ({ kick, stab }) => (
  <>
    {CREW.map(([x, z, face, suit], i) => (
      <Mechanic key={i} x={x} z={z} face={face} suit={suit} work={i % 2 === 0 ? kick : stab} seed={i + 1} />
    ))}
  </>
);

const GRID_BOXES = Array.from({ length: GRID_SLOTS }, (_, p) => gridSlot(p));

export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const kick = kickPulse(t);
  const stab = stabPulse(t);
  const growl = growlPulse(t);
  const land = landingPulse(t);
  const origin = engineOrigin(t);
  const realSpeed = !isSlowed(t);
  const flame = realSpeed ? Math.max(stab, ((rpmAt(t) / REDLINE) ** 2) * Math.max(kick, growl * 0.75)) : 0;
  const onTrack = t >= TRACK_FROM;
  const studio = STUDIO(t);
  const showField = t >= DROP;
  const s = heroS(t);
  const speed = heroV(t);
  const anchorX = cameraAt(t).pos.x;
  const wheelSpin = -s / 3.4;
  const rivals = showField
    ? GRID_BOXES.slice(1).map((b, i) => ({ x: b.x - rivalS(i + 1, t), z: b.z, slot: i + 1 }))
    : [];
  const marks = showField ? [1, -1].map((side) => ({ x: 15.3, z: HERO_Z + side * 7.5, len: Math.min(s, 95) })) : [];
  return (
    <PixelStage t={t} cameraAt={cameraAt} pixelSize={2} normalEdge={0.8} depthEdge={1.1}>
      {/* Extra fill and a cool rim light, so dark parts separate from the dark background. */}
      <hemisphereLight args={["#ffffff", "#5c62a0", 0.6]} />
      <directionalLight position={[45, 30, 34]} intensity={0.9} color="#fff4e0" />
      <directionalLight position={[-34, 22, -44]} intensity={0.75} color="#a8dcff" />
      {studio ? (
        <BlueprintRoom centre={origin} pulse={kick} />
      ) : onTrack ? (
        <StartGrid anchorX={anchorX} lightsOn={lightsOnAt(t)} pulse={Math.max(kick, land)} boxes={GRID_BOXES.map((b) => ({ x: b.x, z: b.z }))} rivals={rivals} showField={showField} speed={speed} wheelSpin={wheelSpin} marks={marks} t={t} heroX={-s} heroZ={HERO_Z} />
      ) : (
        <>
          <Garage t={t} pulse={Math.max(kick, stab)} />
          {t < barT(2) ? <PitCrew kick={kick} stab={stab} /> : null}
        </>
      )}
      {realSpeed ? <BassRing pulse={kick} x={onTrack ? -s : 3} z={onTrack ? HERO_Z : 0} /> : null}
      {studio ? null : (
        <group position={onTrack ? [-s, heroDropY(t), HERO_Z] : [0, 0, 0]}>
          <OpenWheeler coverLift={coverLiftAt(t)} pulse={Math.max(kick, stab, land)} squat={Math.max(kick * (t < barT(2) ? 0.3 : 0.12), land * 0.55)} flame={flame * 1.6} wheelSpin={wheelSpin} />
          {showField ? <LaunchFx age={t - DROP} kick={kick} frame={frame} speed={speed} /> : null}
        </group>
      )}
      {onTrack ? null : <Engine t={t} frame={frame} origin={origin} />}
      {onTrack || studio ? null : <LiftRam origin={new THREE.Vector3(ENGINE_X, origin.y, 0)} amount={liftAt(t) / LIFT} />}
    </PixelStage>
  );
};

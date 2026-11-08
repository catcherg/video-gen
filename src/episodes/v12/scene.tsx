import { useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { D2R, hash } from "../../core/math";
import { PixelStage } from "../../core/PixelStage";
import { BlockShell, CoilPack, DeckFrame } from "../../parts/BlockShell";
import { Ground } from "../../parts/cars/common";
import { WedgeSupercar } from "../../parts/cars/WedgeSupercar";
import { Crankshaft } from "../../parts/Crankshaft";
import { Headers, headerTube } from "../../parts/Headers";
import { CombustionFlash, crankPinInBank, PistonRod } from "../../parts/PistonRod";
import { CamLobes, CamShaft, Valves, valveBump } from "../../parts/ValveTrain";
import {
  bankAngle,
  CAM_DIST,
  coverAngleAt,
  CRANK_R,
  CYL_SPACING,
  cylX,
  DECK,
  engineOrigin,
  PIN_TO_CROWN,
  PISTON_H,
  PISTON_R,
  wristDist,
} from "./geometry";
import { CRANK_PINS, cycleAt, CYLINDERS, FIRING_ORDER, isRightBank, isSlowed } from "./physics";
import { cameraAt, headerGhost } from "./timeline";

const CYLS = [...FIRING_ORDER].sort((a, b) => a - b);

// Valve timing (cycle degrees).
const EXHAUST = { open: 150, close: 390, peak: 270 };
const INTAKE = { open: 330, close: 590, peak: 460 };
const VALVE_LIFT = 0.22;

const Cylinder: React.FC<{ cyl: number; t: number; frame: number }> = ({ cyl, t, frame }) => {
  const c = cycleAt(cyl, t);
  const cm = c % 360;
  const w = wristDist(cm);
  const crown = w + PIN_TO_CROWN;
  const inner = isRightBank(cyl) ? 1 : -1;

  // Slowed: the flash follows the real firing. Real speed: too fast to see, so a seeded flicker.
  const slowed = isSlowed(t);
  const heat = slowed ? (c < 110 ? 1 - c / 110 : 0) : 0.45 + 0.55 * hash(frame, cyl);
  const flashAge = slowed ? c / 80 : hash(cyl * 3, frame) * 0.9;

  return (
    <group position={[cylX(cyl), 0, 0]} rotation={[bankAngle(cyl), 0, 0]}>
      <PistonRod crown={crown} wrist={w} pin={crankPinInBank(cm, CRANK_R)} radius={PISTON_R} height={PISTON_H} heat={heat} />
      <DeckFrame deck={DECK} spacing={CYL_SPACING} boreR={PISTON_R} />
      {/* 4 valves: intake pair on the V side, exhaust pair outside */}
      <Valves
        deck={DECK}
        rows={[
          { side: inner, lift: valveBump(c, INTAKE.open, INTAKE.close) * VALVE_LIFT },
          { side: -inner, lift: valveBump(c, EXHAUST.open, EXHAUST.close) * VALVE_LIFT },
        ]}
      />
      <CamLobes
        camDist={CAM_DIST}
        c={c}
        rows={[
          { side: inner, peak: INTAKE.peak },
          { side: -inner, peak: EXHAUST.peak },
        ]}
      />
      <CoilPack y={CAM_DIST + 0.36} />
      <CombustionFlash crown={crown} age={flashAge} seed={cyl} />
    </group>
  );
};

const headerTubes = () =>
  CYLS.map((cyl) => {
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
    return headerTube([port, p1, p2, p3, p4]);
  });

const CAMSHAFT_BANKS = [1, 7];
const RIGHT_BANK_HEADERS = CYLINDERS / 2;

const Engine: React.FC<{ t: number; frame: number; origin: THREE.Vector3 }> = ({ t, frame, origin }) => {
  const tubes = useMemo(headerTubes, []);
  const pins = CRANK_PINS.map(([right, left]) => ({
    x: (cylX(right) + cylX(left)) / 2,
    alpha: bankAngle(right) + (cycleAt(right, t) % 360) * D2R,
  }));
  const ghost = headerGhost(t);
  return (
    <group position={origin}>
      <Crankshaft pins={pins} throwR={CRANK_R} length={7.6} />
      {CYLS.map((cyl) => (
        <Cylinder key={cyl} cyl={cyl} t={t} frame={frame} />
      ))}
      {CAMSHAFT_BANKS.map((ref) =>
        [1, -1].map((side) => (
          <group key={`${ref}${side}`} rotation={[bankAngle(ref), 0, 0]}>
            <CamShaft x={(cylX(ref) + cylX(ref + 5)) / 2} camDist={CAM_DIST} side={side} length={6.9} />
          </group>
        )),
      )}
      <Headers tubes={tubes} ghost={(i) => (i < RIGHT_BANK_HEADERS ? ghost : 0)} />
      <BlockShell showPan={ghost < 0.5} />
    </group>
  );
};

export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <PixelStage t={t} cameraAt={cameraAt}>
      <group>
        <Ground />
        <WedgeSupercar coverAngle={coverAngleAt(t)} />
      </group>
      <Engine t={t} frame={frame} origin={engineOrigin(t)} />
    </PixelStage>
  );
};

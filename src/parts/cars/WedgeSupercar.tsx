import { useMemo } from "react";
import * as THREE from "three";
import { C } from "../../core/theme";
import { Box, extrude, Wheel } from "./common";

// Generic low-poly mid-engine wedge: an open engine bay under a split cover that hinges at its
// outer edges, so the cover folds out of the camera's way. No badges or brand marks.

const FRONT_ARCH_X = -15.5;
const REAR_ARCH_X = 14.5;
const ARCH_R = 4.3;
const WHEEL_CENTRE_Y = 3.4;
const SILL = 1.3;
const a0 = Math.asin((SILL - WHEEL_CENTRE_Y) / ARCH_R);
const archDx = ARCH_R * Math.cos(a0);

const BAY = { front: 8.2, rear: 22.6, floor: 2.6, halfWidth: 6.8 };

/** Full side profile with both wheel arches. Used for the outer side sections. */
const fullProfile = () => {
  const s = new THREE.Shape();
  s.moveTo(-23.6, 1.2);
  s.lineTo(-24.3, 2.7);
  s.lineTo(-21, 3.7);
  s.lineTo(-10, 5.7);
  s.lineTo(-6.2, 6.5);
  s.lineTo(8, 7.6);
  s.lineTo(23.2, 7.9);
  s.lineTo(24.6, 7.0);
  s.lineTo(24.6, 2.6);
  s.lineTo(22.6, SILL);
  s.lineTo(REAR_ARCH_X + archDx, SILL);
  s.absarc(REAR_ARCH_X, WHEEL_CENTRE_Y, ARCH_R, a0, Math.PI - a0, false);
  s.lineTo(FRONT_ARCH_X + archDx, SILL);
  s.absarc(FRONT_ARCH_X, WHEEL_CENTRE_Y, ARCH_R, a0, Math.PI - a0, false);
  s.lineTo(-23.6, 1.2);
  return s;
};

/** Centre section with the engine bay cut out of it. */
const centreProfile = () => {
  const s = new THREE.Shape();
  s.moveTo(-23.6, 1.2);
  s.lineTo(-24.3, 2.7);
  s.lineTo(-21, 3.7);
  s.lineTo(-10, 5.7);
  s.lineTo(-6.2, 6.5);
  s.lineTo(BAY.front, 7.6);
  s.lineTo(BAY.front, BAY.floor);
  s.lineTo(BAY.rear, BAY.floor);
  s.lineTo(BAY.rear, 7.85);
  s.lineTo(23.2, 7.9);
  s.lineTo(24.6, 7.0);
  s.lineTo(24.6, 2.6);
  s.lineTo(22.6, SILL);
  s.lineTo(FRONT_ARCH_X + archDx, SILL);
  s.absarc(FRONT_ARCH_X, WHEEL_CENTRE_Y, ARCH_R, a0, Math.PI - a0, false);
  s.lineTo(-23.6, 1.2);
  return s;
};

const greenhouse = () => {
  const s = new THREE.Shape();
  s.moveTo(-6.6, 6.3);
  s.lineTo(1.2, 10.6);
  s.lineTo(7.6, 10.8);
  s.lineTo(8.2, 10.4);
  s.lineTo(8.2, 7.4);
  s.lineTo(-6.6, 6.3);
  return s;
};

const roof = () => {
  const s = new THREE.Shape();
  s.moveTo(0.4, 10.2);
  s.lineTo(1.2, 10.68);
  s.lineTo(7.6, 10.88);
  s.lineTo(8.2, 10.48);
  s.lineTo(8.2, 10.0);
  s.lineTo(0.4, 10.2);
  return s;
};

const HINGE_Y = 8;
const COVER_WIDTH = BAY.halfWidth;
const coverShape = () => {
  const s = new THREE.Shape();
  s.moveTo(BAY.front, 10.4 - HINGE_Y);
  s.lineTo(BAY.rear, 7.85 - HINGE_Y);
  s.lineTo(BAY.rear, 7.35 - HINGE_Y);
  s.lineTo(BAY.front, 7.4 - HINGE_Y);
  s.lineTo(BAY.front, 10.4 - HINGE_Y);
  return s;
};

const COVER_SLOPE = (7.85 - 10.4) / (BAY.rear - BAY.front);
const coverTopAt = (x: number) => 10.4 - HINGE_Y + (x - BAY.front) * COVER_SLOPE;

/** One half of the engine cover, drawn from its outer hinge inward. */
const CoverHalf: React.FC<{ geometry: THREE.BufferGeometry; side: number; angle: number }> = ({ geometry, side, angle }) => (
  <group position={[0, HINGE_Y, side * COVER_WIDTH]} rotation={[side * angle, 0, 0]}>
    <mesh geometry={geometry} position={[0, 0, -side * (COVER_WIDTH / 2)]}>
      <meshLambertMaterial color={C.body} flatShading />
    </mesh>
    {[0, 1, 2].map((k) => {
      const x = 11.6 + k * 4.1;
      return <Box key={k} p={[x, coverTopAt(x) + 0.05, -side * (COVER_WIDTH / 2)]} s={[3.2, 0.12, COVER_WIDTH - 1.1]} c={C.glass} r={[0, 0, Math.atan(COVER_SLOPE)]} />;
    })}
    {/* dark lining on the inside face, which faces up once the cover is folded out */}
    <Box p={[(BAY.front + BAY.rear) / 2, -0.72, -side * (COVER_WIDTH / 2)]} s={[BAY.rear - BAY.front - 0.1, 0.08, COVER_WIDTH - 0.1]} c={C.trim} />
    {/* struts on the inside face */}
    {[0, 1].map((k) => (
      <Box key={k} p={[10 + k * 10, coverTopAt(10 + k * 10) - 0.75, -side * 0.5]} s={[0.4, 0.3, 0.7]} c={C.trim} />
    ))}
  </group>
);

const PANEL_LINES: [number, number, number][] = [
  // x, y, height of vertical seams on the bodyside
  [-9.5, 3.9, 3.4],
  [1, 4.1, 4.4],
  [7.8, 4.1, 5.4],
  [18.6, 5.2, 4.4],
];

export type WedgeSupercarProps = {
  /** Cover opening in radians. */
  coverAngle: number;
  /** Tail-light and underglow pulse, 0..1. */
  pulse?: number;
  /** Body squat, in units. */
  squat?: number;
  /** Exhaust flame size, 0..1. */
  flame?: number;
};

const FLAME_Y = 2.95;
const FLAME_Z = 3.6;

export const WedgeSupercar: React.FC<WedgeSupercarProps> = ({ coverAngle, pulse = 0, squat = 0, flame = 0 }) => {
  const geo = useMemo(
    () => ({
      side: extrude(fullProfile(), 3.2),
      centre: extrude(centreProfile(), BAY.halfWidth * 2),
      glass: extrude(greenhouse(), 14.6),
      roof: extrude(roof(), 10.5),
      cover: extrude(coverShape(), COVER_WIDTH),
    }),
    [],
  );
  const underglow = new THREE.Color(C.red).multiplyScalar(0.25 + pulse * 0.95);
  return (
    <group>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[46, 22]} />
        <meshBasicMaterial color={underglow} />
      </mesh>

      <group position={[0, -squat, 0]}>
        <mesh geometry={geo.centre}>
          <meshLambertMaterial color={C.body} flatShading />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={s} geometry={geo.side} position={[0, 0, s * 8.4]}>
            <meshLambertMaterial color={C.body} flatShading />
          </mesh>
        ))}
        <mesh geometry={geo.glass}>
          <meshLambertMaterial color={C.glass} flatShading />
        </mesh>
        <mesh geometry={geo.roof}>
          <meshLambertMaterial color={C.body} flatShading />
        </mesh>

        {/* engine bay lining */}
        <Box p={[15.4, BAY.floor + 0.05, 0]} s={[14.3, 0.1, BAY.halfWidth * 2 - 0.2]} c={C.trim} />
        {[1, -1].map((s) => (
          <Box key={s} p={[15.4, 5.2, s * (BAY.halfWidth - 0.08)]} s={[14.3, 5.2, 0.14]} c={C.trim} />
        ))}
        <Box p={[BAY.front + 0.08, 5.1, 0]} s={[0.14, 5, BAY.halfWidth * 2]} c={C.trim} />
        <Box p={[BAY.rear - 0.08, 5.2, 0]} s={[0.14, 5.2, BAY.halfWidth * 2]} c={C.trim} />

        <CoverHalf geometry={geo.cover} side={1} angle={coverAngle} />
        <CoverHalf geometry={geo.cover} side={-1} angle={coverAngle} />

        {[1, -1].map((s) => (
          <group key={s}>
            <Box p={[1, 4.6, s * 10.03]} s={[38, 0.45, 0.1]} c={C.red} />
            <Box p={[1, 4.1, s * 10.03]} s={[30, 0.18, 0.1]} c={C.trim} />
            <Box p={[6.2, 5.6, s * 10.02]} s={[5.2, 1.6, 0.1]} c={C.trim} r={[0, 0, -0.25]} />
            {/* side intake fins */}
            {[0, 1, 2, 3].map((k) => (
              <Box key={k} p={[4.4 + k * 1.2, 5.6 + k * 0.1 - 0.3, s * 10.06]} s={[0.18, 1.1, 0.1]} c={C.metalDark} />
            ))}
            {PANEL_LINES.map(([x, y, h]) => (
              <Box key={x} p={[x, y, s * 10.02]} s={[0.1, h, 0.06]} c={C.trim} />
            ))}
            {/* door handle, sill and rear haunch vents */}
            <Box p={[2.4, 6.5, s * 10.05]} s={[1.3, 0.22, 0.12]} c={C.metalDark} />
            <Box p={[1, 2.0, s * 10.06]} s={[24, 0.34, 0.12]} c={C.trim} />
            {[0, 1, 2].map((k) => (
              <Box key={`v${k}`} p={[20.4 + k * 0.9, 5.9, s * 10.04]} s={[0.4, 1.5, 0.08]} c={C.trim} />
            ))}
            {/* wiper */}
            <Box p={[-3, 8.4, s * 2.4]} s={[0.14, 0.1, 4.6]} c={C.coil} r={[0, 0.2 * s, 0]} />
            {/* mirror */}
            <Box p={[-1.5, 8.4, s * 9.2]} s={[1, 0.7, 1.5]} c={C.body} />
            <Box p={[-1.4, 8.1, s * 8.1]} s={[0.3, 0.2, 1]} c={C.trim} />
            {/* tail light with beat pulse */}
            <mesh position={[24.62, 5.6, s * 7]}>
              <boxGeometry args={[0.12, 0.7, 4.5]} />
              <meshBasicMaterial color={new THREE.Color(C.tail).multiplyScalar(0.55 + pulse * 0.7)} />
            </mesh>
            {/* headlight and running-light strip */}
            <Box p={[-23.7, 3.3, s * 6.5]} s={[1.5, 0.5, 4]} c={C.trim} r={[0, 0, 0.3]} />
            <mesh position={[-22.8, 3.75, s * 6.5]} rotation={[0, 0, 0.3]}>
              <boxGeometry args={[1.4, 0.16, 4.3]} />
              <meshBasicMaterial color={C.hot} />
            </mesh>
            <Box p={[21.5, 8.6, s * 7.6]} s={[0.4, 1.5, 0.4]} c={C.trim} />
            {/* exhaust tip, with flame */}
            <mesh position={[24.75, FLAME_Y, s * FLAME_Z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.65, 0.65, 0.5, 10]} />
              <meshLambertMaterial color={C.metalDark} flatShading />
            </mesh>
            {flame > 0.04 ? (
              <>
                <mesh position={[25.05 + flame * 1.6, FLAME_Y, s * FLAME_Z]} rotation={[0, 0, -Math.PI / 2]} scale={[flame, flame, flame]}>
                  <coneGeometry args={[0.72, 3.4, 7]} />
                  <meshBasicMaterial color={C.warm} />
                </mesh>
                <mesh position={[25.05 + flame * 0.9, FLAME_Y, s * FLAME_Z]} rotation={[0, 0, -Math.PI / 2]} scale={[flame, flame, flame]}>
                  <coneGeometry args={[0.42, 2, 7]} />
                  <meshBasicMaterial color={C.hot} />
                </mesh>
              </>
            ) : null}
          </group>
        ))}
        <Box p={[22.4, 9.5, 0]} s={[3.2, 0.3, 19]} c={C.trim} />
        <Box p={[24.2, 2.0, 0]} s={[1.0, 1.4, 15]} c={C.trim} />
        {/* diffuser fins */}
        {[-5, -2.5, 0, 2.5, 5].map((z) => (
          <Box key={z} p={[24.72, 1.8, z]} s={[0.5, 1.1, 0.16]} c={C.metalDark} />
        ))}
        <Box p={[-22.6, 1.8, 0]} s={[2.6, 1.0, 17]} c={C.trim} />
        {/* front splitter and hood vents */}
        <Box p={[-23.4, 1.25, 0]} s={[3.2, 0.2, 19.5]} c={C.trim} />
        {[1, -1].map((s) => (
          <Box key={s} p={[-14, 4.9, s * 3.4]} s={[4.5, 0.08, 3.4]} c={C.trim} r={[0, 0, 0.18]} />
        ))}
        {/* blank rear plate and upper grille */}
        <Box p={[24.66, 4.1, 0]} s={[0.08, 1.4, 4.8]} c={C.body} />
        {[0, 1, 2, 3, 4].map((k) => (
          <Box key={k} p={[24.64, 6.5 - k * 0.2, 0]} s={[0.08, 0.08, 8]} c={C.trim} />
        ))}
        {/* roof scoop */}
        <Box p={[6.4, 11.1, 0]} s={[2.6, 0.5, 3.2]} c={C.trim} />
      </group>

      <Wheel x={-15.5} z={9.3} />
      <Wheel x={-15.5} z={-9.3} />
      <Wheel x={14.5} z={9.3} />
      <Wheel x={14.5} z={-9.3} />
    </group>
  );
};

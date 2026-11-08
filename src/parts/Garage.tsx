import { useMemo } from "react";
import * as THREE from "three";
import { hash } from "../core/math";
import { C } from "../core/theme";
import { Box, Ground } from "./cars/common";

// A generic workshop around the car: tiled floor, ribbed walls, light strips, a lift and shop clutter.
// Props stay on the far side of the car from the camera so nothing blocks the view.

const FLOOR_SIZE = 240;
const WALL_X = 112;
const WALL_Z = 92;
const WALL_H = 62;

const tileTexture = () => {
  const n = 2;
  const data = new Uint8Array([40, 43, 78, 255, 26, 28, 56, 255, 26, 28, 56, 255, 40, 43, 78, 255]);
  const tex = new THREE.DataTexture(data, n, n);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(FLOOR_SIZE / 8, FLOOR_SIZE / 8);
  tex.needsUpdate = true;
  return tex;
};

const Wall: React.FC<{ along: "x" | "z"; at: number; length: number; pulse: number; accent: THREE.Color }> = ({ along, at, length, pulse, accent }) => {
  const ribs = Math.floor(length / 16);
  const isX = along === "x";
  const place = (u: number, y: number, inset = 0): [number, number, number] => (isX ? [u, y, at - Math.sign(at) * inset] : [at - Math.sign(at) * inset, y, u]);
  const size = (s: number, h: number, d: number): [number, number, number] => (isX ? [s, h, d] : [d, h, s]);
  return (
    <>
      <Box p={place(0, WALL_H / 2)} s={size(length, WALL_H, 0.5)} c="#1b1d38" />
      <Box p={place(0, 7, 0.4)} s={size(length, 14, 0.5)} c={C.trim} />
      {Array.from({ length: ribs + 1 }, (_, i) => (
        <Box key={i} p={place(-length / 2 + (i / ribs) * length, WALL_H / 2, 0.8)} s={size(1.1, WALL_H, 0.9)} c="#262848" />
      ))}
      <mesh position={place(0, 44, 1.2)}>
        <boxGeometry args={size(length * 0.92, 1, 0.3)} />
        <meshBasicMaterial color={accent} />
      </mesh>
      <mesh position={place(0, 26, 1.2)}>
        <boxGeometry args={size(length * 0.92, 0.5, 0.3)} />
        <meshBasicMaterial color={new THREE.Color("#7f88ff").multiplyScalar(0.45 + pulse * 0.6)} />
      </mesh>
    </>
  );
};

const TireStack: React.FC<{ x: number; z: number; count: number }> = ({ x, z, count }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <mesh key={i} position={[x, 1.25 + i * 2.5, z]}>
        <cylinderGeometry args={[3.2, 3.2, 2.4, 14]} />
        <meshLambertMaterial color={C.tyre} flatShading />
      </mesh>
    ))}
  </>
);

const Drum: React.FC<{ x: number; z: number; c: string }> = ({ x, z, c }) => (
  <>
    <mesh position={[x, 4.2, z]}>
      <cylinderGeometry args={[2.6, 2.6, 8.4, 12]} />
      <meshLambertMaterial color={c} flatShading />
    </mesh>
    <mesh position={[x, 8.5, z]}>
      <cylinderGeometry args={[2.7, 2.7, 0.2, 12]} />
      <meshLambertMaterial color={C.metalDark} flatShading />
    </mesh>
  </>
);

const ToolChest: React.FC<{ x: number; z: number }> = ({ x, z }) => (
  <>
    <Box p={[x, 6, z]} s={[14, 12, 6]} c={C.red} />
    {[0, 1, 2, 3].map((i) => (
      <Box key={i} p={[x, 2.4 + i * 2.5, z + Math.sign(-z) * 3.05]} s={[12.6, 1.7, 0.1]} c={C.tail} />
    ))}
    {[0, 1, 2, 3].map((i) => (
      <Box key={`h${i}`} p={[x, 2.4 + i * 2.5, z + Math.sign(-z) * 3.15]} s={[6, 0.3, 0.1]} c={C.metalLight} />
    ))}
    <Box p={[x - 3, 13.1, z]} s={[3, 2, 2.4]} c={C.warm} />
    <Box p={[x + 3.5, 12.6, z]} s={[4, 1, 2]} c={C.metalDark} />
  </>
);

const Workbench: React.FC<{ x: number; z: number }> = ({ x, z }) => (
  <>
    <Box p={[x, 8, z]} s={[6, 0.6, 26]} c={C.metalDark} />
    {[1, -1].flatMap((sz) =>
      [1, -1].map((sx) => <Box key={`${sz}${sx}`} p={[x + sx * 2.4, 4, z + sz * 12]} s={[0.6, 8, 0.6]} c={C.trim} />),
    )}
    {/* pegboard and hanging tools */}
    <Box p={[x - 3.4, 18, z]} s={[0.4, 16, 28]} c="#2c2f58" />
    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
      <Box key={i} p={[x - 3, 17 + (i % 2) * 3, z - 11 + i * 3.6]} s={[0.3, 4 + (i % 3), 0.7]} c={i % 3 === 0 ? C.red : C.metalLight} />
    ))}
    <Box p={[x, 9.3, z - 7]} s={[3, 2, 5]} c={C.header} />
    <Box p={[x, 9, z + 6]} s={[2.4, 1.2, 8]} c={C.metal} />
  </>
);

const Extinguisher: React.FC<{ x: number; z: number }> = ({ x, z }) => (
  <>
    <mesh position={[x, 2.6, z]}>
      <cylinderGeometry args={[0.9, 0.9, 5.2, 10]} />
      <meshLambertMaterial color={C.red} flatShading />
    </mesh>
    <Box p={[x, 5.6, z]} s={[0.5, 0.9, 0.5]} c={C.metalDark} />
  </>
);

const Lift: React.FC<{ x: number; z: number; pulse: number }> = ({ x, z, pulse }) => (
  <>
    <Box p={[x, 11, z]} s={[2.4, 22, 2.4]} c={C.warm} />
    <Box p={[x, 0.4, z]} s={[6, 0.8, 6]} c={C.metalDark} />
    <mesh position={[x, 22.4, z]}>
      <boxGeometry args={[3, 0.5, 3]} />
      <meshBasicMaterial color={new THREE.Color(C.hot).multiplyScalar(0.4 + pulse * 0.8)} />
    </mesh>
  </>
);

const NeonZigzag: React.FC<{ x: number; z: number; rotY: number; color: THREE.Color }> = ({ x, z, rotY, color }) => (
  <group position={[x, 34, z]} rotation={[0, rotY, 0]}>
    {Array.from({ length: 9 }, (_, i) => (
      <mesh key={i} position={[(i - 4) * 5, 0, 0]} rotation={[0, 0, i % 2 === 0 ? 0.9 : -0.9]}>
        <boxGeometry args={[0.6, 7.6, 0.4]} />
        <meshBasicMaterial color={color} />
      </mesh>
    ))}
  </group>
);

const Dust: React.FC<{ t: number }> = ({ t }) => (
  <>
    {Array.from({ length: 46 }, (_, i) => {
      // Kept on the far side of the car, where the camera never goes.
      const x = -24 - hash(i, 1) * 80 + Math.sin(t * 0.3 + i) * 2;
      const y = 3 + hash(i, 2) * 34 + Math.sin(t * 0.45 + i * 2) * 1.5;
      const z = (hash(i, 3) - 0.5) * 110 + Math.cos(t * 0.25 + i) * 2;
      return (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshBasicMaterial color="#8f96d8" />
        </mesh>
      );
    })}
  </>
);

/** `pulse` is the current beat, 0..1. */
export const Garage: React.FC<{ t: number; pulse: number }> = ({ t, pulse }) => {
  const floorMap = useMemo(tileTexture, []);
  const accent = new THREE.Color(C.red).multiplyScalar(0.5 + pulse * 0.85);
  const neon = new THREE.Color("#35e0ff").multiplyScalar(0.5 + pulse * 0.8);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <meshLambertMaterial map={floorMap} />
      </mesh>
      <Ground floor={false} />
      <Wall along="x" at={-WALL_Z} length={WALL_X * 2} pulse={pulse} accent={accent} />
      <Wall along="x" at={WALL_Z} length={WALL_X * 2} pulse={pulse} accent={accent} />
      <Wall along="z" at={-WALL_X} length={WALL_Z * 2} pulse={pulse} accent={accent} />
      <Wall along="z" at={WALL_X} length={WALL_Z * 2} pulse={pulse} accent={accent} />
      <NeonZigzag x={-108} z={0} rotY={Math.PI / 2} color={neon} />
      <NeonZigzag x={0} z={-88} rotY={0} color={neon} />
      {/* parking lines around the car */}
      {[1, -1].map((s) => (
        <Box key={s} p={[0, 0.06, s * 16]} s={[60, 0.04, 0.5]} c={C.hot} />
      ))}
      <Lift x={-34} z={-24} pulse={pulse} />
      <Lift x={-34} z={24} pulse={pulse} />
      <TireStack x={-58} z={-46} count={4} />
      <TireStack x={-66} z={-38} count={3} />
      <TireStack x={-74} z={40} count={5} />
      <Drum x={-92} z={-70} c={C.header} />
      <Drum x={-85} z={-74} c={C.valley} />
      <Drum x={-96} z={62} c={C.metal} />
      <ToolChest x={-40} z={-82} />
      <ToolChest x={-92} z={-30} />
      <Workbench x={-100} z={22} />
      <Extinguisher x={-78} z={-82} />
      <Dust t={t} />
    </>
  );
};

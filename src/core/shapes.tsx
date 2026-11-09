// Parametric 3D building blocks for any subject. Use them inside <PixelStage>. Each is a pure function of its props.
import { useMemo } from "react";
import * as THREE from "three";
import type { V3 } from "./camera";
import { Lam } from "./Lam";
import { hash } from "./math";
import { usePalette } from "./palette";

type Solid = { position?: V3; rotation?: V3; color: string; glow?: number };

/** Glow uses the part's own colour, and fades with the rest of the part. */
const Mat: React.FC<{ color: string; glow?: number }> = ({ color, glow }) => <Lam c={color} e={glow ? color : undefined} ei={glow} />;

export const Block: React.FC<Solid & { size: V3 }> = ({ size, color, glow, ...place }) => (
  <mesh {...place}>
    <boxGeometry args={size} />
    <Mat color={color} glow={glow} />
  </mesh>
);

export const Ball: React.FC<Solid & { radius: number; detail?: number }> = ({ radius, detail = 14, color, glow, ...place }) => (
  <mesh {...place}>
    <sphereGeometry args={[radius, detail, Math.max(6, Math.round(detail * 0.7))]} />
    <Mat color={color} glow={glow} />
  </mesh>
);

export const Cone: React.FC<Solid & { radius: number; height: number; sides?: number }> = ({ radius, height, sides = 12, color, glow, ...place }) => (
  <mesh {...place}>
    <coneGeometry args={[radius, height, sides]} />
    <Mat color={color} glow={glow} />
  </mesh>
);

export const Ring: React.FC<Solid & { radius: number; tube: number }> = ({ radius, tube, color, glow, ...place }) => (
  <mesh {...place}>
    <torusGeometry args={[radius, tube, 8, 32]} />
    <Mat color={color} glow={glow} />
  </mesh>
);

const UP = new THREE.Vector3(0, 1, 0);

/** Placement of something along +Y so that it spans two points. */
const spanning = (from: V3, to: V3) => {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const direction = b.clone().sub(a);
  const length = direction.length();
  return { centre: a.add(b).multiplyScalar(0.5), length, quaternion: new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize()) };
};

/** A straight bar between two points. */
export const Bar: React.FC<{ from: V3; to: V3; radius: number; color: string; glow?: number; sides?: number }> = ({ from, to, radius, color, glow, sides = 10 }) => {
  const { centre, length, quaternion } = spanning(from, to);
  return (
    <mesh position={centre} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, sides]} />
      <Mat color={color} glow={glow} />
    </mesh>
  );
};

/** An arrow from one point to another, with its head ending at `to`. */
export const Arrow3D: React.FC<{ from: V3; to: V3; radius: number; color: string; glow?: number }> = ({ from, to, radius, color, glow }) => {
  const { centre, length, quaternion } = spanning(from, to);
  const head = Math.min(radius * 6, length * 0.5);
  const shaft = length - head;
  return (
    <group position={centre} quaternion={quaternion}>
      <mesh position={[0, -head / 2, 0]}>
        <cylinderGeometry args={[radius, radius, shaft, 8]} />
        <Mat color={color} glow={glow} />
      </mesh>
      <mesh position={[0, shaft / 2, 0]}>
        <coneGeometry args={[radius * 2.6, head, 8]} />
        <Mat color={color} glow={glow} />
      </mesh>
    </group>
  );
};

/** A smooth tube through a list of points. */
export const Tube: React.FC<{ points: V3[]; radius: number; color: string; glow?: number; segments?: number }> = ({ points, radius, color, glow, segments = 48 }) => {
  const geometry = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), segments, radius, 8, false), [points, radius, segments]);
  return (
    <mesh geometry={geometry}>
      <Mat color={color} glow={glow} />
    </mesh>
  );
};

/** The video's floor, coloured by its palette. */
export const Floor: React.FC<{ size?: number; y?: number }> = ({ size = 400, y = 0 }) => {
  const { floor } = usePalette();
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <planeGeometry args={[size, size]} />
      <meshLambertMaterial color={floor} />
    </mesh>
  );
};

const wrap = (v: number, size: number) => ((v % size) + size) % size;

/**
 * A seeded cloud of small cubes drifting through a box and wrapping at its edges.
 * Positions depend only on the seed and t, so any frame is the same when rendered alone.
 */
export const Particles: React.FC<{
  t: number;
  count: number;
  seed: number;
  /** Corner of the box nearest the origin, and its size along each axis. */
  origin: V3;
  box: V3;
  velocity?: V3;
  size?: number;
  colors: string[];
  glow?: number;
}> = ({ t, count, seed, origin, box, velocity = [0, 0, 0], size = 0.3, colors, glow }) => (
  <>
    {Array.from({ length: count }, (_, i) => {
      const axis = (k: number) => origin[k] + wrap(hash(i + 1, seed + k) * box[k] + velocity[k] * t, box[k]);
      return <Block key={i} position={[axis(0), axis(1), axis(2)]} size={[size, size, size]} color={colors[i % colors.length]} glow={glow} />;
    })}
  </>
);

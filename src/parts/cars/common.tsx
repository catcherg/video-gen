import * as THREE from "three";
import { C } from "../../core/theme";

// Shared low-poly car pieces. Units: 1 = 10 cm. Keep bodies generic: no badges or brand marks.

export type XY = [number, number];
export type XYZ = [number, number, number];

export const WHEEL_R = 3.4;

export const extrude = (shape: THREE.Shape, depth: number) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
};

/** A closed side profile from a list of (x, y) points. */
export const profile = (points: XY[]) => {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.lineTo(points[0][0], points[0][1]);
  return s;
};

export const Box: React.FC<{ p: XYZ; s: XYZ; c: string; r?: XYZ }> = ({ p, s, c, r }) => (
  <mesh position={p} rotation={r}>
    <boxGeometry args={s} />
    <meshLambertMaterial color={c} flatShading />
  </mesh>
);

export const Wheel: React.FC<{ x: number; z: number }> = ({ x, z }) => {
  const out = Math.sign(z);
  return (
    <group position={[x, WHEEL_R, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[WHEEL_R, WHEEL_R, 2.7, 18]} />
        <meshLambertMaterial color={C.tyre} flatShading />
      </mesh>
      <mesh position={[0, out * 1.38, 0]}>
        <cylinderGeometry args={[2.45, 2.45, 0.1, 12]} />
        <meshLambertMaterial color={C.rim} flatShading />
      </mesh>
      {[0, 1, 2, 3, 4].map((k) => (
        <mesh key={k} position={[0, out * 1.45, 0]} rotation={[0, (k * Math.PI * 2) / 5, 0]}>
          <boxGeometry args={[0.55, 0.08, 4.6]} />
          <meshLambertMaterial color={C.trim} flatShading />
        </mesh>
      ))}
      <mesh position={[0, out * 1.5, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 0.1, 10]} />
        <meshLambertMaterial color={C.metalLight} flatShading />
      </mesh>
      {/* brake disc and caliper, seen through the spokes */}
      <mesh position={[0, out * 1.1, 0]}>
        <cylinderGeometry args={[2.1, 2.1, 0.12, 16]} />
        <meshLambertMaterial color={C.metal} flatShading />
      </mesh>
      <mesh position={[1.25, out * 1.12, 0.3]}>
        <boxGeometry args={[1.3, 0.5, 1.7]} />
        <meshLambertMaterial color={C.red} flatShading />
      </mesh>
    </group>
  );
};

/** Studio floor and a soft rectangular shadow under the car. */
export const Ground: React.FC<{ shadow?: [number, number]; floor?: boolean }> = ({ shadow = [54, 24], floor = true }) => (
  <>
    {floor ? (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshLambertMaterial color={C.floor} />
      </mesh>
    ) : null}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <planeGeometry args={shadow} />
      <meshBasicMaterial color={C.shadow} />
    </mesh>
  </>
);

/** Adds a wheel arch of radius r around (cx, WHEEL_R) to a shape drawn right-to-left along the sill. */
export const wheelArch = (s: THREE.Shape, cx: number, r: number, sill: number) => {
  const a0 = Math.asin((sill - WHEEL_R) / r);
  s.lineTo(cx + r * Math.cos(a0), sill);
  s.absarc(cx, WHEEL_R, r, a0, Math.PI - a0, false);
};

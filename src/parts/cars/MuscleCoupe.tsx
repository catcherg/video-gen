import { useMemo } from "react";
import * as THREE from "three";
import { C } from "../../core/theme";
import { Box, extrude, profile, Wheel, wheelArch } from "./common";

// Generic low-poly front-engine coupe (nose at -x) with a hood hinged at the windscreen.

const SILL = 1.5;
const ARCH_R = 4.3;
const REAR_WHEEL_X = 14.5;
const FRONT_WHEEL_X = -15;

const lowerBody = () => {
  const s = new THREE.Shape();
  const top: [number, number][] = [
    [-24, SILL],
    [-24.6, 3.0],
    [-24.2, 7.2],
    [-8, 8.1],
    [10, 8.1],
    [23.4, 8.5],
    [24.2, 7.6],
    [24.2, 3.0],
    [23, SILL],
  ];
  top.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  wheelArch(s, REAR_WHEEL_X, ARCH_R, SILL);
  wheelArch(s, FRONT_WHEEL_X, ARCH_R, SILL);
  s.lineTo(-24, SILL);
  return s;
};

const greenhouseShape = profile([
  [-5.5, 8],
  [2, 12.1],
  [10.5, 12.1],
  [18.5, 8.3],
]);

/** Hood outline relative to its hinge, so it can rotate open. */
const HOOD_HINGE: [number, number] = [-7.5, 8.15];
const hoodShape = profile([
  [-16.4, -0.85],
  [0, 0],
  [0, 0.25],
  [-16.2, -0.55],
]);

/** `hoodAngle` in radians: 0 is closed, positive lifts the front edge. */
export const MuscleCoupe: React.FC<{ hoodAngle?: number }> = ({ hoodAngle = 0 }) => {
  const geo = useMemo(() => ({ lower: extrude(lowerBody(), 19.6), glass: extrude(greenhouseShape, 15), hood: extrude(hoodShape, 15.5) }), []);
  return (
    <group>
      <mesh geometry={geo.lower}>
        <meshLambertMaterial color={C.red} flatShading />
      </mesh>
      <mesh geometry={geo.glass}>
        <meshLambertMaterial color={C.glass} flatShading />
      </mesh>
      <Box p={[6.5, 12.15, 0]} s={[8.6, 0.25, 13.5]} c={C.red} />
      <group position={[HOOD_HINGE[0], HOOD_HINGE[1], 0]} rotation={[0, 0, -hoodAngle]}>
        <mesh geometry={geo.hood}>
          <meshLambertMaterial color={C.red} flatShading />
        </mesh>
      </group>
      {/* twin stripes, grille, lights, bumpers */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Box p={[-24.65, 6, s * 6.8]} s={[0.12, 1.4, 3.6]} c={C.hot} />
          <Box p={[24.25, 6.6, s * 6.5]} s={[0.12, 0.9, 4.6]} c={C.tail} />
          <Box p={[0, 5.2, s * 9.83]} s={[30, 0.3, 0.1]} c={C.body} />
        </group>
      ))}
      <Box p={[-24.65, 6, 0]} s={[0.1, 1.4, 9]} c={C.trim} />
      <Box p={[-24.6, 2.4, 0]} s={[1.4, 0.9, 19]} c={C.metal} />
      <Box p={[24.1, 2.6, 0]} s={[1.2, 0.9, 19]} c={C.metal} />

      <Wheel x={FRONT_WHEEL_X} z={9.1} />
      <Wheel x={FRONT_WHEEL_X} z={-9.1} />
      <Wheel x={REAR_WHEEL_X} z={9.1} />
      <Wheel x={REAR_WHEEL_X} z={-9.1} />
    </group>
  );
};

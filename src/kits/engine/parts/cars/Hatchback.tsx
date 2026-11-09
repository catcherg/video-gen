import { useMemo } from "react";
import * as THREE from "three";
import { C } from "../../theme";
import { Box, extrude, profile, Wheel, wheelArch } from "./common";

// Generic low-poly front-drive hatchback (nose at -x).

const SILL = 1.4;
const ARCH_R = 4.1;
const REAR_WHEEL_X = 12.5;
const FRONT_WHEEL_X = -12.5;

const lowerBody = () => {
  const s = new THREE.Shape();
  const top: [number, number][] = [
    [-19.2, SILL],
    [-20, 3],
    [-19.6, 7.2],
    [-9.5, 9],
    [19, 9],
    [20, 7.8],
    [20, 3],
    [19, SILL],
  ];
  top.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  wheelArch(s, REAR_WHEEL_X, ARCH_R, SILL);
  wheelArch(s, FRONT_WHEEL_X, ARCH_R, SILL);
  s.lineTo(-19.2, SILL);
  return s;
};

const greenhouseShape = profile([
  [-9, 8.8],
  [-2, 14.2],
  [14, 14.2],
  [19.4, 8.8],
]);

export const Hatchback: React.FC = () => {
  const geo = useMemo(() => ({ lower: extrude(lowerBody(), 17.6), glass: extrude(greenhouseShape, 15) }), []);
  return (
    <group>
      <mesh geometry={geo.lower}>
        <meshLambertMaterial color={C.warm} flatShading />
      </mesh>
      <mesh geometry={geo.glass}>
        <meshLambertMaterial color={C.glass} flatShading />
      </mesh>
      <Box p={[6, 14.3, 0]} s={[16, 0.3, 14.4]} c={C.warm} />
      {[1, -1].map((s) => (
        <group key={s}>
          <Box p={[-20.05, 6.2, s * 6]} s={[0.12, 1.3, 3.6]} c={C.hot} />
          <Box p={[20.05, 7, s * 6.4]} s={[0.12, 1.6, 2.6]} c={C.tail} />
          <Box p={[3, 2.2, s * 8.83]} s={[20, 0.5, 0.1]} c={C.trim} />
        </group>
      ))}
      <Box p={[-20.05, 3.4, 0]} s={[0.1, 1.2, 12]} c={C.trim} />

      <Wheel x={FRONT_WHEEL_X} z={8} />
      <Wheel x={FRONT_WHEEL_X} z={-8} />
      <Wheel x={REAR_WHEEL_X} z={8} />
      <Wheel x={REAR_WHEEL_X} z={-8} />
    </group>
  );
};

import { useMemo } from "react";
import * as THREE from "three";
import { C } from "../../core/theme";
import { Box, extrude, Wheel } from "./common";

// Generic low-poly mid-engine wedge with an engine cover hinged at the tail.

const lowerBody = () => {
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
  s.lineTo(22.6, 1.3);
  // wheel arches: arcs of radius 4.3 around each wheel centre (y=3.4)
  const a0 = Math.asin((1.3 - 3.4) / 4.3);
  const dx = 4.3 * Math.cos(a0);
  s.lineTo(14.5 + dx, 1.3);
  s.absarc(14.5, 3.4, 4.3, a0, Math.PI - a0, false);
  s.lineTo(-15.5 + dx, 1.3);
  s.absarc(-15.5, 3.4, 4.3, a0, Math.PI - a0, false);
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

const HINGE: [number, number] = [22.6, 7.85];
const cover = () => {
  const s = new THREE.Shape();
  s.moveTo(8.2 - HINGE[0], 10.4 - HINGE[1]);
  s.lineTo(0, 0);
  s.lineTo(0, -0.5);
  s.lineTo(8.2 - HINGE[0], 7.4 - HINGE[1]);
  s.lineTo(8.2 - HINGE[0], 10.4 - HINGE[1]);
  return s;
};

export const WedgeSupercar: React.FC<{ coverAngle: number }> = ({ coverAngle }) => {
  const geo = useMemo(() => ({ lower: extrude(lowerBody(), 20), glass: extrude(greenhouse(), 14.6), roof: extrude(roof(), 10.5), cover: extrude(cover(), 13.6) }), []);
  return (
    <group>
      <mesh geometry={geo.lower}>
        <meshLambertMaterial color={C.body} flatShading />
      </mesh>
      <mesh geometry={geo.glass}>
        <meshLambertMaterial color={C.glass} flatShading />
      </mesh>
      <mesh geometry={geo.roof}>
        <meshLambertMaterial color={C.body} flatShading />
      </mesh>
      {/* engine cover with glass panels, hinged at the tail */}
      <group position={[HINGE[0], HINGE[1], 0]} rotation={[0, 0, coverAngle]}>
        <mesh geometry={geo.cover}>
          <meshLambertMaterial color={C.body} flatShading />
        </mesh>
        {[0, 1, 2].map((k) => (
          <Box key={k} p={[-3.4 - k * 4.0, 0.62 + k * 0.72, 0]} s={[3.3, 0.12, 7.4]} c={C.glass} r={[0, 0, -0.18]} />
        ))}
      </group>
      {/* side stripe, intakes, lights, wing, diffuser */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Box p={[1, 4.6, s * 10.03]} s={[38, 0.45, 0.1]} c={C.red} />
          <Box p={[1, 4.1, s * 10.03]} s={[30, 0.18, 0.1]} c={C.trim} />
          <Box p={[6.2, 5.6, s * 10.02]} s={[5.2, 1.6, 0.1]} c={C.trim} r={[0, 0, -0.25]} />
          <Box p={[24.62, 5.6, s * 7]} s={[0.12, 0.7, 4.5]} c={C.tail} />
          <Box p={[-23.4, 3.25, s * 6.5]} s={[1.4, 0.45, 4]} c={C.trim} r={[0, 0, 0.3]} />
          <Box p={[21.5, 8.6, s * 7.6]} s={[0.4, 1.5, 0.4]} c={C.trim} />
        </group>
      ))}
      <Box p={[22.4, 9.5, 0]} s={[3.2, 0.3, 19]} c={C.trim} />
      <Box p={[24.2, 2.0, 0]} s={[1.0, 1.4, 15]} c={C.trim} />
      <Box p={[-22.6, 1.8, 0]} s={[2.6, 1.0, 17]} c={C.trim} />
      <Box p={[15.2, 6.3, 0]} s={[14.6, 0.3, 13]} c={C.trim} />

      <Wheel x={-15.5} z={9.3} />
      <Wheel x={-15.5} z={-9.3} />
      <Wheel x={14.5} z={9.3} />
      <Wheel x={14.5} z={-9.3} />
    </group>
  );
};

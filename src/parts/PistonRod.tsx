import { D2R, hash } from "../core/math";
import { C } from "../core/theme";
import { Lam } from "./Lam";

/** Distance from crank centre to wrist pin at crank angle c (deg): real slider-crank kinematics. */
export const wristDistance = (c: number, crankR: number, rodL: number) => {
  const th = (c * Math.PI) / 180;
  const s = Math.sin(th);
  return crankR * Math.cos(th) + Math.sqrt(rodL * rodL - crankR * crankR * s * s);
};

/** Crank-pin position in the cylinder's (y, z) plane at crank angle c (deg). */
export const crankPinInBank = (c: number, crankR: number): [number, number] => [crankR * Math.cos(c * D2R), crankR * Math.sin(c * D2R)];

/** Rod between two points in the cylinder's (y, z) plane. */
const Rod: React.FC<{ a: [number, number]; b: [number, number] }> = ({ a, b }) => {
  const dy = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dy, dz);
  const beta = Math.atan2(dz, dy);
  return (
    <mesh position={[0, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2]} rotation={[beta, 0, 0]}>
      <boxGeometry args={[0.16, len, 0.2]} />
      <Lam c={C.metal} />
    </mesh>
  );
};

/**
 * Piston, rings and rod in the cylinder's local frame (bore axis = +y, crank centre at the origin).
 * `heat` 0..1 colours the crown during combustion.
 */
export const PistonRod: React.FC<{ crown: number; wrist: number; pin: [number, number]; radius: number; height: number; heat: number }> = ({
  crown,
  wrist,
  pin,
  radius,
  height,
  heat,
}) => {
  const crownColor = heat > 0.66 ? C.hot : heat > 0.33 ? C.warm : heat > 0.02 ? C.red : C.metalLight;
  return (
    <>
      <mesh position={[0, crown - height / 2, 0]}>
        <cylinderGeometry args={[radius, radius, height, 14]} />
        <Lam c={C.metalLight} />
      </mesh>
      <mesh position={[0, crown - 0.005, 0]}>
        <cylinderGeometry args={[radius * 0.98, radius * 0.98, 0.03, 14]} />
        <Lam c={crownColor} e={crownColor} ei={heat > 0.02 ? 0.9 : 0} />
      </mesh>
      {[0.12, 0.22].map((d) => (
        <mesh key={d} position={[0, crown - d, 0]}>
          <cylinderGeometry args={[radius + 0.012, radius + 0.012, 0.035, 14]} />
          <Lam c={C.metalDark} />
        </mesh>
      ))}
      <Rod a={pin} b={[wrist, 0]} />
    </>
  );
};

/** Burst of hot particles above a piston crown. `age` 0..1; outside that range nothing draws. */
export const CombustionFlash: React.FC<{ crown: number; age: number; seed: number }> = ({ crown, age, seed }) => {
  if (age < 0 || age > 1) return null;
  return (
    <group>
      {Array.from({ length: 12 }, (_, i) => {
        const h1 = hash(seed, i);
        const h2 = hash(i, seed + 7);
        const ang = h1 * Math.PI * 2;
        const spread = 0.35 + h2 * 0.55;
        const d = age * (0.6 + h2 * 0.7);
        const x = Math.cos(ang) * spread * d;
        const z = Math.sin(ang) * spread * d;
        const y = crown + 0.08 + d * (0.5 + h1 * 0.6);
        const s = 0.13 * (1 - age * 0.55);
        const col = age < 0.3 ? (i % 3 === 0 ? "#ffffff" : C.hot) : age < 0.65 ? C.warm : C.red;
        return (
          <mesh key={i} position={[x, y, z]}>
            <boxGeometry args={[s, s, s]} />
            <meshBasicMaterial color={col} />
          </mesh>
        );
      })}
    </group>
  );
};

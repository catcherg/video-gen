import { useContext } from "react";
import { D2R, hash } from "../core/math";
import { C, STROKE_COLORS } from "../core/theme";
import { DimContext, Lam } from "./Lam";

/** Distance from crank centre to wrist pin at crank angle c (deg): real slider-crank kinematics. */
export const wristDistance = (c: number, crankR: number, rodL: number) => {
  const th = (c * Math.PI) / 180;
  const s = Math.sin(th);
  return crankR * Math.cos(th) + Math.sqrt(rodL * rodL - crankR * crankR * s * s);
};

/** Crank-pin position in the cylinder's (y, z) plane at crank angle c (deg). */
export const crankPinInBank = (c: number, crankR: number): [number, number] => [crankR * Math.cos(c * D2R), crankR * Math.sin(c * D2R)];

const ALONG_X: [number, number, number] = [0, 0, Math.PI / 2];

/** I-beam rod with a bolted big-end cap and a small-end eye, between two points in the cylinder's (y, z) plane. */
const Rod: React.FC<{ a: [number, number]; b: [number, number]; color: string }> = ({ a, b, color }) => {
  const dy = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dy, dz);
  const beta = Math.atan2(dz, dy);
  return (
    <group position={[0, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2]} rotation={[beta, 0, 0]}>
      {/* web and flanges */}
      <mesh>
        <boxGeometry args={[0.05, len, 0.18]} />
        <Lam c={C.metalDark} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, 0, s * 0.09]}>
          <boxGeometry args={[0.16, len, 0.035]} />
          <Lam c={color} />
        </mesh>
      ))}
      {/* big end, bearing shell, cap and bolts */}
      <mesh position={[0, -len / 2, 0]} rotation={ALONG_X}>
        <cylinderGeometry args={[0.24, 0.24, 0.18, 12]} />
        <Lam c={color} />
      </mesh>
      <mesh position={[0, -len / 2, 0]} rotation={ALONG_X}>
        <cylinderGeometry args={[0.175, 0.175, 0.2, 12]} />
        <Lam c={C.bearing} />
      </mesh>
      <mesh position={[0, -len / 2 - 0.2, 0]}>
        <boxGeometry args={[0.18, 0.12, 0.46]} />
        <Lam c={C.metalLight} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, -len / 2 - 0.26, s * 0.17]}>
          <boxGeometry args={[0.09, 0.07, 0.09]} />
          <Lam c={C.warm} />
        </mesh>
      ))}
      {/* small-end eye */}
      <mesh position={[0, len / 2, 0]} rotation={ALONG_X}>
        <cylinderGeometry args={[0.12, 0.12, 0.17, 10]} />
        <Lam c={C.metalLight} />
      </mesh>
    </group>
  );
};

const RELIEFS: [number, number][] = [
  [-0.17, 0.17],
  [0.17, 0.17],
  [-0.17, -0.17],
  [0.17, -0.17],
];

/**
 * Piston, rings, wrist pin and rod in the cylinder's local frame (bore axis = +y, crank centre at the origin).
 * `heat` 0..1 colours the crown during combustion.
 */
export const PistonRod: React.FC<{ crown: number; wrist: number; pin: [number, number]; radius: number; height: number; heat: number; rodColor?: string }> = ({
  crown,
  wrist,
  pin,
  radius,
  height,
  heat,
  rodColor = C.metal,
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
      {/* valve reliefs in the crown */}
      {RELIEFS.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, crown + 0.012, z]}>
          <cylinderGeometry args={[0.1, 0.1, 0.012, 10]} />
          <Lam c={C.metalDark} />
        </mesh>
      ))}
      {[0.12, 0.22, 0.3].map((d) => (
        <mesh key={d} position={[0, crown - d, 0]}>
          <cylinderGeometry args={[radius + 0.012, radius + 0.012, 0.035, 14]} />
          <Lam c={C.metalDark} />
        </mesh>
      ))}
      {/* wrist pin, visible through the skirt */}
      <mesh position={[0, wrist, 0]} rotation={ALONG_X}>
        <cylinderGeometry args={[0.075, 0.075, radius * 2 + 0.02, 8]} />
        <Lam c={C.spring} />
      </mesh>
      <Rod a={pin} b={[wrist, 0]} color={rodColor} />
    </>
  );
};

/** The gas above the piston, coloured by stroke and growing denser as it is squeezed. */
export const GasColumn: React.FC<{ crown: number; deck: number; radius: number; c: number; stroke: string }> = ({ crown, deck, radius, c, stroke }) => {
  const dim = useContext(DimContext);
  const height = deck - crown;
  if (height < 0.02 || dim > 0.5) return null;
  const inStroke = (c % 180) / 180;
  const opacity = stroke === "BANG" ? 0.9 - inStroke * 0.55 : stroke === "SQUEEZE" ? 0.3 + inStroke * 0.55 : 0.34;
  return (
    <mesh position={[0, crown + height / 2, 0]}>
      <cylinderGeometry args={[radius, radius, height, 16]} />
      <meshBasicMaterial color={STROKE_COLORS[stroke]} transparent opacity={opacity * (1 - dim)} depthWrite={false} />
    </mesh>
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

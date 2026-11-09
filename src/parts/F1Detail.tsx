import { useContext } from "react";
import * as THREE from "three";
import { hash } from "../core/math";
import { C, STROKE_COLORS } from "../core/theme";
import { dimmed, DimContext, Lam } from "./Lam";

// Things that show the process inside a racing V8. All of these sit in a cylinder's local frame
// (bore axis +y, across the bank z, along the crank x) and are pure functions of their inputs.

const OIL = "#ffb648";

/** Which way a port's gas is flowing, as a 0..1 position within the valve's open window, or -1 while shut. */
export const flowPhase = (c: number, open: number, close: number) => (c > open && c < close ? (c - open) / (close - open) : -1);

/** A see-through port, with slugs of gas moving along it while its valve is open. */
export const PortFlow: React.FC<{ curve: THREE.Curve<THREE.Vector3>; tube: THREE.BufferGeometry; kind: "INTAKE" | "EXHAUST"; phase: number; seed: number; showTube?: boolean }> = ({ curve, tube, kind, phase, seed, showTube = true }) => {
  const dim = useContext(DimContext);
  if (dim > 0.5) return null;
  const colour = STROKE_COLORS[kind];
  const towardChamber = kind === "INTAKE";
  return (
    <>
      <mesh geometry={tube} visible={showTube}>
        <meshLambertMaterial color={dimmed(colour, dim)} transparent opacity={0.34 + (phase >= 0 ? 0.18 : 0)} depthWrite={false} side={2} />
      </mesh>
      {phase >= 0
        ? Array.from({ length: 12 }, (_, i) => {
            const raw = (phase * 2.5 + i / 12 + hash(seed, i) * 0.04) % 1;
            const u = towardChamber ? 1 - raw : raw;
            const p = curve.getPointAt(Math.min(0.999, u));
            const s = 0.07 + 0.03 * hash(i, seed);
            return (
              <mesh key={i} position={p}>
                <boxGeometry args={[s, s, s]} />
                <meshBasicMaterial color={colour} />
              </mesh>
            );
          })
        : null}
    </>
  );
};

/** The first of the flame: a hot kernel that grows from the plug and fills the chamber just after firing. */
export const FlameKernel: React.FC<{ c: number; deck: number; crown: number; radius: number }> = ({ c, deck, crown, radius }) => {
  if (c >= 95) return null;
  const grow = Math.min(1, c / 50);
  const fade = c < 50 ? 1 : 1 - (c - 50) / 45;
  const r = (0.08 + 0.92 * grow) * radius;
  const h = Math.max(0.04, deck - crown);
  return (
    <group position={[0, deck - h / 2, 0]} scale={[r, h / 2, r]}>
      <mesh>
        <sphereGeometry args={[1, 14, 8]} />
        <meshBasicMaterial color={C.warm} transparent opacity={0.9 * fade} depthWrite={false} />
      </mesh>
      <mesh scale={[0.72, 0.8, 0.72]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial color={C.hot} transparent opacity={0.95 * fade} depthWrite={false} />
      </mesh>
    </group>
  );
};

/** A fixed nozzle at the bottom of the bore, firing cooling oil at the underside of the piston. */
export const OilJet: React.FC<{ y0: number; side: number; underside: number; frame: number; seed: number }> = ({ y0, side, underside, frame, seed }) => {
  const nozzleZ = side * 0.34;
  const span = underside - y0;
  return (
    <>
      <mesh position={[-0.3, y0 - 0.03, nozzleZ]}>
        <cylinderGeometry args={[0.06, 0.06, 0.14, 8]} />
        <Lam c={C.warm} />
      </mesh>
      {span > 0.05
        ? Array.from({ length: 12 }, (_, i) => {
            const u = (frame * 0.09 + i / 12 + hash(seed, i) * 0.05) % 1;
            return (
              <mesh key={i} position={[-0.3, y0 + 0.03 + u * span, nozzleZ * (1 - u * 0.75)]}>
                <boxGeometry args={[0.065, 0.13, 0.065]} />
                <meshBasicMaterial color={OIL} />
              </mesh>
            );
          })
        : null}
    </>
  );
};

/** A bolted camshaft bearing cap, between the two lobes of a cylinder. */
export const CamCap: React.FC<{ y: number; z: number }> = ({ y, z }) => (
  <group position={[0, y, z]}>
    <mesh>
      <boxGeometry args={[0.13, 0.26, 0.36]} />
      <Lam c={C.metal} />
    </mesh>
    {[1, -1].map((s) => (
      <mesh key={s} position={[0, 0.15, s * 0.13]}>
        <cylinderGeometry args={[0.055, 0.055, 0.06, 6]} />
        <Lam c={C.hot} />
      </mesh>
    ))}
  </group>
);

/** The gallery feeding compressed air along a bank, with a pulse of air travelling down it. */
export const AirRail: React.FC<{ x: number; y: number; z: number; length: number; frame: number; seed: number; pulses: boolean }> = ({ x, y, z, length, frame, seed, pulses }) => (
  <>
    <mesh position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.085, 0.085, length, 8]} />
      <Lam c={C.air} />
    </mesh>
    {Array.from({ length: pulses ? 10 : 0 }, (_, i) => {
      const u = (frame * 0.022 + i / 10 + hash(seed, i) * 0.02) % 1;
      return (
        <mesh key={i} position={[x - length / 2 + u * length, y, z]}>
          <boxGeometry args={[0.12, 0.17, 0.17]} />
          <meshBasicMaterial color={C.air} />
        </mesh>
      );
    })}
  </>
);

/** Bolted-on heavy counterweight insert on a crank web, drawn at the web's current angle. */
export const CounterweightInsert: React.FC<{ x: number; alpha: number; radius: number }> = ({ x, alpha, radius }) => (
  <group position={[x, 0, 0]} rotation={[alpha, 0, 0]}>
    <mesh position={[0, -radius, 0]}>
      <boxGeometry args={[0.17, 0.17, 0.46]} />
      <Lam c="#3b3e55" />
    </mesh>
    {[1, -1].map((s) => (
      <mesh key={s} position={[0, -radius + 0.05, s * 0.13]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.2, 6]} />
        <Lam c={C.hot} />
      </mesh>
    ))}
  </group>
);

/** Oil thrown off the spinning crank, at a tangent from a web. */
export const OilFling: React.FC<{ x: number; alpha: number; frame: number; seed: number }> = ({ x, alpha, frame, seed }) => (
  <>
    {Array.from({ length: 8 }, (_, i) => {
      const u = (frame * 0.07 + i / 8 + hash(seed, i)) % 1;
      const r = 0.45 + u * 0.55;
      const a = alpha + 1.2 + hash(i, seed) * 1.2;
      return (
        <mesh key={i} position={[x + (hash(seed, i * 3) - 0.5) * 0.2, Math.cos(a) * r, Math.sin(a) * r]}>
          <boxGeometry args={[0.07, 0.07, 0.07]} />
          <meshBasicMaterial color={OIL} />
        </mesh>
      );
    })}
  </>
);

/** Carbon air bottle and pressure regulator, sized from the bottle's real volume. */
export const AirBottle: React.FC<{ radius: number; length: number }> = ({ radius, length }) => (
  <>
    <mesh rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <Lam c="#2a2c44" />
    </mesh>
    {[1, -1].map((s) => (
      <mesh key={s} position={[(s * length) / 2, 0, 0]} scale={[0.5, 1, 1]}>
        <sphereGeometry args={[radius, 12, 8]} />
        <Lam c="#2a2c44" />
      </mesh>
    ))}
    <mesh position={[length / 2 + radius * 0.9, 0, 0]}>
      <boxGeometry args={[0.32, 0.34, 0.34]} />
      <Lam c={C.gear} />
    </mesh>
    <mesh position={[length / 2 + radius * 0.9, 0.2, 0]}>
      <cylinderGeometry args={[0.09, 0.09, 0.1, 8]} />
      <Lam c={C.air} />
    </mesh>
  </>
);

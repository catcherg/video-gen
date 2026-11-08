import { useMemo } from "react";
import * as THREE from "three";
import { cycleAt, isSlowed } from "../physics";
import {
  bankAngle,
  CAM_DIST,
  CRANK_R,
  CYL_SPACING,
  cylX,
  DECK,
  PIN_TO_CROWN,
  PISTON_H,
  PISTON_R,
  ROD_L,
  wristDist,
} from "../geometry";
import { C } from "./palette";
import { headerGhost } from "../timeline";

const D2R = Math.PI / 180;
const CYLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// deterministic hash in [0,1)
const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Valve timing (cycle degrees): exhaust open 150-390, intake open 330-590.
const bump = (c: number, open: number, close: number) =>
  c > open && c < close ? Math.sin((Math.PI * (c - open)) / (close - open)) ** 2 : 0;
const EX = { open: 150, close: 390, peak: 270 };
const IN = { open: 330, close: 590, peak: 460 };
const VALVE_LIFT = 0.22;

const Lam: React.FC<{ c: string; e?: string; ei?: number }> = ({ c, e, ei }) => (
  <meshLambertMaterial color={c} emissive={e ?? "#000000"} emissiveIntensity={ei ?? 0} flatShading />
);

const springGeo = (() => {
  const pts: THREE.Vector3[] = [];
  const turns = 5;
  for (let i = 0; i <= turns * 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.1, i / (turns * 12), Math.sin(a) * 0.1));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 12, 0.028, 4, false);
})();

/** Rod between two points in the bank's (y,z) plane. */
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

const Particles: React.FC<{ crown: number; c: number; cyl: number; flicker: number }> = ({ crown, c, cyl, flicker }) => {
  const age = flicker >= 0 ? flicker : c / 80;
  if (age < 0 || age > 1) return null;
  return (
    <group>
      {Array.from({ length: 12 }, (_, i) => {
        const h1 = hash(cyl, i);
        const h2 = hash(i, cyl + 7);
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

const Cylinder: React.FC<{ cyl: number; t: number; frame: number }> = ({ cyl, t, frame }) => {
  const c = cycleAt(cyl, t);
  const cm = c % 360;
  const w = wristDist(cm);
  const crown = w + PIN_TO_CROWN;
  const pin: [number, number] = [CRANK_R * Math.cos(cm * D2R), CRANK_R * Math.sin(cm * D2R)];
  const inner = cyl <= 6 ? 1 : -1;

  // heat of the combustion flash
  const slowed = isSlowed(t);
  let heat = c < 110 ? 1 - c / 110 : 0;
  let flicker = -1;
  if (!slowed) {
    heat = 0.45 + 0.55 * hash(frame, cyl);
    flicker = hash(cyl * 3, frame) * 0.9;
  }
  const crownColor = heat > 0.66 ? C.hot : heat > 0.33 ? C.warm : heat > 0.02 ? C.red : C.metalLight;

  const exLift = bump(c, EX.open, EX.close) * VALVE_LIFT;
  const inLift = bump(c, IN.open, IN.close) * VALVE_LIFT;

  return (
    <group position={[cylX(cyl), 0, 0]} rotation={[bankAngle(cyl), 0, 0]}>
      {/* piston + rings */}
      <mesh position={[0, crown - PISTON_H / 2, 0]}>
        <cylinderGeometry args={[PISTON_R, PISTON_R, PISTON_H, 14]} />
        <Lam c={C.metalLight} />
      </mesh>
      <mesh position={[0, crown - 0.005, 0]}>
        <cylinderGeometry args={[PISTON_R * 0.98, PISTON_R * 0.98, 0.03, 14]} />
        <Lam c={crownColor} e={crownColor} ei={heat > 0.02 ? 0.9 : 0} />
      </mesh>
      {[0.12, 0.22].map((d) => (
        <mesh key={d} position={[0, crown - d, 0]}>
          <cylinderGeometry args={[PISTON_R + 0.012, PISTON_R + 0.012, 0.035, 14]} />
          <Lam c={C.metalDark} />
        </mesh>
      ))}
      <Rod a={pin} b={[w, 0]} />

      {/* deck frame around the bore */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, DECK, s * (PISTON_R + 0.13)]}>
          <boxGeometry args={[CYL_SPACING, 0.08, 0.2]} />
          <Lam c={C.valley} />
        </mesh>
      ))}
      <mesh position={[CYL_SPACING / 2, DECK, 0]}>
        <boxGeometry args={[0.16, 0.08, 2 * PISTON_R + 0.06]} />
        <Lam c={C.valley} />
      </mesh>

      {/* 4 valves: intake pair on the V side, exhaust pair outside */}
      {[
        { side: inner, lift: inLift },
        { side: -inner, lift: exLift },
      ].map(({ side, lift }) =>
        [-0.2, 0.2].map((dx) => (
          <group key={`${side}${dx}`} position={[dx, 0, side * 0.24]}>
            <mesh position={[0, DECK + 0.12 - lift, 0]}>
              <cylinderGeometry args={[0.13, 0.13, 0.04, 8]} />
              <Lam c={C.metalDark} />
            </mesh>
            <mesh position={[0, DECK + 0.55 - lift, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.85, 4]} />
              <Lam c={C.metalLight} />
            </mesh>
            <mesh geometry={springGeo} position={[0, DECK + 0.38, 0]} scale={[1, 0.62 - lift, 1]}>
              <Lam c={C.spring} />
            </mesh>
            <mesh position={[0, DECK + 1.0 - lift, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.08, 8]} />
              <Lam c={C.metalLight} />
            </mesh>
          </group>
        ))
      )}

      {/* cam lobes (camshafts turn at half crank speed) */}
      {[
        { side: inner, peak: IN.peak },
        { side: -inner, peak: EX.peak },
      ].map(({ side, peak }) =>
        [-0.2, 0.2].map((dx) => (
          <group key={`l${side}${dx}`} position={[dx, CAM_DIST, side * 0.24]} rotation={[((c - peak) / 2) * D2R, 0, 0]}>
            <mesh position={[0, -0.07, 0]}>
              <boxGeometry args={[0.14, 0.42, 0.26]} />
              <Lam c={C.cam} />
            </mesh>
          </group>
        ))
      )}

      {/* coil pack */}
      <mesh position={[0, CAM_DIST + 0.36, 0]}>
        <boxGeometry args={[0.34, 0.42, 0.22]} />
        <Lam c={C.coil} />
      </mesh>

      <Particles crown={crown} c={c} cyl={cyl} flicker={flicker} />
    </group>
  );
};

const Crank: React.FC<{ t: number }> = ({ t }) => {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 7.6, 10]} />
        <Lam c={C.metalLight} />
      </mesh>
      {[1, 2, 3, 4, 5, 6].map((k) => {
        // pin shared by cylinders k (right) and k+6 (left)
        const cm = cycleAt(k, t) % 360;
        const alpha = bankAngle(k) + cm * D2R;
        const x = (cylX(k) + cylX(k + 6)) / 2;
        const py = CRANK_R * Math.cos(alpha);
        const pz = CRANK_R * Math.sin(alpha);
        return (
          <group key={k}>
            <mesh position={[x, py, pz]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.15, 0.15, 0.62, 8]} />
              <Lam c={C.metalLight} />
            </mesh>
            {[-0.36, 0.36].map((dx) => (
              <group key={dx} position={[x + dx, 0, 0]} rotation={[alpha, 0, 0]}>
                <mesh position={[0, CRANK_R / 2, 0]}>
                  <boxGeometry args={[0.1, CRANK_R + 0.34, 0.34]} />
                  <Lam c={C.metalLight} />
                </mesh>
                <mesh position={[0, -0.42, 0]}>
                  <boxGeometry args={[0.1, 0.42, 0.95]} />
                  <Lam c={C.metal} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
};

const headerCurves = () =>
  CYLS.map((cyl) => {
    const a = bankAngle(cyl);
    const dir = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
    const outward = new THREE.Vector3(0, -Math.sin(a), Math.cos(a)).multiplyScalar(cyl <= 6 ? -1 : 1);
    const x = cylX(cyl);
    const port = new THREE.Vector3(x, 0, 0).add(dir.clone().multiplyScalar(DECK + 0.3)).add(outward.clone().multiplyScalar(0.62));
    const side = Math.sign(outward.z);
    const p1 = port.clone().add(new THREE.Vector3(0, 0.05, side * 0.75));
    const p2 = new THREE.Vector3(x + 0.3, 0.4, side * 2.55);
    const p3 = new THREE.Vector3(x * 0.4 + 2.6, -0.9, side * 2.75);
    const p4 = new THREE.Vector3(4.4, -1.1, side * 2.3);
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([port, p1, p2, p3, p4]), 20, 0.15, 6, false);
  });

export const Engine: React.FC<{ t: number; frame: number; origin: THREE.Vector3 }> = ({ t, frame, origin }) => {
  const headers = useMemo(headerCurves, []);
  return (
    <group position={origin}>
      <Crank t={t} />
      {CYLS.map((cyl) => (
        <Cylinder key={cyl} cyl={cyl} t={t} frame={frame} />
      ))}
      {/* camshafts: 2 per bank */}
      {[1, 7].map((ref) =>
        [1, -1].map((side) => (
          <group key={`${ref}${side}`} rotation={[bankAngle(ref), 0, 0]}>
            <mesh position={[(cylX(ref) + cylX(ref + 5)) / 2, CAM_DIST, side * 0.24]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.07, 0.07, 6.9, 6]} />
              <Lam c={C.cam} />
            </mesh>
          </group>
        ))
      )}
      {headers.map((g, i) => {
        const ghost = i < 6 ? headerGhost(t) : 0;
        return (
          <mesh key={i} geometry={g} visible={ghost < 0.97}>
            <meshLambertMaterial color={C.header} flatShading transparent={ghost > 0} opacity={1 - ghost * 0.85} depthWrite={ghost < 0.5} />
          </mesh>
        );
      })}
      {/* valley between the banks, oil pan, bellhousing */}
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[7.2, 0.1, 1.05]} />
        <Lam c={C.valley} />
      </mesh>
      <mesh position={[0, -1.35, 0]} visible={headerGhost(t) < 0.5}>
        <boxGeometry args={[7.4, 0.5, 2.2]} />
        <Lam c={C.trim} />
      </mesh>
      <mesh position={[4.15, 0.2, 0]}>
        <boxGeometry args={[0.35, 2.6, 2.9]} />
        <Lam c={C.metalDark} />
      </mesh>
    </group>
  );
};

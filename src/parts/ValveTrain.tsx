import * as THREE from "three";
import { D2R } from "../core/math";
import { C } from "../core/theme";
import { Lam } from "./Lam";

/** Smooth valve-lift curve: 0 outside open..close (cycle degrees), peak 1 midway. */
export const valveBump = (c: number, open: number, close: number) =>
  c > open && c < close ? Math.sin((Math.PI * (c - open)) / (close - open)) ** 2 : 0;

const springGeo = (() => {
  const pts: THREE.Vector3[] = [];
  const turns = 5;
  for (let i = 0; i <= turns * 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.1, i / (turns * 12), Math.sin(a) * 0.1));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 12, 0.028, 4, false);
})();

const VALVE_DX = [-0.2, 0.2];
const VALVE_Z = 0.24;

export type ValveRow = { side: number; lift: number; color?: string };

/** Poppet valves with springs, retainers and followers, in the cylinder's local frame. One pair per row. */
export const Valves: React.FC<{ deck: number; rows: ValveRow[] }> = ({ deck, rows }) => (
  <>
    {rows.map(({ side, lift, color = C.metalLight }) =>
      VALVE_DX.map((dx) => (
        <group key={`${side}${dx}`} position={[dx, 0, side * VALVE_Z]}>
          {/* mushroom head */}
          <mesh position={[0, deck + 0.12 - lift, 0]}>
            <cylinderGeometry args={[0.05, 0.14, 0.08, 10]} />
            <Lam c={color} />
          </mesh>
          <mesh position={[0, deck + 0.55 - lift, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.85, 4]} />
            <Lam c={color} />
          </mesh>
          <mesh geometry={springGeo} position={[0, deck + 0.38, 0]} scale={[1, 0.62 - lift, 1]}>
            <Lam c={C.spring} />
          </mesh>
          <mesh position={[0, deck + 1.0 - lift, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.08, 8]} />
            <Lam c={C.metalLight} />
          </mesh>
          {/* bucket follower, pushed down by the cam */}
          <mesh position={[0, deck + 1.08 - lift, 0]}>
            <boxGeometry args={[0.2, 0.06, 0.15]} />
            <Lam c={C.warm} />
          </mesh>
        </group>
      )),
    )}
  </>
);

/** Egg-shaped cam profile: a base circle with a nose that reaches the follower at full lift. */
const LOBE_BASE = 0.13;
const LOBE_NOSE = 0.36;
const lobeGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -LOBE_NOSE);
  s.quadraticCurveTo(LOBE_BASE * 1.05, -LOBE_NOSE * 0.55, LOBE_BASE, 0);
  s.absarc(0, 0, LOBE_BASE, 0, Math.PI, false);
  s.quadraticCurveTo(-LOBE_BASE * 1.05, -LOBE_NOSE * 0.55, 0, -LOBE_NOSE);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -0.07);
  g.rotateY(Math.PI / 2);
  return g;
})();

export type LobeRow = { side: number; peak: number; color?: string };

/** Cam lobes. Cams turn at half crank speed, so the angle is half the 720° cycle position. */
export const CamLobes: React.FC<{ camDist: number; c: number; rows: LobeRow[] }> = ({ camDist, c, rows }) => (
  <>
    {rows.map(({ side, peak, color = C.cam }) =>
      VALVE_DX.map((dx) => (
        <group key={`l${side}${dx}`} position={[dx, camDist, side * VALVE_Z]} rotation={[((c - peak) / 2) * D2R, 0, 0]}>
          <mesh geometry={lobeGeo}>
            <Lam c={color} />
          </mesh>
        </group>
      )),
    )}
  </>
);

/** Camshaft bearing caps, spaced along a bank. */
export const CamCaps: React.FC<{ xs: number[]; camDist: number; side: number }> = ({ xs, camDist, side }) => (
  <>
    {xs.map((x) => (
      <group key={x} position={[x, camDist + 0.03, side * VALVE_Z]}>
        <mesh>
          <boxGeometry args={[0.14, 0.2, 0.26]} />
          <Lam c={C.metalDark} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={s} position={[0, 0.12, s * 0.09]}>
            <cylinderGeometry args={[0.035, 0.035, 0.05, 6]} />
            <Lam c={C.warm} />
          </mesh>
        ))}
      </group>
    ))}
  </>
);

/** A toothed sprocket in the (y, z) plane, spinning about its own axis. */
export const Sprocket: React.FC<{ x: number; y: number; z: number; r: number; teeth: number; spin: number }> = ({ x, y, z, r, teeth, spin }) => (
  <group position={[x, y, z]} rotation={[spin, 0, 0]}>
    <mesh rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[r, r, 0.07, 14]} />
      <Lam c={C.metalLight} />
    </mesh>
    {Array.from({ length: teeth }, (_, i) => {
      const a = (i / teeth) * Math.PI * 2;
      return (
        <mesh key={i} position={[0, Math.cos(a) * (r + 0.03), Math.sin(a) * (r + 0.03)]} rotation={[a, 0, 0]}>
          <boxGeometry args={[0.07, 0.06, 0.045]} />
          <Lam c={C.metal} />
        </mesh>
      );
    })}
  </group>
);

/** Timing chain: links travel round a closed path as the crank turns. */
export const TimingChain: React.FC<{ curve: THREE.Curve<THREE.Vector3>; links: number; phase: number }> = ({ curve, links, phase }) => (
  <>
    {Array.from({ length: links }, (_, i) => {
      const u = (((i / links + phase) % 1) + 1) % 1;
      const p = curve.getPointAt(u);
      const d = curve.getTangentAt(u);
      return (
        <mesh key={i} position={p} rotation={[Math.atan2(d.z, d.y), 0, 0]}>
          <boxGeometry args={[0.07, 0.12, 0.05]} />
          <Lam c={i % 2 === 0 ? C.metalLight : C.metalDark} />
        </mesh>
      );
    })}
  </>
);

/** A camshaft bar running along the bank, in the bank's frame. */
export const CamShaft: React.FC<{ x: number; camDist: number; side: number; length: number; color?: string }> = ({ x, camDist, side, length, color = C.cam }) => (
  <mesh position={[x, camDist, side * VALVE_Z]} rotation={[0, 0, Math.PI / 2]}>
    <cylinderGeometry args={[0.07, 0.07, length, 6]} />
    <Lam c={color} />
  </mesh>
);

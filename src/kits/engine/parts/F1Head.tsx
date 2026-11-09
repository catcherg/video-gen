import { useContext, useMemo } from "react";
import * as THREE from "three";
import { C } from "../theme";
import { dimmed, DimContext, Lam } from "../../../core/Lam";

// Racing cylinder head, in a cylinder's local frame (bore axis +y, across the bank z, along the crank x).
// A cam presses a finger follower, which pushes the valve. Compressed air, not a metal spring, pushes it back.

const ALONG_X: [number, number, number] = [0, 0, Math.PI / 2];
/** Valve axis lengths, measured up the valve axis from its seat. */
export const VALVE_STACK = { chamberFloor: 0.5, chamberTop: 0.9, pistonTop: 0.86, tip: 0.94, padBottom: 0.94, padTop: 1.02 };
/** Distance from the finger's pivot to the valve, across the head. */
const FINGER_ARM = 0.42;

/** A lobe that rises by `lift` over a base circle, with its nose along -y. Radius follows the valve's own lift curve. */
const lobeGeometry = (base: number, lift: number, halfWidthDeg: number) => {
  const s = new THREE.Shape();
  const N = 64;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const offNose = Math.abs(((a * 180) / Math.PI + 180) % 360 - 180);
    const bump = offNose < halfWidthDeg ? Math.cos(((offNose / halfWidthDeg) * Math.PI) / 2) ** 2 : 0;
    const r = base + lift * bump;
    const x = Math.sin(a) * r;
    const y = -Math.cos(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.13, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -0.065);
  g.rotateY(Math.PI / 2);
  return g;
};

export type F1ValveProps = {
  dx: number;
  deck: number;
  z0: number;
  /** +1 leans the valve toward +z, -1 toward -z. */
  side: number;
  tiltRad: number;
  /** Current lift, in scene units. */
  lift: number;
  maxLift: number;
  headR: number;
  color: string;
  /** Height of the camshaft centre above the seat, along the valve axis. */
  camU: number;
  /** Cam angle, radians: 0 puts the nose on the follower. */
  camRad: number;
  camHalfWidthDeg: number;
  /** Extra emphasis on the air column, 0..1. */
  airGlow?: number;
  /** 0..1, how far along the air feed the moving air has reached. */
  airPhase?: number;
};

/** One valve, its air spring, finger follower and cam lobe. */
export const F1Valve: React.FC<F1ValveProps> = ({ dx, deck, z0, side, tiltRad, lift, maxLift, headR, color, camU, camRad, camHalfWidthDeg, airGlow = 0, airPhase = 0 }) => {
  const dim = useContext(DimContext);
  const lobe = useMemo(() => lobeGeometry(camU - VALVE_STACK.padTop, maxLift, camHalfWidthDeg), [camU, maxLift, camHalfWidthDeg]);
  const S = VALVE_STACK;
  const squeeze = maxLift > 0 ? Math.min(1, lift / maxLift) : 0;
  const pistonU = S.pistonTop - lift;
  const airH = pistonU - 0.05 - S.chamberFloor;
  const fingerAngle = -side * Math.asin(Math.min(0.95, lift / FINGER_ARM));
  return (
    <group position={[dx, deck, z0]} rotation={[side * tiltRad, 0, 0]}>
      {/* head and stem move together */}
      <mesh position={[0, 0.03 - lift, 0]}>
        <cylinderGeometry args={[0.05, headR, 0.06, 14]} />
        <Lam c={color} />
      </mesh>
      <mesh position={[0, (S.tip + 0.03) / 2 - lift, 0]}>
        <cylinderGeometry args={[0.029, 0.029, S.tip - 0.03, 6]} />
        <Lam c={color} />
      </mesh>
      {dim < 0.6 ? (
        <>
          {/* laser-clad valve seat: a ring in the head, the valve closes onto it */}
          <mesh position={[0, 0.012, 0]}>
            <cylinderGeometry args={[headR + 0.02, headR + 0.02, 0.05, 16, 1, true]} />
            <meshLambertMaterial color={C.crankGold} side={2} flatShading />
          </mesh>
          {/* fixed guide the stem slides through */}
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.052, 0.052, 0.34, 8]} />
            <Lam c={C.bearing} />
          </mesh>
          {/* PTFE seal that keeps the oil out of the air spring */}
          <mesh position={[0, S.chamberFloor + 0.018, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.075, 12]} />
            <Lam c="#ffffff" e="#ffffff" ei={0.35} />
          </mesh>
          {/* air inlet: compressed air reaches the chamber through a single small passage */}
          <mesh position={[0, S.chamberFloor + 0.08, side * 0.24]}>
            <boxGeometry args={[0.09, 0.09, 0.22]} />
            <Lam c={C.air} />
          </mesh>
          {/* air arriving through that passage, shown only in the air-spring shot */}
          {airGlow > 0.5
            ? [0, 1, 2].map((i) => {
                const u = (airPhase + i / 3) % 1;
                return (
                  <mesh key={i} position={[0, S.chamberFloor + 0.08, side * (0.36 - u * 0.24)]}>
                    <boxGeometry args={[0.075, 0.075, 0.08]} />
                    <meshBasicMaterial color={C.air} />
                  </mesh>
                );
              })
            : null}
          {/* shim and collets at the top of the stem */}
          <mesh position={[0, S.tip - 0.012 - lift, 0]}>
            <cylinderGeometry args={[0.065, 0.065, 0.035, 8]} />
            <Lam c={C.hot} />
          </mesh>
          <mesh position={[0, pistonU + 0.03, 0]}>
            <cylinderGeometry args={[0.05, 0.095, 0.075, 8]} />
            <Lam c={C.warm} />
          </mesh>
          {/* fixed pedestal under the follower's pivot */}
          <mesh position={[0, S.padTop - 0.24, side * FINGER_ARM]}>
            <boxGeometry args={[0.13, 0.32, 0.12]} />
            <Lam c={C.metal} />
          </mesh>
        </>
      ) : null}
      {/* the compressed air under the spring piston */}
      {airH > 0.005 && dim < 0.6 ? (
        <mesh position={[0, S.chamberFloor + airH / 2, 0]}>
          <cylinderGeometry args={[0.135, 0.135, airH, 14]} />
          <meshBasicMaterial color={dimmed(C.air, dim)} transparent opacity={(0.32 + 0.6 * squeeze + 0.1 * airGlow) * (1 - dim)} depthWrite={false} />
        </mesh>
      ) : null}
      {/* spring piston, fixed to the stem */}
      <mesh position={[0, pistonU - 0.025, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.05, 14]} />
        <Lam c={C.metalLight} />
      </mesh>
      {/* cylinder wall and floor */}
      <mesh position={[0, S.chamberFloor - 0.02, 0]}>
        <cylinderGeometry args={[0.165, 0.165, 0.04, 14]} />
        <Lam c={C.metalDark} />
      </mesh>
      {dim < 0.6 ? (
        <mesh position={[0, (S.chamberFloor + S.chamberTop) / 2, 0]}>
          <cylinderGeometry args={[0.16, 0.16, S.chamberTop - S.chamberFloor, 14, 1, true]} />
          <meshLambertMaterial color={C.cam} transparent opacity={0.16} depthWrite={false} side={2} />
        </mesh>
      ) : null}
      {/* finger follower: pivots outboard of the valve, so the cam sits almost directly above the stem */}
      <group position={[0, S.padTop - 0.04, side * FINGER_ARM]} rotation={[fingerAngle, 0, 0]}>
        <mesh position={[0, 0, -side * (FINGER_ARM / 2)]}>
          <boxGeometry args={[0.12, 0.085, FINGER_ARM + 0.1]} />
          <Lam c={C.finger} />
        </mesh>
        <mesh rotation={ALONG_X}>
          <cylinderGeometry args={[0.055, 0.055, 0.16, 10]} />
          <Lam c={C.metalDark} />
        </mesh>
        {/* hard-coated pads: the top one rides on the cam, the bottom one presses the valve */}
        <mesh position={[0, 0.04, -side * FINGER_ARM]}>
          <boxGeometry args={[0.13, 0.05, 0.18]} />
          <Lam c={C.coil} />
        </mesh>
        <mesh position={[0, -0.04, -side * FINGER_ARM]}>
          <boxGeometry args={[0.11, 0.045, 0.14]} />
          <Lam c={C.coil} />
        </mesh>
      </group>
      {/* cam lobe, turning at half crank speed */}
      <group position={[0, camU, 0]} rotation={[camRad, 0, 0]}>
        <mesh geometry={lobe}>
          <Lam c={C.camLobe} />
        </mesh>
        {/* the hollow camshaft and a darker hard-coated face, so a lobe reads as a machined part */}
        <mesh rotation={ALONG_X} position={[-0.07, 0, 0]}>
          <cylinderGeometry args={[0.19, 0.19, 0.008, 18]} />
          <Lam c={C.metal} />
        </mesh>
        <mesh rotation={ALONG_X} position={[-0.075, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.01, 12]} />
          <Lam c={C.coil} />
        </mesh>
        <mesh position={[-0.075, 0.145, 0]}>
          <boxGeometry args={[0.01, 0.05, 0.03]} />
          <Lam c={C.hot} />
        </mesh>
      </group>
    </group>
  );
};

/** Spur gear in the (y, z) plane, with `spin` measured from +y toward +z. */
export const SpurGear: React.FC<{ x: number; y: number; z: number; r: number; teeth: number; spin: number; color?: string; width?: number }> = ({ x, y, z, r, teeth, spin, color = C.gear, width = 0.09 }) => {
  const toothH = (2 * Math.PI * r) / teeth / 2;
  return (
    <group position={[x, y, z]} rotation={[spin, 0, 0]}>
      <mesh rotation={ALONG_X}>
        <cylinderGeometry args={[r - toothH * 0.5, r - toothH * 0.5, width, 24]} />
        <Lam c={color} />
      </mesh>
      <mesh rotation={ALONG_X} position={[-width / 2, 0, 0]}>
        <cylinderGeometry args={[r * 0.42, r * 0.42, 0.02, 12]} />
        <Lam c={C.metalDark} />
      </mesh>
      {/* lightening holes and hub bolts */}
      {r > 0.2
        ? [0, 1, 2, 3, 4, 5].map((i) => {
            const b = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} rotation={ALONG_X} position={[-width / 2 - 0.004, Math.cos(b) * r * 0.62, Math.sin(b) * r * 0.62]}>
                <cylinderGeometry args={[r * 0.13, r * 0.13, 0.012, 8]} />
                <Lam c={C.metalDark} />
              </mesh>
            );
          })
        : null}
      {Array.from({ length: teeth }, (_, i) => {
        const a = (i / teeth) * Math.PI * 2;
        return (
          <mesh key={i} position={[0, Math.cos(a) * r, Math.sin(a) * r]} rotation={[a, 0, 0]}>
            <boxGeometry args={[width, toothH * 1.5, toothH * 0.95]} />
            <Lam c={color} />
          </mesh>
        );
      })}
    </group>
  );
};

export type GearDef = { y: number; z: number; teeth: number; r: number; parent: number };

/** Spin of each gear in a train, from the first gear's spin. Teeth of meshing gears interleave exactly. */
export const gearSpins = (gears: GearDef[], rootSpin: number) => {
  const spins = new Array<number>(gears.length).fill(0);
  gears.forEach((g, i) => {
    if (i === 0) {
      spins[0] = rootSpin;
      return;
    }
    const p = gears[g.parent];
    const phi = Math.atan2(g.z - p.z, g.y - p.y);
    spins[i] = phi + Math.PI + Math.PI / g.teeth - (p.teeth / g.teeth) * (spins[g.parent] - phi);
  });
  return spins;
};


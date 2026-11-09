import * as THREE from "three";
import { hash } from "../../../core/math";
import { C } from "../theme";
import { dimmed } from "../../../core/Lam";

export const headerCurve = (points: THREE.Vector3[]) => new THREE.CatmullRomCurve3(points);

/** One exhaust primary through the given points. */
export const headerTube = (points: THREE.Vector3[], radius = 0.15) => new THREE.TubeGeometry(headerCurve(points), 20, radius, 6, false);

/** Exhaust headers. `ghost` 0..1 fades one tube out so the camera can see past it; `glow` 0..1 heats them up. */
export const Headers: React.FC<{ tubes: THREE.BufferGeometry[]; ghost: (index: number) => number; glow?: number; dim?: number }> = ({ tubes, ghost, glow = 0, dim = 0 }) => (
  <>
    {tubes.map((g, i) => {
      const fade = ghost(i);
      return (
        <mesh key={i} geometry={g} visible={fade < 0.97}>
          <meshLambertMaterial color={dimmed(C.header, dim)} emissive="#ff3a10" emissiveIntensity={glow * 0.85 * (1 - dim)} flatShading transparent={fade > 0} opacity={1 - fade * 0.85} depthWrite={fade < 0.5} />
        </mesh>
      );
    })}
  </>
);

/** Slugs of hot exhaust gas travelling down one header. `head` is 0 at the port and 1 at the collector. */
export const ExhaustPulse: React.FC<{ curve: THREE.Curve<THREE.Vector3>; head: number; seed: number }> = ({ curve, head, seed }) => {
  if (head < 0 || head > 1.25) return null;
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => {
        const u = head - i * 0.05;
        if (u < 0 || u > 1) return null;
        const p = curve.getPointAt(u);
        const s = 0.2 - i * 0.025;
        const jitter = (hash(seed, i) - 0.5) * 0.08;
        return (
          <mesh key={i} position={[p.x + jitter, p.y - jitter, p.z + jitter]}>
            <boxGeometry args={[s, s, s]} />
            <meshBasicMaterial color={i < 2 ? C.hot : C.warm} />
          </mesh>
        );
      })}
    </>
  );
};

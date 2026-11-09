import * as THREE from "three";
import { C } from "../theme";
import { Lam } from "../../../core/Lam";

/** One crank pin: position along the crank, and its current angle about the crank axis (radians). */
export type CrankPin = { x: number; alpha: number };

const ALONG_X: [number, number, number] = [0, 0, Math.PI / 2];

/** Counterweight: a thick pie slice pointing away from the crank pin. */
const counterweightGeo = (() => {
  const halfAngle = 0.95;
  const r = 0.72;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.absarc(0, 0, r, -Math.PI / 2 - halfAngle, -Math.PI / 2 + halfAngle, false);
  s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -0.06);
  g.rotateY(Math.PI / 2);
  return g;
})();

const TEETH = 28;

/**
 * A crankshaft generated from a pin layout. Flat-plane, cross-plane and shared-pin cranks are just different layouts.
 * `spin` is the shaft's rotation in radians, used to turn the flywheel and pulley when `ends` is set.
 */
export const Crankshaft: React.FC<{ pins: CrankPin[]; throwR: number; length: number; webOffset?: number; spin?: number; ends?: boolean; color?: string; weightColor?: string; weightScale?: number }> = ({
  pins,
  throwR,
  length,
  webOffset = 0.36,
  spin = 0,
  ends = false,
  color = C.metalLight,
  weightColor = C.metal,
  weightScale = 1,
}) => (
  <group>
    <mesh rotation={ALONG_X}>
      <cylinderGeometry args={[0.2, 0.2, length, 10]} />
      <Lam c={color} />
    </mesh>
    {pins.map(({ x, alpha }, k) => (
      <group key={k}>
        <mesh position={[x, throwR * Math.cos(alpha), throwR * Math.sin(alpha)]} rotation={ALONG_X}>
          <cylinderGeometry args={[0.15, 0.15, 0.62, 8]} />
          <Lam c={color} />
        </mesh>
        {[-webOffset, webOffset].map((dx) => (
          <group key={dx} position={[x + dx, 0, 0]} rotation={[alpha, 0, 0]}>
            <mesh position={[0, throwR / 2, 0]}>
              <boxGeometry args={[0.1, throwR + 0.34, 0.34]} />
              <Lam c={color} />
            </mesh>
            {/* oil drilling */}
            <mesh position={[dx > 0 ? 0.06 : -0.06, throwR / 2, 0]} rotation={ALONG_X}>
              <cylinderGeometry args={[0.05, 0.05, 0.02, 8]} />
              <Lam c={C.metalDark} />
            </mesh>
            <mesh geometry={counterweightGeo} scale={[1, weightScale, weightScale]}>
              <Lam c={weightColor} />
            </mesh>
          </group>
        ))}
      </group>
    ))}
    {ends ? (
      <>
        {/* flywheel with a toothed ring gear, on the gearbox end */}
        <group position={[length / 2 + 0.06, 0, 0]} rotation={[spin, 0, 0]}>
          <mesh rotation={ALONG_X}>
            <cylinderGeometry args={[0.82, 0.82, 0.12, 24]} />
            <Lam c={C.metalDark} />
          </mesh>
          {Array.from({ length: TEETH }, (_, i) => {
            const a = (i / TEETH) * Math.PI * 2;
            return (
              <mesh key={i} position={[0, Math.cos(a) * 0.86, Math.sin(a) * 0.86]} rotation={[a, 0, 0]}>
                <boxGeometry args={[0.1, 0.1, 0.07]} />
                <Lam c={C.metalLight} />
              </mesh>
            );
          })}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} position={[-0.075, Math.cos(a) * 0.45, Math.sin(a) * 0.45]} rotation={ALONG_X}>
                <cylinderGeometry args={[0.07, 0.07, 0.04, 6]} />
                <Lam c={C.warm} />
              </mesh>
            );
          })}
        </group>
      </>
    ) : null}
  </group>
);

/** Main bearing caps along the crank, at each journal position. */
export const MainBearings: React.FC<{ xs: number[] }> = ({ xs }) => (
  <>
    {xs.map((x) => (
      <group key={x} position={[x, -0.36, 0]}>
        <mesh>
          <boxGeometry args={[0.2, 0.26, 1.15]} />
          <Lam c={C.metalDark} />
        </mesh>
        <mesh position={[0, 0.2, 0]} rotation={ALONG_X}>
          <cylinderGeometry args={[0.24, 0.24, 0.17, 12]} />
          <Lam c={C.bearing} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={s} position={[0, -0.16, s * 0.45]}>
            <boxGeometry args={[0.12, 0.08, 0.12]} />
            <Lam c={C.warm} />
          </mesh>
        ))}
      </group>
    ))}
  </>
);

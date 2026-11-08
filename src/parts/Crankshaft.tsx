import { C } from "../core/theme";
import { Lam } from "./Lam";

/** One crank pin: position along the crank, and its current angle about the crank axis (radians). */
export type CrankPin = { x: number; alpha: number };

/** A crankshaft generated from a pin layout. Flat-plane, cross-plane and shared-pin cranks are just different layouts. */
export const Crankshaft: React.FC<{ pins: CrankPin[]; throwR: number; length: number; webOffset?: number }> = ({
  pins,
  throwR,
  length,
  webOffset = 0.36,
}) => (
  <group>
    <mesh rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.2, 0.2, length, 10]} />
      <Lam c={C.metalLight} />
    </mesh>
    {pins.map(({ x, alpha }, k) => (
      <group key={k}>
        <mesh position={[x, throwR * Math.cos(alpha), throwR * Math.sin(alpha)]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.15, 0.15, 0.62, 8]} />
          <Lam c={C.metalLight} />
        </mesh>
        {[-webOffset, webOffset].map((dx) => (
          <group key={dx} position={[x + dx, 0, 0]} rotation={[alpha, 0, 0]}>
            <mesh position={[0, throwR / 2, 0]}>
              <boxGeometry args={[0.1, throwR + 0.34, 0.34]} />
              <Lam c={C.metalLight} />
            </mesh>
            <mesh position={[0, -0.42, 0]}>
              <boxGeometry args={[0.1, 0.42, 0.95]} />
              <Lam c={C.metal} />
            </mesh>
          </group>
        ))}
      </group>
    ))}
  </group>
);

import { hash } from "../../../core/math";
import { C } from "../theme";
import { Lam } from "../../../core/Lam";

const FUEL = "#9fe8ff";
const AIR = "#dfe7ff";

/** Spark plug with a bright spark while it fires. All in the cylinder's local frame. */
export const SparkPlug: React.FC<{ deck: number; crown: number; firing: boolean; seed: number }> = ({ deck, crown, firing, seed }) => (
  <>
    <mesh position={[0, deck + 0.42, 0]}>
      <cylinderGeometry args={[0.05, 0.05, 0.62, 6]} />
      <Lam c={C.body} />
    </mesh>
    {firing
      ? [0, 1, 2].map((i) => {
          const a = hash(seed, i) * Math.PI;
          return (
            <mesh key={i} position={[0, crown + 0.2, 0]} rotation={[a, a * 1.7, a * 0.6]}>
              <boxGeometry args={[0.05, 0.62, 0.05]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          );
        })
      : null}
  </>
);

/** Fuel injector on the intake side, spraying during the intake stroke. */
export const Injector: React.FC<{ deck: number; side: number; spraying: number; seed: number }> = ({ deck, side, spraying, seed }) => (
  <group position={[0, deck + 0.3, side * 0.58]} rotation={[side * 0.55, 0, 0]}>
    <mesh position={[0, 0.1, 0]}>
      <cylinderGeometry args={[0.05, 0.03, 0.32, 6]} />
      <Lam c={C.metalLight} />
    </mesh>
    {spraying >= 0
      ? Array.from({ length: 8 }, (_, i) => {
          const h = hash(seed, i * 13);
          const d = ((spraying + h) % 1) * 0.42;
          return (
            <mesh key={i} position={[(hash(i, seed) - 0.5) * d * 0.7, -0.08 - d, (hash(seed + 3, i) - 0.5) * d * 0.7]}>
              <boxGeometry args={[0.04, 0.04, 0.04]} />
              <meshBasicMaterial color={FUEL} />
            </mesh>
          );
        })
      : null}
  </group>
);

/** Intake trumpet in the V, with air streaking into it during the intake stroke. */
export const VelocityStack: React.FC<{ deck: number; side: number; drawing: number; seed: number }> = ({ deck, side, drawing, seed }) => (
  <group position={[0, deck + 0.9, side * 0.76]} rotation={[side * 0.42, 0, 0]}>
    <mesh position={[0, -0.12, 0]}>
      <cylinderGeometry args={[0.16, 0.13, 0.36, 10]} />
      <Lam c={C.metal} />
    </mesh>
    <mesh position={[0, 0.1, 0]}>
      <cylinderGeometry args={[0.26, 0.16, 0.1, 12]} />
      <Lam c={C.metalLight} />
    </mesh>
    {drawing >= 0
      ? Array.from({ length: 6 }, (_, i) => {
          const u = (drawing + hash(seed, i)) % 1;
          return (
            <mesh key={i} position={[(hash(i, seed + 1) - 0.5) * 0.3, 0.7 - u * 0.65, (hash(seed + 2, i) - 0.5) * 0.3]}>
              <boxGeometry args={[0.03, 0.2, 0.03]} />
              <meshBasicMaterial color={AIR} />
            </mesh>
          );
        })
      : null}
  </group>
);

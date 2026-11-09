import { C } from "../core/theme";
import { Lam } from "./Lam";

// Low, compact racing crankcase. Units: 1 = 10 cm. The engine origin is the crank centre.

/**
 * Sump, side-mounted oil scavenge pumps, front water pumps and a small clutch.
 * `length` runs along the crank, and the sump bottom sits just below the crank centre.
 */
export const F1Block: React.FC<{ length: number; bottom: number; clutchX: number; spin: number; showSump: boolean }> = ({ length, bottom, clutchX, spin, showSump }) => (
  <>
    {showSump ? (
      <>
        <mesh position={[0, bottom + 0.12, 0]}>
          <boxGeometry args={[length, 0.24, 1.7]} />
          <Lam c={C.trim} />
        </mesh>
        {[1, -1].map((s) => (
          <group key={s}>
            {/* scavenge pump housing runs nearly the full length of the crankcase */}
            <mesh position={[0, bottom + 0.34, s * 1.02]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.2, 0.2, length * 0.92, 10]} />
              <Lam c={C.metalDark} />
            </mesh>
            {[-1.5, -0.5, 0.5, 1.5].map((k) => (
              <mesh key={k} position={[k * 1.06, bottom + 0.34, s * 1.02]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.235, 0.235, 0.14, 10]} />
                <Lam c={C.warm} />
              </mesh>
            ))}
          </group>
        ))}
      </>
    ) : null}
    {[1, -1].map((s) => (
      <mesh key={s} position={[-length / 2 - 0.22, bottom + 0.7, s * 0.9]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.32, 0.32, 0.26, 12]} />
        <Lam c={C.metal} />
      </mesh>
    ))}
    {/* the clutch is tiny, so the crank can sit low */}
    <group position={[clutchX, 0, 0]} rotation={[spin, 0, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.48, 0.48, 0.26, 16]} />
        <Lam c={C.metalDark} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[0.14, Math.cos(a) * 0.3, Math.sin(a) * 0.3]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.05, 6]} />
            <Lam c={C.warm} />
          </mesh>
        );
      })}
    </group>
  </>
);

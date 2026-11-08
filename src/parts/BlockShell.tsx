import { C } from "../core/theme";
import { Lam } from "./Lam";

/** Head-face frame around one bore, in the cylinder's local frame. */
export const DeckFrame: React.FC<{ deck: number; spacing: number; boreR: number }> = ({ deck, spacing, boreR }) => (
  <>
    {[1, -1].map((s) => (
      <mesh key={s} position={[0, deck, s * (boreR + 0.13)]}>
        <boxGeometry args={[spacing, 0.08, 0.2]} />
        <Lam c={C.valley} />
      </mesh>
    ))}
    <mesh position={[spacing / 2, deck, 0]}>
      <boxGeometry args={[0.16, 0.08, 2 * boreR + 0.06]} />
      <Lam c={C.valley} />
    </mesh>
    {/* head bolts */}
    {[1, -1].flatMap((s) =>
      [-0.36, 0.36].map((dx) => (
        <mesh key={`${s}${dx}`} position={[dx, deck + 0.07, s * (boreR + 0.13)]}>
          <cylinderGeometry args={[0.055, 0.055, 0.06, 6]} />
          <Lam c={C.metalDark} />
        </mesh>
      )),
    )}
  </>
);

/** Glass cylinder sleeve around a piston. It glows when the cylinder fires. */
export const CylinderLiner: React.FC<{ y0: number; y1: number; r: number; heat: number }> = ({ y0, y1, r, heat }) => (
  <mesh position={[0, (y0 + y1) / 2, 0]}>
    <cylinderGeometry args={[r, r, y1 - y0, 16, 1, true]} />
    <meshLambertMaterial
      color={heat > 0.05 ? C.warm : C.cam}
      emissive={C.warm}
      emissiveIntensity={heat * 1.1}
      transparent
      opacity={0.14 + heat * 0.32}
      depthWrite={false}
      side={2}
    />
  </mesh>
);

/** Coil pack on top of a cylinder, with its connector. */
export const CoilPack: React.FC<{ y: number }> = ({ y }) => (
  <>
    <mesh position={[0, y, 0]}>
      <boxGeometry args={[0.34, 0.42, 0.22]} />
      <Lam c={C.coil} />
    </mesh>
    <mesh position={[0, y + 0.25, 0]}>
      <boxGeometry args={[0.18, 0.08, 0.16]} />
      <Lam c={C.red} />
    </mesh>
  </>
);

/** Valley floor, finned oil pan, bellhousing and engine mounts around the rotating parts. */
export const BlockShell: React.FC<{ showPan: boolean }> = ({ showPan }) => (
  <>
    <mesh position={[0, 1.15, 0]}>
      <boxGeometry args={[7.2, 0.1, 1.05]} />
      <Lam c={C.valley} />
    </mesh>
    <group visible={showPan}>
      <mesh position={[0, -1.35, 0]}>
        <boxGeometry args={[7.4, 0.5, 2.2]} />
        <Lam c={C.trim} />
      </mesh>
      {Array.from({ length: 13 }, (_, i) => (
        <mesh key={i} position={[(i - 6) * 0.56, -1.66, 0]}>
          <boxGeometry args={[0.1, 0.14, 2.1]} />
          <Lam c={C.metalDark} />
        </mesh>
      ))}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, -0.86, s * 1.5]}>
          <boxGeometry args={[1.2, 0.3, 0.8]} />
          <Lam c={C.metalDark} />
        </mesh>
      ))}
    </group>
    <mesh position={[4.15, 0.2, 0]}>
      <boxGeometry args={[0.35, 2.6, 2.9]} />
      <Lam c={C.metalDark} />
    </mesh>
    {Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return (
        <mesh key={i} position={[3.95, 0.2 + Math.cos(a) * 1.1, Math.sin(a) * 1.25]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.06, 6]} />
          <Lam c={C.warm} />
        </mesh>
      );
    })}
  </>
);

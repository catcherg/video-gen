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
  </>
);

/** Coil pack on top of a cylinder. */
export const CoilPack: React.FC<{ y: number }> = ({ y }) => (
  <mesh position={[0, y, 0]}>
    <boxGeometry args={[0.34, 0.42, 0.22]} />
    <Lam c={C.coil} />
  </mesh>
);

/** Valley floor, oil pan and bellhousing around the rotating parts. */
export const BlockShell: React.FC<{ showPan: boolean }> = ({ showPan }) => (
  <>
    <mesh position={[0, 1.15, 0]}>
      <boxGeometry args={[7.2, 0.1, 1.05]} />
      <Lam c={C.valley} />
    </mesh>
    <mesh position={[0, -1.35, 0]} visible={showPan}>
      <boxGeometry args={[7.4, 0.5, 2.2]} />
      <Lam c={C.trim} />
    </mesh>
    <mesh position={[4.15, 0.2, 0]}>
      <boxGeometry args={[0.35, 2.6, 2.9]} />
      <Lam c={C.metalDark} />
    </mesh>
  </>
);

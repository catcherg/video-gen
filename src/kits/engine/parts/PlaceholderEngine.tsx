import { D2R } from "../../../core/math";
import { C } from "../theme";
import { Crankshaft, type CrankPin } from "./Crankshaft";
import { Lam } from "../../../core/Lam";
import { crankPinInBank, PistonRod, wristDistance } from "./PistonRod";

export type PlaceholderCylinder = { cyl: number; x: number; bankRad: number; c: number };

/** Crank pin for the given cylinder, placed from that cylinder's own timing. */
export const pinFor = (x: number, bankRad: number, c: number): CrankPin => ({ x, alpha: bankRad + (c % 360) * D2R });

/**
 * Stand-in engine for a new episode: real piston and crank motion, plain block.
 * Replace it with detailed parts when the episode's full scene is built.
 */
export const PlaceholderEngine: React.FC<{
  origin: [number, number, number];
  cylinders: PlaceholderCylinder[];
  pins: CrankPin[];
  crankR: number;
  rodL: number;
  length: number;
}> = ({ origin, cylinders, pins, crankR, rodL, length }) => (
  <group position={origin}>
    <Crankshaft pins={pins} throwR={crankR} length={length} />
    {cylinders.map(({ cyl, x, bankRad, c }) => {
      const cm = c % 360;
      const wrist = wristDistance(cm, crankR, rodL);
      return (
        <group key={cyl} position={[x, 0, 0]} rotation={[bankRad, 0, 0]}>
          <PistonRod crown={wrist + 0.32} wrist={wrist} pin={crankPinInBank(cm, crankR)} radius={0.44} height={0.5} heat={c < 110 ? 1 - c / 110 : 0} />
        </group>
      );
    })}
    <mesh position={[0, -1.35, 0]}>
      <boxGeometry args={[length, 0.5, 2.2]} />
      <Lam c={C.trim} />
    </mesh>
  </group>
);

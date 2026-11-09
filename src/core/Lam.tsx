import { createContext, useContext } from "react";
import * as THREE from "three";
import { usePalette } from "./palette";

/** How far parts inside this provider are faded back, 0 (full colour) to 1 (almost background). */
export const DimContext = createContext(0);

const DIM_TARGET = new THREE.Color("#23254a");

export const dimmed = (hex: string, dim: number, target: THREE.ColorRepresentation = DIM_TARGET) => new THREE.Color(hex).lerp(new THREE.Color(target), dim);

/** Flat-shaded Lambert material, the look used by every solid model. */
export const Lam: React.FC<{ c: string; e?: string; ei?: number }> = ({ c, e, ei }) => {
  const dim = useContext(DimContext);
  const { fade } = usePalette();
  return <meshLambertMaterial color={dimmed(c, dim, fade)} emissive={e ?? "#000000"} emissiveIntensity={(ei ?? 0) * (1 - dim)} flatShading />;
};

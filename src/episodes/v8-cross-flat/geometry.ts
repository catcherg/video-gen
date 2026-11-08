// Placeholder model dimensions, shared by the scene and the overlay. Units: 1 = 10 cm.
import type { V8 } from "./physics";

export const ROD_L = 1.5;
export const CYL_SPACING = 1.12;
export const BANK_SHIFT = 0.28; // one bank sits slightly forward so paired rods can share a pin
export const ROWS = 4;
export const ORIGIN: [number, number, number] = [0, 3.2, 0];
export const CRANK_LENGTH = ROWS * CYL_SPACING + 1;

export const crankRadius = (v8: V8) => v8.strokeMm / 200;
export const cylX = (v8: V8, cyl: number) => (v8.row(cyl) - 1.5) * CYL_SPACING + (v8.isRight(cyl) ? -BANK_SHIFT / 2 : BANK_SHIFT / 2);

// The engine kit's palette: the base palette plus a colour for every part and stroke.
import { C as BASE } from "../../core/theme";

export { FONT, PIXEL_SIZE, UI } from "../../core/theme";

export const C = {
  ...BASE,
  body: "#e3e5f3",
  bodyShade: "#c9cce4",
  trim: "#2a2c4a",
  glass: "#33365a",
  red: "#e5354b",
  tail: "#ff4a5c",
  metalLight: "#c4c8e4",
  metal: "#9297c1",
  metalDark: "#5a5f8e",
  cam: "#a7acd2",
  spring: "#7a80b0",
  valley: "#e9d7a3",
  coil: "#1a1b2c",
  header: "#e2662d",
  crank: "#8187b3",
  rim: "#9ea3c8",
  tyre: "#1c1d30",
  hot: "#fff27a",
  warm: "#ffa133",
  // Colour language for parts: the same colour means the same job in every shot and diagram.
  crankGold: "#f2c14e",
  bearing: "#c98a2e",
  rodRight: "#5cc8ff",
  rodLeft: "#6ee7b0",
  intake: "#4fc3ff",
  exhaust: "#ff6a4d",
  camLobe: "#f4f1ff",
  gear: "#f0a13a",
  finger: "#ffe066",
  air: "#7ff5d2",
};

/** What each of the four strokes looks like, in 3D gas and in diagrams. */
export const STROKE_COLORS: Record<string, string> = {
  BANG: "#ffd84d",
  EXHAUST: "#ff8a4d",
  INTAKE: "#4fc3ff",
  SQUEEZE: "#a78bff",
};

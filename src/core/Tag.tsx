import { FONT, UI } from "./theme";

/** Small label box, centred on a projected screen point. */
export const Tag: React.FC<{ x: number; y: number; text: string; hot?: boolean; size?: number }> = ({ x, y, text, hot, size = 26 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: "translate(-50%, -50%)",
      background: hot ? UI.yellow : UI.ink,
      color: hot ? UI.ink : UI.cream,
      border: `3px solid ${hot ? UI.yellow : UI.cream}`,
      fontFamily: FONT.label,
      fontWeight: 700,
      fontSize: size,
      padding: "2px 8px 0",
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </div>
);

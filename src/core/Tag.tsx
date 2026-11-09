import { usePalette } from "./palette";
import { FONT } from "./theme";

/** Small label box, centred on a projected screen point. */
export const Tag: React.FC<{ x: number; y: number; text: string; hot?: boolean; size?: number }> = ({ x, y, text, hot, size = 26 }) => {
  const { ink, text: cream, accent } = usePalette();
  return (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: "translate(-50%, -50%)",
      background: hot ? accent : ink,
      color: hot ? ink : cream,
      border: `3px solid ${hot ? accent : cream}`,
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
};

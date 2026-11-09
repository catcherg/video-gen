import { Tag } from "./Tag";
import { usePalette } from "./palette";
import { FONT } from "./theme";

const CHAR_PX = 20;

/** A label at a fixed screen position with a leader line to a point on a part. */
export const Callout: React.FC<{ x: number; y: number; px: number; py: number; text: string; color?: string; hot?: boolean; size?: number }> = ({ x, y, px, py, text, color, hot, size = 24 }) => {
  const { ink, text: cream } = usePalette();
  const stroke = color ?? cream;
  const halfW = (text.length * CHAR_PX * (size / 24)) / 2 + 10;
  const startX = px > x ? x + halfW : x - halfW;
  return (
    <>
      <svg data-leader={`${startX},${y},${px},${py}`} width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        <line x1={startX} y1={y} x2={px} y2={py} stroke={ink} strokeWidth={7} />
        <line x1={startX} y1={y} x2={px} y2={py} stroke={stroke} strokeWidth={3} />
        <rect x={px - 6} y={py - 6} width={12} height={12} fill={stroke} stroke={ink} strokeWidth={2} />
      </svg>
      <div style={{ fontFamily: FONT.label }}>
        <Tag x={x} y={y} text={text} size={size} hot={hot} />
      </div>
    </>
  );
};

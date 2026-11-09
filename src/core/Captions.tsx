import type { Rect } from "./layout";
import { COMPACT_CAPTION_PX } from "./layout";
import { usePalette } from "./palette";
import { FONT } from "./theme";

export type Caption = { from: number; to: number; lines: string[]; size?: "big" | "small" | "compact"; y?: number };

const CHARS_PER_S = 42;
const LINE_GAP_S = 0.18;

/** Seconds until every line has finished typing. */
export const typingSeconds = (lines: string[]) => lines.reduce((sum, line) => sum + line.length / CHARS_PER_S, 0) + (lines.length - 1) * LINE_GAP_S;
const DEFAULT_Y = 1290;

/** Typewriter captions: each line types on in sequence. Pass `region` to keep them inside a layout region. */
export const Captions: React.FC<{ t: number; captions: Caption[]; region?: Rect }> = ({ t, captions, region }) => {
  const { ink, text } = usePalette();
  const cap = captions.find((c) => t >= c.from && t < c.to);
  if (!cap) return null;
  const big = cap.size === "big";
  let start = cap.from;
  const shown = cap.lines.map((line) => {
    const n = Math.max(0, Math.min(line.length, Math.floor((t - start) * CHARS_PER_S)));
    start += line.length / CHARS_PER_S + LINE_GAP_S;
    return { line, n };
  });
  const fade = Math.min(1, (cap.to - t) / 0.15, (t - cap.from) / 0.08);
  const allLen = Math.max(...cap.lines.map((l) => l.length));
  return (
    <div
      style={{
        position: "absolute",
        top: cap.y ?? region?.y ?? DEFAULT_Y,
        left: region?.x ?? 0,
        ...(region ? { width: region.w } : { right: 0 }),
        display: "flex",
        justifyContent: "center",
        opacity: fade,
      }}
    >
      <div
        data-audit="caption"
        style={{
          background: ink,
          border: `4px solid ${text}`,
          boxShadow: `0 0 0 4px ${ink}`,
          padding: big ? "14px 30px 10px" : "10px 26px 6px",
          fontFamily: FONT.display,
          fontSize: big ? 84 : cap.size === "compact" ? COMPACT_CAPTION_PX : 70,
          lineHeight: 1.0,
          color: text,
          textAlign: "center",
          minWidth: `${allLen * 0.5}em`,
          letterSpacing: 2,
        }}
      >
        {shown.map(({ line, n }, i) => (
          <div key={i} style={{ whiteSpace: "pre" }}>
            <span>{line.slice(0, n)}</span>
            <span style={{ opacity: 0 }}>{line.slice(n)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

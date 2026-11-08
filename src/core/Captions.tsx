import { FONT, UI } from "./theme";

export type Caption = { from: number; to: number; lines: string[]; size?: "big" | "small"; y?: number };

const CHARS_PER_S = 42;
const DEFAULT_Y = 1290;

/** Typewriter captions: each line types on in sequence. */
export const Captions: React.FC<{ t: number; captions: Caption[] }> = ({ t, captions }) => {
  const cap = captions.find((c) => t >= c.from && t < c.to);
  if (!cap) return null;
  const big = cap.size === "big";
  let start = cap.from;
  const shown = cap.lines.map((line) => {
    const n = Math.max(0, Math.min(line.length, Math.floor((t - start) * CHARS_PER_S)));
    start += line.length / CHARS_PER_S + 0.18;
    return { line, n };
  });
  const fade = Math.min(1, (cap.to - t) / 0.15, (t - cap.from) / 0.08);
  const allLen = Math.max(...cap.lines.map((l) => l.length));
  return (
    <div
      style={{
        position: "absolute",
        top: cap.y ?? DEFAULT_Y,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity: fade,
      }}
    >
      <div
        style={{
          background: UI.ink,
          border: `4px solid ${UI.cream}`,
          boxShadow: `0 0 0 4px ${UI.ink}`,
          padding: big ? "14px 30px 10px" : "10px 26px 6px",
          fontFamily: FONT.display,
          fontSize: big ? 84 : 70,
          lineHeight: 1.0,
          color: UI.cream,
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

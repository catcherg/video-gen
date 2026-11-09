import { REGIONS, type Rect } from "./layout";
import { typedChars } from "./motion";
import { usePalette } from "./palette";
import { FONT } from "./theme";

/** A big line of text that types on at the top of the safe zone. */
export const Headline: React.FC<{ t: number; at: number; text: string; size?: number; region?: Rect }> = ({ t, at, text, size = 88, region = REGIONS.title }) => {
  const { accent, ink } = usePalette();
  if (t < at) return null;
  const shown = typedChars(text, t, at);
  return (
    <div style={{ position: "absolute", left: region.x, top: region.y, width: region.w, height: region.h, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div data-audit="headline" style={{ fontFamily: FONT.display, fontSize: size, lineHeight: 1, color: accent, textAlign: "center", background: ink, padding: "8px 24px 4px", whiteSpace: "pre" }}>
        <span>{text.slice(0, shown)}</span>
        <span style={{ opacity: 0 }}>{text.slice(shown)}</span>
      </div>
    </div>
  );
};

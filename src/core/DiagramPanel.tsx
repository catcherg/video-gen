// The frame for a live 2D diagram, under the captions.
import { usePalette, withAlpha } from "./palette";
import { FONT } from "./theme";

export const PANEL = { left: 70, top: 1478, width: 940, height: 280 };

export const DiagramPanel: React.FC<{ title: string; fade: number; children: React.ReactNode }> = ({ title, fade, children }) => {
  const { ink, text, dim, border } = usePalette();
  return (
  <div
    style={{
      position: "absolute",
      left: PANEL.left,
      top: PANEL.top,
      width: PANEL.width,
      height: PANEL.height,
      boxSizing: "border-box",
      background: withAlpha(ink, 0.92),
      border: `4px solid ${border}`,
      boxShadow: `0 0 0 4px ${ink}`,
      padding: "12px 22px",
      opacity: fade,
      color: text,
    }}
  >
    <div style={{ fontFamily: FONT.label, fontSize: 22, color: dim, marginBottom: 6 }}>{title}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 26 }}>{children}</div>
  </div>
  );
};

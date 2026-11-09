// The frame for a live 2D diagram, under the captions.
import { FONT, UI } from "./theme";

export const PANEL = { left: 70, top: 1478, width: 940, height: 280 };

export const DiagramPanel: React.FC<{ title: string; fade: number; children: React.ReactNode }> = ({ title, fade, children }) => (
  <div
    style={{
      position: "absolute",
      left: PANEL.left,
      top: PANEL.top,
      width: PANEL.width,
      height: PANEL.height,
      boxSizing: "border-box",
      background: "rgba(13,14,31,0.92)",
      border: `4px solid ${UI.border}`,
      boxShadow: `0 0 0 4px ${UI.ink}`,
      padding: "12px 22px",
      opacity: fade,
      color: UI.cream,
    }}
  >
    <div style={{ fontFamily: FONT.label, fontSize: 22, color: UI.dim, marginBottom: 6 }}>{title}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 26 }}>{children}</div>
  </div>
);

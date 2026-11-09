// Reports where every piece of on-screen text really landed, once the fonts have loaded.
// Only mounted for automated checks. It draws nothing, so it can't affect a finished video.
import { useEffect, useState } from "react";
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT } from "./theme";

/** Marks the console message that scripts/lib/videoChecks.ts reads. */
export const AUDIT_PREFIX = "LAYOUT_AUDIT ";

const FONT_WAIT_MS = 3000;
const POLL_MS = 20;

const opacityOf = (el: Element | null): number => {
  let product = 1;
  for (let node = el; node; node = node.parentElement) product *= Number(getComputedStyle(node).opacity);
  return product;
};

const VISIBLE = 0.05;

const box = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { text: (el.textContent ?? "").trim(), x: r.x, y: r.y, w: r.width, h: r.height };
};

export const AuditProbe: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const [handle] = useState(() => delayRender("layout audit"));
  useEffect(() => {
    const started = performance.now();
    const measure = () => {
      const fontsReady = document.fonts.check(`16px "${FONT.display}"`) && document.fonts.check(`16px "${FONT.label}"`);
      if (!fontsReady && performance.now() - started < FONT_WAIT_MS) {
        setTimeout(measure, POLL_MS);
        return;
      }
      const marked = [...document.querySelectorAll("[data-audit]")].filter((el) => opacityOf(el) > VISIBLE);
      const boxes = marked.map((el) => ({ kind: (el as HTMLElement).dataset.audit ?? "", ...box(el) }));
      const texts = marked.flatMap((el, card) => [...el.querySelectorAll("svg text")].filter((t) => opacityOf(t) > VISIBLE).map((t) => ({ kind: "text", card, ...box(t) })));
      const leaders = [...document.querySelectorAll("[data-leader]")].map((el) => {
        const [x1, y1, x2, y2] = ((el as HTMLElement).dataset.leader ?? "").split(",").map(Number);
        return { x1, y1, x2, y2 };
      });
      console.log(AUDIT_PREFIX + JSON.stringify({ frame, width, height, fontsReady, boxes, texts, leaders }));
      continueRender(handle);
    };
    measure();
  }, [frame, handle, height, width]);
  return null;
};

import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import { FONT } from "./theme";

/** Blocks rendering until the pixel fonts are ready, so no frame can draw with a fallback. */
export const useFonts = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    const faces = [
      new FontFace(FONT.display, `url(${staticFile("fonts/vt323.woff2")})`),
      new FontFace(FONT.label, `url(${staticFile("fonts/silkscreen.woff2")})`),
      new FontFace(FONT.label, `url(${staticFile("fonts/silkscreen-bold.woff2")})`, { weight: "700" }),
    ];
    Promise.all(faces.map((f) => f.load()))
      .then((loaded) => {
        loaded.forEach((f) => document.fonts.add(f));
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [handle]);
};

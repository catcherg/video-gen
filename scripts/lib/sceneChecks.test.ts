import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkSource } from "./sceneChecks";
import { ROOT } from "./episode";

const rulesFor = (source: string, kit?: string) => checkSource("videos/demo/scene.tsx", source, { videoDir: "videos/demo", kit }).map((f) => f.rule);

describe("checkSource", () => {
  const bad: [string, string, string][] = [
    ["Math.random", "export const x = Math.random();", "random"],
    ["computed Math.random", 'export const x = Math["random"]();', "random"],
    ["the clock", "export const x = Date.now();", "forbidden-global"],
    ["new Date", "export const x = new Date();", "forbidden-global"],
    ["performance", "export const x = performance.now();", "forbidden-global"],
    ["window", "export const x = window.innerWidth;", "forbidden-global"],
    ["process", "export const x = process.env.KEY;", "forbidden-global"],
    ["globalThis", "export const x = globalThis;", "forbidden-global"],
    ["useState", 'import { useState } from "react"; export const f = () => useState(0);', "stateful-hook"],
    ["useEffect", 'import { useEffect } from "react"; export const f = () => useEffect(() => {});', "stateful-hook"],
    ["React.useRef", 'import React from "react"; export const f = () => React.useRef(0);', "stateful-hook"],
    ["useFrame", "export const f = () => useFrame(() => {});", "stateful-hook"],
    ["timers", "setTimeout(() => {}, 1);", "forbidden-call"],
    ["fetch", 'fetch("/x");', "forbidden-call"],
    ["eval", 'eval("1");', "forbidden-call"],
    ["new Function", 'new Function("return 1");', "forbidden-call"],
    ["WebSocket", 'new WebSocket("/x");', "forbidden-call"],
    ["dynamic import", 'import("./x");', "dynamic-import"],
    ["node modules", 'import fs from "node:fs";', "import"],
    ["other packages", 'import x from "left-pad";', "import"],
    ["another video", 'import { x } from "../other/physics";', "import"],
    ["outside the framework", 'import { x } from "../../scripts/lib/episode";', "import"],
    ["re-export from outside", 'export { x } from "../other/physics";', "import"],
    ["URL", 'export const x = "https://example.com/a.png";', "url"],
    ["URL in a template", "export const x = `https://example.com/${1}`;", "url"],
    ["raw HTML", 'export const X = () => <div dangerouslySetInnerHTML={{ __html: "" }} />;', "raw-html"],
    ["iframe", 'export const X = () => <iframe src="/a" />;', "raw-html"],
  ];
  it.each(bad)("catches %s", (_, source, rule) => {
    expect(rulesFor(source)).toContain(rule);
  });

  it("restricts a video to its own kit when one is named", () => {
    const source = 'import { x } from "../../src/kits/other/y";';
    expect(rulesFor(source, "engine")).toContain("import");
    expect(rulesFor(source)).toEqual([]);
  });

  const good: [string, string][] = [
    ["its own files", 'import { x } from "./physics"; export const y = x;'],
    ["core", 'import { hash } from "../../src/core/math"; export const y = hash(1, 2);'],
    ["allowed packages", 'import * as THREE from "three"; import { useCurrentFrame } from "remotion"; export const f = () => [THREE, useCurrentFrame()];'],
    ["useMemo", 'import { useMemo } from "react"; export const f = () => useMemo(() => 1, []);'],
    ["property names that match globals", "const a = { window: 1, Date: 2 }; export const b = a.window + a.Date;"],
    ["type annotations", "type T = Date; export const f = (d: T) => d;"],
    ["words in strings and comments", '// Math.random and fetch\nexport const x = "window and Date.now";'],
  ];
  it.each(good)("allows %s", (_, source) => {
    expect(rulesFor(source)).toEqual([]);
  });

  it("reports the line, and reports a parse failure instead of throwing", () => {
    expect(checkSource("videos/demo/a.ts", "\n\nMath.random();", { videoDir: "videos/demo" })[0].line).toBe(3);
    expect(checkSource("videos/demo/a.ts", "const = ;", { videoDir: "videos/demo" })[0].rule).toBe("parse");
  });

  it("passes every finished video", () => {
    const videos = readdirSync(path.join(ROOT, "videos"), { withFileTypes: true }).filter((e) => e.isDirectory());
    const findings = videos.flatMap((v) =>
      readdirSync(path.join(ROOT, "videos", v.name))
        .filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."))
        .flatMap((f) => checkSource(`videos/${v.name}/${f}`, readFileSync(path.join(ROOT, "videos", v.name, f), "utf8"), { videoDir: `videos/${v.name}`, kit: "engine" })),
    );
    expect(findings).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTime, validateSpec } from "../../src/core/spec";
import { spec } from "./meta";
import rawSpec from "./spec.json";
import { CAPTIONS, panelAt } from "./timeline";

describe("v12 spec", () => {
  it("is valid", () => {
    expect(validateSpec(rawSpec)).toEqual([]);
  });

  it("fills every caption token", () => {
    expect(CAPTIONS).toHaveLength(spec.captions.length);
    expect(CAPTIONS.flatMap((c) => c.lines).filter((line) => /[{}]/.test(line))).toEqual([]);
  });

  it("names the diagram that is really on screen in each shot", () => {
    for (const shot of spec.shots) {
      const middle = (resolveTime(spec, shot.from) + resolveTime(spec, shot.to)) / 2;
      expect(panelAt(middle)?.kind, shot.subject).toBe(shot.diagram);
    }
  });

  it("records the song hash approved in the project status", () => {
    const status = readFileSync(path.resolve(import.meta.dirname, "../../docs/PROJECT_STATUS.md"), "utf8");
    expect(status).toContain(`| \`v12\` | \`${spec.song.lockedWavSha256}\` |`);
  });
});

// Keeps the framework's layers apart: core knows nothing about subjects, and videos stand alone.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SUBJECT_WORDS = /\b(engines?|pistons?|crank\w*|cylinders?|rpm|firing|bangs?|valves?|four.?stroke)\b/i;
const IMPORT = /(?:from\s+|import\s*\(\s*|import\s+)"(\.[^"]+)"/g;

const sourceFiles = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "output" ? [] : sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [rel] : [];
  });

/** Repository-relative paths this file imports. */
const importsOf = (file: string) => [...readFileSync(path.join(ROOT, file), "utf8").matchAll(IMPORT)].map((m) => path.join(path.dirname(file), m[1]));

describe("framework boundaries", () => {
  it("core imports only core", () => {
    const leaks = sourceFiles("src/core").flatMap((file) => importsOf(file).filter((target) => !target.startsWith("src/core")).map((target) => `${file} -> ${target}`));
    expect(leaks).toEqual([]);
  });

  it("core never mentions a subject", () => {
    const mentions = sourceFiles("src/core").flatMap((file) =>
      readFileSync(path.join(ROOT, file), "utf8")
        .split("\n")
        .flatMap((line, i) => (SUBJECT_WORDS.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [])),
    );
    expect(mentions).toEqual([]);
  });

  it("kits never import a video", () => {
    const leaks = sourceFiles("src/kits").flatMap((file) => importsOf(file).filter((target) => target.startsWith("videos")).map((target) => `${file} -> ${target}`));
    expect(leaks).toEqual([]);
  });

  it("each video imports only itself and the framework", () => {
    const leaks = sourceFiles("videos")
      .filter((file) => file !== path.join("videos", "registry.ts"))
      .flatMap((file) => {
        const own = file.split(path.sep).slice(0, 2).join(path.sep);
        return importsOf(file)
          .filter((target) => !target.startsWith(own + path.sep) && !target.startsWith("src"))
          .map((target) => `${file} -> ${target}`);
      });
    expect(leaks).toEqual([]);
  });
});

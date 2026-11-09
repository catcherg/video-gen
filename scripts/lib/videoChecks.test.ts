import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import type { VideoSpec } from "../../src/core/spec";
import { audioLagS, makeAudibleDelay } from "./audible";
import { classifyDiff, decodePng, diffImages, dominantShare, type Image } from "./pngDiff";
import { auditLayout, checkCaptionNumbers, checkCaptionTiming, checkHitSync, pickFrames, type AuditBox, type AuditReport } from "./videoChecks";

const box = (kind: string, x: number, y: number, w: number, h: number, text = kind): AuditBox => ({ kind, text, x, y, w, h });
const report = (over: Partial<AuditReport>): AuditReport => ({ frame: 5, width: 1080, height: 1920, fontsReady: true, boxes: [], texts: [], leaders: [], ...over });
const checks = (r: AuditReport, strict = true) => auditLayout(r, strict).map((f) => f.check);

const CAPTION = box("caption", 150, 1110, 700, 130);
const DIAGRAM = box("diagram", 120, 850, 780, 240);

describe("auditLayout", () => {
  it("passes a clean frame", () => {
    expect(checks(report({ boxes: [box("headline", 300, 280, 400, 100), DIAGRAM, CAPTION] }))).toEqual([]);
  });

  it("finds text outside the safe zone", () => {
    expect(checks(report({ boxes: [box("caption", 150, 1300, 700, 130)] }))).toContain("safe-zone");
    expect(checks(report({ boxes: [box("headline", 300, 200, 400, 100)] }))).toContain("safe-zone");
  });

  it("only warns about layout on videos that predate the safe zones", () => {
    const findings = auditLayout(report({ boxes: [box("caption", 150, 1300, 700, 130)] }), false);
    expect(findings.map((f) => f.severity)).toEqual(["warning"]);
  });

  it("always fails text that runs off the frame", () => {
    expect(auditLayout(report({ boxes: [box("label", 1000, 500, 200, 40)] }), false)[0]).toMatchObject({ check: "off-frame", severity: "error" });
  });

  it("finds overlaps but ignores a rounding sliver", () => {
    expect(checks(report({ boxes: [DIAGRAM, box("caption", 150, 1060, 700, 130)] }))).toContain("overlap");
    expect(checks(report({ boxes: [DIAGRAM, box("caption", 150, 1089, 700, 130)] }))).not.toContain("overlap");
  });

  it("finds diagram text that spills or collides", () => {
    const text = (x: number, label: string) => ({ ...box("text", x, 900, 120, 30, label), card: 0 });
    expect(checks(report({ boxes: [DIAGRAM], texts: [text(850, "WIDE")] }))).toContain("clipped-text");
    expect(checks(report({ boxes: [DIAGRAM], texts: [text(200, "A"), text(260, "B")] }))).toContain("text-collision");
    expect(checks(report({ boxes: [DIAGRAM], texts: [text(200, "A"), text(400, "B")] }))).toEqual([]);
  });

  it("finds leader lines that cross things or end at the safe-zone edge", () => {
    const label = box("label", 200, 500, 200, 40);
    expect(checks(report({ boxes: [label], leaders: [{ x1: 400, y1: 520, x2: 600, y2: 700 }] }))).toEqual([]);
    expect(checks(report({ boxes: [label, box("headline", 500, 600, 200, 50)], leaders: [{ x1: 400, y1: 520, x2: 700, y2: 700 }] }))).toContain("leader-crossing");
    expect(checks(report({ boxes: [label], leaders: [{ x1: 400, y1: 520, x2: 600, y2: 270 }] }))).toContain("leader-target");
    expect(checks(report({ leaders: [{ x1: 200, y1: 500, x2: 600, y2: 800 }, { x1: 600, y1: 500, x2: 200, y2: 800 }] }))).toContain("leader-crossing");
  });

  it("refuses a frame measured before the fonts loaded", () => {
    expect(checks(report({ fontsReady: false }))).toContain("fonts");
  });
});

describe("checkCaptionTiming", () => {
  it("passes a caption with time to be read", () => {
    expect(checkCaptionTiming([{ from: 0, to: 2, lines: ["SHORT LINE"] }], true)).toEqual([]);
  });

  it("catches the caption that finished typing as it vanished", () => {
    const lines = ["ABOUT 90% OF BANDANESE WERE", "KILLED, ENSLAVED OR DEPORTED"];
    expect(checkCaptionTiming([{ from: 0, to: 1.63, lines }], true)[0].check).toBe("caption-time");
  });
});

describe("checkCaptionNumbers", () => {
  const spec = (lines: string[]): VideoSpec =>
    ({
      facts: [
        { id: "a", claim: "A", value: 1602, confidence: "primary", sources: ["x"] },
        { id: "b", claim: "B", value: [1780, 1784], confidence: "primary", sources: ["x"] },
      ],
      captions: [{ from: 0, to: 1, lines }],
    }) as unknown as VideoSpec;

  it("accepts numbers that are facts, abbreviated years and computed tokens", () => {
    expect(checkCaptionNumbers(spec(["IN 1602", "1780-84", "{ratio}× MORE"]), true)).toEqual([]);
  });

  it("flags a number nobody sourced", () => {
    expect(checkCaptionNumbers(spec(["ABOUT 500 SHIPS"]), true)[0].message).toContain("500");
  });
});

describe("pickFrames", () => {
  it("samples completed captions and shot middles, once each, in order", () => {
    expect(pickFrames(300, 30, [{ from: 0, to: 2, lines: ["A"] }], [{ from: 0, to: 4 }])).toEqual([54, 60]);
  });

  it("falls back to even sampling and respects the limit", () => {
    expect(pickFrames(300, 30, [], [], 4)).toEqual([38, 113, 188, 263]);
    expect(pickFrames(3000, 30, Array.from({ length: 60 }, (_, i) => ({ from: i, to: i + 1, lines: ["A"] })), [], 12, 10)).toHaveLength(10);
  });
});

describe("checkHitSync", () => {
  it("passes hits on their frame", () => {
    expect(checkHitSync([1, 2], [30, 60], () => 0, 30, "kick")).toEqual([]);
  });

  it("fails a picture that leads its sound", () => {
    expect(checkHitSync([1], [29], () => 0, 30, "kick")[0].message).toContain("before");
  });

  it("fails a picture that lags, and a mismatched map", () => {
    expect(checkHitSync([1], [33], () => 0, 30, "kick")[0].message).toContain("after");
    expect(checkHitSync([1, 2], [30], () => 0, 30, "kick")[0].message).toContain("song map");
  });

  it("allows for a fade that delays a hit", () => {
    expect(checkHitSync([0], [2], () => 0.053, 30, "kick")).toEqual([]);
  });
});

const makeWav = (samples: (i: number) => number, count: number, rate = 48000) => {
  const b = Buffer.alloc(44 + count * 4);
  b.writeUInt32LE(rate, 24);
  for (let i = 0; i < count; i++) {
    const v = Math.round(samples(i) * 20000);
    b.writeInt16LE(v, 44 + i * 4);
    b.writeInt16LE(v, 46 + i * 4);
  }
  return b;
};

describe("audio measurement", () => {
  const burstAt = (start: number, gap = 4800) => (i: number) => (i >= start && (i - start) % gap < 960 ? Math.sin(i * 0.3) : 0);

  it("measures when a hit becomes audible", () => {
    const wav = makeWav(burstAt(24000 + 960), 48000);
    expect(makeAudibleDelay(wav)(0.5)).toBeCloseTo(0.02, 2);
  });

  it("measures the lag between two copies of a song", () => {
    const pattern = (offset: number) => (i: number) => {
      const j = i - offset;
      return j >= 0 && (j % 9000 < 700 || j % 13000 < 400) ? Math.sin(i * 0.3) : 0;
    };
    expect(audioLagS(makeWav(pattern(0), 96000), makeWav(pattern(2400), 96000))).toBeCloseTo(0.05, 2);
  });
});

const crc = zlib.crc32 as unknown as (d: Buffer) => number;

const makePng = (w: number, h: number, pixel: (x: number, y: number) => [number, number, number], filter = 0) => {
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = filter;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      const left = filter === 1 && x > 0 ? pixel(x - 1, y) : [0, 0, 0];
      raw[y * (w * 3 + 1) + 1 + x * 3] = (r - left[0]) & 255;
      raw[y * (w * 3 + 1) + 2 + x * 3] = (g - left[1]) & 255;
      raw[y * (w * 3 + 1) + 3 + x * 3] = (b - left[2]) & 255;
    }
  }
  const chunk = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, "latin1");
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), body])) >>> 0, 0);
    return Buffer.concat([head, body, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};

describe("png tools", () => {
  const solid = (r: number): Image => decodePng(makePng(100, 100, () => [r, 0, 0]));

  it.each([0, 1])("decodes filter type %i", (filter) => {
    const img = decodePng(makePng(4, 2, (x, y) => [x * 10, y * 20, 7], filter));
    expect([...img.data.subarray(9, 12)]).toEqual([30, 0, 7]);
    expect([...img.data.subarray(12, 15)]).toEqual([0, 20, 7]);
  });

  it("classifies identical, noisy and changed frames", () => {
    const a = solid(100);
    expect(classifyDiff(diffImages(a, a))).toBe("identical");
    expect(classifyDiff(diffImages(a, solid(200)))).toBe("changed");
    expect(classifyDiff({ pixels: 60, share: 0.00003, maxDelta: 13 })).toBe("noise");
    expect(classifyDiff({ pixels: 60, share: 0.00003, maxDelta: 90 })).toBe("changed");
    expect(classifyDiff({ pixels: 9000, share: 0.01, maxDelta: 3 })).toBe("changed");
  });

  it("spots an empty region", () => {
    expect(dominantShare(solid(100), { x: 0, y: 0, w: 100, h: 100 })).toBe(1);
    const busy = decodePng(makePng(100, 100, (x) => [x * 2, 0, 0]));
    expect(dominantShare(busy, { x: 0, y: 0, w: 100, h: 100 })).toBeLessThan(0.1);
  });
});

// Where things can safely go on a 1080×1920 frame, clear of the Reels and TikTok buttons and captions.
//
// Sources: neither platform's own page could be found, and third-party guides disagree, so this is low confidence.
//   Instagram Reels, 14% top and 35% bottom, attributed to Meta:
//     https://www.hopperhq.com/blog/instagram-reel-size/
//   TikTok, 240 top, 660 bottom, 120 sides, 180-wide button column from y=840, said to match TikTok's template:
//     https://www.socialync.io/tools/safe-zones/tiktok
// The zone below takes the stricter figure from each. Check it against a real upload on each platform.

export type Rect = { x: number; y: number; w: number; h: number };

export const FRAME = { w: 1080, h: 1920 };

export const SAFE = {
  top: 270,
  bottom: 1248,
  left: 120,
  right: 960,
  /** From here down, the platform's button column narrows the frame on the right. */
  buttonsFrom: 840,
  rightBesideButtons: 900,
};

/** One column of content inside the safe zone: headline, subject, optional diagram, then the caption. */
export const REGIONS = {
  title: { x: 120, y: 270, w: 840, h: 120 },
  subject: { x: 120, y: 400, w: 840, h: 430 },
  panel: { x: 120, y: 850, w: 780, h: 240 },
  caption: { x: 120, y: 1100, w: 780, h: 148 },
} satisfies Record<string, Rect>;

/** True when a rectangle stays clear of every platform overlay. */
export const rectIsSafe = (r: Rect) => {
  const right = r.y + r.h > SAFE.buttonsFrom ? SAFE.rightBesideButtons : SAFE.right;
  return r.x >= SAFE.left && r.y >= SAFE.top && r.x + r.w <= right && r.y + r.h <= SAFE.bottom;
};

export const rectCentre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Approximate average glyph widths in em for the two pixel fonts, rounded up to leave a margin. */
const EM_WIDTH = { display: 0.42, label: 0.78 };
const CAPTION_LETTER_SPACING = 2;
export const COMPACT_CAPTION_PX = 56;
const CAPTION_CHROME_PX = 8 + 16; // border and padding, top and bottom combined
const CAPTION_SIDE_CHROME_PX = 8 + 52;

export const textWidth = (text: string, fontPx: number, font: keyof typeof EM_WIDTH) => text.length * fontPx * EM_WIDTH[font];

/** Whether compact caption lines fit a region, across and down. */
export const captionFits = (lines: string[], region: Rect = REGIONS.caption) => {
  const tall = lines.length * COMPACT_CAPTION_PX + CAPTION_CHROME_PX <= region.h;
  const wide = lines.every((l) => textWidth(l, COMPACT_CAPTION_PX, "display") + l.length * CAPTION_LETTER_SPACING + CAPTION_SIDE_CHROME_PX <= region.w);
  return tall && wide;
};

/** Greedy word wrap by character count. A single word longer than the limit keeps its own line. */
export const wrapWords = (text: string, maxChars: number): string[] => {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + 1 + word.length <= maxChars) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
};

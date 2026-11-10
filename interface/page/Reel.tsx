// The tall screen that stays beside every step. It starts as a few huge blocks and sharpens with each finished stage.
import { useEffect, useRef, useState } from "react";

const COLUMNS = [3, 4, 6, 9, 14, 21, 32];
const TICK_MS = 420;
const SONG_ROWS = 72;

const hash = (n: number) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
};

const seedOf = (text: string) => [...text].reduce((sum, ch) => Math.imul(sum, 31) + ch.charCodeAt(0), 7);

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const sizeCanvas = (canvas: HTMLCanvasElement, width: number, height: number) => {
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext("2d");
};

export const Mosaic: React.FC<{ seed: string; progress: number; colors: string[]; moving?: boolean }> = ({ seed, progress, colors, moving }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!moving || reducedMotion()) return;
    const timer = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(timer);
  }, [moving]);

  useEffect(() => {
    const cols = COLUMNS[Math.min(progress, COLUMNS.length - 1)];
    const rows = Math.ceil((cols * 16) / 9);
    const context = ref.current && sizeCanvas(ref.current, cols, rows);
    if (!context) return;
    const base = seedOf(seed) + progress * 101;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = base + x * 1009 + y * 7919;
        // A few cells at a time change colour while work is happening.
        const flip = hash(cell + 3) % 9 === 0 ? tick : 0;
        context.fillStyle = colors[hash(cell + flip * 131) % colors.length];
        context.globalAlpha = 0.35 + (hash(cell + 5) % 66) / 100;
        context.fillRect(x, y, 1, 1);
      }
    }
  }, [seed, progress, colors, tick]);

  return <canvas ref={ref} className="reel-fill pixelated" aria-hidden="true" />;
};

/** The song drawn down the screen, with its played part lit up. */
export const SongScreen: React.FC<{ audio: React.RefObject<HTMLAudioElement | null>; src: string; color: string }> = ({ audio, src, color }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[]>();

  useEffect(() => {
    let live = true;
    void (async () => {
      const data = await (await fetch(src)).arrayBuffer();
      const context = new AudioContext();
      const decoded = await context.decodeAudioData(data);
      void context.close();
      const samples = decoded.getChannelData(0);
      const step = Math.floor(samples.length / SONG_ROWS);
      const raw = Array.from({ length: SONG_ROWS }, (_, row) => {
        let peak = 0;
        for (let i = row * step; i < (row + 1) * step; i++) peak = Math.max(peak, Math.abs(samples[i]));
        return peak;
      });
      const top = Math.max(...raw, 0.001);
      if (live) setPeaks(raw.map((p) => p / top));
    })();
    return () => {
      live = false;
    };
  }, [src]);

  useEffect(() => {
    if (!peaks) return;
    const context = ref.current && sizeCanvas(ref.current, 81, SONG_ROWS * 2);
    if (!context) return;
    let frame = 0;
    const draw = () => {
      const player = audio.current;
      const played = player && player.duration ? player.currentTime / player.duration : 0;
      context.clearRect(0, 0, 81, SONG_ROWS * 2);
      peaks.forEach((peak, row) => {
        const width = Math.max(2, Math.round(peak * 37)) * 2 + 1;
        context.fillStyle = row / SONG_ROWS <= played ? color : "#7f83f2";
        context.fillRect((81 - width) / 2, row * 2, width, 1);
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [peaks, audio, color]);

  return <canvas ref={ref} className="reel-fill pixelated" aria-hidden="true" />;
};

export const Reel: React.FC<{ children: React.ReactNode; caption?: string; small?: boolean }> = ({ children, caption, small }) => (
  <div className={small ? "reel reel-small" : "reel"}>
    {children}
    {caption ? <p className="reel-caption">{caption}</p> : null}
  </div>
);

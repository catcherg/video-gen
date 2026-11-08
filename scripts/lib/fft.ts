/** In-place radix-2 FFT. Length must be a power of two. */
export const fft = (re: Float64Array, im: Float64Array) => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
};

export type Peak = { hz: number; db: number };

/** Strongest spectral peaks of a mono section, loudest first, frequency refined by parabolic interpolation. */
export const spectralPeaks = (samples: Float64Array, sampleRate: number, minHz: number, maxHz: number): Peak[] => {
  const n = 2 ** Math.floor(Math.log2(samples.length));
  const start = (samples.length - n) >> 1;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = samples[start + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  fft(re, im);
  const binHz = sampleRate / n;
  const mag = (k: number) => 20 * Math.log10(Math.hypot(re[k], im[k]) + 1e-12);
  const peaks: Peak[] = [];
  for (let k = Math.max(2, Math.ceil(minHz / binHz)); k < Math.min(n / 2 - 1, maxHz / binHz); k++) {
    const m = mag(k);
    const l = mag(k - 1);
    const r = mag(k + 1);
    if (m > l && m > r) {
      const shift = (0.5 * (l - r)) / (l - 2 * m + r);
      peaks.push({ hz: (k + shift) * binHz, db: m - 0.25 * (l - r) * shift });
    }
  }
  return peaks.sort((a, b) => b.db - a.db);
};

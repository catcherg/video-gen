// Four-stroke engine timing: integrates an RPM curve into a crank-angle table and
// derives every firing event from it. Videos configure this from their physics.ts.

export type FourStrokeSpec = {
  /** Cylinder numbers in firing sequence. */
  firingOrder: number[];
  /**
   * Crank angle (0-720) of each firing slot. Leave out for even firing (720 / cylinders apart).
   * Set it for odd-fire engines.
   */
  firingAnglesDeg?: number[];
  durationS: number;
  /** Displayed engine speed at on-screen time t. */
  rpmAt: (t: number) => number;
  /** Slow-motion factor at on-screen time t (1 = real speed). */
  slowAt: (t: number) => number;
  /** Phase the crank so firingOrder[0] fires exactly at this on-screen time. */
  phaseLockT?: number;
};

export type Bang = { t: number; cyl: number };

const TABLE_HZ = 2400;
const CYCLE_DEG = 720;

export const strokeName = (c: number) =>
  c < 180 ? "BANG" : c < 360 ? "EXHAUST" : c < 540 ? "INTAKE" : "SQUEEZE";

export const meanPistonSpeed = (strokeMm: number, rpm: number) => (2 * (strokeMm / 1000) * rpm) / 60;

/**
 * Loudest frequency of a train of identical exhaust pulses that repeats every 720° of crank rotation.
 * Line k has period 720°/k and strength |sum of e^(-i·k·angle)|, weighted by a decaying pulse's
 * spectrum. Uneven firing shifts energy away from the firing frequency, which is why a cross-plane
 * bank does not simply sound like its firing rate.
 */
export const dominantPulseHz = (anglesDeg: number[], rpm: number, pulseTauS: number, maxHz = 2000) => {
  const cycleHz = rpm / 120;
  let bestHz = 0;
  let bestAmp = -1;
  for (let k = 1; k * cycleHz <= maxHz; k++) {
    const hz = k * cycleHz;
    let re = 0;
    let im = 0;
    for (const a of anglesDeg) {
      const phase = (2 * Math.PI * k * a) / CYCLE_DEG;
      re += Math.cos(phase);
      im += Math.sin(phase);
    }
    const amp = Math.hypot(re, im) / Math.sqrt(1 + (2 * Math.PI * hz * pulseTauS) ** 2);
    if (amp > bestAmp + 1e-9) {
      bestAmp = amp;
      bestHz = hz;
    }
  }
  return bestHz;
};

export const createFourStroke = (spec: FourStrokeSpec) => {
  const { firingOrder, durationS, rpmAt, slowAt, phaseLockT } = spec;
  const cylinders = firingOrder.length;
  const anglesDeg = spec.firingAnglesDeg ?? firingOrder.map((_, i) => i * (CYCLE_DEG / cylinders));

  const fireOffset: number[] = new Array(Math.max(...firingOrder) + 1).fill(0);
  firingOrder.forEach((cyl, i) => (fireOffset[cyl] = anglesDeg[i]));

  const N = durationS * TABLE_HZ + 2;
  const raw = new Float64Array(N);
  {
    let a = 0;
    for (let i = 0; i < N; i++) {
      raw[i] = a;
      const t = i / TABLE_HZ;
      a += (360 * rpmAt(t)) / 60 / slowAt(t) / TABLE_HZ;
    }
  }
  const rawAt = (t: number) => {
    const x = Math.min(N - 1.0001, Math.max(0, t * TABLE_HZ));
    const i = Math.floor(x);
    return raw[i] + (raw[i + 1] - raw[i]) * (x - i);
  };
  const offset = phaseLockT === undefined ? 0 : (CYCLE_DEG - (rawAt(phaseLockT) % CYCLE_DEG)) % CYCLE_DEG;

  /** Crank angle in degrees at on-screen time t. Always increases, including across speed changes. */
  const crankAt = (t: number) => rawAt(t) + offset;

  /** Where a cylinder is in its 720° cycle: 0 = firing (top of the power stroke). */
  const cycleAt = (cyl: number, t: number) => {
    const c = (crankAt(t) - fireOffset[cyl]) % CYCLE_DEG;
    return c < 0 ? c + CYCLE_DEG : c;
  };

  const angleOfEvent = (k: number) => Math.floor(k / cylinders) * CYCLE_DEG + anglesDeg[k % cylinders];

  /** Every firing event in the video, in time order. */
  const bangs: Bang[] = (() => {
    const out: Bang[] = [];
    let k = 0;
    while (angleOfEvent(k) <= raw[0] + offset) k++;
    for (let i = 0; i < N - 1; i++) {
      const a0 = raw[i] + offset;
      const a1 = raw[i + 1] + offset;
      while (angleOfEvent(k) <= a1) {
        const frac = (angleOfEvent(k) - a0) / (a1 - a0);
        out.push({ t: (i + frac) / TABLE_HZ, cyl: firingOrder[k % cylinders] });
        k++;
      }
    }
    return out;
  })();

  /** Index of the first bang at or after time t. */
  const firstBangAfter = (t: number) => {
    let lo = 0;
    let hi = bangs.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (bangs[mid].t < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  /** Firing events per second at real speed. Every cylinder fires once per two revolutions. */
  const bangsPerSecond = (rpm: number) => (rpm / 60) * (cylinders / 2);

  return { cylinders, firingOrder, fireOffset, rpmAt, slowAt, crankAt, cycleAt, bangs, firstBangAfter, bangsPerSecond };
};

export type FourStroke = ReturnType<typeof createFourStroke>;

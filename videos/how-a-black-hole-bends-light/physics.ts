// Single source of truth for this video: the scene, labels, captions and diagrams all read from here.
//
// Sources, with confidence and notes on each fact in spec.json:
//   Photon sphere at 1.5 Schwarzschild radii, non-spinning case:
//     https://arxiv.org/pdf/1910.02957
//     https://arxiv.org/pdf/2212.06054
//   Shadow looks at least about twice as wide as the horizon:
//     https://svs.gsfc.nasa.gov/14576/
//     https://arxiv.org/pdf/1910.02957
//     https://messier-objects.com/first-image-of-a-black-hole-captured-in-m87
//   Far from a mass, the bend is 4GM/(c²b), twice the Newtonian value:
//     https://icc.dur.ac.uk/~tt/Lectures/Galaxies/TeX/lec/node101.html
//     https://ar5iv.labs.arxiv.org/html/gr-qc/0611086
//   Bending grows without limit near the critical distance:
//     https://arxiv.org/html/2503.02320v4
//     https://ar5iv.labs.arxiv.org/html/gr-qc/0611086
//   The predicted 1.75 arcsecond shift and the 1919 expeditions:
//     https://www.scielo.br/j/rbef/a/tsCDFzLWszcgV8XzMN9KvQH/
//     https://eclipse-history.wp.st-andrews.ac.uk/the-controversial-british-led-eclipse-expeditions-of-1919-that-validated-general-relativity/
//     https://gulfnews.com/uae/science/the-eclipse-that-revealed-the-universe-1.2075558
//   The far side of the disk appears above and below the shadow:
//     https://svs.gsfc.nasa.gov/13326/
//     https://www.sciencenews.org/article/nasa-new-black-hole-visualizations-showcase-how-gravity-warps-light
//   The thin photon ring:
//     https://science.nasa.gov/universe/black-holes/supermassive-black-holes/new-nasa-black-hole-visualization-takes-viewers-beyond-the-brink/
//     https://svs.gsfc.nasa.gov/14585
//   Sagittarius A*: ring size, and its match with general relativity:
//     https://en.wikipedia.org/wiki/Sagittarius_A*
//     https://iopscience.iop.org:443/article/10.3847/2041-8213/ac6674/meta
//     https://research.chalmers.se/en/publication/534136
// Weaker figures: sources differ on the shadow's width, so 2 is treated as a lower bound and it is worded "more than twice".
// The handling of the 1919 data is debated, so the video reports the two results without saying they proved anything.
// The bends in the Sun and mass shots are drawn far larger than real ones, and their diagram titles say so.
// The black hole rays are not sketched: traceRay integrates the real equation for a light path.
import { listFact, numberFact } from "../../src/core/spec";
import { spec } from "./meta";

export const PHOTON_SPHERE = numberFact(spec, "photonSphere");
export const SHADOW_TO_HORIZON = numberFact(spec, "shadowToHorizon");
export const WEAK_RATIO = numberFact(spec, "weakDeflection");
export const SUN_DEFLECTION = numberFact(spec, "sunDeflection");
export const [SOBRAL_SHIFT, PRINCIPE_SHIFT] = listFact(spec, "eclipseResults");
export const SGR_A_RING = numberFact(spec, "sgrARing");

/** The distance at which a passing ray is only just not captured, in horizon radii. About 2.6 for a non-spinning hole. */
export const CRITICAL_IMPACT = PHOTON_SPHERE / Math.sqrt(1 - 1 / PHOTON_SPHERE);

/** Far-field bending for a ray passing at distance b, in relative units. Only meaningful well away from the photon sphere. */
export const newtonBend = (b: number) => 1 / b;
export const einsteinBend = (b: number) => WEAK_RATIO * newtonBend(b);

/** Drawn width of the shadow against the horizon: a little over the lower bound, to match "more than twice". */
export const SHADOW_DRAWN_RATIO = SHADOW_TO_HORIZON + 1 / 3;

const WORLD_UNITS_PER_MICROARCSECOND = 0.2;
export const SGR_RING_RADIUS = (SGR_A_RING / 2) * WORLD_UNITS_PER_MICROARCSECOND;

export type V2 = [number, number];

const RAY_STEP_RAD = 0.01;
const RAY_MAX_STEPS = 8000;

/** The orbit equation u'' = -u + (3GM/c²)u², with u = 1/r. In horizon radii, 3GM/c² is the photon sphere's radius. */
const orbitAccel = (u: number) => -u + PHOTON_SPHERE * u * u;

/**
 * The path of a light ray past a non-spinning black hole of radius 1, moving clockwise, by fourth-order Runge-Kutta.
 * It starts at startR heading inward and ends at the horizon, or when it is heading out and leaves the frame.
 */
export const traceRay = (impact: number, startR: number, inFrame: (x: number, y: number) => boolean): V2[] => {
  const h = RAY_STEP_RAD;
  let u = 1 / startR;
  let v = Math.sqrt(Math.max(0, 1 / (impact * impact) - u * u + u * u * u));
  let angle = Math.atan2(Math.min(impact, startR), -Math.sqrt(Math.max(0, startR * startR - impact * impact)));
  const points: V2[] = [[Math.cos(angle) * startR, Math.sin(angle) * startR]];
  for (let step = 0; step < RAY_MAX_STEPS; step++) {
    const du1 = v;
    const dv1 = orbitAccel(u);
    const du2 = v + (h / 2) * dv1;
    const dv2 = orbitAccel(u + (h / 2) * du1);
    const du3 = v + (h / 2) * dv2;
    const dv3 = orbitAccel(u + (h / 2) * du2);
    const du4 = v + h * dv3;
    const dv4 = orbitAccel(u + h * du3);
    u += (h / 6) * (du1 + 2 * du2 + 2 * du3 + du4);
    v += (h / 6) * (dv1 + 2 * dv2 + 2 * dv3 + dv4);
    angle -= h;
    if (u >= 1 || u <= 0) break;
    const x = Math.cos(angle) / u;
    const y = Math.sin(angle) / u;
    if (v < 0 && !inFrame(x, y)) break;
    points.push([x, y]);
  }
  return points;
};

export const pathLength = (points: V2[]) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);

/** The same path as `count` points evenly spaced along it, so that a reveal moves at a steady speed. */
export const resample = (points: V2[], count: number): V2[] => {
  const along = [0];
  for (let i = 1; i < points.length; i++) along.push(along[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const total = along[along.length - 1];
  let k = 1;
  return Array.from({ length: count }, (_, i): V2 => {
    const wanted = (i / (count - 1)) * total;
    while (k < points.length - 1 && along[k] < wanted) k++;
    const u = (wanted - along[k - 1]) / (along[k] - along[k - 1] || 1);
    return [points[k - 1][0] + (points[k][0] - points[k - 1][0]) * u, points[k - 1][1] + (points[k][1] - points[k - 1][1]) * u];
  });
};

export const FRAMES_PER_BEAT = Math.round((60 * spec.format.fps) / spec.song.bpm);
export const beatT = (beat: number) => (beat * FRAMES_PER_BEAT) / spec.format.fps;
export const barT = (bar: number) => beatT(bar * spec.song.beatsPerBar);

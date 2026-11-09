// Single source of truth for this video: scene, labels, captions and diagrams all read from here.
//
// Sources, with confidence and notes on each fact in spec.json:
//   Rayleigh scattering is proportional to 1 / wavelength^4:
//     https://wtamu.edu/~cbaird/sq/2013/03/28/why-is-the-sky-blue/
//     https://metoffice.gov.uk/learning/optics/why-is-the-sky-blue
//   Sunlight has less violet than blue, and eyes are less sensitive to violet:
//     https://www.rmg.co.uk/stories/topics/why-sky-blue
//     https://wtamu.edu/~cbaird/sq/2013/03/28/why-is-the-sky-blue/
//   Air mass at the horizon is about 38 (Kasten and Young; other models give about 38.9 to 40):
//     https://en.wikipedia.org/wiki/Air_mass_(astronomy)
// Weaker figures: the 450 nm and 650 nm wavelengths are representative picks from bands of colour,
// so the blue-to-red ratio is approximate and is worded that way on screen.
import { numberFact } from "../../src/core/spec";
import { spec } from "./meta";

export const SCATTER_EXPONENT = numberFact(spec, "scatterExponent");
export const BLUE_NM = numberFact(spec, "blueNm");
export const RED_NM = numberFact(spec, "redNm");
export const HORIZON_AIR_MASS = numberFact(spec, "horizonAirMass");

/** How strongly light of a wavelength scatters, compared with blue. */
export const scatterRelativeToBlue = (nm: number) => (BLUE_NM / nm) ** SCATTER_EXPONENT;
export const BLUE_VS_RED = 1 / scatterRelativeToBlue(RED_NM);

/** The colours of sunlight, in order. Wavelengths place them on the scattering curve. */
export const LIGHT_BANDS = [
  { name: "VIOLET", nm: 410, color: "#a07bff" },
  { name: "BLUE", nm: BLUE_NM, color: "#4aa8ff" },
  { name: "CYAN", nm: 490, color: "#49e0e0" },
  { name: "GREEN", nm: 530, color: "#6fe36f" },
  { name: "YELLOW", nm: 580, color: "#ffe45e" },
  { name: "RED", nm: RED_NM, color: "#ff5a4d" },
];

export const FRAMES_PER_BEAT = Math.round((60 * spec.format.fps) / spec.song.bpm);
export const beatT = (beat: number) => (beat * FRAMES_PER_BEAT) / spec.format.fps;
export const barT = (bar: number) => beatT(bar * spec.song.beatsPerBar);

export const SUNSET_AT = barT(12);

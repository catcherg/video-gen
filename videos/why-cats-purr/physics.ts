// Single source of truth for this video: the scene, titles, captions and diagrams all read from here.
//
// Sources, with confidence and notes on each fact in spec.json:
//   No settled explanation for why cats purr:
//     https://www.loc.gov/everyday-mysteries/categories/zoology/item/why-and-how-do-cats-purr/
//     https://www.aaha.org/publications/newstat/articles/2010-08/hart-explores-unexplained-beha/
//   Purring reaches down to about 25 Hz:
//     https://www.aaha.org/resources/the-secret-feline-language-5-reasons-why-your-cat-purrs/
//     https://www.scientificamerican.com/article/why-do-cats-purr/
//     https://www.cell.com/current-biology/fulltext/S0960-9822(23)01230-7
//   Eight excised larynges, 25 to 30 Hz from airflow alone, pads up to 4 mm (Herbst et al., 2023):
//     https://www.cell.com/current-biology/fulltext/S0960-9822(23)01230-7
//   The brain's part in living cats is not ruled out:
//     https://www.vetmeduni.ac.at/en/universitaet/infoservice/presseinformationen/presseinformationen-2023/purring-more-complex-than-previously-thought
//   A cry embedded in food-soliciting purrs, and people rating those purrs as more urgent (McComb et al., 2009):
//     https://pubmed.ncbi.nlm.nih.gov/19602409/
//     https://www.sciencedirect.com/science/article/pii/S0960982209011683
//   The cry peaks at 220 to 520 Hz, and urgency falls when it is removed:
//     https://www.nationalgeographic.com/science/article/cats-manipulate-their-owners-with-a-cry-embedded-in-a-purr
//     https://www.discovermagazine.com/planet-earth/cats-manipulate-their-owners-with-a-cry-embedded-in-a-purr
//   Kittens and their mother:
//     https://webarchive.library.unt.edu/eot2008/20081215031158/http:/www.loc.gov/rr/scitech/mysteries/catspurr.html
//     https://www.aaha.org/resources/the-secret-feline-language-5-reasons-why-your-cat-purrs/
//   Purring in fear or pain, and healing as an unproven idea:
//     https://www.tuftscatnip.com/?p=6665
//     https://www.tuftscatnip.com/behavior/why-do-cats-purr/
//     https://www.bksv.com/catspurr
// Weaker figures: sources disagree on a purr's upper limit, so only its low end is stated as a number.
// The 220 to 520 Hz range comes from press coverage of the paper rather than its full text.
// The vocal fold pads appear only in the illustrated model: their role in lowering pitch is a proposal, so no claim is made about it on screen.
import { listFact, numberFact } from "../../src/core/spec";
import { spec } from "./meta";

export const PURR_LOW_HZ = numberFact(spec, "purrLowEnd");
export const LARYNX_COUNT = numberFact(spec, "larynxCount");
export const LARYNX_STUDY_YEAR = numberFact(spec, "herbstYear");
export const VOCAL_PAD_MM = numberFact(spec, "vocalFoldPads");
export const CRY_STUDY_YEAR = numberFact(spec, "crySolicitationYear");
export const [LARYNX_LOW_HZ, LARYNX_HIGH_HZ] = listFact(spec, "larynxFrequency");
export const [CRY_LOW_HZ, CRY_HIGH_HZ] = listFact(spec, "cryFrequencyRange");

/** A frequency range as it reads on screen. */
export const hzRange = (low: number, high: number) => `${low}-${high}`;

/** One cycle of the purr's lowest pitch, in milliseconds. */
export const PURR_PERIOD_MS = 1000 / PURR_LOW_HZ;

/** Relative air pressure of an idealised purr at its lowest pitch. A pure sine, so only the timing is real. */
export const purrPressure = (ms: number) => 1 + Math.sin((2 * Math.PI * ms) / PURR_PERIOD_MS);

/** The spectrogram's axis is a drawing choice: five octaves up from 20 Hz, which fits both the purr and the cry. */
const SPECTRO_BOTTOM_HZ = 20;
const SPECTRO_OCTAVES = 5;

/** Height of a frequency on the spectrogram, from 0 at the bottom to 1 at the top. */
export const spectroHeight = (hz: number) => Math.log2(hz / SPECTRO_BOTTOM_HZ) / SPECTRO_OCTAVES;

export const FRAMES_PER_BEAT = Math.round((60 * spec.format.fps) / spec.song.bpm);
export const beatT = (beat: number) => (beat * FRAMES_PER_BEAT) / spec.format.fps;
export const barT = (bar: number) => beatT(bar * spec.song.beatsPerBar);

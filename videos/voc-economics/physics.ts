// Single source of truth for this video: scene, labels, captions and diagrams all read from here.
//
// Sources, with a confidence level and notes on each fact in spec.json:
//   Founding capital and 21-year charter: https://www.worldhistory.org/Dutch_East_India_Company/
//   Dividends, profit by period, 1780 net capital, war damage: https://en.wikipedia.org/wiki/Dutch_East_India_Company
//   Voyages: Dutch-Asiatic Shipping, via https://resolve.cambridge.org/core/journals/journal-of-southeast-asian-studies/article/between-batavia-and-the-cape-shipping-patterns-of-the-dutch-east-india-company/9CD79760674B0AE0363828DF9FDE9C6D
//   Banda Islands: https://en.wikipedia.org/wiki/Dutch_conquest_of_the_Banda_Islands (citing Corn, Loth and Lape)
//   Final debts: https://outsidethecase.org/dutch-east-india-company-voc/ and https://www.swaen.com/articles-about-trading-companies/voc
// Weaker figures:
//   The 18% dividend is single-sourced to Wikipedia and is measured against the original share capital.
//   Published final debts range from 110 to 219 million guilders, so the video only says "over 100 million".
//   Banda population figures are estimates and are labelled that way on screen.
//   Spice markups of 122× and 300× are widely repeated, but they conflict and weren't traced to a price record, so they aren't used.
import { numberFact } from "../../src/core/spec";
import { spec } from "./meta";

export const CAPITAL_M = numberFact(spec, "capitalM");
export const CHARTER_YEARS = numberFact(spec, "charterYears");
export const OUTBOUND_VOYAGES = numberFact(spec, "outboundVoyages");
export const BANDA_BEFORE = numberFact(spec, "bandaPopulationBefore");
export const BANDA_SURVIVORS = numberFact(spec, "bandaSurvivors");
export const BANDA_LOSS_PCT = numberFact(spec, "bandaLossPct");
export const DIVIDEND_PCT = numberFact(spec, "dividendPct");
export const PROFIT_1630S_M = numberFact(spec, "profit1630sM");
export const PROFIT_1680S_M = numberFact(spec, "profit1680sM");
export const NET_CAPITAL_1780_M = numberFact(spec, "netCapital1780M");
export const WAR_DAMAGE_M = numberFact(spec, "warDamageM");
export const FINAL_DEBT_FLOOR_M = numberFact(spec, "finalDebtFloorM");

export const FRAMES_PER_BEAT = Math.round((60 * spec.format.fps) / spec.song.bpm);
export const beatT = (beat: number) => (beat * FRAMES_PER_BEAT) / spec.format.fps;
export const barT = (bar: number) => beatT(bar * spec.song.beatsPerBar);

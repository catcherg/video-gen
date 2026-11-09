import { makeEpisode } from "../../src/core/EpisodeShell";
import { specPalette } from "../../src/core/spec";
import { meta, spec } from "./meta";
import { Overlay } from "./overlay";
import { Scene } from "./scene";

export default makeEpisode(meta.slug, Scene, Overlay, specPalette(spec));

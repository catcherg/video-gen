import { makeEpisode } from "../../core/EpisodeShell";
import { meta } from "./meta";
import { Overlay } from "./overlay";
import { Scene } from "./scene";

export default makeEpisode(meta.slug, Scene, Overlay);

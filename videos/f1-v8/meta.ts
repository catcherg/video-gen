import { loadSpec, specToMeta } from "../../src/core/spec";
import rawSpec from "./spec.json";

export const spec = loadSpec(rawSpec);
export const meta = specToMeta(spec);

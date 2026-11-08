import { Config } from "@remotion/cli/config";

// Apple Silicon desktop: ANGLE uses the Metal-backed GPU for WebGL.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);

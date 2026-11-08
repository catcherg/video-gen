import { Config } from "@remotion/cli/config";
import { GL, JPEG_QUALITY } from "./render-settings";

Config.setChromiumOpenGlRenderer(GL);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(JPEG_QUALITY);

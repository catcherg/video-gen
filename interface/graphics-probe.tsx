// A tiny composition that reports which graphics hardware the render browser can use.
import { Composition, registerRoot } from "remotion";

const Probe: React.FC = () => {
  const gl = document.createElement("canvas").getContext("webgl2");
  if (!gl) throw new Error("WebGL isn't available");
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  console.log(`GRAPHICS:${info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)}`);
  return <div />;
};

registerRoot(() => <Composition id="probe" component={Probe} durationInFrames={1} fps={30} width={16} height={16} />);

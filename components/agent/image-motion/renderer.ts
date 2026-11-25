import type { AgentThemeId } from "../../../lib/agent-theme";
import { IMAGE_FRAGMENT_SHADER, IMAGE_MOTION_THEMES, IMAGE_VERTEX_SHADER } from "./shaders";

export function createImageMotionRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement, themeId: AgentThemeId) {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, powerPreference: "low-power" });
  if (!gl) throw new Error("Image motion requires WebGL");
  const shaders: WebGLShader[] = [];
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  const dispose = () => {
    shaders.forEach(shader => gl.deleteShader(shader));
    gl.deleteTexture(texture);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
  };
  try {
    if (!program || !buffer || !texture) throw new Error("Image motion resources unavailable");
    for (const [type, source] of [[gl.VERTEX_SHADER, IMAGE_VERTEX_SHADER], [gl.FRAGMENT_SHADER, IMAGE_FRAGMENT_SHADER]] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Image motion shader unavailable");
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Shader compilation failed");
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Image motion link failed");
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // A 256px texture is ample for the 28–64px avatars; don't retain a full-size GPU texture.
    const upload = document.createElement("canvas");
    upload.width = upload.height = 256;
    const context = upload.getContext("2d");
    if (!context) throw new Error("Image upload unavailable");
    context.drawImage(image, 0, 0, 256, 256);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, upload);
    gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0);
    gl.uniform1f(gl.getUniformLocation(program, "u_theme"), IMAGE_MOTION_THEMES[themeId]);
    const time = gl.getUniformLocation(program, "u_time");
    const intensity = gl.getUniformLocation(program, "u_intensity");
    return {
      render(seconds: number, thinking: boolean) {
        const size = Math.min(256, Math.max(1, Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2))));
        if (canvas.width !== size || canvas.height !== size) canvas.width = canvas.height = size;
        gl.viewport(0, 0, size, size);
        gl.uniform1f(time, seconds);
        gl.uniform1f(intensity, thinking ? 1.35 : 1);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

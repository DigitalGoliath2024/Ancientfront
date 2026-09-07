/**
 * RangeCirclePass — draws a translucent circle showing the effective
 * range of a structure during build-mode ghost preview, plus the heal
 * bubble of selected Tenders. White by default, red when the ghost flags
 * a warning (e.g. nuking would break an alliance).
 *
 * Single quad with circle SDF in the fragment shader, redrawn per circle.
 */

import type { GhostPreviewData } from "../../types";
import { createProgram } from "../utils/GlUtils";

import fragSrc from "../shaders/range-circle/range-circle.frag.glsl?raw";
import vertSrc from "../shaders/range-circle/range-circle.vert.glsl?raw";

export class RangeCirclePass {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;

  private uCamera: WebGLUniformLocation;
  private uCenter: WebGLUniformLocation;
  private uRadius: WebGLUniformLocation;
  private uColor: WebGLUniformLocation;

  private centerX = 0;
  private centerY = 0;
  private radius = 0;
  private warning = false;
  private rangeTint: "default" | "valid" | "invalid" = "default";

  private selectionCenters: { x: number; y: number }[] = [];
  private selectionRadius = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = createProgram(gl, vertSrc, fragSrc);

    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uCenter = gl.getUniformLocation(this.program, "uCenter")!;
    this.uRadius = gl.getUniformLocation(this.program, "uRadius")!;
    this.uColor = gl.getUniformLocation(this.program, "uColor")!;

    // Unit quad [0,1]
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  updateGhostPreview(data: GhostPreviewData | null): void {
    if (data && data.rangeRadius > 0) {
      this.centerX = data.radiusTileX;
      this.centerY = data.radiusTileY;
      this.radius = data.rangeRadius;
      this.warning = data.rangeWarning;
      this.rangeTint = data.rangeTint ?? "default";
    } else {
      this.radius = 0;
      this.warning = false;
      this.rangeTint = "default";
    }
  }

  /** Heal bubbles for selected Tenders. Pass [] to hide. */
  setSelectionRanges(
    centers: readonly { x: number; y: number }[],
    radius: number,
  ): void {
    this.selectionCenters = centers.map((c) => ({ x: c.x, y: c.y }));
    this.selectionRadius = centers.length > 0 ? radius : 0;
  }

  draw(cameraMatrix: Float32Array): void {
    if (this.radius <= 0 && this.selectionRadius <= 0) return;

    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cameraMatrix);
    gl.bindVertexArray(this.vao);

    if (this.radius > 0) {
      if (this.warning || this.rangeTint === "invalid") {
        this.drawCircle(this.centerX, this.centerY, this.radius, 1.0, 0.2, 0.2);
      } else if (this.rangeTint === "valid") {
        this.drawCircle(
          this.centerX,
          this.centerY,
          this.radius,
          0.2,
          0.95,
          0.35,
        );
      } else {
        this.drawCircle(this.centerX, this.centerY, this.radius, 1.0, 1.0, 1.0);
      }
    }

    if (this.selectionRadius > 0) {
      for (const c of this.selectionCenters) {
        this.drawCircle(c.x, c.y, this.selectionRadius, 0.45, 0.95, 0.8);
      }
    }
  }

  private drawCircle(
    x: number,
    y: number,
    radius: number,
    r: number,
    g: number,
    b: number,
  ): void {
    const gl = this.gl;
    gl.uniform2f(this.uCenter, x, y);
    gl.uniform1f(this.uRadius, radius);
    gl.uniform3f(this.uColor, r, g, b);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
  }
}

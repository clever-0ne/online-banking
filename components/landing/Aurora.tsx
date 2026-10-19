"use client";

import { useEffect, useRef } from "react";

// Full-bleed animated aurora drawn on the GPU: three drifting color fields blended through
// domain-warped noise, with a soft glow that follows the pointer. Falls back to the CSS gradient
// behind it if WebGL isn't available, and holds still for people who prefer reduced motion.

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 r;
uniform float t;
uniform vec2 m;
uniform float dark;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / r;
  vec2 p = uv * vec2(r.x / r.y, 1.0) * 1.6;
  float s = t * 0.045;
  vec2 q = vec2(fbm(p + s), fbm(p + vec2(5.2, 1.3) - s));
  vec2 w = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + s * 1.4), fbm(p + 3.0 * q + vec2(8.3, 2.8) - s));
  float n = fbm(p + 2.6 * w);

  vec3 indigo = vec3(0.30, 0.25, 0.88);
  vec3 violet = vec3(0.49, 0.30, 0.95);
  vec3 orchid = vec3(0.77, 0.42, 0.84);
  vec3 teal   = vec3(0.20, 0.55, 0.75);
  vec3 col = mix(indigo, violet, smoothstep(0.2, 0.8, n));
  col = mix(col, orchid, smoothstep(0.45, 0.95, w.x) * 0.85);
  col = mix(col, teal, smoothstep(0.55, 1.0, q.y) * 0.35);

  // Ribbons of light through the field
  float band = smoothstep(0.02, 0.0, abs(fract(n * 3.0 + s * 2.0) - 0.5) - 0.46);
  col += band * 0.08;

  // Pointer glow
  float d = distance(uv, m);
  col += vec3(0.55, 0.45, 1.0) * 0.22 * exp(-d * d * 9.0);

  // Fade toward the page background at the edges and bottom
  vec3 bg = mix(vec3(0.91, 0.92, 0.95), vec3(0.055, 0.055, 0.1), dark);
  float fade = smoothstep(0.0, 0.55, uv.y) * (0.75 + 0.25 * smoothstep(0.0, 0.25, min(uv.x, 1.0 - uv.x)));
  // Mostly page background, with the color showing through in soft ribbons
  float ribbons = smoothstep(0.35, 0.85, n) * 0.75 + smoothstep(0.5, 1.0, w.x) * 0.35;
  float strength = mix(0.32, 0.5, dark);
  gl_FragColor = vec4(mix(bg, col, clamp(fade * strength * ribbons + band * 0.04, 0.0, 1.0)), 1.0);
}`;

export function Aurora() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, powerPreference: "low-power" });
    if (!gl) return; // CSS gradient behind the canvas stays visible

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) canvas.dataset.error = gl.getShaderInfoLog(sh) ?? "compile failed";
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.dataset.error ??= gl.getProgramInfoLog(prog) ?? "link failed"; return; }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, "r"), uT = gl.getUniformLocation(prog, "t"), uM = gl.getUniformLocation(prog, "m"), uD = gl.getUniformLocation(prog, "dark");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { x: 0.7, y: 0.6, tx: 0.7, ty: 0.6 };
    let visible = true;
    let raf = 0;
    const start = performance.now() - 20_000;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * 0.6; // render below native size; the blur hides it and saves battery
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const isDark = () => (document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";

    const frame = (now: number) => {
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      gl.uniform2f(uR, canvas.width, canvas.height);
      gl.uniform1f(uT, reduce ? 20 : (now - start) / 1000);
      gl.uniform2f(uM, mouse.x, mouse.y);
      gl.uniform1f(uD, isDark() ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      canvas.classList.add("on");
      if (!reduce && visible) raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect();
      mouse.tx = (e.clientX - b.left) / b.width;
      mouse.ty = 1 - (e.clientY - b.top) / b.height;
    };
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(frame);
    });

    resize();
    io.observe(canvas);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      // Keep the context: React may re-run this effect on the same canvas, and a lost context can't compile shaders.
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, []);

  return <canvas ref={ref} className="aurora" aria-hidden="true" />;
}

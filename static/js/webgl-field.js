/**
 * webgl-field.js - Fluid Particle Shader Background
 * Matches editorial luxury aesthetic with pointer reactivity.
 */
(() => {
  const canvas = document.getElementById("field");
  if (!canvas) return;

  const glow = document.querySelector(".pointer-glow");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const pointer = { x: 0.5, y: 0.4, tx: 0.5, ty: 0.4 };

  if (!coarse) document.body.classList.add("has-pointer");

  window.addEventListener("pointermove", (e) => {
    if (coarse || reduce) return;
    pointer.tx = e.clientX / window.innerWidth;
    pointer.ty = e.clientY / window.innerHeight;
    if (glow) {
      glow.style.left = `${e.clientX}px`;
      glow.style.top = `${e.clientY}px`;
    }
    document.documentElement.style.setProperty("--px", (pointer.tx - 0.5).toFixed(3));
    document.documentElement.style.setProperty("--py", (pointer.ty - 0.5).toFixed(3));
  });

  const gl = canvas.getContext("webgl", { antialias: false, alpha: true });
  let useGL = Boolean(gl) && !reduce;

  if (useGL) {
    const vs = `
      attribute vec2 a_pos;
      void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
    `;
    const fs = `
      precision highp float;
      uniform vec2 u_res;
      uniform float u_time;
      uniform vec2 u_mouse;
      uniform float u_day;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p); vec2 f = fract(p);
        float a = hash(i), b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      float fbm(vec2 p){
        float v = 0.0; float a = 0.5;
        for(int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.04; a *= 0.5; }
        return v;
      }

      void main(){
        vec2 p = (gl_FragCoord.xy - 0.5 * u_res.xy) / min(u_res.x, u_res.y);
        p += (u_mouse - 0.5) * 0.22;
        float t = u_time * 0.045;
        float n = fbm(p + t);
        
        vec3 darkVoid = mix(vec3(0.043, 0.039, 0.035), vec3(0.08, 0.12, 0.11), n);
        vec3 dayCream = mix(vec3(0.937, 0.909, 0.862), vec3(0.85, 0.88, 0.84), n);
        vec3 col = mix(darkVoid, dayCream, u_day);

        // Subtle geometric grid weave
        float meshX = abs(fract(p.x * 12.0) - 0.5);
        float meshY = abs(fract(p.y * 12.0) - 0.5);
        float mesh = smoothstep(0.035, 0.0, min(meshX, meshY));
        col += mesh * 0.035;

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const compile = (type, src) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
      return shader;
    };

    const program = gl.createProgram();
    const vsh = compile(gl.VERTEX_SHADER, vs);
    const fsh = compile(gl.FRAGMENT_SHADER, fs);
    if (vsh && fsh) {
      gl.attachShader(program, vsh);
      gl.attachShader(program, fsh);
      gl.linkProgram(program);
      gl.useProgram(program);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );

      const loc = gl.getAttribLocation(program, "a_pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const uRes = gl.getUniformLocation(program, "u_res");
      const uTime = gl.getUniformLocation(program, "u_time");
      const uMouse = gl.getUniformLocation(program, "u_mouse");
      const uDay = gl.getUniformLocation(program, "u_day");

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      resize();
      window.addEventListener("resize", resize);

      const loop = (now) => {
        pointer.x += (pointer.tx - pointer.x) * 0.06;
        pointer.y += (pointer.ty - pointer.y) * 0.06;
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, now * 0.001);
        gl.uniform2f(uMouse, pointer.x, 1.0 - pointer.y);
        gl.uniform1f(uDay, document.body.classList.contains("day") ? 1.0 : 0.0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } else {
      useGL = false;
    }
  }

  if (!useGL && canvas) {
    canvas.style.background = "radial-gradient(900px 600px at 20% 10%, #151d1b, transparent), #0b0a09";
  }
})();

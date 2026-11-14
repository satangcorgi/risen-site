// One WebGL2 canvas behind the page draws every dithered picture on it.
// Each picture is a DOM placeholder ([data-dither]); every frame the stage
// reads its rect and draws into exactly that box (scissor), so the page
// scrolls natively and the dots stay anchored to their picture.
//
// Rule of the site: dots are unread, ink is read. A picture "develops" cell
// by cell from the look's two inks into its true colours.

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec4 uRect;      // x, y from top, w, h (device px)
uniform vec2 uTexSize;   // source size in px
uniform vec2 uFocus;     // cover focal point
uniform float uContain;  // 1 = contain, 0 = cover
uniform float uCell;     // device px per dot
uniform vec3 uGround;
uniform vec3 uDot;
uniform float uGain;
uniform float uBias;
uniform vec3 uLight;     // x, y, radius (device px)
uniform float uLightAmt;
uniform float uDevelop;  // 0 dots, 1 true colour
uniform float uAtlas;    // tiles per row, 0 = plain image
uniform float uFrame;
uniform float uFadeBottom;
uniform float uFadeTop;
uniform float uRadius;   // rounded corners (device px)
uniform float uTextMode; // 1 = alpha is the ink
uniform float uGray;     // 1 = single-channel source
uniform vec3 uInk;
uniform float uAlpha;
out vec4 outColor;

float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec2 mapUV(vec2 local) {
  float ea = uRect.z / uRect.w;
  float ia = uTexSize.x / uTexSize.y;
  vec2 uv = local;
  if (uContain < 0.5) {
    if (ea > ia) { float s = ia / ea; uv.y = local.y * s + (1.0 - s) * uFocus.y; }
    else { float s = ea / ia; uv.x = local.x * s + (1.0 - s) * uFocus.x; }
  } else {
    if (ea > ia) { float s = ea / ia; uv.x = (local.x - 0.5) * s + 0.5; }
    else { float s = ia / ea; uv.y = (local.y - 0.5) * s + 0.5; }
  }
  return uv;
}

vec4 sampleSrc(vec2 uv) {
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(1.0, 1.0, 1.0, 0.0);
  if (uAtlas > 0.5) {
    float f0 = floor(uFrame);
    float t = uFrame - f0;
    vec2 tile = vec2(1.0 / uAtlas);
    vec2 a = vec2(mod(f0, uAtlas), floor(f0 / uAtlas));
    vec2 b = vec2(mod(f0 + 1.0, uAtlas), floor((f0 + 1.0) / uAtlas));
    vec2 inset = clamp(uv, 0.002, 0.998);
    vec4 ca = texture(uTex, (a + inset) * tile);
    vec4 cb = texture(uTex, (b + inset) * tile);
    vec4 c = mix(ca, cb, t);
    return uGray > 0.5 ? vec4(c.rrr, 1.0) : c;
  }
  vec4 c = texture(uTex, uv);
  return uGray > 0.5 ? vec4(c.rrr, 1.0) : c;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 rel = p - uRect.xy;
  vec2 local = rel / uRect.zw;

  // rounded rectangle mask
  float alpha = uAlpha;
  if (uRadius > 0.0) {
    vec2 h = uRect.zw * 0.5;
    vec2 q = abs(rel - h) - (h - vec2(uRadius));
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
    alpha *= clamp(0.5 - d, 0.0, 1.0);
  }
  if (alpha <= 0.0) discard;

  vec2 cell = floor(rel / uCell);
  vec2 cellLocal = ((cell + 0.5) * uCell) / uRect.zw;
  vec4 src = sampleSrc(mapUV(cellLocal));

  float dark;
  if (uTextMode > 0.5) {
    dark = src.a * uGain + uBias;
  } else {
    float lum = dot(src.rgb, vec3(0.2126, 0.7152, 0.0722));
    dark = (1.0 - lum) * uGain + uBias;
  }
  if (uLightAmt > 0.0) {
    float d = distance(p, uLight.xy) / max(uLight.z, 1.0);
    dark *= mix(1.0, smoothstep(0.15, 1.0, d), uLightAmt);
  }
  if (uFadeBottom > 0.0) dark *= smoothstep(0.0, uFadeBottom, 1.0 - local.y);
  if (uFadeTop > 0.0) dark *= smoothstep(0.0, uFadeTop, local.y);
  // A small floor: near-white paper and fading edges carry no stray dots.
  dark = clamp((dark - 0.035) / 0.965, 0.0, 1.0);
  dark = dark * dark * (3.0 - 2.0 * dark);

  bool on = dark > bayer8(cell);
  vec3 col = on ? uDot : uGround;
  float a = alpha;
  if (uTextMode > 0.5) { a = on ? alpha : 0.0; }

  if (uDevelop > 0.0) {
    float n = hash(cell);
    if (n < uDevelop) {
      vec4 full = sampleSrc(mapUV(local));
      if (uTextMode > 0.5) { col = uInk; a = full.a * alpha; }
      else { col = full.rgb; a = alpha; }
    }
  }
  outColor = vec4(col * a, a);
}`;

export function hex(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false, alpha: true });
    if (!gl) throw new Error('no webgl2');
    this.gl = gl;
    this.items = [];
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const prog = this.program(VERT, FRAG);
    this.prog = prog;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i);
      this.u[info.name] = gl.getUniformLocation(prog, info.name);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.SCISSOR_TEST);
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  program(vs, fs) {
    const gl = this.gl;
    const make = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, make(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  // The WebGL canvas is offscreen. It only needs to be as large as the
  // largest picture; each picture is copied into its own canvas in the page.
  ensureSize(w, h) {
    if (this.canvas.width < w) this.canvas.width = w;
    if (this.canvas.height < h) this.canvas.height = h;
  }

  resize() { this.dpr = Math.min(window.devicePixelRatio || 1, 2); }

  texture(source, { gray = false } = {}) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (gray) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, source);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  update(tex, source) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  // Each picture gets its own 2D canvas inside its element, so it scrolls
  // with the page natively (a fixed overlay trails behind Safari's scrolling).
  add(item) {
    const merged = Object.assign({
      cell: 2, gain: 1, bias: 0, develop: 0, atlas: 0, frame: 0, contain: 0, focus: [0.5, 0.5],
      fadeTop: 0, fadeBottom: 0, radius: 0, textMode: 0, alpha: 1, light: null, lightAmt: 0,
      ground: [1, 1, 1], dot: [0, 0, 0], ink: [0, 0, 0], visible: true,
    }, item);
    const view = document.createElement('canvas');
    view.setAttribute('aria-hidden', 'true');
    view.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    merged.el.prepend(view);
    merged.view = view;
    merged.ctx = view.getContext('2d');
    this.items.push(merged);
    return merged;
  }

  draw() {
    const gl = this.gl, u = this.u, dpr = this.dpr;
    const vh = innerHeight;
    for (const it of this.items) {
      const r = it.el.getBoundingClientRect();
      if (r.bottom < -80 || r.top > vh + 80 || r.width < 1 || r.height < 1) continue;
      const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (it.view.width !== w || it.view.height !== h) { it.view.width = w; it.view.height = h; }
      if (!it.visible || !it.tex || it.alpha <= 0) { if (it.drawn) { it.ctx.clearRect(0, 0, w, h); it.drawn = false; } continue; }
      this.ensureSize(w, h);
      const H = this.canvas.height;
      gl.viewport(0, 0, w, h);
      gl.scissor(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.uRes, w, h);
      gl.bindTexture(gl.TEXTURE_2D, it.tex);
      gl.uniform4f(u.uRect, 0, 0, w, h);
      gl.uniform2f(u.uTexSize, it.texW, it.texH);
      gl.uniform2f(u.uFocus, it.focus[0], it.focus[1]);
      gl.uniform1f(u.uContain, it.contain);
      gl.uniform1f(u.uCell, Math.max(1, Math.round(it.cell * dpr)));
      gl.uniform3fv(u.uGround, it.ground);
      gl.uniform3fv(u.uDot, it.dot);
      gl.uniform3fv(u.uInk, it.ink);
      gl.uniform1f(u.uGain, it.gain);
      gl.uniform1f(u.uBias, it.bias);
      const L = it.light || [0, 0, 1];
      gl.uniform3f(u.uLight, (L[0] - r.left) * dpr, (L[1] - r.top) * dpr, L[2] * dpr);
      gl.uniform1f(u.uLightAmt, it.light ? it.lightAmt : 0);
      gl.uniform1f(u.uDevelop, it.develop);
      gl.uniform1f(u.uAtlas, it.atlas);
      gl.uniform1f(u.uFrame, it.frame);
      gl.uniform1f(u.uFadeBottom, it.fadeBottom);
      gl.uniform1f(u.uFadeTop, it.fadeTop);
      gl.uniform1f(u.uRadius, it.radius * dpr);
      gl.uniform1f(u.uTextMode, it.textMode);
      gl.uniform1f(u.uGray, it.gray ? 1 : 0);
      gl.uniform1f(u.uAlpha, it.alpha);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      it.ctx.clearRect(0, 0, w, h);
      it.ctx.drawImage(this.canvas, 0, H - h, w, h, 0, 0, w, h);
      it.drawn = true;
    }
  }
}

export function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

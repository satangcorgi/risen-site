import { Stage, hex, loadImage } from './stage.js';

// ---------------------------------------------------------------- looks
// The app's own looks (Risen/Design/Page/Look.swift), light and dark.
const LOOKS = {
  Morning: { light: ['F4F8FD', 'FFFFFF', '0D1624', '2F5BC8', '1E7A46', 'E3EEFD', 'A8C4F2'],
             dark:  ['080F1C', '111A2B', 'EAF1FA', '60A5FA', '4ADE80', '0B1628', '1F3B6B'] },
  Meadow:  { light: ['F3FAF5', 'FFFFFF', '0E1A14', '2B5DA8', '0F7A3B', 'E5F2EA', 'A6CDB5'],
             dark:  ['06130E', '0E1F18', 'E8F3EC', '8AB8F5', '4ADE80', '0A1A16', '1E4A3D'] },
  Tide:    { light: ['F2F9FA', 'FFFFFF', '0B1A1E', '0B6E85', '15803D', 'DDEFF3', '9FCFDB'],
             dark:  ['061A1F', '0D272D', 'E6F4F6', '5CC8D6', '4ADE80', '0A2228', '1B4A55'] },
  Purple:  { light: ['F7F4FD', 'FFFFFF', '16102A', '6D3FD1', '1E7A46', 'EDE6FC', 'C4B2F2'],
             dark:  ['0E0A1C', '181229', 'EEEAFA', 'B69CFF', '4ADE80', '150F2A', '352866'] },
  Pink:    { light: ['FDF4F8', 'FFFFFF', '220B17', 'B8266E', '1E7A46', 'FCE6F0', 'F2B3D0'],
             dark:  ['1A0912', '26111C', 'FBE9F2', 'FF8FC4', '4ADE80', '241020', '5A2545'] },
  Red:     { light: ['FDF5F4', 'FFFFFF', '210C0B', 'B42318', '1E7A46', 'FCE5E5', 'F2A8AB'],
             dark:  ['1A0A09', '261211', 'FAEAE8', 'FF8A7A', '4ADE80', '260E10', '6A2026'] },
  Orange:  { light: ['FEF7F1', 'FFFFFF', '22120A', 'B4490A', '1E7A46', 'FEE9D6', 'F8B57E'],
             dark:  ['180E07', '24160D', 'FBEEE4', 'FF9F5A', '4ADE80', '24140A', '6A3810'] },
  Yellow:  { light: ['FDFAF0', 'FFFFFF', '1C1704', '8A5C00', '1E7A46', 'FCF2CF', 'F0D27A'],
             dark:  ['15110A', '201A0F', 'FAF5E6', 'F5C542', '4ADE80', '1F1805', '5A460C'] },
};
const KEYS = ['ground', 'surface', 'ink', 'tint', 'kept', 'sky', 'dots'];

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
let family = 'Morning';
try { const saved = localStorage.getItem('risen.look'); if (saved && LOOKS[saved]) family = saved; } catch {}

function lookColors() {
  const row = LOOKS[family][darkMQ.matches ? 'dark' : 'light'];
  return Object.fromEntries(KEYS.map((k, i) => ['#' + row[i], hex(row[i])]).map(([h, rgb], i) => [KEYS[i], { h, rgb }]));
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
let ink = null;          // live colours the stage draws with (tweened)
let inkTarget = null;

function applyLook(animate = true) {
  const c = lookColors();
  const root = document.documentElement.style;
  for (const k of KEYS) root.setProperty('--' + k, c[k].h);
  root.setProperty('--quiet', `color-mix(in srgb, ${c.ink.h} 66%, ${c.ground.h})`);
  root.setProperty('--rule', `color-mix(in srgb, ${c.ink.h} 13%, transparent)`);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', c.ground.h));
  const target = Object.fromEntries(KEYS.map(k => [k, c[k].rgb]));
  if (!ink || !animate || reduce) { ink = structuredClone(target); inkTarget = target; return; }
  const from = structuredClone(ink);
  inkTarget = target;
  const tween = { t: 0 };
  gsap.to(tween, { t: 1, duration: 0.7, ease: 'power2.inOut', onUpdate: () => {
    for (const k of KEYS) ink[k] = mix(from[k], target[k], tween.t);
  } });
}
applyLook(false);
darkMQ.addEventListener('change', () => applyLook(true));

// Look buttons
const row = document.getElementById('looksRow');
for (const name of Object.keys(LOOKS)) {
  const b = document.createElement('button');
  b.className = 'look';
  b.type = 'button';
  b.setAttribute('aria-pressed', String(name === family));
  b.innerHTML = `<span class="sw"></span>${name}`;
  const paint = () => {
    const r = LOOKS[name][darkMQ.matches ? 'dark' : 'light'];
    b.style.setProperty('--a', '#' + r[5]);
    b.style.setProperty('--b', '#' + r[6]);
  };
  paint();
  darkMQ.addEventListener('change', paint);
  b.addEventListener('click', () => {
    family = name;
    try { localStorage.setItem('risen.look', name); } catch {}
    row.querySelectorAll('.look').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    applyLook(true);
  });
  row.append(b);
}

// ---------------------------------------------------------------- the store, always near
const getPill = document.getElementById('get');
const topBar = document.querySelector('header.top');
const barState = () => topBar.classList.toggle('solid', scrollY > 24);
addEventListener('scroll', barState, { passive: true }); barState();
const heroAct = document.querySelector('.hero .act');
new IntersectionObserver(([e]) => getPill.classList.toggle('on', !e.isIntersecting), { threshold: 0 }).observe(heroAct);

// The alarm in the scene rings at the visitor's own time.
const clock = document.getElementById('clock');
const tick = () => { clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
tick(); setInterval(tick, 15000);

// ---------------------------------------------------------------- stage
gsap.registerPlugin(ScrollTrigger);
let stage = null;
try {
  if (/nogl/.test(location.search)) throw new Error('nogl requested'); // test hook for the no-WebGL page
  stage = new Stage(document.getElementById('stage')); document.documentElement.classList.add('gl');
}
catch (e) { console.warn('Risen: drawing without WebGL2', e); }

const pointer = { x: innerWidth * 0.5, y: innerHeight * 0.32, tx: innerWidth * 0.5, ty: innerHeight * 0.32, last: -1e9 };
addEventListener('pointermove', e => { pointer.tx = e.clientX; pointer.ty = e.clientY; pointer.last = performance.now(); }, { passive: true });
addEventListener('pointerdown', e => { pointer.tx = e.clientX; pointer.ty = e.clientY; pointer.last = performance.now(); }, { passive: true });

const items = {};
const loopState = { target: 0, p: 0 };

async function build() {
  if (!stage) return;
  const heroPhoneEl = document.querySelector('[data-dither="hero-phone"]');
  const [plate, phoneShot] = await Promise.all([
    loadImage('assets/plate-creation-of-light.png'),
    loadImage(heroPhoneEl.dataset.src),
  ]);
  const plateTex = stage.texture(plate);

  // Hero: Doré's light, in the look's sky dots. "Let there be light":
  // the page opens fully dotted and the light comes through.
  items.sky = stage.add({
    el: document.querySelector('[data-dither="sky"]'), tex: plateTex, texW: plate.width, texH: plate.height,
    focus: [0.5, 0.2], gain: 2.0, bias: 0, base: reduce ? -0.7 : 0.15, fadeBottom: 0.86, fadeTop: 0.1, cell: 2,
    light: [0, 0, 300], lightAmt: 1, role: 'sky',
  });
  // Bands of cloud between sections, so the sky runs down the page.
  document.querySelectorAll('[data-dither="band"]').forEach(el => {
    stage.add({ el, tex: plateTex, texW: plate.width, texH: plate.height, focus: el.dataset.focus.split(',').map(Number),
      gain: 2.0, bias: -0.75, fadeTop: 0.5, fadeBottom: 0.5, cell: 2, light: [0, 0, 300], lightAmt: 1, role: 'sky' });
  });

  // The looks panel: the same plate, close on the light, re-inked live.
  items.plate = stage.add({
    el: document.querySelector('[data-dither="plate"]'), tex: plateTex, texW: plate.width, texH: plate.height,
    focus: [0.35, 0.25], gain: 2.1, bias: -0.55, cell: 2, radius: 28, role: 'plate',
  });
  items.dawn = stage.add({
    el: document.querySelector('[data-dither="dawn"]'), tex: plateTex, texW: plate.width, texH: plate.height,
    focus: [0.5, 0.3], gain: 2.0, bias: -0.8, fadeTop: 0.3, fadeBottom: 0.3, cell: 2,
    light: [0, 0, 300], lightAmt: 0.9, role: 'sky',
  });
  intro();
  requestAnimationFrame(frame);

  // The hero phone: the ringing alarm, sharp from the first frame.
  stage.add({ el: heroPhoneEl, tex: stage.texture(phoneShot), texW: phoneShot.width, texH: phoneShot.height,
    focus: [0.5, 0], gain: 1.15, bias: -0.07, cell: 2, radius: 30, develop: 1, role: 'screen' });

  const atlas = await loadImage('assets/v2/book-atlas-512.jpg');
  items.book = stage.add({
    el: document.querySelector('[data-dither="book"]'), tex: stage.texture(atlas, { gray: true }), gray: true,
    texW: 512, texH: 512, atlas: 8, frame: 0, focus: [0.5, 0.52], gain: 1.3, bias: -0.04, cell: 2, role: 'book',
  });

  // The verse: drawn as dots first, then developed into ink.
  items.verse = stage.add({ el: document.querySelector('#verse blockquote'), tex: null, textMode: 1, gain: 1, bias: -0.35, cell: 2, role: 'verse' });
  layoutVerse();
  document.fonts.ready.then(layoutVerse);
  addEventListener('resize', () => requestAnimationFrame(layoutVerse));

  // Screens: lazy, and each develops from dots when it comes into view.
  const screenEls = document.querySelectorAll('[data-dither="screen"]');
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const el = e.target;
      loadImage(el.dataset.src).then(img => {
        const focus = (el.dataset.focus || '0.5,0').split(',').map(Number);
        const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
        const it = stage.add({ el, tex: stage.texture(img), texW: img.width, texH: img.height, focus,
          gain: 1.15, bias: -0.07, cell: 2, radius, develop: reduce ? 1 : 0, role: 'screen' });
        if (!reduce) {
          const row = el.closest('.screens') || el;
          const watch = new IntersectionObserver(([v]) => {
            if (!v.isIntersecting) return;
            watch.disconnect();
            const i = [...document.querySelectorAll('[data-dither="screen"]')].indexOf(el);
            gsap.to(it, { develop: 1, duration: 0.6, ease: 'power1.inOut', delay: 0.05 + Math.max(0, i) * 0.05 });
          }, { threshold: 0.35 });
          watch.observe(row);
        }
      });
    }
  }, { rootMargin: '60% 0px' });
  screenEls.forEach(el => io.observe(el));

}

// Text into a texture, word by word at the DOM's own positions, so the
// highlighter strokes (DOM) line up with the drawn ink.
function layoutVerse() {
  const it = items.verse;
  if (!it) return;
  const bq = it.el, t = bq.querySelector('.t');
  const box = bq.getBoundingClientRect();
  const dpr = stage.dpr;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(box.width * dpr));
  cv.height = Math.max(1, Math.round(box.height * dpr));
  const ctx = cv.getContext('2d');
  const cs = getComputedStyle(t);
  ctx.scale(dpr, dpr);
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText('Hg');
  const asc = m.fontBoundingBoxAscent ?? parseFloat(cs.fontSize) * 0.9;
  const desc = m.fontBoundingBoxDescent ?? parseFloat(cs.fontSize) * 0.25;
  const node = t.firstChild;
  const text = node.textContent;
  const range = document.createRange();
  const lines = new Map();
  let i = 0;
  for (const word of text.split(' ')) {
    range.setStart(node, i); range.setEnd(node, i + word.length);
    const r = range.getBoundingClientRect();
    const x = r.left - box.left, top = r.top - box.top;
    ctx.fillText(word, x, top + (r.height - asc - desc) / 2 + asc);
    const key = Math.round(top);
    const line = lines.get(key) || { top, bottom: r.bottom - box.top, left: x, right: x + r.width };
    line.left = Math.min(line.left, x); line.right = Math.max(line.right, x + r.width);
    lines.set(key, line);
    i += word.length + 1;
  }
  if (it.tex) stage.update(it.tex, cv); else it.tex = stage.texture(cv);
  it.texW = cv.width; it.texH = cv.height;
  layoutMarks([...lines.values()]);
}

// Highlighter: one felt-tip stroke per line, a little past each end.
function verseLines() {
  const bq = document.querySelector('#verse blockquote'), node = bq.querySelector('.t').firstChild;
  const box = bq.getBoundingClientRect(), range = document.createRange(), lines = new Map();
  let i = 0;
  for (const word of node.textContent.split(' ')) {
    range.setStart(node, i); range.setEnd(node, i + word.length);
    const r = range.getBoundingClientRect();
    const x = r.left - box.left, top = r.top - box.top, key = Math.round(top);
    const line = lines.get(key) || { top, bottom: r.bottom - box.top, left: x, right: x + r.width };
    line.left = Math.min(line.left, x); line.right = Math.max(line.right, x + r.width);
    lines.set(key, line);
    i += word.length + 1;
  }
  return [...lines.values()];
}

function layoutMarks(lines = verseLines()) {
  const bq = document.querySelector('#verse blockquote');
  const marks = bq.querySelector('.marks');
  marks.innerHTML = '';
  let n = 0;
  for (const line of lines) {
    const h = line.bottom - line.top;
    const s = document.createElement('i');
    const seed = Math.sin(++n * 91.7) * 0.5 + 0.5;
    s.style.left = `${line.left - 4 - seed * 3}px`;
    s.style.width = `${line.right - line.left + 8 + seed * 4}px`;
    s.style.top = `${line.top + h * 0.2}px`;
    s.style.height = `${h * 0.66}px`;
    s.style.transform = `rotate(${(seed - 0.55) * 1.1}deg)`;
    marks.append(s);
  }
  setLoop(loopState.p, true);
}

function intro() {
  const h1 = document.getElementById('headline');
  const rest = document.querySelectorAll('.hero .sub, .hero .act');
  if (reduce) return;
  gsap.set(h1, { opacity: 0.001, y: 10 });
  gsap.set(rest, { opacity: 0, y: 10 });
  gsap.to(items.sky, { base: -0.7, duration: 1.4, ease: 'power3.out' });
  gsap.to(h1, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' });
  gsap.to(rest, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', delay: 0.15, stagger: 0.06 });
}

// ---------------------------------------------------------------- the loop scene
const lines = [...document.querySelectorAll('.say .line')];
const verseBox = document.getElementById('verse');
const endCopy = document.querySelector('.end .copy');
const verseText = verseBox.querySelector('.t');
const alarm = document.getElementById('alarm');
const scan = document.getElementById('scan');
const clamp01 = v => Math.min(1, Math.max(0, v));
const span = (p, a, b) => clamp01((p - a) / (b - a));
const smooth = x => x * x * (3 - 2 * x);

function show(el, o) {
  el.style.opacity = o.toFixed(3);
  el.style.transform = `translateY(${((1 - o) * 10).toFixed(2)}px)`;
}

// The alarm can be heard, if you ask. Opening the book stops it, like the app.
let wasStopped = false;
const hear = document.getElementById('hear');
const sound = {
  on: false, audio: null, inView: false,
  sync() {
    const play = this.on && !wasStopped && this.inView;
    hear.hidden = wasStopped;
    if (!this.audio) return;
    if (play) { this.audio.currentTime = 0; this.audio.play().catch(() => {}); }
    else this.audio.pause();
  },
};
hear.addEventListener('click', () => {
  if (!sound.audio) { sound.audio = new Audio('assets/v2/alarm-classic.m4a'); sound.audio.loop = true; sound.audio.volume = 0.35; }
  sound.on = !sound.on;
  hear.setAttribute('aria-pressed', String(sound.on));
  hear.querySelector('span').textContent = sound.on ? 'Mute' : 'Hear it';
  sound.sync();
});
new IntersectionObserver(([e]) => { sound.inView = e.isIntersecting; sound.sync(); }).observe(document.querySelector('.loop'));

function setLoop(p) {
  // Step captions cross-fade at their edges.
  const steps = [[0, 0.2], [0.2, 0.52], [0.52, 0.72]];
  steps.forEach(([a, b], i) => {
    const o = (i === 0 ? 1 : smooth(span(p, a, a + 0.04))) * (1 - smooth(span(p, b - 0.04, b)));
    show(lines[i], o);
  });
  const verseIn = smooth(span(p, 0.7, 0.75));
  show(verseBox, verseIn);
  if (items.book) {
    const o = smooth(span(p, 0.18, 0.54));
    const f = o < 0.35 ? o / 0.35 * 14 : o < 0.5 ? 14 + (o - 0.35) / 0.15 * 24 : 38 + (o - 0.5) / 0.5 * 18;
    items.book.frame = Math.min(55.999, f);
  }
  // The camera reads the page.
  const s = span(p, 0.55, 0.68);
  scan.style.opacity = (s > 0 && s < 1 ? Math.sin(s * Math.PI) : 0).toFixed(3);
  scan.style.top = `${28 + s * 44}%`;
  const stopped = p >= 0.66;
  if (stopped !== wasStopped) { wasStopped = stopped; sound.sync(); }
  alarm.classList.toggle('stopped', stopped);
  alarm.classList.toggle('ringing', !stopped && !reduce);
  // Dots develop into ink, then the real text takes over so the pen can go under it.
  const handoff = span(p, 0.84, 0.865);
  if (items.verse) { items.verse.develop = smooth(span(p, 0.74, 0.84)); items.verse.alpha = verseIn * (1 - handoff); }
  verseText.style.color = stage ? `color-mix(in srgb, var(--ink) ${(handoff * 100).toFixed(1)}%, transparent)` : '';
  const marks = verseBox.querySelectorAll('.marks i');
  marks.forEach((m, i) => {
    const a = 0.86 + (i / marks.length) * 0.09, b = a + 0.09 / marks.length;
    m.style.clipPath = `inset(0 ${((1 - span(p, a, b)) * 100).toFixed(1)}% 0 0)`;
  });
}

if (reduce) {
  loopState.p = loopState.target = 1;
} else {
  ScrollTrigger.create({
    trigger: '.loop', start: 'top top', end: 'bottom bottom',
    onUpdate: self => { loopState.target = self.progress; if (!stage) { loopState.p = self.progress; setLoop(loopState.p); } },
  });
}
setLoop(loopState.p);

// Section reveals
if (!reduce) {
  const reveals = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      reveals.unobserve(e.target);
      gsap.to(e.target, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' });
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('.reveal').forEach(el => reveals.observe(el));
}

// ---------------------------------------------------------------- frame
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  // Scroll progress is followed by a critically damped spring, so a flick
  // of the wheel still opens the book smoothly.
  const k = 1 - Math.exp(-dt * 9);
  loopState.p += (loopState.target - loopState.p) * k;
  if (Math.abs(loopState.target - loopState.p) > 0.0004) setLoop(loopState.p);
  else if (loopState.p !== loopState.target) { loopState.p = loopState.target; setLoop(loopState.p); }

  // The light follows the pointer; with nobody pointing, it wanders slowly.
  const idle = now - pointer.last > 3500;
  if (idle && !reduce) {
    const t = now / 1000;
    pointer.tx = innerWidth * (0.5 + 0.22 * Math.sin(t * 0.17));
    pointer.ty = innerHeight * (0.3 + 0.1 * Math.cos(t * 0.13));
  }
  const kp = 1 - Math.exp(-dt * (idle ? 1.2 : 6));
  pointer.x += (pointer.tx - pointer.x) * kp;
  pointer.y += (pointer.ty - pointer.y) * kp;
  const radius = Math.min(innerWidth, innerHeight) * 0.42;

  // Scrolling away from the hero, the light rises and burns off the cloud.
  if (items.sky) {
    const out = clamp01(scrollY / (innerHeight * 0.9));
    const t = now / 1000;
    const breathe = reduce ? 0 : 0.05 * Math.sin(t * 0.5);
    items.sky.bias = items.sky.base - (reduce ? 0 : 1.1 * out * out) + breathe;
    if (!reduce) items.sky.focus = [0.5 + 0.06 * Math.sin(t * 0.05), 0.2 + 0.03 * Math.sin(t * 0.037)];
  }
  for (const it of stage.items) {
    if (it.role === 'sky' && it === items.dawn) {
      it.ground = ink.ground; it.dot = mix(ink.dots, ink.tint, 0.18);
      const c = endCopy.getBoundingClientRect();
      it.light = [c.left + c.width / 2, c.top + c.height / 2, Math.max(c.width, c.height) * 0.62];
      it.lightAmt = 1;
    } else if (it.role === 'sky') {
      it.ground = ink.ground; it.dot = mix(ink.dots, ink.tint, 0.18);
      it.light = reduce ? null : [pointer.x, pointer.y, radius];
    } else if (it.role === 'plate') {
      it.ground = ink.sky; it.dot = mix(ink.dots, ink.tint, 0.35);
    } else if (it.role === 'book') {
      it.ground = ink.ground; it.dot = mix(ink.dots, ink.tint, 0.72);
    } else if (it.role === 'screen') {
      it.ground = ink.ground; it.dot = mix(ink.dots, ink.ink, 0.3);
    } else if (it.role === 'verse') {
      it.ground = ink.ground; it.dot = mix(ink.dots, ink.ink, 0.25); it.ink = ink.ink;
    }
  }
  stage.draw();
  requestAnimationFrame(frame);
}

// Test hook: ?y=0.4 opens the page scrolled that far through the how-it-works scene.
const at = new URLSearchParams(location.search).get('y');
if (at !== null) setTimeout(() => { const l = document.querySelector('.loop'); scrollTo(0, l.offsetTop + Number(at) * (l.offsetHeight - innerHeight)); }, 900);

if (stage) build();
else { const lay = () => { layoutMarks(); setLoop(loopState.p); }; lay(); document.fonts.ready.then(lay); addEventListener('resize', lay); }

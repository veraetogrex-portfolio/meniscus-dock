// Meniscus Dock — github.com/veraetogrex-portfolio · zero dependencies
// The tab doesn't slide, the dock melts around it: one SVG path is rebuilt every frame,
// its dip chases the bead on a spring, and the colour blends in HSL, never through green.

const root   = document.querySelector('#meniscus');
const bead   = root.querySelector('.mn-bead');
const shadow = root.querySelector('.mn-shadow');
const paths  = root.querySelectorAll('.mn-path');
const edge   = root.querySelectorAll('.mn-e');
const pool   = root.querySelector('#mn-pool');
const wash   = document.querySelector('.mn-wash');

const SECTIONS = [
  { name: 'Overview', rgb: [124, 108, 255], sub: 'Good evening, <b>Mira</b> — 3 things need you' },
  { name: 'Projects', rgb: [255, 111, 181], sub: '<b>4 projects</b> · 2 shipping this month' },
  { name: 'Inbox',    rgb: [63, 224, 208],  sub: '<b>23 unread</b> · 5 mention you' },
  { name: 'Calendar', rgb: [255, 181, 71],  sub: 'Next · <b>Design review</b> at 14:30' },
  { name: 'Settings', rgb: [255, 122, 69],  sub: 'Workspace · <b>Veraetogrex</b>' },
];
const ICONS = [
  '<rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/>',
  '<path d="M12 3.2l8.6 4.6L12 12.4 3.4 7.8z"/><path d="M3.4 12.2L12 16.8l8.6-4.6"/><path d="M3.4 16.4L12 21l8.6-4.6"/>',
  '<path d="M3.5 13.5l2.6-8h11.8l2.6 8V19a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 19z"/><path d="M3.5 13.5h5l1.2 2.6h4.6l1.2-2.6h5"/>',
  '<rect x="3.5" y="5" width="17" height="15.5" rx="2.2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
];
const icon = (i, w = 1.7) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${ICONS[i]}</svg>`;

// rgb ⇄ hsl
const toHsl = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, d / (1 - Math.abs(2 * l - 1)), l];
};
const toRgb = ([h, s, l]) => {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map(v => Math.round((v + m) * 255));
};

// geometry in dock px (the dock box is 800 × 200)
const X0 = 40, X1 = 760, TOP = 40, BOTTOM = 148, R = 26;
const XS = [144, 272, 400, 528, 656], STEP = 128;
const SHOULDER = 78, DEPTH = 46, BEAD_Y = TOP + 4;

const tabs = SECTIONS.map((s, i) => {
  const b = document.createElement('button');
  b.className = 'mn-icon'; b.style.left = XS[i] + 'px';
  b.innerHTML = icon(i) + `<span>${s.name}</span>`;
  b.addEventListener('click', () => go(i));
  return root.querySelector('.mn-icons').appendChild(b);
});
const beadIcons = SECTIONS.map((_, i) => { bead.insertAdjacentHTML('beforeend', icon(i, 2.1)); return bead.lastElementChild; });

// bx/bv: bead · nx/nv: dip centre lagging behind it · lift: 0..1 while held
const st = { bx: XS[0], bv: 0, nx: XS[0], nv: 0, lift: 0, lv: 0, target: XS[0], index: 0, from: 0, drag: false, dragX: 0, grab: 0 };
let shown = -1;

function showSection(i, dir) {
  if (i === shown) return;
  const title = root.querySelector('.mn-title'), old = title.querySelector('span:not(.is-out)');
  const now = document.createElement('span'); now.textContent = SECTIONS[i].name; title.append(now);
  root.querySelector('.mn-idx').textContent = `0${i + 1} / 05`;
  root.querySelector('.mn-sub').innerHTML = SECTIONS[i].sub;
  tabs.forEach((t, k) => t.classList.toggle('is-on', k === i));
  bead.setAttribute('aria-valuenow', i + 1); bead.setAttribute('aria-valuetext', SECTIONS[i].name);
  if (old) {   // vertical roll: new title comes in from the side we are moving to
    const dy = dir >= 0 ? 100 : -100, opt = { duration: st.drag ? 240 : 380, easing: 'cubic-bezier(.2,.8,.2,1)' };
    now.animate([{ transform: `translateY(${dy}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], opt);
    old.classList.add('is-out');
    old.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${-dy}%)`, opacity: 0 }], { ...opt, fill: 'forwards' })
      .onfinish = () => old.remove();
  }
  shown = i;
}

// 1 · colour by position: HSL blend stays saturated, never through green
const HSL = SECTIONS.map(s => toHsl(s.rgb));
const green = (h0, dh) => [...Array(13).keys()].some(k => { const h = ((h0 + dh * k / 12) % 360 + 360) % 360; return h > 75 && h < 165; });
function colorAt(p) {
  const a = Math.max(0, Math.min(4, p)), i = Math.min(3, Math.floor(a)), f = a - i;
  const [h0, s0, l0] = HSL[i], [h1, s1, l1] = HSL[i + 1];
  let dh = ((h1 - h0 + 540) % 360) - 180;              // shortest way round…
  if (green(h0, dh)) dh = dh > 0 ? dh - 360 : dh + 360; // …unless it crosses green
  return toRgb([(h0 + dh * f + 360) % 360, s0 + (s1 - s0) * f, l0 + (l1 - l0) * f]);
}

// 2 · the liquid outline: one path, a C1-smooth dip from cA to cB
function dockPath(cA, cB, depth) {
  cA = Math.max(X0 + R + 40, cA); cB = Math.min(X1 - R - 40, Math.max(cA, cB));
  const L = Math.max(X0 + R, cA - SHOULDER), Rr = Math.min(X1 - R, cB + SHOULDER), y = TOP + depth;
  const kl = cA - L, kr = Rr - cB, f = n => n.toFixed(2);
  return `M${X0},${TOP + R}A${R},${R} 0 0 1 ${X0 + R},${TOP}L${f(L)},${TOP}` +
    `C${f(L + kl * .5)},${TOP} ${f(cA - kl * .42)},${f(y)} ${f(cA)},${f(y)}L${f(cB)},${f(y)}` +
    `C${f(cB + kr * .42)},${f(y)} ${f(Rr - kr * .5)},${TOP} ${f(Rr)},${TOP}` +
    `L${X1 - R},${TOP}A${R},${R} 0 0 1 ${X1},${TOP + R}L${X1},${BOTTOM - R}A${R},${R} 0 0 1 ${X1 - R},${BOTTOM}` +
    `L${X0 + R},${BOTTOM}A${R},${R} 0 0 1 ${X0},${BOTTOM - R}Z`;
}

// 3 · every frame: the dip spans bead → lagging centre, so it stretches
function render() {
  const p = (st.bx - XS[0]) / STEP;
  const cp = st.drag ? p : st.from <= st.index ? Math.min(p, st.index) : Math.max(p, st.index); // no tint overshoot
  const [r, g, b] = colorAt(cp), rgb = `rgb(${r},${g},${b})`;
  root.style.setProperty('--c', `${r},${g},${b}`);

  const cA = Math.min(st.bx, st.nx), cB = Math.max(st.bx, st.nx), gap = cB - cA;
  const depth = DEPTH * (1 - Math.min(.32, gap / 260)) + st.lift * 4;
  const d = dockPath(cA, cB, depth);
  paths.forEach(el => el.setAttribute('d', d));

  const mid = ((cA + cB) / 2 - X0) / (X1 - X0), spread = (SHOULDER + gap / 2 + 40) / (X1 - X0);
  [mid - spread, mid, mid + spread].forEach((o, k) => edge[k].setAttribute('offset', Math.max(0, Math.min(1, o))));
  edge[1].setAttribute('stop-color', rgb);
  pool.querySelectorAll('stop').forEach(s => s.setAttribute('stop-color', rgb));
  pool.setAttribute('gradientTransform', `translate(${(cA + cB) / 2} ${TOP + depth - 4}) scale(${120 + gap * .6} 64)`);

  const sx = 1 + st.lift * .08 + Math.min(.12, Math.abs(st.bv) / 12000), sy = 1 + st.lift * .08 - Math.min(.07, Math.abs(st.bv) / 20000);
  bead.style.transform = `translate(${st.bx}px,${BEAD_Y - st.lift * 10}px) scale(${sx},${sy})`;
  shadow.style.transform = `translate(${(cA + cB) / 2}px,${TOP + depth - 6}px) scaleX(${1 + gap / 120})`;
  shadow.style.opacity = .7 - st.lift * .3;
  beadIcons.forEach((el, i) => el.style.opacity = Math.max(0, 1 - Math.abs(p - i) * 1.8));
  tabs.forEach((t, i) => t.firstChild.style.opacity = Math.min(1, Math.max(0, (Math.abs(st.bx - XS[i]) - 22) / 60)));

  const sec = st.drag ? Math.round(Math.max(0, Math.min(4, p))) : st.index;   // title follows the bead while held
  if (sec !== shown) showSection(sec, sec - shown);
}

// 4 · physics: bead springs to its tab, the dip centre springs to the bead
const spring = (x, v, to, w, z, dt) => { v += (-w * w * (x - to) - 2 * z * w * v) * dt; return [x + v * dt, v]; };
let last = performance.now();
function tick(now) {
  const h = Math.min(.034, (now - last) / 1000) / 4; last = now;
  for (let k = 0; k < 4; k++) {
    if (st.drag) {   // rubber band past the first and last tab
      const x = st.dragX, lo = XS[0], hi = XS[4];
      const want = x < lo ? lo - 46 * (1 - Math.exp(-(lo - x) / 90)) : x > hi ? hi + 46 * (1 - Math.exp(-(x - hi) / 90)) : x;
      const nb = st.bx + (want - st.bx) * (1 - Math.exp(-h * 38));
      st.bv = (nb - st.bx) / h; st.bx = nb;
    } else [st.bx, st.bv] = spring(st.bx, st.bv, st.target, 12.5, .6, h);
    [st.nx, st.nv] = spring(st.nx, st.nv, st.bx, 19, .95, h);
    [st.lift, st.lv] = spring(st.lift, st.lv, st.drag ? 1 : 0, 18, .55, h);
  }
  render();
  requestAnimationFrame(tick);
}

function go(i) {
  i = Math.max(0, Math.min(4, i));
  st.from = (st.bx - XS[0]) / STEP; st.index = i; st.target = XS[i];
}

// pointer → dock px (works with CSS zoom / transforms)
const toDock = e => { const r = root.querySelector('.mn-dock').getBoundingClientRect(); return (e.clientX - r.left) / (r.width / 800); };
bead.addEventListener('pointerdown', e => {
  e.preventDefault(); bead.setPointerCapture(e.pointerId);
  st.drag = true; st.grab = toDock(e) - st.bx; st.dragX = st.bx;
  bead.classList.add('is-drag');
});
bead.addEventListener('pointermove', e => { if (st.drag) st.dragX = toDock(e) - st.grab; });
bead.addEventListener('pointerup', release);
bead.addEventListener('pointercancel', release);

// 5 · release: snap to the nearest tab, its colour washes the page
function release() {
  if (!st.drag) return;
  st.drag = false; bead.classList.remove('is-drag');
  go(Math.round(Math.max(0, Math.min(4, (st.bx - XS[0]) / STEP))));
  const at = bead.getBoundingClientRect();
  wash.style.left = at.left + at.width / 2 + 'px';
  wash.style.top = at.top + at.height / 2 + 'px';
  wash.style.setProperty('--w', SECTIONS[st.index].rgb.join(','));
  wash.animate([
    { transform: 'scale(.04)', opacity: 0 },
    { opacity: 1, offset: .12 },
    { transform: 'scale(1)', opacity: 0 },
  ], { duration: 1000, easing: 'cubic-bezier(.2,.8,.2,1)' });
}

addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') { e.preventDefault(); go(st.index + 1); }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); go(st.index - 1); }
});

showSection(0, 0);
requestAnimationFrame(t => { last = t; tick(t); });

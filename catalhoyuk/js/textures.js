// Procedural textures for Çatalhöyük. Everything is drawn on canvases at
// start-up so the page loads with no image downloads at all.
import * as THREE from 'three';

// ---------- small deterministic noise toolkit ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Periodic value noise so textures tile seamlessly.
export function makeValueNoise(seed, period = 64) {
  const rnd = mulberry32(seed);
  const grid = new Float32Array(period * period);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const fade = (t) => t * t * (3 - 2 * t);
  return function (x, y) {
    x = ((x % period) + period) % period;
    y = ((y % period) + period) % period;
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x1 = (xi + 1) % period, y1 = (yi + 1) % period;
    const a = grid[yi * period + xi], b = grid[yi * period + x1];
    const c = grid[y1 * period + xi], d = grid[y1 * period + x1];
    const u = fade(xf), v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

export function fbm(noise, x, y, octaves = 5, lac = 2, gain = 0.5) {
  let amp = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * f, y * f);
    norm += amp; amp *= gain; f *= lac;
  }
  return sum / norm;
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  return c;
}

function toTexture(c, repeat = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Fill a canvas pixel-by-pixel with f(u,v)->[r,g,b] in 0..255.
function paint(size, f) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const [r, g, b] = f(x / size, y / size, x, y);
      d[i] = clamp(r, 0, 255); d[i + 1] = clamp(g, 0, 255); d[i + 2] = clamp(b, 0, 255); d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------- exterior mud plaster (tan / grey-brown earth) ----------
export function mudPlasterTexture(seed = 1) {
  const n1 = makeValueNoise(seed, 32), n2 = makeValueNoise(seed + 7, 64), n3 = makeValueNoise(seed + 13, 16), n4 = makeValueNoise(seed + 21, 8);
  const size = 512;
  const COURSES = 16;           // ~15 cm courses over a 2.5 m tile
  const BRICKS = 3;             // ~0.8 m long bricks
  const c = paint(size, (u, v) => {
    const big = fbm(n1, u * 6, v * 6, 4);
    const fine = fbm(n2, u * 40, v * 40, 3);
    const streak = fbm(n3, u * 2, v * 30, 2);
    // brick grid
    const row = Math.floor(v * COURSES), fy = v * COURSES - row;
    const off = (row % 2) * 0.5;
    const fx = ((u * BRICKS + off) % 1 + 1) % 1;
    const mortar = (fy < 0.16 || fx < 0.05) ? 1 : 0;
    const brickTone = fbm(n4, Math.floor(u * BRICKS + off) * 1.7 + 0.3, row * 1.3 + 0.7, 1);
    // plaster coverage: intact where the noise is high, worn away elsewhere
    const cover = fbm(n1, u * 3 + 7, v * 3 + 2, 3);
    const plaster = Math.min(1, Math.max(0, (cover - 0.36) * 5));
    // plaster colour (pale grey-brown render) vs brick colour (browner, with dark grey mortar)
    let lp = 0.66 + (big - 0.5) * 0.16 + (fine - 0.5) * 0.08 + (streak - 0.5) * 0.05;
    const pr = 196 * lp + 18, pg = 176 * lp + 14, pb = 146 * lp + 10;
    let lb = 0.6 + (brickTone - 0.5) * 0.18 + (fine - 0.5) * 0.1;
    let br = 182 * lb + 22, bg = 150 * lb + 16, bb = 112 * lb + 10;
    if (mortar) { br *= 0.84; bg *= 0.85; bb *= 0.87; }
    const r = pr * plaster + br * (1 - plaster), g = pg * plaster + bg * (1 - plaster), b = pb * plaster + bb * (1 - plaster);
    return [r, g, b];
  });
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed + 99);
  ctx.strokeStyle = 'rgba(70,50,30,0.3)'; ctx.lineWidth = 1.2;
  for (let k = 0; k < 8; k++) {
    let x = rnd() * size, y = rnd() * size;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < 12; s++) { x += (rnd() - 0.5) * 30; y += rnd() * 25; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return toTexture(c);
}

// ---------- interior lime/marl plaster (cream-white) ----------
export function whitePlasterTexture(seed = 2, soot = 0) {
  const n1 = makeValueNoise(seed, 32), n2 = makeValueNoise(seed + 3, 64);
  const size = 512;
  const c = paint(size, (u, v) => {
    const big = fbm(n1, u * 5, v * 5, 4);
    const fine = fbm(n2, u * 60, v * 60, 3);
    // trowel strokes: faint horizontal banding
    const stroke = Math.sin(v * Math.PI * 60 + big * 10) * 0.012;
    let l = 0.90 + (big - 0.5) * 0.10 + (fine - 0.5) * 0.08 + stroke;
    // soot darkens towards the top (v = 0 is top of texture in UV space 1)
    if (soot > 0) {
      const s = soot * Math.pow(1 - v, 2.2) * (0.6 + 0.4 * big);
      l *= (1 - s * 0.8);
    }
    return [248 * l, 240 * l, 222 * l];
  });
  return toTexture(c);
}

// ---------- packed-mud roof with reed impressions ----------
export function roofTexture(seed = 3) {
  const n1 = makeValueNoise(seed, 32), n2 = makeValueNoise(seed + 5, 64), n3 = makeValueNoise(seed + 9, 16);
  const size = 512;
  const c = paint(size, (u, v) => {
    const big = fbm(n1, u * 4, v * 4, 4);
    const fine = fbm(n2, u * 50, v * 50, 3);
    // reed/stalk impressions as thin parallel streaks
    const reed = Math.pow(Math.abs(Math.sin((u * 90 + fbm(n3, u * 3, v * 3, 2) * 4) * Math.PI)), 30) * 0.07;
    let l = 0.58 + (big - 0.5) * 0.25 + (fine - 0.5) * 0.12 - reed;
    return [190 * l + 25, 165 * l + 18, 130 * l + 10];
  });
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed + 77);
  // dried-mud polygon cracks
  ctx.strokeStyle = 'rgba(80,60,35,0.45)'; ctx.lineWidth = 1.5;
  for (let k = 0; k < 26; k++) {
    let x = rnd() * size, y = rnd() * size;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < 8; s++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return toTexture(c);
}

// ---------- midden: ash, charcoal, bone fragments ----------
export function middenTexture(seed = 4) {
  const n1 = makeValueNoise(seed, 32), n2 = makeValueNoise(seed + 2, 64);
  const size = 512;
  const c = paint(size, (u, v) => {
    const big = fbm(n1, u * 5, v * 5, 4);
    const fine = fbm(n2, u * 70, v * 70, 3);
    let l = 0.56 + (big - 0.5) * 0.3 + (fine - 0.5) * 0.15;
    // ash is greyer, dirt browner
    const ash = clamp((big - 0.45) * 3, 0, 1);
    const r = (150 * (1 - ash) + 160 * ash) * l + 10;
    const g = (125 * (1 - ash) + 155 * ash) * l + 8;
    const b = (95 * (1 - ash) + 150 * ash) * l + 6;
    return [r, g, b];
  });
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed + 55);
  for (let k = 0; k < 420; k++) {
    const x = rnd() * size, y = rnd() * size, r = 0.5 + rnd() * 1.6;
    const t = rnd();
    ctx.fillStyle = t < 0.45 ? 'rgba(35,28,22,0.8)' : t < 0.8 ? 'rgba(235,228,210,0.85)' : 'rgba(120,90,60,0.8)';
    ctx.beginPath(); ctx.ellipse(x, y, r * (0.6 + rnd()), r, rnd() * 3, 0, Math.PI * 2); ctx.fill();
  }
  return toTexture(c);
}

// ---------- plain soil / steppe (used as terrain detail) ----------
export function soilTexture(seed = 5) {
  const n1 = makeValueNoise(seed, 32), n2 = makeValueNoise(seed + 2, 64);
  const size = 512;
  const c = paint(size, (u, v) => {
    const big = fbm(n1, u * 4, v * 4, 4);
    const fine = fbm(n2, u * 80, v * 80, 3);
    let l = 0.6 + (big - 0.5) * 0.2 + (fine - 0.5) * 0.18;
    return [200 * l, 178 * l, 135 * l];
  });
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed + 11);
  // dry grass tufts
  for (let k = 0; k < 500; k++) {
    const x = rnd() * size, y = rnd() * size;
    ctx.strokeStyle = `rgba(${150 + rnd() * 40 | 0},${130 + rnd() * 30 | 0},${60 + rnd() * 30 | 0},0.6)`;
    ctx.lineWidth = 1;
    for (let b = 0; b < 4; b++) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * 8, y - rnd() * 7); ctx.stroke();
    }
  }
  return toTexture(c);
}

// ---------- wood (oak / juniper) ----------
export function woodTexture(seed = 6) {
  const n1 = makeValueNoise(seed, 32);
  const size = 256;
  const c = paint(size, (u, v) => {
    const grain = Math.sin((v * 2 + fbm(n1, u * 10, v * 2, 3) * 3) * Math.PI * 12) * 0.5 + 0.5;
    const fine = fbm(n1, u * 60, v * 4, 2);
    let l = 0.45 + grain * 0.12 + (fine - 0.5) * 0.1;
    return [170 * l + 20, 130 * l + 12, 90 * l + 6];
  });
  return toTexture(c);
}

// ---------- reeds / thatch for mats and wind-screens ----------
export function reedTexture(seed = 7) {
  const n1 = makeValueNoise(seed, 32);
  const size = 256;
  const c = paint(size, (u, v) => {
    const stalk = Math.pow(Math.abs(Math.sin(u * Math.PI * 28)), 1.5);
    const fine = fbm(n1, u * 30, v * 8, 2);
    let l = 0.55 + stalk * 0.25 + (fine - 0.5) * 0.2;
    return [205 * l, 180 * l, 120 * l];
  });
  return toTexture(c);
}

// woven mat (plaited reeds)
export function matTexture(seed = 8) {
  const size = 256;
  const c = paint(size, (u, v) => {
    const a = Math.floor(u * 12) % 2, b = Math.floor(v * 12) % 2;
    const over = (a ^ b);
    const fx = (u * 12) % 1, fy = (v * 12) % 1;
    const shade = over ? Math.sin(fx * Math.PI) : Math.sin(fy * Math.PI);
    let l = 0.5 + shade * 0.3;
    return [190 * l + 15, 160 * l + 10, 100 * l + 5];
  });
  return toTexture(c);
}

// basket (coiled) texture
export function basketTexture(seed = 9) {
  const size = 256;
  const n1 = makeValueNoise(seed, 32);
  const c = paint(size, (u, v) => {
    const coil = Math.sin(v * Math.PI * 24) * 0.5 + 0.5;
    const stitch = Math.pow(Math.abs(Math.sin(u * Math.PI * 40 + v * 20)), 3) * 0.3;
    const fine = fbm(n1, u * 20, v * 20, 2);
    let l = 0.5 + coil * 0.25 - stitch + (fine - 0.5) * 0.1;
    return [205 * l + 10, 170 * l + 8, 110 * l + 4];
  });
  return toTexture(c);
}

// wool: just a mottled light texture
export function woolTexture(seed = 10) {
  const size = 128;
  const n1 = makeValueNoise(seed, 16);
  const c = paint(size, (u, v) => {
    const f = fbm(n1, u * 10, v * 10, 3);
    let l = 0.75 + (f - 0.5) * 0.35;
    return [235 * l, 225 * l, 205 * l];
  });
  return toTexture(c);
}

// water: a tileable normal-ish pattern we animate by UV offset
export function waterTexture(seed = 11) {
  const size = 256;
  const n1 = makeValueNoise(seed, 32);
  const c = paint(size, (u, v) => {
    const f = fbm(n1, u * 8, v * 8, 4);
    let l = 0.45 + (f - 0.5) * 0.4;
    return [60 * l + 30, 90 * l + 50, 95 * l + 55];
  });
  return toTexture(c);
}

// Soot gradient decal (transparent → black), used on south walls and ceilings.
export function sootTexture() {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const n1 = makeValueNoise(31, 32);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const u = x / size, v = y / size;
    const f = fbm(n1, u * 6, v * 6, 4);
    const a = clamp(Math.pow(1 - v, 1.6) * (0.5 + f * 0.9), 0, 1);
    img.data[i] = 20; img.data[i + 1] = 16; img.data[i + 2] = 12; img.data[i + 3] = a * 235;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Smoke / dust puff sprite
export function puffTexture() {
  const size = 64;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// Fire sprite (flame-ish blob)
export function flameTexture() {
  const size = 64;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 40, 2, 32, 36, 30);
  g.addColorStop(0, 'rgba(255,240,180,1)');
  g.addColorStop(0.35, 'rgba(255,150,40,0.9)');
  g.addColorStop(0.7, 'rgba(200,60,10,0.35)');
  g.addColorStop(1, 'rgba(120,20,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}


// ceiling seen from below: round poles over a reed layer
export function ceilingTexture(seed = 12) {
  const size = 512;
  const n1 = makeValueNoise(seed, 32);
  const c = paint(size, (u, v) => {
    // poles every ~0.16 m across a 2.5 m tile -> 16 poles
    const pole = Math.pow(Math.abs(Math.sin(u * Math.PI * 16)), 0.6);
    const reed = Math.pow(Math.abs(Math.sin(v * Math.PI * 90 + fbm(n1, u * 4, v * 4, 2) * 3)), 2) * 0.12;
    const shade = fbm(n1, u * 12, v * 12, 3);
    const isPole = pole > 0.55;
    let l = isPole ? 0.42 + (pole - 0.55) * 0.6 + (shade - 0.5) * 0.1 : 0.55 + (shade - 0.5) * 0.2 - reed;
    return isPole ? [150 * l + 20, 115 * l + 12, 80 * l + 6] : [190 * l + 10, 165 * l + 8, 115 * l + 4];
  });
  return toTexture(c);
}

// reed clump with transparent background for alpha-tested quads
export function reedAlphaTexture(seed = 13) {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    const x0 = 40 + rnd() * 176, lean = (rnd() - 0.5) * 60;
    const h = 150 + rnd() * 100;
    const g = 120 + rnd() * 60;
    ctx.strokeStyle = `rgb(${g + 40},${g + 30},${g * 0.5})`;
    ctx.lineWidth = 2 + rnd() * 2;
    ctx.beginPath(); ctx.moveTo(x0, size); ctx.quadraticCurveTo(x0 + lean * 0.5, size - h * 0.6, x0 + lean, size - h); ctx.stroke();
    // leaves
    for (let k = 0; k < 3; k++) {
      const t = 0.3 + rnd() * 0.5, px = x0 + lean * t, py = size - h * t;
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + (rnd() - 0.5) * 40, py - 20, px + (rnd() - 0.5) * 70, py - 10 - rnd() * 30); ctx.stroke();
    }
    // seed head
    if (rnd() < 0.5) { ctx.fillStyle = 'rgb(150,120,80)'; ctx.beginPath(); ctx.ellipse(x0 + lean, size - h - 8, 3, 12, lean * 0.01, 0, Math.PI * 2); ctx.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function makeTextureSet() {
  const mud = mudPlasterTexture(1);
  const mud2 = mudPlasterTexture(21);
  const white = whitePlasterTexture(2, 0);
  const whiteSoot = whitePlasterTexture(2, 1);
  const roof = roofTexture(3);
  const midden = middenTexture(4);
  const soil = soilTexture(5);
  const wood = woodTexture(6);
  const reed = reedTexture(7);
  const mat = matTexture(8);
  const basket = basketTexture(9);
  const wool = woolTexture(10);
  const water = waterTexture(11);
  const soot = sootTexture();
  const puff = puffTexture();
  const flame = flameTexture();
  const ceiling = ceilingTexture();
  const reedAlpha = reedAlphaTexture();
  return { ceiling, reedAlpha, mud, mud2, white, whiteSoot, roof, midden, soil, wood, reed, mat, basket, wool, water, soot, puff, flame };
}

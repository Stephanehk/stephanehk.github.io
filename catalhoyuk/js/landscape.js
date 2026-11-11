// Terrain, river belt, vegetation, sky, distant mountains and herds for the
// Konya Plain around Çatalhöyük. World axes: +X = east, -Z = north, +Z = south.
import * as THREE from 'three';
import { makeValueNoise, fbm, mulberry32 } from './textures.js';
import { mergeGeometries, mergeVertices } from '../lib/BufferGeometryUtils.js';

export const PLAIN_Y = 0;              // level of the Neolithic plain
export const MOUND = {
  cx: 0, cz: 0,
  a: 150,          // semi-axis east-west (m)
  b: 230,          // semi-axis north-south (m)
  rot: 0.28,       // long axis skewed NNE–SSW (radians, clockwise from north)
  height: 13.5,    // metres above the plain at the summit
};

const nPlain = makeValueNoise(101, 64);
const nMound = makeValueNoise(102, 32);

// --- river channels: polylines in world space (x,z) with width ---
// Anabranching belt west and south of the mound. Main channel ~200 m west.
function buildChannels() {
  const chans = [];
  const rnd = mulberry32(5);
  function wiggly(x0, z0, x1, z1, n, amp, width, depth) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      const dx = -(z1 - z0), dz = (x1 - x0);
      const l = Math.hypot(dx, dz) || 1;
      const off = Math.sin(t * Math.PI * 3.1 + rnd() * 0.3) * amp * (0.6 + 0.4 * Math.sin(t * 7.3)) + (rnd() - 0.5) * amp * 0.4;
      pts.push(new THREE.Vector2(x + dx / l * off, z + dz / l * off));
    }
    chans.push({ pts, width, depth });
  }
  // main channel: from far south (slightly SSW) running north, passing ~220 m west of the summit
  wiggly(-120, 2600, -260, -2600, 60, 70, 34, 1.9);
  // second branch splitting off to the south, curling around the south of the mound and rejoining to the NW
  wiggly(-80, 1500, 170, 420, 20, 40, 16, 1.8);
  wiggly(170, 420, 330, -200, 14, 35, 14, 1.6);
  wiggly(330, -200, 60, -700, 14, 40, 14, 1.6);
  wiggly(60, -700, -250, -1300, 14, 40, 16, 1.6);
  // small side channels and backwaters
  wiggly(-400, 300, -600, -900, 16, 30, 10, 1.2);
  wiggly(-250, -500, -900, -300, 12, 30, 8, 1.0);
  wiggly(-200, 900, -520, 1600, 12, 30, 10, 1.2);
  return chans;
}
export const CHANNELS = buildChannels();

function distToPolyline(pts, x, z) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const abx = b.x - a.x, abz = b.y - a.y;
    const apx = x - a.x, apz = z - a.y;
    const l2 = abx * abx + abz * abz;
    let t = l2 > 0 ? (apx * abx + apz * abz) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = apx - abx * t, dz = apz - abz * t;
    const d = dx * dx + dz * dz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// Channel influence: returns {cut, wet} where cut is how much to lower the
// terrain, wet is 0..1 moisture used for colouring/vegetation.
export function channelInfo(x, z) {
  let cut = 0, wet = 0, water = 0;
  for (const c of CHANNELS) {
    // cheap bbox reject
    const d = distToPolyline(c.pts, x, z);
    const hw = c.width / 2;
    if (d < hw) { cut = Math.max(cut, c.depth * (0.55 + 0.45 * Math.cos(Math.PI * d / hw))); water = 1; }
    else if (d < hw * 3.2) { cut = Math.max(cut, c.depth * 0.3 * Math.pow(1 - (d - hw) / (hw * 2.2), 2)); }
    const w = Math.max(0, 1 - d / (hw * 6));
    wet = Math.max(wet, w);
  }
  return { cut, wet, water };
}

export function moundHeight(x, z) {
  const dx = x - MOUND.cx, dz = z - MOUND.cz;
  const c = Math.cos(MOUND.rot), s = Math.sin(MOUND.rot);
  const u = (dx * c - dz * s) / MOUND.a;   // east-west normalised
  const v = (dx * s + dz * c) / MOUND.b;   // north-south normalised
  const r = Math.sqrt(u * u + v * v);
  if (r >= 1.08) return 0;
  // broad dome with slightly flattened top and two gentle summits along the long axis
  const base = Math.pow(Math.max(0, 1 - Math.pow(Math.min(r, 1), 2.6)), 1.25);
  const hump = 0.07 * Math.exp(-Math.pow((v - 0.25) / 0.3, 2) - Math.pow(u / 0.5, 2)) + 0.05 * Math.exp(-Math.pow((v + 0.35) / 0.3, 2) - Math.pow(u / 0.5, 2));
  const n = (fbm(nMound, (x + 500) * 0.012, (z + 500) * 0.012, 3) - 0.5) * 0.08;
  let h = MOUND.height * (base + hump * base + n * base);
  // skirt: the mound's foot blends smoothly into the plain
  if (r > 1) h *= Math.max(0, 1 - (r - 1) / 0.08);
  return Math.max(0, h);
}

export function terrainHeight(x, z) {
  const m = moundHeight(x, z);
  const plain = (fbm(nPlain, x * 0.004 + 10, z * 0.004 + 10, 3) - 0.5) * 0.9;
  const ci = channelInfo(x, z);
  const onMound = Math.min(1, m / 2.5);
  return PLAIN_Y + m + plain * (1 - onMound) - ci.cut * (1 - onMound);
}

export const WATER_Y = PLAIN_Y - 1.0;

// ---------------- terrain mesh ----------------
export function buildTerrain(tex, townMask) {
  const N = 300, EXT = 3200;
  const geo = new THREE.BufferGeometry();
  const verts = (N + 1) * (N + 1);
  const pos = new Float32Array(verts * 3), col = new Float32Array(verts * 3), uv = new Float32Array(verts * 2);
  const warp = (t) => Math.sign(t) * Math.pow(Math.abs(t), 2.3) * EXT;
  const cTan = new THREE.Color(0xc7bca2), cGreen = new THREE.Color(0x8fa65a), cWetMud = new THREE.Color(0x8a7c62);
  const cTown = new THREE.Color(0xb3a184), cField = new THREE.Color(0xd4ad4e), cReedy = new THREE.Color(0xa3b067);
  const tmp = new THREE.Color();
  const nCol = makeValueNoise(103, 64);
  let i = 0;
  for (let iz = 0; iz <= N; iz++) {
    for (let ix = 0; ix <= N; ix++) {
      const x = warp(ix / N * 2 - 1), z = warp(iz / N * 2 - 1);
      const h = terrainHeight(x, z);
      pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z;
      uv[i * 2] = x / 5; uv[i * 2 + 1] = z / 5;
      // colour
      const ci = channelInfo(x, z);
      const m = moundHeight(x, z);
      const n = fbm(nCol, x * 0.01, z * 0.01, 3);
      tmp.copy(cTan).lerp(cGreen, Math.pow(ci.wet, 1.6) * 0.85);
      if (ci.water > 0) tmp.copy(cWetMud);
      else if (ci.wet > 0.55 && n > 0.45) tmp.lerp(cReedy, 0.5);
      // fields on the drier ground around the mound
      const fieldMask = townMask ? townMask.field(x, z) : 0;
      if (fieldMask > 0) tmp.lerp(cField, fieldMask * 0.9);
      // the mound itself: trampled brown-grey
      const tm = Math.min(1, m / 1.5);
      tmp.lerp(cTown, tm * 0.9);
      // noise variation
      const v = (0.85 + n * 0.3) * 1.65;
      col[i * 3] = tmp.r * v; col[i * 3 + 1] = tmp.g * v; col[i * 3 + 2] = tmp.b * v;
      i++;
    }
  }
  const idx = [];
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
    const a = iz * (N + 1) + ix, b = a + 1, c = a + N + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: tex.soil, vertexColors: true, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

// ---------------- water ----------------
export function buildWater(tex) {
  const geo = new THREE.PlaneGeometry(6400, 6400, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({ color: 0x8aa0a2, map: tex.water, specular: 0xfff4e0, shininess: 120, transparent: true, opacity: 0.9 });
  tex.water.repeat.set(400, 400);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WATER_Y;
  mesh.receiveShadow = true;
  mesh.name = 'water';
  return mesh;
}

// ---------------- sky ----------------
export function buildSky() {
  const geo = new THREE.SphereGeometry(5000, 48, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      zenith: { value: new THREE.Color(0x2d5aa6) },
      horizon: { value: new THREE.Color(0xd9d2c0) },
      sunCol: { value: new THREE.Color(0xfff2d0) },
      haze: { value: 1.0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 sunDir, zenith, horizon, sunCol; uniform float haze; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(13.7, 7.1); a *= 0.5; } return v; }
      void main(){
        vec3 d = normalize(vDir);
        float t = max(d.y, 0.0);
        // Rayleigh-ish gradient: saturated blue overhead, pale and warm at the horizon
        float grad = 1.0 - exp(-t * 3.2);
        vec3 col = mix(horizon, zenith, grad);
        // thicker dusty haze in the lowest degrees
        col = mix(col, horizon, (1.0 - smoothstep(0.0, 0.06, t)) * 0.6);
        float mu = max(dot(d, sunDir), 0.0);
        col += sunCol * (pow(mu, 6.0) * 0.12 + pow(mu, 64.0) * 0.25 + pow(mu, 600.0) * 0.6) * haze;
        col = mix(col, sunCol * 1.4, smoothstep(0.99955, 0.99985, mu));
        // sparse, stretched cirrus high up
        if (d.y > 0.04) {
          vec2 p = d.xz / (d.y + 0.25);
          p = vec2(p.x * 0.9 + p.y * 0.3, p.y * 2.6);
          float c = fbm(p * 0.9);
          float wisps = fbm(p * 4.0 + c * 2.0);
          float cov = smoothstep(0.56, 0.72, c) * smoothstep(0.35, 0.7, wisps);
          cov *= smoothstep(0.04, 0.2, d.y) * 0.55;
          col = mix(col, mix(vec3(1.0, 0.98, 0.95), sunCol, 0.3), cov);
        }
        if (d.y < 0.0) col = horizon * (1.0 + d.y * 1.5);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sky';
  return mesh;
}

// ---------------- distant mountains ----------------
// Bearing in compass degrees (0 = north, clockwise). Heights in metres at the
// ring radius; angular sizes slightly exaggerated for recognisability.
export function buildMountains(hazeColor) {
  const R = 2900, SEG = 1440;
  const peaks = [
    { b: 66, h: 1.15, w: 1.2, twin: true },   // Hasan Dağı (twin cones, ENE)
    { b: 90, h: 0.55, w: 5, flat: true },     // Karacadağ (E, broad shield)
    { b: 134, h: 1.25, w: 6 },                // Karadağ (SE)
    { b: 110, h: 0.35, w: 14, flat: true },   // Bolkar, far ESE, very low
    { b: 275, h: 0.9, w: 7 },                 // Erenler Dağı (W)
    { b: 300, h: 0.7, w: 9, flat: true },     // hills NW of Konya
    { b: 325, h: 0.55, w: 6 },                // Takkeli Dağ (NW)
  ];
  const nR = makeValueNoise(201, 128);
  const heights = new Float32Array(SEG + 1), snow = new Float32Array(SEG + 1);
  for (let i = 0; i <= SEG; i++) {
    const bear = i / SEG * 360;
    let h = 0;
    { const dH = ((bear - 66 + 540) % 360) - 180; snow[i] = Math.abs(dH) < 1.3 ? 1 : 0; }
    // Taurus hills: low jagged wall from ~150° to ~225°
    const tz = (bear - 187) / 40;
    if (Math.abs(tz) < 1) h += (0.7 + 0.5 * fbm(nR, bear * 0.12, 0.3, 3)) * (1 - tz * tz) * 0.95;
    for (const p of peaks) {
      let d = ((bear - p.b + 540) % 360) - 180;
      const x = d / p.w;
      if (Math.abs(x) < 1) {
        let prof = p.flat ? Math.pow(1 - x * x, 0.6) : (1 - Math.abs(x)) * (1 - Math.abs(x)) * (1 + 0.5 * (1 - Math.abs(x)));
        if (p.twin) prof = Math.max(Math.exp(-Math.pow((d - 0.45) / 0.45, 2)), 0.9 * Math.exp(-Math.pow((d + 0.55) / 0.55, 2)));
        h = Math.max(h, p.h * prof);
      }
    }
    // tiny ridge noise everywhere so the horizon isn't a razor line
    h += 0.04 * fbm(nR, bear * 0.6, 7.7, 2);
    heights[i] = h * Math.PI / 180 * R; // degrees to metres at radius R
  }
  const pos = [], col = [], idx = [];
  const cBase = hazeColor.clone().lerp(new THREE.Color(0x8a93a8), 0.35), cTop = new THREE.Color(0x5f6c88), cSnow = new THREE.Color(0xeef1f6);
  const rows = 6;
  for (let i = 0; i <= SEG; i++) {
    const bear = i / SEG * 360, a = bear * Math.PI / 180;
    const x = Math.sin(a) * R, z = -Math.cos(a) * R;
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      const y = -40 + (heights[i] + 40) * t;
      pos.push(x, y, z);
      const c = cBase.clone().lerp(cTop, Math.pow(t, 1.3) * 0.7);
      // snow cap on Hasan Dağı only
      if (snow[i] && t > 0.8) c.lerp(cSnow, 0.8 * (t - 0.8) / 0.2);
      // ridge shading noise
      const sh = 0.92 + 0.16 * fbm(nR, bear * 0.9, t * 3, 2);
      col.push(c.r * sh, c.g * sh, c.b * sh);
    }
  }
  for (let i = 0; i < SEG; i++) for (let r = 0; r < rows; r++) {
    const a = i * (rows + 1) + r, b = a + rows + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'mountains';
  return mesh;
}

// ---------------- vegetation ----------------
function scatter(count, rnd, accept, tries = 20) {
  const out = [];
  for (let k = 0; k < count; k++) {
    for (let t = 0; t < tries; t++) {
      const p = accept(rnd);
      if (p) { out.push(p); break; }
    }
  }
  return out;
}

export function buildReeds(tex, rnd) {
  // crossed quads, alpha-tested, clustered along channel margins
  const quad = new THREE.PlaneGeometry(1.6, 2.4, 1, 1);
  quad.translate(0, 1.2, 0);
  const q2 = quad.clone().rotateY(Math.PI / 2);
  const q3 = quad.clone().rotateY(Math.PI / 4);
  const geo = mergeGeometries([quad, q2, q3]);
  const mat = new THREE.MeshStandardMaterial({ map: tex.reedAlpha, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, color: 0xcdbb7a });
  const count = 2600;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const cTmp = new THREE.Color();
  let n = 0;
  for (let k = 0; k < count * 30 && n < count; k++) {
    const x = (rnd() - 0.5) * 2600, z = (rnd() - 0.5) * 3400;
    if (moundHeight(x, z) > 0.2) continue;
    const ci = channelInfo(x, z);
    // reeds stand in the shallow margins and backswamp, not in the main flow
    const h = terrainHeight(x, z);
    const inWater = h < WATER_Y + 0.9;
    if (!(ci.wet > 0.65 && (inWater ? rnd() < 0.5 : rnd() < 0.8 * (ci.wet - 0.65) * 3))) continue;
    if (h < WATER_Y - 0.6) continue;
    pos.set(x, Math.max(h, WATER_Y - 0.3) - 0.1, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI);
    const sc = 0.8 + rnd() * 0.7;
    s.set(sc, sc * (0.9 + rnd() * 0.5), sc);
    m.compose(pos, q, s);
    mesh.setMatrixAt(n, m);
    cTmp.setHSL(0.16 + rnd() * 0.05, 0.3 + rnd() * 0.2, 0.42 + rnd() * 0.15, THREE.SRGBColorSpace);
    mesh.setColorAt(n, cTmp);
    n++;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = true;
  mesh.name = 'reeds';
  return mesh;
}

export function buildTrees(tex, rnd) {
  // low-poly riverine trees: willow / poplar / tamarisk along the channel banks
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 1, 6, 1);
  trunkGeo.translate(0, 0.5, 0);
  const canopyGeo = mergeVertices(new THREE.IcosahedronGeometry(1, 2));
  { const p = canopyGeo.attributes.position; const r0 = mulberry32(77); for (let i = 0; i < p.count; i++) { const k = 0.85 + r0() * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } canopyGeo.computeVertexNormals(); }
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4a38, roughness: 1 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: false });
  const MAXT = 420;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, MAXT);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, MAXT * 3);
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const c = new THREE.Color();
  let nt = 0, nc = 0;
  for (let k = 0; k < 20000 && nt < MAXT; k++) {
    const x = (rnd() - 0.5) * 2800, z = (rnd() - 0.5) * 3600;
    if (moundHeight(x, z) > 0.1) continue;
    const ci = channelInfo(x, z);
    const h = terrainHeight(x, z);
    if (ci.water || h < WATER_Y + 0.6) continue;
    // trees on the banks; a few scattered almond/hackberry further out
    const bank = ci.wet > 0.5 && ci.wet < 0.97;
    if (!(bank && rnd() < 0.35) && !(rnd() < 0.006)) continue;
    const kind = bank ? (rnd() < 0.45 ? 'willow' : rnd() < 0.7 ? 'poplar' : 'tamarisk') : 'almond';
    let th, tr, canopyN, cw, ch, hue, sat, lig;
    if (kind === 'poplar') { th = 7 + rnd() * 5; tr = 0.9; canopyN = 3; cw = 1.8; ch = 3.4; hue = 0.25; sat = 0.38; lig = 0.26; }
    else if (kind === 'willow') { th = 3 + rnd() * 2; tr = 1.3; canopyN = 3; cw = 3.2; ch = 2.4; hue = 0.22; sat = 0.3; lig = 0.3; }
    else if (kind === 'tamarisk') { th = 2 + rnd() * 1.5; tr = 0.8; canopyN = 2; cw = 2.2; ch = 1.8; hue = 0.24; sat = 0.2; lig = 0.3; }
    else { th = 2.5 + rnd() * 1.5; tr = 0.9; canopyN = 2; cw = 2.4; ch = 2.0; hue = 0.2; sat = 0.25; lig = 0.28; }
    p.set(x, h - 0.2, z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2); s.set(tr, th, tr);
    m.compose(p, q, s); trunks.setMatrixAt(nt, m);
    trunks.setColorAt(nt, c.setHSL(0.08, 0.25, 0.25 + rnd() * 0.1, THREE.SRGBColorSpace));
    for (let j = 0; j < canopyN && nc < MAXT * 3; j++) {
      const f = j / Math.max(1, canopyN - 1);
      p.set(x + (rnd() - 0.5) * cw * 0.5, h + th * (kind === 'poplar' ? 0.45 + 0.45 * f : 0.75 + 0.2 * f), z + (rnd() - 0.5) * cw * 0.5);
      const sw = cw * (0.6 + rnd() * 0.5) * (kind === 'poplar' ? 1 - 0.35 * f : 1), sh = ch * (0.6 + rnd() * 0.4);
      s.set(sw, sh, sw);
      q.setFromEuler(new THREE.Euler(rnd(), rnd(), rnd()));
      m.compose(p, q, s); canopies.setMatrixAt(nc, m);
      canopies.setColorAt(nc, c.setHSL(hue + (rnd() - 0.5) * 0.03, sat, lig + (rnd() - 0.5) * 0.08, THREE.SRGBColorSpace));
      nc++;
    }
    nt++;
  }
  trunks.count = nt; canopies.count = nc;
  trunks.instanceMatrix.needsUpdate = true; canopies.instanceMatrix.needsUpdate = true;
  if (trunks.instanceColor) trunks.instanceColor.needsUpdate = true;
  if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
  trunks.castShadow = canopies.castShadow = true;
  trunks.name = 'trunks'; canopies.name = 'canopies';
  return [trunks, canopies];
}

// steppe shrubs (Artemisia) and grass tufts around the mound
export function buildShrubs(rnd) {
  const geo = new THREE.IcosahedronGeometry(0.5, 1);
  geo.scale(1, 0.55, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const N = 2200;
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const c = new THREE.Color();
  let n = 0;
  for (let k = 0; k < N * 20 && n < N; k++) {
    const r = 260 + rnd() * 900, a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (moundHeight(x, z) > 0.05) continue;
    const ci = channelInfo(x, z);
    if (ci.wet > 0.6) continue;
    const h = terrainHeight(x, z);
    p.set(x, h, z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
    const sc = 0.4 + rnd() * 0.7; s.set(sc, sc * (0.6 + rnd() * 0.6), sc);
    m.compose(p, q, s); mesh.setMatrixAt(n, m);
    mesh.setColorAt(n, c.setHSL(0.16 + rnd() * 0.05, 0.14 + rnd() * 0.12, 0.26 + rnd() * 0.1, THREE.SRGBColorSpace));
    n++;
  }
  mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.receiveShadow = true;
  mesh.name = 'shrubs';
  return mesh;
}

// ---------------- animals ----------------
function sheepGeometry() {
  const body = new THREE.SphereGeometry(0.42, 8, 6); body.scale(1.35, 0.95, 0.85); body.translate(0, 0.78, 0);
  const head = new THREE.SphereGeometry(0.17, 6, 5); head.scale(1.4, 1, 0.9); head.translate(0.68, 0.72, 0);
  const legGeo = () => { const g = new THREE.CylinderGeometry(0.05, 0.04, 0.55, 5); g.translate(0, 0.27, 0); return g; };
  const l1 = legGeo().translate(0.35, 0, 0.18), l2 = legGeo().translate(0.35, 0, -0.18), l3 = legGeo().translate(-0.35, 0, 0.18), l4 = legGeo().translate(-0.35, 0, -0.18);
  return mergeGeometries([body, head, l1, l2, l3, l4]);
}

export class Herds {
  constructor(tex, rnd, groups) {
    // groups: [{x,z,r,n,kind}], kind sheep|goat
    this.geo = sheepGeometry();
    this.mat = new THREE.MeshStandardMaterial({ map: tex.wool, roughness: 1 });
    this.total = groups.reduce((a, g) => a + g.n, 0);
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, this.total);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.name = 'herds';
    this.animals = [];
    const c = new THREE.Color();
    let i = 0;
    for (const g of groups) {
      for (let k = 0; k < g.n; k++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * g.r;
        const x = g.x + Math.cos(a) * r, z = g.z + Math.sin(a) * r;
        const goat = g.kind === 'goat' || rnd() < 0.3;
        this.animals.push({ x, z, yaw: rnd() * Math.PI * 2, phase: rnd() * 10, speed: 0, t: rnd() * 5, hx: g.x, hz: g.z, hr: g.r, goat, grounded: g.grounded, y: g.y });
        if (goat) c.setHSL(0.07, 0.3 + rnd() * 0.2, 0.15 + rnd() * 0.25, THREE.SRGBColorSpace); else c.setHSL(0.09, 0.15, 0.72 + rnd() * 0.15, THREE.SRGBColorSpace);
        this.mesh.setColorAt(i, c);
        i++;
      }
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this._m = new THREE.Matrix4(); this._p = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
    this.update(0, 0);
  }
  update(dt, time, rnd = Math.random) {
    const { _m, _p, _q, _s, _e } = this;
    for (let i = 0; i < this.animals.length; i++) {
      const a = this.animals[i];
      a.t -= dt;
      if (a.t <= 0) { a.t = 2 + rnd() * 6; a.speed = rnd() < 0.5 ? 0 : 0.35 + rnd() * 0.3; a.yaw += (rnd() - 0.5) * 2.0; }
      if (a.speed > 0) {
        let nx = a.x + Math.cos(a.yaw) * a.speed * dt, nz = a.z - Math.sin(a.yaw) * a.speed * dt;
        const dx = nx - a.hx, dz = nz - a.hz;
        if (dx * dx + dz * dz > a.hr * a.hr) { a.yaw += Math.PI * 0.6; } else { a.x = nx; a.z = nz; }
      }
      const y = a.y !== undefined ? a.y : terrainHeight(a.x, a.z);
      const grazing = a.speed === 0 ? -0.08 : 0;
      const bob = a.speed > 0 ? Math.abs(Math.sin(time * 6 + a.phase)) * 0.04 : 0;
      _p.set(a.x, y + bob, a.z);
      _e.set(0, a.yaw, grazing * 2); _q.setFromEuler(_e);
      const sc = a.goat ? 0.9 : 1;
      _s.set(sc, sc, sc);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// circling birds (vultures / cranes) as simple V shapes
export class Birds {
  constructor(n, cx, cz, rnd) {
    const geo = new THREE.BufferGeometry();
    const v = new Float32Array([-1.2, 0, 0.1, 0, 0, -0.15, 0, 0.05, 0.25, 1.2, 0, 0.1, 0, 0, -0.15, 0, 0.05, 0.25]);
    geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
    const mat = new THREE.MeshBasicMaterial({ color: 0x2a2520, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.name = 'birds';
    this.birds = [];
    for (let i = 0; i < n; i++) this.birds.push({ cx: cx + (rnd() - 0.5) * 300, cz: cz + (rnd() - 0.5) * 300, r: 40 + rnd() * 90, h: 45 + rnd() * 70, ph: rnd() * 6.28, sp: (0.08 + rnd() * 0.08) * (rnd() < 0.5 ? 1 : -1), fl: rnd() * 6 });
    this._m = new THREE.Matrix4(); this._p = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
  }
  update(time) {
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      const a = b.ph + time * b.sp;
      this._p.set(b.cx + Math.cos(a) * b.r, b.h + Math.sin(time * 0.3 + b.ph) * 4, b.cz + Math.sin(a) * b.r);
      const flap = Math.sin(time * 5 + b.fl) * 0.35 * (Math.sin(time * 0.5 + b.fl) > 0.3 ? 1 : 0.1);
      this._e.set(0, -a - (b.sp > 0 ? 0 : Math.PI), flap + (b.sp > 0 ? 0.25 : -0.25));
      this._q.setFromEuler(this._e); this._s.set(1, 1, 1);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// Trampled midden surface over the whole mound: ash, bone and refuse between the houses.
export function buildMoundCap(tex) {
  const res = 2.2;
  const geos = [];
  const c = Math.cos(MOUND.rot), sn = Math.sin(MOUND.rot);
  const nx = Math.ceil(MOUND.a * 2.1 / res), nz = Math.ceil(MOUND.b * 2.1 / res);
  const g = new THREE.PlaneGeometry(MOUND.a * 2.1, MOUND.b * 2.1, nx, nz);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), tmp = new THREE.Color();
  const nC = makeValueNoise(501, 64);
  for (let i = 0; i < pos.count; i++) {
    // rotate the local grid into the mound's frame
    const lx = pos.getX(i), lz = pos.getZ(i);
    const x = MOUND.cx + lx * c - lz * sn, z = MOUND.cz + lx * sn + lz * c;
    const m = moundHeight(x, z);
    const inside = m > 0.25 ? 1 : 0;
    pos.setXYZ(i, x, terrainHeight(x, z) + (inside ? 0.06 : -2.0), z);
    const n = fbm(nC, x * 0.03, z * 0.03, 3);
    tmp.setHSL(0.08 + (n - 0.5) * 0.02, 0.12 + n * 0.1, 0.96 + (n - 0.5) * 0.2, THREE.SRGBColorSpace);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 3, pos.getZ(i) / 3);
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: tex.midden, vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true; mesh.name = 'moundcap';
  return mesh;
}

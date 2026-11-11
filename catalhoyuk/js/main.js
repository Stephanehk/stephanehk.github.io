// Çatalhöyük, c. 6600 BCE — a first-person reconstruction of the East Mound.
import * as THREE from 'three';
import { makeTextureSet, mulberry32 } from './textures.js';
import { buildMoundCap, buildTerrain, buildWater, buildSky, buildMountains, buildReeds, buildTrees, buildShrubs, Herds, Birds, terrainHeight, moundHeight, channelInfo, MOUND } from './landscape.js';
import { generateTown, placeLadders, buildTown, buildRoofClutter, buildMiddens, buildPens, worldPt, sectorMatrix, clearPlot } from './town.js';
import { buildB52, ASSET_V } from './b52.js';
import { makePaintings } from './paintings.js';
import { makeInteriorBuilder, updateShafts, disposeInterior } from './interiors.js';
import { Player, CollisionWorld } from './player.js';
import { buildPeople } from './people.js';

const nullEl = { textContent: '', disabled: false, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} };
const $ = (id) => document.getElementById(id) || nullEl;
const params = new URLSearchParams(location.search);
const rnd = mulberry32(parseInt(params.get('seed') || '6600', 10));

// ---------------- sun / sky presets ----------------
const PRESETS = [
  { name: 'Morning', az: 98, el: 24, sun: 0xffe2b4, sunI: 3.1, hemiSky: 0xb4c6dc, hemiGround: 0x9a8666, hemiI: 1.7, zenith: 0x4a7cc0, horizon: 0xe4d8c4, fog: 0xdfd3bf, fogD: 0.00070, exposure: 1.32 },
  { name: 'Midday', az: 182, el: 70, sun: 0xfff7ea, sunI: 3.6, hemiSky: 0xaec2dc, hemiGround: 0xa39070, hemiI: 1.8, zenith: 0x2b5db0, horizon: 0xd9d4c6, fog: 0xd6d0c2, fogD: 0.00050, exposure: 1.25 },
  { name: 'Afternoon', az: 247, el: 36, sun: 0xffe8c2, sunI: 3.4, hemiSky: 0xb3c5dc, hemiGround: 0xa38c68, hemiI: 1.7, zenith: 0x3467b2, horizon: 0xdfd1b8, fog: 0xdccfb6, fogD: 0.00058, exposure: 1.32 },
  { name: 'Evening', az: 292, el: 9, sun: 0xffb974, sunI: 3.2, hemiSky: 0x97a9cc, hemiGround: 0x957c60, hemiI: 1.9, zenith: 0x2a4785, horizon: 0xf2b88c, fog: 0xe8bb98, fogD: 0.00062, exposure: 1.4 },
];
let presetIdx = 2;

function sunDirOf(p) {
  const az = p.az * Math.PI / 180, el = p.el * Math.PI / 180;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

// ---------------- renderer / scene ----------------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 6000);
scene.add(camera);

const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 600;
const SH = 48;
sun.shadow.camera.left = -SH; sun.shadow.camera.right = SH; sun.shadow.camera.top = SH; sun.shadow.camera.bottom = -SH;
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.06;
scene.add(sun); scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0x8fb4e4, 0x9a8260, 1.0);
scene.add(hemi);
const skyFill = new THREE.PointLight(0xcfdcf0, 0, 13, 2);   // skylight bounce under the hatch when inside
scene.add(skyFill);
const fire = new THREE.PointLight(0xff8c3a, 0, 9, 2);
scene.add(fire);

scene.fog = new THREE.FogExp2(0xdccfb6, 0.00058);

const sky = buildSky(); scene.add(sky);
let mountains = null;

function applyPreset(p) {
  const dir = sunDirOf(p);
  sun.color.set(p.sun); sun.intensity = p.sunI;
  hemi.color.set(p.hemiSky); hemiSkyCol.set(p.hemiSky); hemi.groundColor.set(p.hemiGround); hemi.intensity = p.hemiI;
  hemiBase = p.hemiI;
  sky.material.uniforms.sunDir.value.copy(dir);
  sky.material.uniforms.zenith.value.set(p.zenith);
  sky.material.uniforms.horizon.value.set(p.horizon);
  scene.fog.color.set(p.fog); scene.fog.density = p.fogD;
  renderer.toneMappingExposure = p.exposure;
  exposureBase = p.exposure;
  if (mountains) scene.remove(mountains);
  mountains = buildMountains(new THREE.Color(p.fog)); scene.add(mountains);
  sunDir.copy(dir);
  if (registry.length) updateShafts(registry, sunDir);
  $('time').textContent = p.name;
}
const sunDir = new THREE.Vector3(0, 1, 0);
let hemiBase = 1.0, exposureBase = 1.0;
const hemiSkyCol = new THREE.Color(0x8fb4e4), warmBounce = new THREE.Color(0xd9c4a0);

// ---------------- loading helpers ----------------
// straw-tempered loam, trampled earth and timber photographed for the Building 52 model (Alicia Walsh, CC BY 4.0)
async function loadPhotoTextures(tex) {
  const loader = new THREE.TextureLoader();
  const load = (f, srgb) => loader.loadAsync('./assets/b52/' + f + '?v=' + ASSET_V).then((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }).catch(() => null);
  // the photographs are of a reddish loam; Çatalhöyük's bricks and plasters were a paler buff marl, so re-tone them
  const tone = (t, hue, lift) => {
    if (!t) return t;
    const img = t.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'color'; ctx.fillStyle = hue; ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = lift; ctx.fillStyle = hue; ctx.fillRect(0, 0, c.width, c.height);
    const out = new THREE.CanvasTexture(c); out.wrapS = out.wrapT = THREE.RepeatWrapping; out.colorSpace = THREE.SRGBColorSpace; out.anisotropy = 4;
    t.dispose(); return out;
  };
  let [loam, loamN, dirt, dirtN, timber, timberN] = await Promise.all([load('loam.jpg', true), load('loam_N.jpg'), load('dirt.jpg', true), load('dirt_N.jpg'), load('wood.jpg', true), load('wood_N.jpg')]);
  loam = tone(loam, '#c9b48e', 0.18); dirt = tone(dirt, '#bca682', 0.3);
  if (loam && loamN) { tex.loam = loam; tex.loamN = loamN; }
  if (dirt && dirtN) { tex.dirt = dirt; tex.dirtN = dirtN; }
  if (timber && timberN) { tex.timber = timber; tex.timberN = timberN; }
}
let b52plot = null;
const SHOW_B52_MODEL = false;
const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
async function stage(msg, fn) { $('loadmsg').textContent = msg; await nextFrame(); await nextFrame(); const t = performance.now(); const out = await fn(); console.log(`[catalhoyuk] ${msg} ${(performance.now() - t).toFixed(0)} ms`); return out; }

// ---------------- world ----------------
const world = new CollisionWorld(8);
world.groundFn = (x, z) => terrainHeight(x, z) + 0.09 * Math.min(1, moundHeight(x, z));
const registry = [];
// Interiors exist only around the player: built a couple per frame as they come within reach, torn down again beyond it.
const interiors = { built: new Map(), builder: null, group: new THREE.Group(), timer: 0 };
interiors.group.name = 'interiors';
const near = [];
function updateInteriors(px, pz, budget = 2) {
  const R_IN = 20, R_OUT = 28;
  for (const [h, e] of interiors.built) if (Math.hypot(h.wx - px, h.wz - pz) > R_OUT) { disposeInterior(e, registry, world); interiors.built.delete(h); }
  near.length = 0;
  for (const h of town.houses) { const d = Math.hypot(h.wx - px, h.wz - pz); if (d < R_IN && !interiors.built.has(h)) near.push([d, h]); }
  if (!near.length) return;
  near.sort((a, b) => a[0] - b[0]);
  if (near[0][0] < 7) budget = Math.max(budget, 4);   // the house we are at or about to enter must not pop in late
  for (let i = 0; i < Math.min(budget, near.length); i++) {
    const h = near[i][1];
    const e = interiors.builder(h, h.sector, sectorMatrix(h.sector), interiors.group, world);
    updateShafts([e], sunDir);
    interiors.built.set(h, e);
  }
}
let tex, town, herds = [], birds, smoke, dust, player, water;
const sheepHerds = [];
let startPos = new THREE.Vector3(0, 20, 0);
const fieldRects = [];

function fieldMask(x, z) {
  if (moundHeight(x, z) > 0.05) return 0;
  for (const r of fieldRects) {
    const dx = x - r.x, dz = z - r.z;
    const lx = dx * r.c + dz * r.s, lz = -dx * r.s + dz * r.c;
    if (Math.abs(lx) < r.w / 2 && Math.abs(lz) < r.l / 2) return channelInfo(x, z).wet < 0.55 ? 1 : 0;
  }
  return 0;
}

async function build() {
  tex = await stage('Mixing plaster and mudbrick…', () => makeTextureSet());
  await stage('Fetching the loam…', () => loadPhotoTextures(tex));
  const paintings = makePaintings(tex.white.image, 11);

  await stage('Laying out the Konya Plain…', () => {
    // cultivated plots on the drier ground around the mound
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, r = 1.12 + rnd() * 0.9;
      const x = Math.cos(a) * MOUND.a * r, z = Math.sin(a) * MOUND.b * r;
      fieldRects.push({ x, z, w: 25 + rnd() * 45, l: 30 + rnd() * 60, c: Math.cos(MOUND.rot + (rnd() - 0.5) * 0.3), s: Math.sin(MOUND.rot + (rnd() - 0.5) * 0.3) });
    }
    const terrain = buildTerrain(tex, { field: fieldMask }); scene.add(terrain);
    scene.add(buildMoundCap(tex));
    water = buildWater(tex); scene.add(water);
  });

  await stage('Raising the houses…', () => {
    town = generateTown(rnd);
    // pick the start: the highest roof on the southern summit, in a sizeable sector
    const cands = town.houses.filter((h) => h.sector.houses.length >= 12 && !h.upper).sort((a, b) => b.roofY - a.roofY);
    const start = cands[0];
    const sp = worldPt(start.sector, (start.x0 + start.x1) / 2, start.roofY, (start.z0 + start.z1) / 2 - 1.0);
    startPos.copy(sp);
    // special houses: the nearest suitable ones to the start
    const byDist = town.houses.slice().sort((a, b) => Math.hypot(a.wx - sp.x, a.wz - sp.z) - Math.hypot(b.wx - sp.x, b.wz - sp.z));
    const specials = ['b77', 'hunters', 'vultures', 'leopards', 'map', 'b80'];
    const okFor = (h, k) => {
      const W = h.main.x1 - h.main.x0, L = h.main.z1 - h.main.z0;
      if (h.upper) return false;
      if (k === 'b80') return L >= 5.2 && W >= 2.9;
      if (k === 'hunters' || k === 'vultures' || k === 'map') return W >= 3.8 && L >= 4.3;
      return W >= 3.5 && L >= 4.2;
    };
    const used = new Set([start]);
    for (const k of specials) {
      for (const h of byDist) {
        if (used.has(h)) continue;
        if (!okFor(h, k)) continue;
        if (Math.hypot(h.wx - sp.x, h.wz - sp.z) > 60) break;
        h.kind = k; used.add(h); break;
      }
    }
    // Building 52 itself (open-topped reconstruction model) can stand two houses north of the start; off by
    // default, since its single-surface walls read as unfinished among the solid houses
    if (SHOW_B52_MODEL) {
      const p0 = worldPt(start.sector, (start.x0 + start.x1) / 2 - 2.0, 0, start.z0 - 7.5);
      b52plot = clearPlot(town, p0.x, p0.z, 8.6, 10.7);
      if (b52plot && b52plot.floorY === undefined) b52plot.floorY = start.floorY;
    }
    placeLadders(town, rnd);
  });

  await stage('Plastering the interiors…', async () => {
    interiors.builder = makeInteriorBuilder(tex, paintings, rnd, registry);
    scene.add(interiors.group);
    const { group, smokeSources } = buildTown(town, tex, world, rnd);
    scene.add(group);
    if (b52plot) await buildB52(b52plot, tex, world, group, rnd, registry).catch((e) => console.warn('Building 52 not built', e));
    smoke = new Puffs(tex.puff, smokeSources.slice(0, 70), { rise: 5.5, spread: 3.0, jitter: 0.5, size: 2.2, alpha: 0.26, speed: 0.07, color: new THREE.Color(0xd8d4cc) });
    scene.add(smoke.points);
    const dustSrc = town.houses.map((h) => worldPt(h.sector, (h.hatch.x0 + h.hatch.x1) / 2, h.roofY - 1.6, (h.hatch.z0 + h.hatch.z1) / 2));
    dust = new Puffs(tex.puff, dustSrc, { rise: -0.6, spread: 0.3, jitter: 1.4, size: 0.06, alpha: 0.5, speed: 0.05, color: new THREE.Color(0xfff2d8), perEmitter: 10 });
    scene.add(dust.points);
  });

  await stage('Carrying baskets up the ladders…', () => {
    const { group, skulls } = buildRoofClutter(town, tex, rnd); scene.add(group);
    const mid = buildMiddens(town, tex, rnd); if (mid) scene.add(mid);
    const pens = buildPens(town, tex, world, rnd, 5);
    if (pens.mesh) scene.add(pens.mesh);
    for (const g of pens.herds) sheepHerds.push(g);
    const people = buildPeople(town, world, rnd, startPos, pens.herds);
    if (people) { scene.add(people); console.log('[catalhoyuk] people', people.userData.count); }
  });

  await stage('Letting the herds out…', () => {
    // herds on the plain
    for (let i = 0; i < 5; i++) {
      let x, z, tries = 0;
      do { const a = rnd() * Math.PI * 2, r = 1.25 + rnd() * 1.2; x = Math.cos(a) * MOUND.a * r; z = Math.sin(a) * MOUND.b * r; tries++; } while (tries < 20 && channelInfo(x, z).wet > 0.5);
      sheepHerds.push({ x, z, r: 18 + rnd() * 14, n: 18 + Math.floor(rnd() * 20), kind: rnd() < 0.4 ? 'goat' : 'sheep' });
    }
    herds = new Herds(tex, rnd, sheepHerds); scene.add(herds.mesh);
    birds = new Birds(14, 0, 0, rnd); scene.add(birds.mesh);
    scene.add(buildReeds(tex, rnd));
    for (const m of buildTrees(tex, rnd)) scene.add(m);
    scene.add(buildShrubs(rnd));
  });

  await stage('Climbing to the roof…', () => {
    player = new Player(camera, world, canvas);
    player.teleport(startPos.x, startPos.y + 0.05, startPos.z, 0.15, -0.05);
    updateInteriors(startPos.x, startPos.z, 40);
    applyPreset(PRESETS[presetIdx]);
  });
}

// ---------------- particles ----------------
class Puffs {
  constructor(map, emitters, o) {
    const per = o.perEmitter || 14;
    const n = emitters.length * per;
    const pos = new Float32Array(n * 3), rand = new Float32Array(n * 4);
    for (let i = 0; i < emitters.length; i++) for (let k = 0; k < per; k++) {
      const j = i * per + k;
      pos[j * 3] = emitters[i].x; pos[j * 3 + 1] = emitters[i].y; pos[j * 3 + 2] = emitters[i].z;
      rand[j * 4] = Math.random(); rand[j * 4 + 1] = Math.random(); rand[j * 4 + 2] = Math.random(); rand[j * 4 + 3] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      uniforms: { uTime: { value: 0 }, uMap: { value: map }, uWind: { value: new THREE.Vector2(0.6, -0.3) }, uRise: { value: o.rise }, uSpread: { value: o.spread }, uJitter: { value: o.jitter }, uSize: { value: o.size }, uAlpha: { value: o.alpha }, uSpeed: { value: o.speed }, uColor: { value: o.color }, uScale: { value: window.innerHeight } },
      vertexShader: `
        attribute vec4 aRand; uniform float uTime, uRise, uSpread, uJitter, uSize, uSpeed, uScale; uniform vec2 uWind; varying float vA;
        void main(){
          float age = fract(uTime * uSpeed * (0.7 + 0.6 * aRand.w) + aRand.x);
          vec3 p = position;
          p.x += uWind.x * age * uSpread + (aRand.y - 0.5) * uJitter * (0.4 + age);
          p.z += uWind.y * age * uSpread + (aRand.z - 0.5) * uJitter * (0.4 + age);
          p.y += age * uRise + sin(age * 6.0 + aRand.y * 6.0) * uJitter * 0.2;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * (0.4 + age * 1.2) * uScale / max(1.0, -mv.z);
          vA = sin(age * 3.14159) * (uRise > 0.0 ? 1.0 : 1.0);
        }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uAlpha; uniform vec3 uColor; varying float vA; void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(uColor, t.a * vA * uAlpha); }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
  }
  update(t) { this.mat.uniforms.uTime.value = t; this.mat.uniforms.uScale.value = window.innerHeight; }
}

// ---------------- HUD ----------------
const compass = document.getElementById('compass'), cctx = compass ? compass.getContext('2d') : null;
const MARKS = [
  { b: 0, t: 'N' }, { b: 90, t: 'E' }, { b: 180, t: 'S' }, { b: 270, t: 'W' },
  { b: 66, t: 'Hasan Dağı', small: true }, { b: 134, t: 'Karadağ', small: true }, { b: 187, t: 'Taurus', small: true }, { b: 262, t: 'Çarşamba', small: true },
];
function drawCompass(yaw) {
  if (!cctx) return;
  const w = compass.width, h = compass.height;
  cctx.clearRect(0, 0, w, h);
  // heading in compass degrees: yaw=0 looks north (-Z); yaw increases turning left (west)
  const heading = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
  const span = 110; // degrees visible
  cctx.font = '600 12px system-ui, sans-serif'; cctx.textAlign = 'center'; cctx.textBaseline = 'middle';
  for (const m of MARKS) {
    let d = ((m.b - heading + 540) % 360) - 180;
    if (Math.abs(d) > span / 2) continue;
    const x = w / 2 + d / (span / 2) * (w / 2 - 10);
    const a = 1 - Math.pow(Math.abs(d) / (span / 2), 3);
    cctx.fillStyle = `rgba(255,245,225,${a})`;
    if (m.small) { cctx.font = '500 10px system-ui, sans-serif'; cctx.fillText(m.t, x, h - 8); cctx.fillRect(x - 0.5, 4, 1, 5); }
    else { cctx.font = '700 13px system-ui, sans-serif'; cctx.fillText(m.t, x, 14); }
  }
  cctx.fillStyle = 'rgba(255,245,225,0.9)'; cctx.fillRect(w / 2 - 1, 0, 2, 8);
}

let captionTimer = 0, currentHouse = null, insideAmt = 0;
function showCaption() {}

// ---------------- input / UI wiring ----------------
let started = false;
function enter() {
  if (!player || player.locked) return;
  player.lock();
  $('overlay').classList.add('hidden');
  started = true;
}
$('enter').addEventListener('click', enter);
canvas.addEventListener('click', () => { if (player && !player.locked && !isTouch) enter(); });
// a key press is a user gesture too: the first step taken locks the mouse
document.addEventListener('keydown', (e) => { if (player && !player.locked && !isTouch && e.code !== 'Escape' && !e.repeat) enter(); });
let isTouch = false;
canvas.addEventListener('player-touch', () => { isTouch = true; $('overlay').classList.add('hidden'); });
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyT') { presetIdx = (presetIdx + 1) % PRESETS.length; applyPreset(PRESETS[presetIdx]); }
  if (e.code === 'KeyH') $('hud').classList.toggle('hidden');
  if (e.code === 'KeyR' && player) { player.teleport(startPos.x, startPos.y + 0.05, startPos.z, 0.15, -0.05); updateInteriors(startPos.x, startPos.z, 40); }
});
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

// ---------------- main loop ----------------
const clock = new THREE.Clock();
let time = 0;
let fpsAcc = 0, fpsN = 0, fpsChecked = false, lowQuality = false;
function setLowQuality() {
  lowQuality = true;
  renderer.setPixelRatio(1);
  sun.shadow.mapSize.set(1024, 1024);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  renderer.setSize(window.innerWidth, window.innerHeight);
  showCaption('Running in reduced quality to keep the frame rate smooth.', 6);
}
const tmpV = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  time += dt;
  if (!player) return;
  if (player.locked && !fpsChecked && started) {
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 6) { fpsChecked = true; if (fpsN / fpsAcc < 28) setLowQuality(); }
  }
  player.update(dt);
  interiors.timer -= dt;
  if (interiors.timer <= 0) { interiors.timer = 0.15; updateInteriors(player.pos.x, player.pos.z, 2); }

  // sun follows the player; snap to shadow texels to avoid shimmer
  const texel = (2 * SH) / 2048;
  const px = Math.round(player.pos.x / texel) * texel, pz = Math.round(player.pos.z / texel) * texel, py = Math.round(player.pos.y / texel) * texel;
  sun.target.position.set(px, py, pz);
  sun.position.set(px + sunDir.x * 260, py + sunDir.y * 260, pz + sunDir.z * 260);
  sky.position.copy(camera.position);
  if (mountains) mountains.position.set(camera.position.x, 0, camera.position.z);

  // inside / outside
  let inside = null;
  for (const e of registry) if (e.inside(player.pos.x, player.pos.z, player.pos.y)) { inside = e; break; }
  const target = inside ? 1 : 0;
  insideAmt += (target - insideAmt) * Math.min(1, dt * 2.5);
  hemi.intensity = hemiBase * (1 - insideAmt * 0.5);
  hemi.color.copy(hemiSkyCol).lerp(warmBounce, insideAmt);
  renderer.toneMappingExposure = exposureBase * (1 + insideAmt * 0.28);
  if (inside !== currentHouse) {
    currentHouse = inside;
    if (inside) { showCaption(inside.caption, 18); $('loc').textContent = inside.kind === 'plain' ? 'Inside a house' : 'Inside an elaborate “history house”'; }
    else { $('loc').textContent = 'On the roofs'; }
  }
  if (!inside && player.pos.y < terrainHeight(player.pos.x, player.pos.z) + 1.2 && moundHeight(player.pos.x, player.pos.z) > 0.3) $('loc').textContent = 'In a midden between the houses';
  // lights: fire + skylight at the nearest hearth / hatch
  let nearest = null, nd = Infinity;
  for (const e of registry) { const d = e.hearth.distanceToSquared(player.pos); if (d < nd) { nd = d; nearest = e; } }
  if (nearest) {
    const flick = 1.6 + Math.sin(time * 5.3) * 0.12 + Math.sin(time * 8.9) * 0.08;   // a slow breathing glow, not a strobe
    fire.position.copy(nearest.hearth); fire.intensity = flick * Math.min(1, insideAmt + 0.15);
    skyFill.position.copy(nearest.hatchWorld).add(tmpV.set(0, -0.9, 0)); skyFill.intensity = 7.0 * insideAmt;
  }
  // caption timer
  if (captionTimer > 0) { captionTimer -= dt; if (captionTimer <= 0) $('caption').classList.remove('show'); }
  // animated bits
  if (herds) herds.update(dt, time, Math.random);
  if (birds) birds.update(time);
  if (smoke) smoke.update(time);
  if (dust) dust.update(time);
  if (water) { tex.water.offset.x = time * 0.004; tex.water.offset.y = time * 0.002; }
  drawCompass(player.yaw);
  renderer.render(scene, camera);
}

build().then(() => {
  $('loading').classList.add('hidden');
  $('overlay').classList.add('hidden');
  player.freeLook = true;
  started = true;
  window.focus();
  frame();
  // debug / screenshot support: ?cam=x,y,z,yaw,pitch
  if (params.get('cam')) {
    const [x, y, z, yaw, pitch] = params.get('cam').split(',').map(Number);
    player.teleport(x, y, z, yaw || 0, pitch || 0);
    updateInteriors(x, z, 60);
    $('overlay').classList.add('hidden');
    if (params.get('t')) { presetIdx = parseInt(params.get('t'), 10) % PRESETS.length; applyPreset(PRESETS[presetIdx]); }
  }
  window.__cat = { scene, player, town, registry, startPos, renderer, camera, PRESETS, applyPreset, updateInteriors, interiors, b52plot, worldPt };
}).catch((err) => { console.error(err); window.__err = String(err.stack || err); $("loadmsg").textContent = 'Something went wrong: ' + err.message; });

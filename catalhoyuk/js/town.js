// Settlement generator for Çatalhöyük East, c. 6600 BCE.
// Houses are laid out in sectors (neighbourhoods of ~30 houses) on a cardinal
// grid with a local swing of up to ~15°, wall to wall, separated by irregular
// midden strips. Everything is built in sector-local coordinates where
// local +x = east and local +z = south, then rotated into the world.
import * as THREE from 'three';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';
import { makeValueNoise, fbm, mulberry32 } from './textures.js';
import { MOUND, moundHeight, terrainHeight } from './landscape.js';

export const WALL_T = 0.30;      // single-brick wall
export const ROOF_T = 0.22;      // beams + reeds + mud
export const LADDER_ANGLE = 68 * Math.PI / 180;
export const STEP_MAX = 0.55;    // step-up the player can take without a ladder

const nOpen = makeValueNoise(301, 64);

function moundR(x, z) {
  const dx = x - MOUND.cx, dz = z - MOUND.cz;
  const c = Math.cos(MOUND.rot), s = Math.sin(MOUND.rot);
  const u = (dx * c - dz * s) / MOUND.a, v = (dx * s + dz * c) / MOUND.b;
  return Math.sqrt(u * u + v * v);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
export function generateTown(rnd) {
  const sectors = [];
  const houses = [];
  const openCells = [];
  const SECT = 34;            // sector pitch (m)
  const GAP = 2.0;            // midden strip between sectors (m)
  const baseRot = MOUND.rot * 0.35;

  // tile the mound with sectors
  const R = Math.max(MOUND.a, MOUND.b) * 1.05;
  let sid = 0;
  for (let sz = -R; sz < R; sz += SECT) {
    for (let sx = -R; sx < R; sx += SECT) {
      const cx = sx + SECT / 2 + (rnd() - 0.5) * 2.5, cz = sz + SECT / 2 + (rnd() - 0.5) * 2.5;
      if (moundR(cx, cz) > 1.0) continue;
      const angle = baseRot + (rnd() - 0.5) * 0.42;        // ±12° swing
      const sector = { id: sid++, cx, cz, angle, c: Math.cos(angle), s: Math.sin(angle), houses: [], open: [], fi: -1 };
      // rows along local x
      const half = (SECT - GAP) / 2;
      let x = -half;
      let rowIdx = 0;
      const rowBias = [];
      while (x < half - 3.5) {
        const rw = Math.min(5.0 + rnd() * 2.6, half - x);
        if (rw < 3.8) break;
        const bias = (rnd() - 0.5) * 1.3;
        rowBias.push(bias);
        let z = -half + (rnd() - 0.5) * 1.2;
        while (z < half - 3.5) {
          const hl = Math.min(5.5 + rnd() * 3.5, half - z);
          if (hl < 4.2) break;
          const lx0 = x, lx1 = x + rw, lz0 = z, lz1 = z + hl;
          const lcx = (lx0 + lx1) / 2, lcz = (lz0 + lz1) / 2;
          const wx = cx + sector.c * lcx - sector.s * lcz, wz = cz + sector.s * lcx + sector.c * lcz;
          const r = moundR(wx, wz);
          const cell = { x0: lx0, x1: lx1, z0: lz0, z1: lz1, wx, wz, row: rowIdx };
          let keep = r < 0.93;
          if (keep) {
            // irregular midden pockets from low-frequency noise + random thinning,
            // thinning out towards the edge of the mound
            const n = fbm(nOpen, wx * 0.035 + 3, wz * 0.035 + 3, 3);
            const edge = Math.max(0, (r - 0.72) / 0.21);
            if (n < 0.29) keep = false;
            if (rnd() < 0.04 + edge * 0.5) keep = false;
          }
          if (keep) {
            const h = makeHouse(rnd, sector, cell, rowBias[rowIdx]);
            h.id = houses.length; houses.push(h); sector.houses.push(h);
          } else if (r < 1.0) {
            sector.open.push(cell);
          }
          z += hl;
        }
        x += rw;
        rowIdx++;
      }
      if (sector.houses.length) { sectors.push(sector); for (const cell of sector.open) openCells.push({ sector, cell }); }
    }
  }
  // adjacency within sectors (share an edge for > 1.5 m)
  for (const s of sectors) {
    for (let i = 0; i < s.houses.length; i++) for (let j = i + 1; j < s.houses.length; j++) {
      const a = s.houses[i], b = s.houses[j];
      const ov = sharedEdge(a, b);
      if (ov) { a.adj.push({ h: b, ...ov }); b.adj.push({ h: a, ...flipEdge(ov) }); }
    }
  }
  return { sectors, houses, openCells };
}

function flipEdge(e) { return { side: e.side === 'E' ? 'W' : e.side === 'W' ? 'E' : e.side === 'N' ? 'S' : 'N', a0: e.a0, a1: e.a1 }; }

// returns {side, a0, a1}: side of `a` that touches `b`, overlap interval along it
function sharedEdge(a, b) {
  const eps = 0.05, minLen = 1.5;
  if (Math.abs(a.x1 - b.x0) < eps) { const o = overlap(a.z0, a.z1, b.z0, b.z1); if (o && o[1] - o[0] > minLen) return { side: 'E', a0: o[0], a1: o[1] }; }
  if (Math.abs(a.x0 - b.x1) < eps) { const o = overlap(a.z0, a.z1, b.z0, b.z1); if (o && o[1] - o[0] > minLen) return { side: 'W', a0: o[0], a1: o[1] }; }
  if (Math.abs(a.z1 - b.z0) < eps) { const o = overlap(a.x0, a.x1, b.x0, b.x1); if (o && o[1] - o[0] > minLen) return { side: 'S', a0: o[0], a1: o[1] }; }
  if (Math.abs(a.z0 - b.z1) < eps) { const o = overlap(a.x0, a.x1, b.x0, b.x1); if (o && o[1] - o[0] > minLen) return { side: 'N', a0: o[0], a1: o[1] }; }
  return null;
}
function overlap(a0, a1, b0, b1) { const lo = Math.max(a0, b0), hi = Math.min(a1, b1); return hi > lo ? [lo, hi] : null; }

function makeHouse(rnd, sector, cell, rowBias) {
  const { x0, x1, z0, z1, wx, wz } = cell;
  const w = x1 - x0, l = z1 - z0;
  // the floor must sit above the ground everywhere under the footprint
  let ground = terrainHeight(wx, wz);
  for (const [lx, lz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
    const p = { x: sector.cx + sector.c * lx - sector.s * lz, z: sector.cz + sector.s * lx + sector.c * lz };
    ground = Math.max(ground, terrainHeight(p.x, p.z));
  }
  const floorY = ground + 0.3 + Math.abs(rowBias) + rnd() * 0.9;   // houses rebuilt at different times stand at different heights
  // the walls must reach the ground on the downhill side too: sample the footprint for its lowest point
  let low = ground;
  for (let i = 0; i <= 3; i++) for (let j = 0; j <= 3; j++) {
    const lx = x0 + (x1 - x0) * i / 3, lz = z0 + (z1 - z0) * j / 3;
    const p = { x: sector.cx + sector.c * lx - sector.s * lz, z: sector.cz + sector.s * lx + sector.c * lz };
    low = Math.min(low, terrainHeight(p.x, p.z));
  }
  const baseY = Math.min(low - 0.9, floorY - 1.4);
  const wallH = 2.2 + rnd() * 0.7;              // floor to ceiling (Building 52 reconstruction: ~2 m walls plus roof)
  const roofY = floorY + wallH + ROOF_T;
  // interior plan, after Building 52: a large central room with a strip of small store rooms along one long
  // side, the strip itself divided in two; smaller houses get a single room across the north end or none.
  const ix0 = x0 + WALL_T, ix1 = x1 - WALL_T, iz0 = z0 + WALL_T, iz1 = z1 - WALL_T;
  const side = [];
  let main = { x0: ix0, x1: ix1, z0: iz0, z1: iz1 };
  const roll = rnd();
  if (w > 5.4 && roll < 0.62) {
    const sw = 1.4 + rnd() * 0.7;
    const west = rnd() < 0.5;
    const sx0 = west ? ix0 : ix1 - sw, sx1 = west ? ix0 + sw : ix1, wall = west ? 'W' : 'E';
    if (l > 5.8) {
      // two compartments, the partition between them a little north of the middle
      const zc = iz0 + (iz1 - iz0) * (0.42 + rnd() * 0.16);
      side.push({ x0: sx0, x1: sx1, z0: iz0, z1: zc - WALL_T / 2, wall });
      side.push({ x0: sx0, x1: sx1, z0: zc + WALL_T / 2, z1: iz1, wall });
    } else side.push({ x0: sx0, x1: sx1, z0: iz0, z1: iz1, wall });
    if (west) main.x0 = ix0 + sw + WALL_T; else main.x1 = ix1 - sw - WALL_T;
    if (l > 7.4 && rnd() < 0.35) { const sd = 1.5 + rnd() * 0.5; side.push({ x0: main.x0, x1: main.x1, z0: iz0, z1: iz0 + sd, wall: 'N' }); main.z0 = iz0 + sd + WALL_T; }
  } else if (l > 6.2 && roll < 0.9) {
    const sd = 1.5 + rnd() * 0.8;
    side.push({ x0: ix0, x1: ix1, z0: iz0, z1: iz0 + sd, wall: 'N' }); main.z0 = iz0 + sd + WALL_T;
  }
  // hatch in the SE corner of the main room, against the south wall
  const hatch = { x1: main.x1 - 0.15, x0: main.x1 - 1.15, z1: main.z1 - 0.02, z0: main.z1 - 1.15 };
  const h = {
    sector, x0, x1, z0, z1, wx, wz, floorY, baseY, wallH, roofY, main, side, hatch,
    adj: [], ladders: [], enterable: true, kind: 'plain', upper: null,
    tint: 0.9 + rnd() * 0.2, parapet: rnd() < 0.22, smoke: rnd() < 0.18, seed: Math.floor(rnd() * 1e9),
  };
  // occasional upper room (Level VI two-storey evidence)
  if (rnd() < 0.055 && w > 4.8 && l > 6) {
    const uw = Math.min(w - 1.0, 3.6 + rnd() * 1.2), ul = Math.min(l - 2.6, 3.2 + rnd() * 1.4);
    const ux0 = x0 + 0.2 + rnd() * (w - uw - 0.4), uz0 = z0 + 0.2;
    h.upper = { x0: ux0, x1: ux0 + uw, z0: uz0, z1: uz0 + ul, roofY: roofY + 2.25 + ROOF_T, hatch: null };
  }
  return h;
}

// ---------------------------------------------------------------------------
// Ladders: make the roofscape fully connected
// ---------------------------------------------------------------------------
export function placeLadders(town, rnd) {
  for (const s of town.sectors) {
    // union-find over houses linked by walkable steps
    const parent = new Map();
    const find = (h) => { while (parent.get(h) !== h) { parent.set(h, parent.get(parent.get(h))); h = parent.get(h); } return h; };
    const union = (a, b) => { parent.set(find(a), find(b)); };
    for (const h of s.houses) parent.set(h, h);
    const pairs = [];
    for (const h of s.houses) for (const e of h.adj) {
      if (e.h.id < h.id) continue;
      const d = Math.abs(h.roofY - e.h.roofY);
      if (d <= STEP_MAX) union(h, e.h); else pairs.push({ a: h, b: e.h, e, d });
    }
    pairs.sort((p, q) => p.d - q.d);
    for (const p of pairs) {
      const needed = find(p.a) !== find(p.b);
      if ((needed && p.d < 3.6) || (p.d < 2.6 && rnd() < 0.12)) {
        addRoofLadder(p.a, p.b, p.e, rnd);
        union(p.a, p.b);
      }
    }
    // ground ladders: from open ground up to a few roofs per sector, where a
    // house edge faces open space
    const candidates = [];
    for (const h of s.houses) {
      for (const side of ['N', 'S', 'E', 'W']) {
        if (h.adj.some((e) => e.side === side)) continue;
        candidates.push({ h, side });
      }
    }
    shuffle(candidates, rnd);
    const nGround = Math.max(2, Math.round(s.houses.length / 7));
    for (let i = 0; i < Math.min(nGround, candidates.length); i++) {
      const { h, side } = candidates[i];
      addGroundLadder(h, side, rnd);
    }
    for (const h of s.houses) if (h.upper) addUpperLadder(h, rnd);
  }
}

function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }

// ladder from lower roof `lo` leaning against the wall of higher roof `hi`
function addRoofLadder(a, b, e, rnd) {
  const lo = a.roofY < b.roofY ? a : b, hi = lo === a ? b : a;
  const side = lo === a ? e.side : flipEdge(e).side;  // side of `lo` facing `hi`
  const H = hi.roofY - lo.roofY;
  const run = H / Math.tan(LADDER_ANGLE);
  let nx = 0, nz = 0; // n = direction from lo towards hi
  if (side === 'E') nx = 1; else if (side === 'W') nx = -1; else if (side === 'S') nz = 1; else nz = -1;
  const span = Math.max(0.1, (e.a1 - e.a0) - 1.2);
  let wx, wz, bx, bz;
  for (let tries = 0; tries < 8; tries++) {
    const t = e.a0 + 0.6 + rnd() * span;
    if (side === 'E') { wx = lo.x1; wz = t; } else if (side === 'W') { wx = lo.x0; wz = t; } else if (side === 'S') { wx = t; wz = lo.z1; } else { wx = t; wz = lo.z0; }
    bx = wx - nx * run; bz = wz - nz * run;
    const ht = lo.hatch, m = 0.55;
    const inHatch = bx > ht.x0 - m && bx < ht.x1 + m && bz > ht.z0 - m && bz < ht.z1 + m;
    const u = lo.upper, inUpper = u && bx > u.x0 - 0.4 && bx < u.x1 + 0.4 && bz > u.z0 - 0.4 && bz < u.z1 + 0.4;
    // keep the top clear of the upper house's own hatch ladder too, so the two climb zones do not overlap
    const hh = hi.hatch, nearHiHatch = wx > hh.x0 - 1.1 && wx < hh.x1 + 1.1 && wz > hh.z0 - 1.1 && wz < hh.z1 + 1.1;
    const hu = hi.upper, nearHiUpper = hu && wx > hu.x0 - 1.0 && wx < hu.x1 + 1.0 && wz > hu.z0 - 1.0 && wz < hu.z1 + 1.0;
    if (!inHatch && !inUpper && !nearHiHatch && !nearHiUpper) break;
  }
  lo.ladders.push({ type: 'roof', bx, bz, by: lo.roofY, tx: wx, tz: wz, ty: hi.roofY, nx, nz, top: hi });
}

function addGroundLadder(h, side, rnd) {
  let wx, wz, nx = 0, nz = 0;
  for (let tries = 0; tries < 8; tries++) {
    if (side === 'E') { wx = h.x1; wz = h.z0 + 0.8 + rnd() * (h.z1 - h.z0 - 1.6); nx = 1; }
    else if (side === 'W') { wx = h.x0; wz = h.z0 + 0.8 + rnd() * (h.z1 - h.z0 - 1.6); nx = -1; }
    else if (side === 'S') { wx = h.x0 + 0.8 + rnd() * (h.x1 - h.x0 - 1.6); wz = h.z1; nz = 1; }
    else { wx = h.x0 + 0.8 + rnd() * (h.x1 - h.x0 - 1.6); wz = h.z0; nz = -1; }
    const ht = h.hatch, nearHatch = wx > ht.x0 - 1.1 && wx < ht.x1 + 1.1 && wz > ht.z0 - 1.1 && wz < ht.z1 + 1.1;
    const u = h.upper, nearUpper = u && wx > u.x0 - 1.0 && wx < u.x1 + 1.0 && wz > u.z0 - 1.0 && wz < u.z1 + 1.0;
    if (!nearHatch && !nearUpper) break;
  }
  h.ladders.push({ type: 'ground', wx, wz, nx, nz, ty: h.roofY, tx: wx, tz: wz, top: h });
}

function addUpperLadder(h, rnd) {
  const u = h.upper;
  // lean against the upper room's south wall from the main roof
  const H = u.roofY - h.roofY;
  const run = H / Math.tan(LADDER_ANGLE);
  const tx = u.x0 + 0.6 + rnd() * (u.x1 - u.x0 - 1.2), tz = u.z1;
  h.ladders.push({ type: 'roof', bx: tx, bz: tz + run, by: h.roofY, tx, tz, ty: u.roofY, nx: 0, nz: -1, top: null });
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
export function boxGeo(sx, sy, sz, uvScale = 2.5, color) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  // scale UVs so the texture repeats every `uvScale` metres on every face
  const uv = g.attributes.uv;
  const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) {
    const [du, dv] = dims[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * du / uvScale, uv.getY(k) * dv / uvScale);
    }
  }
  if (color) addColor(g, color);
  return g;
}
export function addColor(g, color) {
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = color.r; arr[i * 3 + 1] = color.g; arr[i * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
export function placed(g, x, y, z, ry = 0) {
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}
export function sectorMatrix(s) {
  const m = new THREE.Matrix4();
  m.makeRotationY(-s.angle);
  // local (x,z) -> world: wx = cx + c*x - s*z ; wz = cz + s*x + c*z  (rotation by -angle about Y in three.js terms)
  const rot = new THREE.Matrix4().makeRotationY(-s.angle);
  const t = new THREE.Matrix4().makeTranslation(s.cx, 0, s.cz);
  return t.multiply(rot);
}
export function localToWorld(s, x, z) { return { x: s.cx + s.c * x - s.s * z, z: s.cz + s.s * x + s.c * z }; }

// ladder geometry from base (bx,by,bz) to top (tx,ty,tz), extending `over`
// above the top. Returns geometry in the same (local) frame.
export function ladderGeo(bx, by, bz, tx, ty, tz, over = 0.7) {
  const dir = new THREE.Vector3(tx - bx, ty - by, tz - bz);
  const len = dir.length();
  dir.normalize();
  const total = len + over;
  const parts = [];
  const width = 0.44;
  // local ladder frame: y along the ladder, x across
  const stringer = (sx) => { const g = new THREE.CylinderGeometry(0.038, 0.045, total, 7); g.translate(sx, total / 2, 0); scaleUV(g, 0.3, total / 0.6); return g; };
  parts.push(stringer(-width / 2), stringer(width / 2));
  const nR = Math.floor(total / 0.34);
  for (let i = 1; i <= nR; i++) {
    const g = new THREE.CylinderGeometry(0.024, 0.024, width + 0.14, 6);
    g.rotateZ(Math.PI / 2); g.translate((i % 2 ? 0.01 : -0.01), i * 0.34 - 0.06, 0.055);
    parts.push(g);
  }
  const g = mergeGeometries(parts);
  // orient: rotate local +y to dir, keep rungs horizontal
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  // choose roll so that rungs are horizontal: the ladder's x axis should be horizontal and perpendicular to dir
  const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(dir, side).normalize();
  const m = new THREE.Matrix4().makeBasis(side, dir, up);
  g.applyMatrix4(m);
  g.translate(bx, by, bz);
  return g;
}

// ---------------------------------------------------------------------------
// Build exteriors, collision, ladders, clutter
// ---------------------------------------------------------------------------
export function buildTown(town, tex, world, rnd) {
  const group = new THREE.Group();
  group.name = 'town';
  // geometry is merged per ~30 m chunk (not per town) so the renderer can frustum-cull
  // what is behind the player, in both the colour pass and the shadow pass
  const CHUNK = 30;
  const buckets = new Map();
  const bucketFor = (s, wx, wz) => {
    const k = Math.floor(wx / CHUNK) + ':' + Math.floor(wz / CHUNK);
    let b = buckets.get(k);
    if (!b) { b = { wallGeos: [], roofGeos: [], woodGeos: [], darkGeos: [], matGeos: [], strawGeos: [] }; buckets.set(k, b); }
    return b;
  };
  const bucketArrays = (b) => [b.wallGeos, b.roofGeos, b.woodGeos, b.darkGeos, b.matGeos, b.strawGeos];
  const cWall = new THREE.Color(), cRoof = new THREE.Color();
  const smokeSources = [], ladderZones = [];
  const nTint = makeValueNoise(401, 32);

  for (const s of town.sectors) {
    s.fi = world.addFrame(s.cx, s.cz, s.angle);
    const M = sectorMatrix(s);
    for (const h of s.houses) {
      const { wallGeos, roofGeos, woodGeos, darkGeos, matGeos, strawGeos } = bucketFor(s, h.wx, h.wz);
      const w = h.x1 - h.x0, l = h.z1 - h.z0, cx = (h.x0 + h.x1) / 2, cz = (h.z0 + h.z1) / 2;
      const tn = fbm(nTint, h.wx * 0.05, h.wz * 0.05, 2);
      cWall.setHSL(0.08 + (tn - 0.5) * 0.02, 0.18 + (tn - 0.5) * 0.08, (tex.loam ? 0.86 : 0.72) * h.tint, THREE.SRGBColorSpace);
      cRoof.setHSL(0.085 + (tn - 0.5) * 0.02, 0.2, (tex.dirt ? 0.84 : 0.7) * h.tint, THREE.SRGBColorSpace);
      const base = h.baseY;
      {
        // hollow shell: four walls, roof slabs around the hatch; the interior is built on demand
        const parts = [
          [h.x0, h.x0 + WALL_T, h.z0, h.z1], [h.x1 - WALL_T, h.x1, h.z0, h.z1],
          [h.x0 + WALL_T, h.x1 - WALL_T, h.z0, h.z0 + WALL_T], [h.x0 + WALL_T, h.x1 - WALL_T, h.z1 - WALL_T, h.z1],
        ];
        for (const [a, b, c, d] of parts) {
          const g = boxGeo(b - a, h.roofY - base, d - c, 2.5, cWall);
          placed(g, (a + b) / 2, (base + h.roofY) / 2, (c + d) / 2); wallGeos.push(g);
          world.addBox(s.fi, a, base, c, b, h.roofY, d, h);
        }
        // solid fill below the floor so the player stands on it
        world.addBox(s.fi, h.x0, base, h.z0, h.x1, h.floorY, h.z1, h);
        const fillTop = h.floorY - 0.6;   // the room floors are drawn by the interior; below them only earth, so graves can be cut into it
        const fg = boxGeo(w - 2 * WALL_T + 0.02, fillTop - base, l - 2 * WALL_T + 0.02, 2.5, cWall);
        placed(fg, cx, (base + fillTop) / 2, cz); wallGeos.push(fg);
        // roof slabs with hatch hole
        const ceilY = h.roofY - ROOF_T;
        const ht = h.hatch;
        const slabs = [
          [h.x0 + WALL_T, h.x1 - WALL_T, h.z0 + WALL_T, ht.z0],           // north of hatch (full width)
          [h.x0 + WALL_T, ht.x0, ht.z0, h.z1 - WALL_T],                     // west of hatch
          [ht.x1, h.x1 - WALL_T, ht.z0, h.z1 - WALL_T],                     // east of hatch
          [ht.x0, ht.x1, ht.z1, h.z1 - WALL_T],                             // south sliver
        ];
        for (const [a, b, c, d] of slabs) {
          if (b - a < 0.01 || d - c < 0.01) continue;
          const g = boxGeo(b - a, ROOF_T, d - c, 2.5, cRoof);
          placed(g, (a + b) / 2, ceilY + ROOF_T / 2, (c + d) / 2); roofGeos.push(g);
          world.addBox(s.fi, a, ceilY, c, b, h.roofY, d, h);
        }
        // roof surface planes (clean texture over the slabs & wall tops), cut around the hatch
        for (const [a, b, c, d] of [[h.x0, h.x1, h.z0, ht.z0], [h.x0, ht.x0, ht.z0, h.z1], [ht.x1, h.x1, ht.z0, h.z1], [ht.x0, ht.x1, ht.z1, h.z1]]) {
          if (b - a < 0.01 || d - c < 0.01) continue;
          const p = new THREE.PlaneGeometry(b - a - 0.02, d - c - 0.02); p.rotateX(-Math.PI / 2);
          scaleUV(p, (b - a) / 2.5, (d - c) / 2.5); addColor(p, cRoof);
          placed(p, (a + b) / 2, h.roofY + 0.015, (c + d) / 2); roofGeos.push(p);
        }
        // interior ladder: leans on the south wall, protrudes through the hatch
        const lx = (ht.x0 + ht.x1) / 2;
        const H = h.roofY - h.floorY;
        const run = H / Math.tan(LADDER_ANGLE);
        const topZ = h.main.z1 - 0.1;
        woodGeos.push(ladderGeo(lx, h.floorY, topZ - run, lx, h.roofY, topZ, 0.0));   // flush with the roof: nothing sticks up out of the hatch
        const lw = worldPt(s, lx, 0, topZ - run * 0.45);
        const tw = worldPt(s, lx, 0, ht.z0 - 0.05);          // step past the hatch's north edge and you are on the ladder
        const ex = worldDir(s, 0, -1);
        world.addLadder(lw.x, lw.z, h.floorY, h.roofY, ex.x, ex.z, 0.9, tw.x, tw.z);
        // woven hatch cover lying on the roof beside the opening
        if (rnd() < 0.45) {
          const cw = ht.x1 - ht.x0 + 0.2, cd = ht.z1 - ht.z0 + 0.2;
          if (ht.x0 - cw - 0.2 > h.x0 + 0.3) {
            const cover = new THREE.PlaneGeometry(cw, cd); cover.rotateX(-Math.PI / 2); scaleUV(cover, cw / 1.2, cd / 1.2);
            placed(cover, ht.x0 - cw / 2 - 0.15 - rnd() * 0.2, h.roofY + 0.025, (ht.z0 + ht.z1) / 2 - rnd() * 0.3, (rnd() - 0.5) * 0.25); matGeos.push(cover);
          }
        }
        // beam ends showing along the long sides where they face open air
        const longX = w >= l;   // beams run across the short axis
        for (const sd of longX ? ['N', 'S'] : ['E', 'W']) {
          if (h.adj.some((e) => e.side === sd)) continue;
          const len = longX ? w : l, n = Math.max(2, Math.round(len / 0.55));
          for (let i = 0; i < n; i++) {
            const t = (i + 0.5) / n;
            const g = new THREE.CylinderGeometry(0.065, 0.065, 0.22, 6, 1);
            const y = h.roofY - ROOF_T / 2 - 0.03;
            if (longX) { g.rotateX(Math.PI / 2); g.translate(h.x0 + 0.25 + t * (len - 0.5), y, sd === 'N' ? h.z0 - 0.06 : h.z1 + 0.06); }
            else { g.rotateZ(Math.PI / 2); g.translate(sd === 'W' ? h.x0 - 0.06 : h.x1 + 0.06, y, h.z0 + 0.25 + t * (len - 0.5)); }
            woodGeos.push(g);
          }
        }
        if (h.smoke || rnd() < 0.5) smokeSources.push(worldPt(s, lx, h.roofY + 0.1, (ht.z0 + ht.z1) / 2));
        // shade canopy: four poles carrying a mat of reeds and straw, over the north part of the roof
        if (!h.upper && rnd() < 0.22 && w > 4.6 && l > 5.4) {
          const cw = Math.min(2.4, w - 1.6), cd = Math.min(2.2, l * 0.35);
          const cx0 = h.x0 + 0.6 + rnd() * (w - 1.2 - cw), cz0 = h.z0 + 0.5 + rnd() * 0.4;
          const ph = 1.75 + rnd() * 0.25;
          for (const [px, pz] of [[cx0 + 0.1, cz0 + 0.1], [cx0 + cw - 0.1, cz0 + 0.1], [cx0 + 0.1, cz0 + cd - 0.1], [cx0 + cw - 0.1, cz0 + cd - 0.1]]) {
            const g = new THREE.CylinderGeometry(0.045, 0.055, ph, 6); g.translate(px, h.roofY + ph / 2, pz); woodGeos.push(g);
            world.addBox(s.fi, px - 0.06, h.roofY, pz - 0.06, px + 0.06, h.roofY + ph, pz + 0.06, 'post');
          }
          for (const [a, b, c, d] of [[cx0, cx0 + cw, cz0 + 0.1, cz0 + 0.1], [cx0, cx0 + cw, cz0 + cd - 0.1, cz0 + cd - 0.1]]) {
            const g = new THREE.CylinderGeometry(0.035, 0.035, b - a + 0.2, 5); g.rotateZ(Math.PI / 2); g.translate((a + b) / 2, h.roofY + ph + 0.03, c); woodGeos.push(g);
          }
          const top = new THREE.BoxGeometry(cw + 0.3, 0.09, cd + 0.3); top.translate(cx0 + cw / 2, h.roofY + ph + 0.11, cz0 + cd / 2);
          scaleUV(top, 1, 1); strawGeos.push(top);
        }
      }
      // upper room
      if (h.upper) {
        const u = h.upper;
        const g = boxGeo(u.x1 - u.x0, u.roofY - h.roofY + 0.05, u.z1 - u.z0, 2.5, cWall);
        placed(g, (u.x0 + u.x1) / 2, (h.roofY - 0.05 + u.roofY) / 2, (u.z0 + u.z1) / 2); wallGeos.push(g);
        world.addBox(s.fi, u.x0, h.roofY, u.z0, u.x1, u.roofY, u.z1, h);
        const r = new THREE.PlaneGeometry(u.x1 - u.x0 - 0.02, u.z1 - u.z0 - 0.02); r.rotateX(-Math.PI / 2);
        scaleUV(r, (u.x1 - u.x0) / 2.5, (u.z1 - u.z0) / 2.5); addColor(r, cRoof); placed(r, (u.x0 + u.x1) / 2, u.roofY + 0.015, (u.z0 + u.z1) / 2); roofGeos.push(r);
        const uh = { x0: u.x1 - 1.0, x1: u.x1 - 0.2, z0: u.z1 - 1.0, z1: u.z1 - 0.1 };
        const hd = new THREE.PlaneGeometry(0.8, 0.9); hd.rotateX(-Math.PI / 2); placed(hd, (uh.x0 + uh.x1) / 2, u.roofY + 0.02, (uh.z0 + uh.z1) / 2); darkGeos.push(hd);
      }
      // parapet: low plastered wall along one or two roof edges
      if (h.parapet) {
        const ph = 0.3 + rnd() * 0.25;
        const edges = [];
        if (rnd() < 0.5) edges.push([h.x0 + 0.05, h.x1 - 0.05, h.z0 + 0.05, h.z0 + 0.3]);
        if (rnd() < 0.5) edges.push([h.x0 + 0.05, h.x0 + 0.3, h.z0 + 0.05, h.z1 - 0.05]);
        if (!edges.length) edges.push([h.x0 + 0.05, h.x1 - 0.05, h.z1 - 0.3, h.z1 - 0.05]);
        for (const [a, b, c, d] of edges) {
          const g = boxGeo(b - a, ph, d - c, 2.5, cWall); placed(g, (a + b) / 2, h.roofY + ph / 2, (c + d) / 2); wallGeos.push(g);
          world.addBox(s.fi, a, h.roofY, c, b, h.roofY + ph, d, h);
        }
      }
      // roof-to-roof and ground ladders
      for (const L of h.ladders) {
        if (L.type === 'ground') {
          const wpt = worldPt(s, L.wx, 0, L.wz);
          const groundY = terrainHeight(...Object.values(offsetWorld(s, L.wx, L.wz, L.nx, L.nz, 1.4)));
          const H = L.ty - groundY;
          const run = H / Math.tan(LADDER_ANGLE);
          const bx = L.wx + L.nx * run, bz = L.wz + L.nz * run;  // base out in the open area
          woodGeos.push(ladderGeo(bx, groundY, bz, L.wx, L.ty, L.wz, 0.75));
          const mid = worldPt(s, L.wx + L.nx * run * 0.45, 0, L.wz + L.nz * run * 0.45);
          const ex = worldDir(s, -L.nx, -L.nz);
          const top = worldPt(s, L.wx, 0, L.wz);
          world.addLadder(mid.x, mid.z, groundY, L.ty, ex.x, ex.z, 0.85, top.x, top.z);
        } else {
          woodGeos.push(ladderGeo(L.bx, L.by, L.bz, L.tx, L.ty, L.tz, 0.75));
          const mid = worldPt(s, (L.bx + L.tx) / 2, 0, (L.bz + L.tz) / 2);
          const ex = worldDir(s, L.nx, L.nz);
          const top = worldPt(s, L.tx, 0, L.tz);
          world.addLadder(mid.x, mid.z, L.by, L.ty, ex.x, ex.z, 0.85, top.x, top.z);
        }
      }
    }
    // transform this sector's geometry (everything not yet placed) into world space
    for (const b of buckets.values()) for (const arr of bucketArrays(b)) for (const g of arr) if (!g.userData.placed) { g.applyMatrix4(M); g.userData.placed = true; }
  }

  const wallMat = tex.loam
    ? new THREE.MeshStandardMaterial({ map: tex.loam, normalMap: tex.loamN, normalScale: new THREE.Vector2(0.6, 0.6), vertexColors: true, roughness: 1 })
    : new THREE.MeshStandardMaterial({ map: tex.mud, vertexColors: true, roughness: 1 });
  const roofMat = tex.dirt
    ? new THREE.MeshStandardMaterial({ map: tex.dirt, normalMap: tex.dirtN, normalScale: new THREE.Vector2(0.5, 0.5), vertexColors: true, roughness: 1 })
    : new THREE.MeshStandardMaterial({ map: tex.roof, vertexColors: true, roughness: 1 });
  const woodMat = tex.timber
    ? new THREE.MeshStandardMaterial({ map: tex.timber, normalMap: tex.timberN, roughness: 0.9 })
    : new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.85, color: 0xb59a78 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 1 });
  const strawMat = new THREE.MeshStandardMaterial({ map: tex.reed, color: 0xd8c488, roughness: 1 });
  const coverMat = new THREE.MeshStandardMaterial({ map: tex.mat, color: 0xb8ab90, roughness: 1, side: THREE.DoubleSide });
  const chunkMesh = (geos, mat, name, shadows = true) => {
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeGeometries(geos), mat); m.name = name;
    if (shadows) { m.castShadow = true; m.receiveShadow = true; }
    group.add(m);
  };
  for (const b of buckets.values()) {
    chunkMesh(b.wallGeos, wallMat, 'walls'); chunkMesh(b.roofGeos, roofMat, 'roofs'); chunkMesh(b.woodGeos, woodMat, 'ladders');
    chunkMesh(b.darkGeos, darkMat, 'hatches', false); chunkMesh(b.strawGeos, strawMat, 'canopies'); chunkMesh(b.matGeos, coverMat, 'covers');
  }
  return { group, smokeSources };
}

function offsetWorld(s, lx, lz, nx, nz, d) { const p = localToWorld(s, lx + nx * d, lz + nz * d); return { x: p.x, z: p.z }; }
export function worldPt(s, x, y, z) { const p = localToWorld(s, x, z); return new THREE.Vector3(p.x, y, p.z); }
export function worldDir(s, x, z) { return { x: s.c * x - s.s * z, z: s.s * x + s.c * z }; }
export function scaleUV(g, su, sv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; }

function hatchFrame(ht, y) {
  // four squared timbers framing the opening, flush with the roof
  const w = ht.x1 - ht.x0, d = ht.z1 - ht.z0, t = 0.09;
  const parts = [];
  const mk = (sx, sz, x, z) => { const g = new THREE.BoxGeometry(sx, 0.07, sz); g.translate(x, y + 0.035, z); parts.push(g); };
  mk(w + 2 * t, t, (ht.x0 + ht.x1) / 2, ht.z0 - t / 2);
  mk(w + 2 * t, t, (ht.x0 + ht.x1) / 2, ht.z1 + t / 2);
  mk(t, d, ht.x0 - t / 2, (ht.z0 + ht.z1) / 2);
  mk(t, d, ht.x1 + t / 2, (ht.z0 + ht.z1) / 2);
  return mergeGeometries(parts);
}

// ---------------------------------------------------------------------------
// Roof clutter (instanced), midden patches, pens
// ---------------------------------------------------------------------------
export function buildRoofClutter(town, tex, rnd) {
  const group = new THREE.Group(); group.name = 'clutter';
  const kinds = {
    basket: { geo: (() => { const g = new THREE.CylinderGeometry(0.32, 0.22, 0.5, 10, 1, true); g.translate(0, 0.25, 0); const lid = new THREE.CircleGeometry(0.32, 10); lid.rotateX(-Math.PI / 2); lid.translate(0, 0.5, 0); return mergeGeometries([g, lid]); })(), mat: new THREE.MeshStandardMaterial({ map: tex.basket, roughness: 1, side: THREE.DoubleSide }), n: 0, items: [] },
    quern: { geo: (() => { const g = new THREE.BoxGeometry(0.55, 0.14, 0.36); g.translate(0, 0.07, 0); const s = new THREE.SphereGeometry(0.09, 7, 5); s.translate(0.05, 0.17, 0); return mergeGeometries([g, s]); })(), mat: new THREE.MeshStandardMaterial({ color: 0x8e847a, roughness: 1 }), n: 0, items: [] },
    mat: { geo: (() => { const g = new THREE.PlaneGeometry(1.4, 0.9); g.rotateX(-Math.PI / 2); g.translate(0, 0.012, 0); return g; })(), mat: new THREE.MeshStandardMaterial({ map: tex.mat, roughness: 1, color: 0xb8ab90 }), n: 0, items: [] },
    bundle: { geo: (() => { const g = new THREE.CylinderGeometry(0.16, 0.16, 1.5, 8); g.rotateZ(Math.PI / 2); g.translate(0, 0.16, 0); return g; })(), mat: new THREE.MeshStandardMaterial({ map: tex.reed, roughness: 1 }), n: 0, items: [] },
    dung: { geo: (() => { const parts = []; for (let i = 0; i < 5; i++) { const g = new THREE.CylinderGeometry(0.17, 0.17, 0.05, 9); g.translate((Math.random() - 0.5) * 0.06, 0.025 + i * 0.05, (Math.random() - 0.5) * 0.06); parts.push(g); } return mergeGeometries(parts); })(), mat: new THREE.MeshStandardMaterial({ color: 0x5a4834, roughness: 1 }), n: 0, items: [] },
    drying: { geo: (() => { const g = new THREE.PlaneGeometry(1.6, 1.1); g.rotateX(-Math.PI / 2); g.translate(0, 0.05, 0); return g; })(), mat: new THREE.MeshStandardMaterial({ color: 0xa89a74, roughness: 1, map: tex.reed }), n: 0, items: [] },
    log: { geo: (() => { const g = new THREE.CylinderGeometry(0.09, 0.11, 2.4, 7); g.rotateZ(Math.PI / 2); g.translate(0, 0.1, 0); return g; })(), mat: new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 1 }), n: 0, items: [] },
    bowl: { geo: (() => { const g = new THREE.CylinderGeometry(0.22, 0.14, 0.12, 9, 1, true); g.translate(0, 0.06, 0); return g; })(), mat: new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.9, side: THREE.DoubleSide }), n: 0, items: [] },
  };
  const names = Object.keys(kinds);
  const skulls = [];
  for (const s of town.sectors) {
    for (const h of s.houses) {
      const n = Math.floor(rnd() * 4.2);
      for (let i = 0; i < n; i++) {
        const k = names[Math.floor(rnd() * names.length)];
        // keep away from the hatch (SE corner) and edges
        let x, z, tries = 0;
        const inset = (k === 'log' || k === 'bundle') ? 1.35 : 0.6;
        if (h.x1 - h.x0 < 2 * inset + 0.2 || h.z1 - h.z0 < 2 * inset + 0.2) continue;
        do {
          x = h.x0 + inset + rnd() * (h.x1 - h.x0 - 2 * inset); z = h.z0 + inset + rnd() * (h.z1 - h.z0 - 2 * inset); tries++;
        } while (tries < 6 && x > h.hatch.x0 - 0.8 && z > h.hatch.z0 - 0.8);
        if (h.upper && x > h.upper.x0 - 0.4 && x < h.upper.x1 + 0.4 && z > h.upper.z0 - 0.4 && z < h.upper.z1 + 0.4) continue;
        const p = worldPt(s, x, h.roofY, z);
        kinds[k].items.push({ p, ry: -s.angle + (rnd() - 0.5) * 1.2, sc: 0.8 + rnd() * 0.45 });
      }
      if (rnd() < 0.02) skulls.push(worldPt(s, h.x0 + 0.7 + rnd() * (h.x1 - h.x0 - 1.4), h.roofY, h.z0 + 0.5, ));
    }
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), e = new THREE.Euler();
  for (const k of names) {
    const kd = kinds[k];
    if (!kd.items.length) continue;
    const mesh = new THREE.InstancedMesh(kd.geo, kd.mat, kd.items.length);
    kd.items.forEach((it, i) => { e.set(0, it.ry, 0); q.setFromEuler(e); sc.set(it.sc, it.sc, it.sc); m.compose(it.p, q, sc); mesh.setMatrixAt(i, m); });
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'clutter-' + k;
    group.add(mesh);
  }
  return { group, skulls };
}

// patches of ash/bone/debris in the open cells, conforming to the terrain
export function buildMiddens(town, tex, rnd) {
  const geos = [];
  const c = new THREE.Color();
  for (const { sector: s, cell } of town.openCells) {
    const w = cell.x1 - cell.x0, l = cell.z1 - cell.z0;
    const nx = Math.max(3, Math.round(w / 0.7)), nz = Math.max(3, Math.round(l / 0.7));
    const g = new THREE.PlaneGeometry(w + 0.6, l + 0.6, nx, nz); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const tint = 0.8 + rnd() * 0.4;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i) + (cell.x0 + cell.x1) / 2, lz = pos.getZ(i) + (cell.z0 + cell.z1) / 2;
      const p = localToWorld(s, lx, lz);
      // flush with the trampled ground at the edge of the patch, heaped a little towards the middle
      const ex = Math.abs(pos.getX(i)) / ((w + 0.6) / 2), ez = Math.abs(pos.getZ(i)) / ((l + 0.6) / 2);
      const edge = Math.max(ex, ez);
      const heap = edge > 0.85 ? 0 : 0.14 * Math.max(0, 1 - Math.hypot(pos.getX(i), pos.getZ(i)) / (Math.min(w, l) * 0.6)) + (rnd() - 0.5) * 0.03;
      pos.setXYZ(i, lx, terrainHeight(p.x, p.z) + 0.035 + heap, lz);
      c.setHSL(0.08, 0.12 + rnd() * 0.06, 0.93 * (0.95 + (tint - 1) * 0.3) + rnd() * 0.04, THREE.SRGBColorSpace);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    scaleUV(g, w / 3, l / 3);
    g.computeVertexNormals();
    g.applyMatrix4(sectorMatrix(s));
    geos.push(g);
  }
  if (!geos.length) return null;
  const mat = new THREE.MeshStandardMaterial({ map: tex.midden, vertexColors: true, roughness: 1 });
  const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
  mesh.receiveShadow = true; mesh.name = 'middens';
  return mesh;
}

// wattle fences around a few open cells used as pens; returns herd groups
export function buildPens(town, tex, world, rnd, max = 5) {
  const cells = town.openCells.filter(({ cell }) => (cell.x1 - cell.x0) > 4.5 && (cell.z1 - cell.z0) > 5.5);
  shuffle(cells, rnd);
  const geos = [];
  const herds = [];
  for (let i = 0; i < Math.min(max, cells.length); i++) {
    const { sector: s, cell } = cells[i];
    const x0 = cell.x0 + 0.5, x1 = cell.x1 - 0.5, z0 = cell.z0 + 0.5, z1 = cell.z1 - 0.5;
    const M = sectorMatrix(s);
    const edges = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];
    for (const [ax, az, bx, bz] of edges) {
      const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 0.7);
      for (let k = 0; k <= n; k++) {
        const t = k / n, lx = ax + (bx - ax) * t, lz = az + (bz - az) * t;
        const p = localToWorld(s, lx, lz);
        const gy = terrainHeight(p.x, p.z);
        const post = new THREE.CylinderGeometry(0.04, 0.05, 1.3, 5); post.translate(lx, gy + 0.55, lz); geos.push(post);
      }
      // two woven rails
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, pm = localToWorld(s, mx, mz), gy = terrainHeight(pm.x, pm.z);
      const ang = Math.atan2(bz - az, bx - ax);
      for (const ry of [0.45, 0.95]) {
        const rail = new THREE.BoxGeometry(len, 0.08, 0.05); rail.rotateY(-ang); rail.translate(mx, gy + ry, mz); geos.push(rail);
      }
      const wattle = new THREE.PlaneGeometry(len, 0.75); wattle.rotateY(-ang + Math.PI / 2 - Math.PI / 2); wattle.translate(mx, gy + 0.7, mz); 
      // collision for the fence
      const minx = Math.min(ax, bx) - 0.05, maxx = Math.max(ax, bx) + 0.05, minz = Math.min(az, bz) - 0.05, maxz = Math.max(az, bz) + 0.05;
      world.addBox(s.fi, minx, gy - 0.5, minz, maxx, gy + 1.1, maxz, 'fence');
    }
    const pc = localToWorld(s, (x0 + x1) / 2, (z0 + z1) / 2);
    herds.push({ x: pc.x, z: pc.z, r: Math.min(x1 - x0, z1 - z0) / 2 - 0.8, n: 4 + Math.floor(rnd() * 6), kind: rnd() < 0.5 ? 'goat' : 'sheep' });
    for (const g of geos) if (!g.userData.p) { g.applyMatrix4(M); g.userData.p = true; }
  }
  const mat = new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 1, color: 0x9c8a6a });
  const mesh = geos.length ? new THREE.Mesh(mergeGeometries(geos), mat) : null;
  if (mesh) { mesh.castShadow = true; mesh.name = 'pens'; }
  return { mesh, herds };
}

// Remove the houses under a rectangular plot (sector-local, in the sector nearest to the world point)
// so the Building 52 model can stand there. Returns the plot or null.
export function clearPlot(town, wx, wz, pw, pl) {
  let best = null, bd = Infinity;
  for (const s of town.sectors) { const d = Math.hypot(s.cx - wx, s.cz - wz); if (d < bd) { bd = d; best = s; } }
  if (!best) return null;
  const s = best;
  const dx = wx - s.cx, dz = wz - s.cz;
  const lx = s.c * dx + s.s * dz, lz = -s.s * dx + s.c * dz;
  const plot = { sector: s, x0: lx - pw / 2, x1: lx + pw / 2, z0: lz - pl / 2, z1: lz + pl / 2 };
  const gone = new Set();
  for (const h of s.houses) {
    if (h.x1 > plot.x0 - 0.05 && h.x0 < plot.x1 + 0.05 && h.z1 > plot.z0 - 0.05 && h.z0 < plot.z1 + 0.05) gone.add(h);
  }
  if (!gone.size) return plot;
  s.houses = s.houses.filter((h) => !gone.has(h));
  town.houses = town.houses.filter((h) => !gone.has(h));
  for (const h of town.houses) h.adj = h.adj.filter((e) => !gone.has(e.h));
  plot.floorY = Math.max(...[...gone].map((h) => h.floorY));
  return plot;
}

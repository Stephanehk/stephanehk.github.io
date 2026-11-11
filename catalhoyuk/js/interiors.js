// House interiors: shells, fixtures, storerooms and the symbolic installations
// of the elaborate "history houses". Built in sector-local coordinates.
import * as THREE from 'three';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';
import { WALL_T, ROOF_T, boxGeo, scaleUV, worldPt } from './town.js';
import { mulberry32 } from './textures.js';
import { gravePit, burialLayout } from './burial.js';

const UVS = 2.4; // metres per plaster tile

export const CAPTIONS = {
  plain: 'A house of the ordinary kind. Ladder, oven and hearth crowd the sooty south end; the white-plastered platforms to the north and east are for sleeping, sitting and the dead buried beneath. Crouch (C) to crawl into the storeroom.',
  b77: 'After Building 77 (North Area). A “history house”: the north-east platform is fenced by aurochs horns on red pedestals, a plastered ram’s skull hangs over a niche, and a row of twelve red handprints runs along the north wall. More than nine people were buried under its floors.',
  b80: 'After Building 80 (South Area). A long room with its east wall divided into three plaster panels: a red-painted niche, a panel of stacked red “brick” motifs above the burial platform, and a bench holding a pair of bull’s horns. Walls here stood 2.5 m high.',
  hunters: 'After the “Shrine of the Hunters” (F.V.1, Level V). A great red bull dwarfs dozens of small black and red figures that leap, run and tease it; on the side walls men in skins bait a stag and a boar. Painted on every wall to a height of 1.35 m.',
  vultures: 'After the “Vulture Shrine” (VII.8). Seven red griffon vultures with wingspans of 1.5 m spread across the east and north walls above the platforms, swooping on tiny headless human figures.',
  leopards: 'After Shrines VII.44 and VI.44. Two plaster leopards face each other nose to nose above a red panel, their spots repainted over forty coats. On the west wall a splayed figure raises arms and legs; beneath it a bull’s head with real horns.',
  map: 'After Shrine VII.14 (Level VII). A 2.7 m painting above the north-east platform shows rows of boxes like the town’s own houses under a double-peaked form covered in dots: read since the 1960s as the twin-peaked volcano Hasan Dağı in eruption.',
};

export function makeInteriorBuilder(tex, P0, rnd, registry) {
  // paintings are drawn once per (motif, size) and shared by every house that uses them
  const texCache = new Map();
  const P = {};
  for (const k of Object.keys(P0)) P[k] = (...args) => { const key = k + ':' + args.map((a) => typeof a === 'number' ? a.toFixed(2) : String(a)).join(','); if (!texCache.has(key)) texCache.set(key, P0[k](...args)); return texCache.get(key); };
  // ---- shared materials ----
  const M = {
    plaster: new THREE.MeshStandardMaterial({ map: tex.white, roughness: 0.95 }),
    plasterSoot: new THREE.MeshStandardMaterial({ map: tex.whiteSoot, roughness: 0.95 }),
    floor: new THREE.MeshStandardMaterial({ map: tex.white, color: 0xe9e2d2, roughness: 1 }),
    floorDirty: new THREE.MeshStandardMaterial({ map: tex.soil, color: 0x8d7f6b, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    silt: tex.loam ? new THREE.MeshStandardMaterial({ map: tex.loam, normalMap: tex.loamN, normalScale: new THREE.Vector2(0.5, 0.5), color: 0xe2d2bc, roughness: 1 })
                   : new THREE.MeshStandardMaterial({ map: tex.mud2, color: 0xd9b88c, roughness: 1 }),
    earth: tex.dirt ? new THREE.MeshStandardMaterial({ map: tex.dirt, color: 0x5e4e3e, roughness: 1 }) : new THREE.MeshStandardMaterial({ map: tex.soil, color: 0x5a4a3a, roughness: 1 }),
    earthWall: tex.dirt ? new THREE.MeshStandardMaterial({ map: tex.dirt, color: 0x7a6752, roughness: 1 }) : new THREE.MeshStandardMaterial({ map: tex.soil, color: 0x6f5e4c, roughness: 1 }),
    red: new THREE.MeshStandardMaterial({ color: 0x9a3e2a, roughness: 1 }),
    niche: new THREE.MeshStandardMaterial({ map: tex.white, color: 0xbfb3a0, roughness: 1 }),
    wood: tex.timber ? new THREE.MeshStandardMaterial({ map: tex.timber, normalMap: tex.timberN, roughness: 0.9 }) : new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.9 }),
    ceiling: new THREE.MeshStandardMaterial({ map: tex.ceiling, roughness: 1 }),
    clay: new THREE.MeshStandardMaterial({ map: tex.mud2, color: 0xc9a883, roughness: 1 }),
    horn: new THREE.MeshStandardMaterial({ color: 0x5a4d42, roughness: 0.7 }),
    charcoal: new THREE.MeshStandardMaterial({ color: 0x1b1613, roughness: 1 }),
    ash: new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 1 }),
    basket: new THREE.MeshStandardMaterial({ map: tex.basket, roughness: 1, side: THREE.DoubleSide }),
    mat: new THREE.MeshStandardMaterial({ map: tex.mat, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    redMat: new THREE.MeshStandardMaterial({ map: tex.mat, color: 0xb0604a, roughness: 1 }),
    hide: new THREE.MeshStandardMaterial({ color: 0x6b4b34, roughness: 1 }),
    hideDS: new THREE.MeshStandardMaterial({ color: 0x8a5f3c, roughness: 1, side: THREE.DoubleSide }),
    rope: new THREE.MeshStandardMaterial({ color: 0x8f7a58, roughness: 1 }),
    obsidian: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.25, metalness: 0.2 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x8c8378, roughness: 1 }),
    bone: new THREE.MeshStandardMaterial({ color: 0xf2eadb, roughness: 0.7 }),
    graveMat: new THREE.MeshStandardMaterial({ map: tex.mat, color: 0x6a553c, roughness: 1 }),
    grain: new THREE.MeshStandardMaterial({ color: 0xc8a85a, roughness: 1 }),
    soot: new THREE.MeshBasicMaterial({ map: tex.puff, color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false }),
    sootWall: new THREE.MeshBasicMaterial({ map: tex.soot, transparent: true, depthWrite: false }),
    leopard: null, // set below
    groove: new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 }),
    woodDS: new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.9, side: THREE.DoubleSide }),
    herbA: new THREE.MeshStandardMaterial({ color: 0x8a8a4a, roughness: 1 }),
    herbB: new THREE.MeshStandardMaterial({ color: 0xa08d55, roughness: 1 }),
  };
  M.nicheBack = new THREE.MeshStandardMaterial({ map: tex.white, color: 0xbfb3a0, roughness: 1, side: THREE.BackSide });
  M.leopard = new THREE.MeshStandardMaterial({ map: P.leopardSpots(), roughness: 0.95, side: THREE.DoubleSide });

  // ---- geometry helpers ----
  function panel(w, h, holes = []) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(w, 0); shape.lineTo(w, h); shape.lineTo(0, h); shape.closePath();
    for (const ho of holes) {
      const p = new THREE.Path();
      p.moveTo(ho.u, ho.v); p.lineTo(ho.u, ho.v + ho.h); p.lineTo(ho.u + ho.w, ho.v + ho.h); p.lineTo(ho.u + ho.w, ho.v); p.closePath();
      shape.holes.push(p);
    }
    const g = new THREE.ShapeGeometry(shape);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / UVS, uv.getY(i) / UVS);
    return g;
  }
  // place a panel geometry on a wall of room R (interior rect) facing inwards
  function wallMesh(g, side, R, y, mat, inset = 0.004) {
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    if (side === 'N') { m.position.set(R.x0, y, R.z0 + inset); }
    else if (side === 'S') { m.rotation.y = Math.PI; m.position.set(R.x1, y, R.z1 - inset); }
    else if (side === 'W') { m.rotation.y = Math.PI / 2; m.position.set(R.x0 + inset, y, R.z1); }
    else { m.rotation.y = -Math.PI / 2; m.position.set(R.x1 - inset, y, R.z0); }
    return m;
  }
  // panel-u coordinate of a room-local point on the given wall
  const uOf = (side, R, x, z) => side === 'N' ? x - R.x0 : side === 'S' ? R.x1 - x : side === 'W' ? R.z1 - z : z - R.z0;
  const wallLen = (side, R) => (side === 'N' || side === 'S') ? R.x1 - R.x0 : R.z1 - R.z0;

  // flat decoration plane hung on a wall: u0 along the wall, v0 above floor, size w x h
  function hang(group, side, R, floorY, u0, v0, w, h, mat, proud = 0.012) {
    const g = new THREE.PlaneGeometry(w, h); g.translate(u0 + w / 2, v0 + h / 2, 0);
    const m = wallMesh(g, side, R, floorY, mat, proud);
    group.add(m); return m;
  }
  function paintMat(texture) { const m = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 }); m.userData.disposable = true; return m; }
  // a hide stretched on a frame of two poles, leaning against a wall (as in the Grant Cox model)
  function hideFrame() {
    const g = new THREE.Group();
    for (const sx of [-0.3, 0.3]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.5, 6), M.wood); pole.position.set(sx, 0.75, 0); pole.rotation.z = -sx * 0.25; pole.castShadow = true; g.add(pole); }
    const shape = new THREE.Shape();
    shape.moveTo(-0.3, 0.2); shape.quadraticCurveTo(-0.4, 0.7, -0.28, 1.15); shape.quadraticCurveTo(-0.1, 1.3, 0, 1.22); shape.quadraticCurveTo(0.1, 1.3, 0.28, 1.15); shape.quadraticCurveTo(0.4, 0.7, 0.3, 0.2); shape.quadraticCurveTo(0, 0.1, -0.3, 0.2);
    const hide = new THREE.Mesh(new THREE.ShapeGeometry(shape), M.hideDS); hide.position.z = 0.02; hide.castShadow = true; g.add(hide);
    return g;
  }

  // recess (niche) cut into a wall: returns the hole descriptor for the panel and adds the reveal box
  function niche(group, side, R, floorY, u, v, w, h, depth, mat = M.niche) {
    const inner = new THREE.BoxGeometry(w, h, depth);
    // open-fronted box: build 5 faces by using a box and placing it behind the wall; back-face culling hides nothing since we look inside
    const m = new THREE.Mesh(inner, M.nicheBack);
    m.receiveShadow = true;
    const off = -depth / 2 + 0.002; // centred behind the wall surface
    if (side === 'N') m.position.set(R.x0 + u + w / 2, floorY + v + h / 2, R.z0 + off);
    else if (side === 'S') m.position.set(R.x1 - u - w / 2, floorY + v + h / 2, R.z1 - off);
    else if (side === 'W') { m.rotation.y = Math.PI / 2; m.position.set(R.x0 + off, floorY + v + h / 2, R.z1 - u - w / 2); }
    else { m.rotation.y = -Math.PI / 2; m.position.set(R.x1 - off, floorY + v + h / 2, R.z0 + u + w / 2); }
    group.add(m);
    return { u, v, w, h };
  }

  function box(group, mat, x0, y0, z0, x1, y1, z1, uvs = UVS, shadow = true) {
    const g = boxGeo(x1 - x0, y1 - y0, z1 - z0, uvs);
    const m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = shadow; m.receiveShadow = true;
    group.add(m); return m;
  }

  // aurochs skull with horn cores, plastered. Facing +z (out of a wall behind it). Span in metres.
  function bucranium(span = 1.1, plastered = true) {
    const g = new THREE.Group();
    const mat = plastered ? M.plaster : M.bone;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), mat);
    skull.scale.set(0.95, 0.7, 1.35); skull.position.set(0, 0.02, 0.1);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), mat);
    snout.scale.set(0.8, 0.6, 1.1); snout.position.set(0, -0.14, 0.32);
    g.add(skull, snout);
    for (const sgn of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sgn * 0.12, 0.06, 0.0), new THREE.Vector3(sgn * span * 0.28, 0.16, 0.08),
        new THREE.Vector3(sgn * span * 0.42, 0.34, 0.22), new THREE.Vector3(sgn * span * 0.46, 0.56, 0.36)]);
      const horn = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.036, 7, false), M.horn);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.14, 7), M.horn);
      const end = curve.getPoint(1), tan = curve.getTangent(1);
      tip.position.copy(end).addScaledVector(tan, 0.06);
      tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
      horn.castShadow = tip.castShadow = true;
      g.add(horn, tip);
    }
    skull.castShadow = snout.castShadow = true;
    return g;
  }
  // pair of upright horn cores rising from a pedestal / bench top
  function hornPair(spread = 0.3) {
    const g = new THREE.Group();
    for (const sgn of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(sgn * 0.08, 0, 0), new THREE.Vector3(sgn * spread * 0.7, 0.16, 0), new THREE.Vector3(sgn * spread, 0.36, 0.03), new THREE.Vector3(sgn * spread * 0.8, 0.52, 0.08)]);
      const horn = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.03, 7, false), M.horn);
      horn.castShadow = true; g.add(horn);
    }
    return g;
  }
  function splayedFigure() {
    const pts = [[0.08, 0.55], [0.08, 0.46], [0.33, 0.46], [0.33, 0.80], [0.45, 0.80], [0.45, 0.34], [0.15, 0.34], [0.15, 0.0], [0.33, 0.0], [0.33, 0.25], [0.45, 0.25], [0.45, -0.12], [0.15, -0.12], [0.15, -0.25],
      [-0.15, -0.25], [-0.15, -0.12], [-0.45, -0.12], [-0.45, 0.25], [-0.33, 0.25], [-0.33, 0.0], [-0.15, 0.0], [-0.15, 0.34], [-0.45, 0.34], [-0.45, 0.80], [-0.33, 0.80], [-0.33, 0.46], [-0.08, 0.46], [-0.08, 0.55]];
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const navel = new THREE.Path(); navel.absarc(0, 0.12, 0.03, 0, Math.PI * 2, false); shape.holes.push(navel);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
    const m = new THREE.Mesh(g, M.red); m.castShadow = true; return m;
  }
  function leopard(mirror = false) {
    // side profile facing +x, tail curled over the back, ~1.6 m long
    const pts = [[0.78, 0.52], [0.74, 0.58], [0.68, 0.64], [0.64, 0.72], [0.60, 0.66], [0.55, 0.66], [0.42, 0.64], [0.30, 0.66], [0.10, 0.66], [-0.10, 0.65], [-0.30, 0.64], [-0.48, 0.62], [-0.58, 0.58], [-0.66, 0.52],
      [-0.76, 0.58], [-0.82, 0.70], [-0.78, 0.82], [-0.66, 0.88], [-0.52, 0.86], [-0.44, 0.80], [-0.52, 0.80], [-0.62, 0.82], [-0.72, 0.76], [-0.74, 0.66], [-0.70, 0.56], [-0.66, 0.46],
      [-0.68, 0.34], [-0.70, 0.18], [-0.64, 0.04], [-0.56, 0.04], [-0.56, 0.18], [-0.50, 0.32], [-0.44, 0.40], [-0.30, 0.40], [-0.10, 0.40], [0.10, 0.42], [0.26, 0.42],
      [0.34, 0.36], [0.36, 0.18], [0.36, 0.04], [0.46, 0.04], [0.46, 0.18], [0.48, 0.36], [0.54, 0.46], [0.62, 0.48], [0.70, 0.46], [0.76, 0.46]];
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(mirror ? -x : x, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.4, uv.getY(i) * 1.4);
    const m = new THREE.Mesh(g, M.leopard); m.castShadow = true; return m;
  }
  function basket(r = 0.25, h = 0.4) {
    const g = new THREE.CylinderGeometry(r, r * 0.75, h, 10, 1, true); g.translate(0, h / 2, 0);
    const m = new THREE.Mesh(g, M.basket); m.castShadow = true; return m;
  }
  function bowl(r = 0.2) {
    const g = new THREE.CylinderGeometry(r, r * 0.65, r * 0.45, 10, 1, true); g.translate(0, r * 0.22, 0);
    const m = new THREE.Mesh(g, M.woodDS); m.castShadow = true; return m;
  }
  function quern() {
    const g = new THREE.Group();
    const q = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.13, 0.35), M.stone); q.position.y = 0.065;
    const hs = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), M.stone); hs.scale.set(1.3, 0.7, 1); hs.position.set(0.08, 0.17, 0);
    q.castShadow = hs.castShadow = true; g.add(q, hs); return g;
  }
  function clayBalls(n) {
    const geos = [];
    for (let i = 0; i < n; i++) { const g = new THREE.SphereGeometry(0.035 + rnd() * 0.015, 7, 5); g.translate((rnd() - 0.5) * 0.4, 0.04, (rnd() - 0.5) * 0.3); geos.push(g); }
    const m = new THREE.Mesh(mergeGeometries(geos), M.ash); m.castShadow = true; return m;
  }
  function obsidianBlades(n) {
    const geos = [];
    for (let i = 0; i < n; i++) { const g = new THREE.BoxGeometry(0.012, 0.004, 0.06 + rnd() * 0.05); g.rotateY(rnd() * Math.PI); g.translate((rnd() - 0.5) * 0.3, 0.004, (rnd() - 0.5) * 0.25); geos.push(g); }
    return new THREE.Mesh(mergeGeometries(geos), M.obsidian);
  }
  function antler() {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, 0.25, 0.02), new THREE.Vector3(0.15, 0.5, 0.05), new THREE.Vector3(0.1, 0.7, 0.08)]);
    const g = new THREE.Group();
    const main = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.02, 6), M.bone);
    g.add(main);
    for (const t of [0.35, 0.65]) { const p = curve.getPoint(t); const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.016, 0.22, 5), M.bone); tine.position.copy(p).add(new THREE.Vector3(-0.08, 0.08, 0)); tine.rotation.z = 0.7; g.add(tine); }
    return g;
  }
  function bin(x, z, w, d, h, group, fillMat) {
    const t = 0.06;
    box(group, M.clay, x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2);
    const inner = box(group, M.charcoal, x - w / 2 + t, h - 0.02, z - d / 2 + t, x + w / 2 - t, h + 0.001, z + d / 2 - t, UVS, false);
    inner.material = M.charcoal;
    if (fillMat) { const f = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * t, d - 2 * t), fillMat); f.rotation.x = -Math.PI / 2; f.position.set(x, h - 0.2, z); group.add(f); inner.visible = false; }
  }

  // ---------------------------------------------------------------------
  // the builder
  // ---------------------------------------------------------------------
  return function buildInterior(h, s, Msector, parent, world) {
    rnd = mulberry32((h.seed ^ 0x9e3779b9) >>> 0);   // deterministic per house, so it can be rebuilt on demand
    const solids = [];
    const G = new THREE.Group();
    G.name = 'interior-' + h.id;
    const fy = 0;               // we build with the floor at y=0 then lift the group
    const H = h.wallH;
    const R = h.main;           // main room interior rect (local coords)
    const kind = h.kind;
    const hatch = h.hatch;
    const rooms = [{ R, main: true }, ...h.side.map((sr) => ({ R: sr, main: false, wall: sr.wall }))];
    const addSolid = (x0, y0, z0, x1, y1, z1, tag) => { solids.push(world.addBox(s.fi, x0, h.floorY + y0, z0, x1, h.floorY + y1, z1, tag || 'fixture')); };

    // --- openings between rooms (crawl holes) ---
    const doors = [];
    for (const sr of h.side) {
      if (sr.wall === 'W' || sr.wall === 'E') {
        // through the party wall, within this compartment, towards its south end; clear of the sleeping
        // platforms at the north end and of the oven and ladder foot at the south end where possible
        const neD0 = Math.min(1.5, (R.z1 - R.z0) * 0.32);
        const zLo = R.z0 + neD0 + 0.45, zHi = R.z1 - (sr.wall === 'W' ? 1.35 : 1.1);
        let z = Math.min(sr.z1 - 0.55, sr.z0 + (sr.z1 - sr.z0) * 0.6);
        const lo = Math.max(sr.z0 + 0.45, zLo), hi = Math.min(sr.z1 - 0.45, zHi);
        if (hi >= lo) z = Math.max(lo, Math.min(hi, z));
        else z = Math.max(sr.z0 + 0.45, Math.min(sr.z1 - 0.45, z));
        z = Math.max(R.z0 + 0.45, Math.min(R.z1 - 0.95, z));
        doors.push({ sr, x: sr.wall === 'W' ? R.x0 - WALL_T : R.x1, z0: z - 0.3, z1: z + 0.3, axis: 'x', wall: sr.wall });
      } else {
        const x = R.x0 + 0.55;
        doors.push({ sr, z: R.z0 - WALL_T, x0: x - 0.3, x1: x + 0.3, axis: 'z', wall: 'N' });
      }
    }
    const nearDoor = (wall, z, m) => doors.some((d) => d.wall === wall && z > d.z0 - m && z < d.z1 + m);
    const DOOR_H = 0.82;
    // party walls between the central room and its store rooms, with every crawl-hole on that wall cut through
    for (const wall of ['W', 'E']) {
      const ds = doors.filter((d) => d.wall === wall).sort((a, b) => a.z0 - b.z0);
      if (!ds.length) continue;
      const srs = h.side.filter((sr) => sr.wall === wall);
      const x0 = wall === 'W' ? R.x0 - WALL_T : R.x1, x1 = x0 + WALL_T;
      const zA = Math.min(R.z0, ...srs.map((r) => r.z0)) - 0.02, zB = Math.max(R.z1, ...srs.map((r) => r.z1)) + 0.02;
      let z = zA;
      for (const d of ds) {
        box(G, M.plaster, x0, 0, z, x1, H, d.z0); addSolid(x0, -0.1, z, x1, H, d.z0);
        box(G, M.plaster, x0, DOOR_H, d.z0, x1, H, d.z1); addSolid(x0, DOOR_H, d.z0, x1, H, d.z1);
        box(G, M.wood, x0 - 0.01, DOOR_H, d.z0 - 0.02, x1 + 0.01, DOOR_H + 0.08, d.z1 + 0.02);
        z = d.z1;
      }
      box(G, M.plaster, x0, 0, z, x1, H, zB); addSolid(x0, -0.1, z, x1, H, zB);
    }
    for (const d of doors) {
      if (d.axis !== 'z') continue;
      const z0 = d.z, z1 = d.z + WALL_T, xA = Math.min(R.x0, d.sr.x0) - 0.02, xB = Math.max(R.x1, d.sr.x1) + 0.02;
      box(G, M.plaster, xA, 0, z0, d.x0, H, z1); addSolid(xA, -0.1, z0, d.x0, H, z1);
      box(G, M.plaster, d.x1, 0, z0, xB, H, z1); addSolid(d.x1, -0.1, z0, xB, H, z1);
      box(G, M.plaster, d.x0, DOOR_H, z0, d.x1, H, z1); addSolid(d.x0, DOOR_H, z0, d.x1, H, z1);
      box(G, M.wood, d.x0 - 0.02, DOOR_H, z0 - 0.01, d.x1 + 0.02, DOOR_H + 0.08, z1 + 0.01);
    }
    // partition between the two compartments of a store-room strip
    for (let i = 0; i < h.side.length; i++) for (let j = i + 1; j < h.side.length; j++) {
      const a = h.side[i], b = h.side[j];
      if (a.wall !== b.wall || a.wall === 'N') continue;
      const lo = a.z1 < b.z0 ? a : b, hi = lo === a ? b : a;
      if (hi.z0 - lo.z1 > WALL_T + 0.02) continue;
      box(G, M.silt, lo.x0 - 0.02, 0, lo.z1, lo.x1 + 0.02, H, hi.z0); addSolid(lo.x0, -0.1, lo.z1, lo.x1, H, hi.z0);
    }

    // --- per-room shells ---
    for (const room of rooms) {
      const r = room.R, mat = room.main ? M.plaster : M.silt;
      // floor (the central room's floor is laid later, once we know whether a grave is open in it)
      if (!room.main) {
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), M.silt);
        scaleUV(fl.geometry, (r.x1 - r.x0) / UVS, (r.z1 - r.z0) / UVS);
        fl.rotation.x = -Math.PI / 2; fl.position.set((r.x0 + r.x1) / 2, 0.002, (r.z0 + r.z1) / 2); fl.receiveShadow = true; G.add(fl);
      }
      // ceiling
      const ce = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), M.ceiling);
      scaleUV(ce.geometry, (r.x1 - r.x0) / 2.5, (r.z1 - r.z0) / 2.5);
      ce.rotation.x = Math.PI / 2; ce.position.set((r.x0 + r.x1) / 2, H - 0.001, (r.z0 + r.z1) / 2); ce.receiveShadow = true; G.add(ce);
      // roof structure: main beams along the long axis carrying close-set pole rafters, reeds above
      const alongX = (r.x1 - r.x0) <= (r.z1 - r.z0);   // rafters run along x when the room is longer in z
      const span = alongX ? r.x1 - r.x0 : r.z1 - r.z0, len = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
      const nBeam = span > 3.2 ? 2 : 1;
      for (let b = 0; b < nBeam; b++) {
        const t = (b + 1) / (nBeam + 1);
        const g = new THREE.CylinderGeometry(0.12, 0.13, len + 0.02, 8);
        if (alongX) g.rotateX(Math.PI / 2); else g.rotateZ(Math.PI / 2);
        const m = new THREE.Mesh(g, M.wood); m.castShadow = true;
        if (alongX) m.position.set(r.x0 + t * span, H - 0.36, (r.z0 + r.z1) / 2); else m.position.set((r.x0 + r.x1) / 2, H - 0.36, r.z0 + t * span);
        G.add(m);
      }
      const nR = Math.max(2, Math.round(len / 0.3));
      for (let i = 0; i < nR; i++) {
        const t = (i + 0.5) / nR + (rnd() - 0.5) * 0.08 / nR;
        const g = new THREE.CylinderGeometry(0.05 + rnd() * 0.015, 0.055 + rnd() * 0.015, span + 0.02, 6);
        if (alongX) g.rotateZ(Math.PI / 2); else g.rotateX(Math.PI / 2);
        const m = new THREE.Mesh(g, M.wood); m.castShadow = true;
        if (alongX) m.position.set((r.x0 + r.x1) / 2, H - 0.1, r.z0 + t * len); else m.position.set(r.x0 + t * len, H - 0.1, (r.z0 + r.z1) / 2);
        G.add(m);
      }
      // plaster cove where the walls meet the floor
      box(G, mat, r.x0, 0, r.z0, r.x1, 0.05, r.z0 + 0.05, UVS, false); box(G, mat, r.x0, 0, r.z1 - 0.05, r.x1, 0.05, r.z1, UVS, false);
      box(G, mat, r.x0, 0, r.z0, r.x0 + 0.05, 0.05, r.z1, UVS, false); box(G, mat, r.x1 - 0.05, 0, r.z0, r.x1, 0.05, r.z1, UVS, false);
      // walls: collect holes per side
      const sides = ['N', 'S', 'E', 'W'];
      const holes = { N: [], S: [], E: [], W: [] };
      for (const d of doors) {
        // which side of this room does the door sit on?
        if (room.main) {
          if (d.wall === 'W') holes.W.push({ u: uOf('W', r, 0, d.z1), v: 0, w: 0.6, h: DOOR_H });
          if (d.wall === 'E') holes.E.push({ u: uOf('E', r, 0, d.z0), v: 0, w: 0.6, h: DOOR_H });
          if (d.wall === 'N') holes.N.push({ u: uOf('N', r, d.x0, 0), v: 0, w: 0.6, h: DOOR_H });
        } else if (d.sr === room.R) {
          if (d.wall === 'W') holes.E.push({ u: uOf('E', r, 0, d.z0), v: 0, w: 0.6, h: DOOR_H });
          if (d.wall === 'E') holes.W.push({ u: uOf('W', r, 0, d.z1), v: 0, w: 0.6, h: DOOR_H });
          if (d.wall === 'N') holes.S.push({ u: uOf('S', r, d.x1, 0), v: 0, w: 0.6, h: DOOR_H });
        }
      }
      room.holes = holes;
    }

    // --- main room fixtures ---
    const W = R.x1 - R.x0, L = R.z1 - R.z0;
    const hatchCx = (hatch.x0 + hatch.x1) / 2;
    // domed oven against the south wall at the foot of the ladder, so the hatch above draws its smoke
    const ovenX = Math.max(R.x0 + 0.7, hatchCx - 1.05);
    {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.clay);
      dome.scale.set(1, 0.82, 1); dome.position.set(ovenX, 0, R.z1 - 0.3); dome.castShadow = true; dome.receiveShadow = true; G.add(dome);
      const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.14, 10, 1, false, 0, Math.PI), M.charcoal); mouth.rotation.x = Math.PI / 2; mouth.rotation.z = 0; mouth.position.set(ovenX, 0.12, R.z1 - 0.78); G.add(mouth);
      const mouthFloor = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), M.charcoal); mouthFloor.rotation.x = -Math.PI / 2; mouthFloor.position.set(ovenX, 0.01, R.z1 - 0.7); G.add(mouthFloor);
      const sill = box(G, M.clay, ovenX - 0.6, 0, R.z1 - 0.95, ovenX + 0.6, 0.07, R.z1 - 0.7);
      addSolid(ovenX - 0.55, 0, R.z1 - 0.82, ovenX + 0.55, 0.45, R.z1);
      // basin west of the oven, set back into the wall
      if (ovenX - 0.6 - R.x0 > 1.1) { box(G, M.clay, R.x0 + 0.1, 0, R.z1 - 0.5, R.x0 + 1.0, 0.22, R.z1 - 0.1); box(G, M.charcoal, R.x0 + 0.17, 0.2, R.z1 - 0.43, R.x0 + 0.93, 0.21, R.z1 - 0.17, UVS, false); }
    }
    // hearth ~1 m north-west of the oven
    const hearth = { x: Math.max(R.x0 + 0.6, ovenX - 0.7), z: R.z1 - 1.45 };
    {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.06, 7, 18), M.clay); rim.rotation.x = Math.PI / 2; rim.position.set(hearth.x, 0.04, hearth.z); rim.scale.z = 0.6; G.add(rim);
      const ash = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), M.ash); ash.rotation.x = -Math.PI / 2; ash.position.set(hearth.x, 0.012, hearth.z); G.add(ash);
      const coals = new THREE.Mesh(new THREE.CircleGeometry(0.14, 10), M.charcoal); coals.rotation.x = -Math.PI / 2; coals.position.set(hearth.x, 0.02, hearth.z); G.add(coals);
      // scattered sticks
      for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.4, 5), M.wood); st.rotation.set(Math.PI / 2, 0, rnd() * Math.PI); st.position.set(hearth.x + (rnd() - 0.5) * 0.3, 0.05, hearth.z + (rnd() - 0.5) * 0.3); G.add(st); }
      // soot on the ceiling above hatch and hearth, and on the south wall
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6), M.soot); sc.rotation.x = Math.PI / 2; sc.position.set((hatchCx + ovenX) / 2, H - 0.01, R.z1 - 0.9); G.add(sc);
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(W, 3.0), 1.6), M.sootWall); sw.rotation.y = Math.PI; sw.position.set(Math.min(R.x1 - 1.5, (hatchCx + ovenX) / 2), H - 0.8, R.z1 - 0.01); G.add(sw);
    }
    // dirty floor zone in the south
    {
      const dz = Math.min(L * 0.4, 2.2);
      const d = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.02, dz), M.floorDirty); scaleUV(d.geometry, W / 2, dz / 2);
      d.rotation.x = -Math.PI / 2; d.position.set((R.x0 + R.x1) / 2, 0.012, R.z1 - dz / 2); d.receiveShadow = true; G.add(d);
    }
    // platforms: NW large, NE, and east-central. Heights per Hodder (0.1-0.4 m)
    const plats = [];
    const doorN = doors.find((d) => d.wall === 'N');
    const doorsE = doors.filter((d) => d.wall === 'E'), doorsW = doors.filter((d) => d.wall === 'W');
    const doorE = doorsE.length ? doorsE.reduce((a, b) => (a.z0 < b.z0 ? a : b)) : null;   // northernmost east door
    const doorW = doorsW.length ? doorsW.reduce((a, b) => (a.z0 < b.z0 ? a : b)) : null;
    const nwX0 = doorN ? doorN.x1 + 0.25 : R.x0;        // leave the crawl-hole in front of the north door clear
    const nwW = Math.min(2.6, (W - (nwX0 - R.x0)) * 0.55), nwD = Math.min(1.3, L * 0.3);
    const neD = Math.min(1.5, L * 0.32);
    let nwD1 = nwD, neD1 = neD;
    for (const d of doorsW) if (d.z0 < R.z0 + nwD1 + 0.15) nwD1 = Math.min(nwD1, d.z0 - 0.15 - R.z0);
    for (const d of doorsE) if (d.z0 < R.z0 + neD1 + 0.15) neD1 = Math.min(neD1, d.z0 - 0.15 - R.z0);
    if (nwD1 > 0.6) plats.push({ x0: nwX0, x1: nwX0 + nwW, z0: R.z0, z1: R.z0 + nwD1, h: kind === 'b77' ? 0.3 : 0.22 + rnd() * 0.1, name: 'NW' });
    if (neD1 > 0.6) plats.push({ x0: nwX0 + nwW, x1: R.x1, z0: R.z0, z1: R.z0 + neD1, h: kind === 'b77' ? 0.42 : 0.3 + rnd() * 0.12, name: 'NE' });
    const pNW = plats.find((p) => p.name === 'NW'), pNE = plats.find((p) => p.name === 'NE');
    const eD = Math.min(1.3, W * 0.3), eZ0 = R.z0 + neD;
    let eZ1 = Math.min(R.z1 - 2.0, eZ0 + 2.0);
    for (const d of doorsE) if (d.z1 > eZ0 && d.z0 < eZ1 + 0.15) eZ1 = Math.min(eZ1, d.z0 - 0.15);
    if (eZ1 - eZ0 > 0.9) plats.push({ x0: R.x1 - eD, x1: R.x1, z0: eZ0, z1: eZ1, h: 0.12 + rnd() * 0.1, name: 'E' });
    const grave = kind === 'plain' && pNW && rnd() < 0.14 && nwW > 1.5 && nwD1 > 1.1 ? pNW : null;
    let graveHole = null;
    for (const p of plats) {
      const pm = kind === 'b77' && p.name === 'NE' ? M.red : (kind === 'map' && p.name === 'NE' ? M.red : M.plaster);
      if (p === grave) {
        // the platform's plaster cut open for a burial: four plaster walls and a top with a hole, the pit below
        const gw = Math.min(1.1, (p.x1 - p.x0) - 0.5), gd = Math.min(0.8, (p.z1 - p.z0) - 0.4), gx = (p.x0 + p.x1) / 2, gz = (p.z0 + p.z1) / 2 + 0.05;
        const top = panel(p.x1 - p.x0, p.z1 - p.z0, [{ u: gx - gw / 2 - p.x0, v: p.z1 - (gz + gd / 2), w: gw, h: gd }]);
        graveHole = { u: gx - gw / 2 - R.x0, v: R.z1 - (gz + gd / 2), w: gw, h: gd };
        const tm = new THREE.Mesh(top, pm); tm.rotation.x = -Math.PI / 2; tm.position.set(p.x0, p.h, p.z1); tm.receiveShadow = true; G.add(tm);
        box(G, pm, p.x0, 0, p.z0, p.x1, p.h, p.z0 + 0.02); box(G, pm, p.x0, 0, p.z1 - 0.02, p.x1, p.h, p.z1);
        box(G, pm, p.x0, 0, p.z0, p.x0 + 0.02, p.h, p.z1); box(G, pm, p.x1 - 0.02, 0, p.z0, p.x1, p.h, p.z1);
        const depth = p.h + 0.35;
        const pit = gravePit({ earth: M.earth, earthWall: M.earthWall, matting: M.graveMat, bone: M.bone, wood: M.woodDS }, rnd, gw, gd, depth, burialLayout(rnd, false));
        pit.position.set(gx, p.h - depth, gz); G.add(pit);
        // the spoil heaped beside the grave and a basket of plaster for closing it again
        const spoil = new THREE.Mesh(new THREE.SphereGeometry(0.3, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.earth); spoil.scale.set(1.3, 0.45, 1); spoil.position.set(p.x1 - 0.35, p.h, p.z1 - 0.3); G.add(spoil);
        addSolid(p.x0, 0, p.z0, p.x1, p.h, p.z1);
        const mw = gx - gw / 2 - p.x0 - 0.12;
        if (mw > 0.3) { const mm = new THREE.Mesh(new THREE.PlaneGeometry(mw, (p.z1 - p.z0) * 0.6), M.mat); mm.rotation.x = -Math.PI / 2; mm.position.set(p.x0 + 0.06 + mw / 2, p.h + 0.006, (p.z0 + p.z1) / 2); G.add(mm); }
        continue;
      }
      box(G, pm, p.x0, 0, p.z0, p.x1, p.h, p.z1);
      // kerb lip along the open edges
      box(G, M.plaster, p.x0, p.h, p.z1 - 0.08, p.x1, p.h + 0.05, p.z1);
      addSolid(p.x0, 0, p.z0, p.x1, p.h, p.z1);
      // matting
      const mm = new THREE.Mesh(new THREE.PlaneGeometry((p.x1 - p.x0) * 0.8, (p.z1 - p.z0) * 0.75), kind === 'map' && p.name === 'NE' ? M.redMat : M.mat);
      mm.rotation.x = -Math.PI / 2; mm.position.set((p.x0 + p.x1) / 2, p.h + 0.006, (p.z0 + p.z1) / 2 + 0.03); mm.receiveShadow = true; G.add(mm);
    }
    // the central room's white plaster floor, cut where a grave is open
    {
      const fl = new THREE.Mesh(panel(W, L, graveHole ? [graveHole] : []), M.floor);
      fl.rotation.x = -Math.PI / 2; fl.position.set(R.x0, 0.002, R.z1); fl.receiveShadow = true; G.add(fl);
    }
    // engaged posts on the E and W walls flanking the platforms, with pillow capitals; tie-beam groove at 1.95 m
    const postH = Math.min(1.95, H - 0.5);
    const postZ = [R.z0 + nwD + 0.15, Math.min(R.z1 - 1.6, R.z0 + nwD + 2.2)];
    for (const z of postZ) {
      for (const side of ['W', 'E']) {
        if (nearDoor(side, z, 0.45)) continue;
        const x0 = side === 'W' ? R.x0 : R.x1 - 0.26, x1 = side === 'W' ? R.x0 + 0.26 : R.x1;
        box(G, M.plaster, x0, 0, z - 0.15, x1, postH, z + 0.15);
        box(G, M.plaster, x0 - (side === 'W' ? 0 : 0.08), postH, z - 0.22, x1 + (side === 'W' ? 0.08 : 0), postH + 0.12, z + 0.22);
        addSolid(x0, 0, z - 0.15, x1, postH, z + 0.15);
      }
    }
    for (const side of ['N', 'E', 'W']) {
      const g = new THREE.PlaneGeometry(wallLen(side, R), 0.028); g.translate(wallLen(side, R) / 2, postH + 0.2, 0);
      G.add(wallMesh(g, side, R, 0, M.groove, 0.006));
    }
    // ladder platform / step in the SE corner and a basin by the ladder foot
    box(G, M.plaster, hatch.x0 - 0.1, 0, R.z1 - 0.65, R.x1, 0.12, R.z1);

    // --- wall surfaces of the main room (with niches) ---
    const mainHoles = rooms[0].holes;
    // niches
    const nicheList = [];
    if (kind === 'b77') {
      nicheList.push(['N', (W / 2) - 0.4, 0.95, 0.8, 0.9, 0.25]);                  // central alcove
      nicheList.push(['N', 0.35, 1.25, 0.19, 0.12, 0.15]);                         // small niche under the ram's skull
      nicheList.push(['N', W - 0.55, 1.1, 0.3, 0.35, 0.2]);
    } else if (kind === 'b80') {
      nicheList.push(['E', L * 0.5 - 0.2, 1.05, 0.4, 0.5, 0.22]);                  // red-painted central niche
      nicheList.push(['W', 0.4, 0.15, 0.3, 0.3, 0.2]);                             // floor-level niche
    } else {
      if (rnd() < 0.8) nicheList.push([rnd() < 0.5 ? 'E' : 'W', 0.6 + rnd() * (L - 2.2), 1.0 + rnd() * 0.3, 0.3, 0.35, 0.2]);
      if (rnd() < 0.4) nicheList.push(['N', 0.4 + rnd() * (W - 1.2), 0.9 + rnd() * 0.5, 0.28, 0.3, 0.2]);
    }
    for (const [side, u, v, w, hh, d] of nicheList) mainHoles[side].push(niche(G, side, R, 0, u, v, w, hh, d));
    // red frames around niches in b77/b80
    if (kind === 'b77') { const n = nicheList[1]; hang(G, 'N', R, 0, n[1] - 0.08, n[2] - 0.08, n[3] + 0.16, n[4] + 0.16, M.red, 0.006); }
    if (kind === 'b80') { const n = nicheList[0]; hang(G, 'E', R, 0, n[1] - 0.12, n[2] - 0.12, n[3] + 0.24, n[4] + 0.24, M.red, 0.006); }
    for (const side of ['N', 'S', 'E', 'W']) {
      const g = panel(wallLen(side, R), H, mainHoles[side]);
      G.add(wallMesh(g, side, R, 0, side === 'S' ? M.plasterSoot : M.plaster));
    }
    // side rooms wall surfaces (silt plaster) + contents
    for (const room of rooms.slice(1)) {
      const r = room.R;
      for (const side of ['N', 'S', 'E', 'W']) G.add(wallMesh(panel(wallLen(side, r), H, room.holes[side]), side, r, 0, M.silt));
      // bins along the far walls
      const rw = r.x1 - r.x0, rl = r.z1 - r.z0;
      if (room.wall === 'N') {
        const n = Math.max(1, Math.floor(rw / 1.05));
        for (let i = 0; i < n; i++) { const bx = r.x0 + (i + 0.5) * rw / n; bin(bx, r.z0 + 0.5, Math.min(0.95, rw / n - 0.1), 0.9, 0.85, G, i % 2 ? M.grain : null); addSolid(bx - 0.5, 0, r.z0, bx + 0.5, 0.85, r.z0 + 1.0); }
      } else {
        const n = Math.max(1, Math.floor((rl - 1.2) / 1.05));
        const bxx = room.wall === 'W' ? r.x0 + 0.5 : r.x1 - 0.5;
        for (let i = 0; i < n; i++) { const bz = r.z0 + 0.6 + (i + 0.5) * (rl - 1.2) / n; bin(bxx, bz, Math.min(0.95, rw - 0.2), Math.min(0.95, (rl - 1.2) / n - 0.1), 0.85, G, i % 2 ? M.grain : null); addSolid(bxx - 0.5, 0, bz - 0.5, bxx + 0.5, 0.85, bz + 0.5); }
        // basins along the south wall (B.77 store), unless the crawl-hole opens right onto them
        const doorHere = doors.find((d) => d.sr === r);
        if (!doorHere || doorHere.z1 < r.z1 - 0.95) {
          box(G, M.clay, r.x0 + 0.1, 0, r.z1 - 0.55, r.x1 - 0.1, 0.25, r.z1 - 0.05); box(G, M.charcoal, r.x0 + 0.17, 0.23, r.z1 - 0.48, r.x1 - 0.17, 0.24, r.z1 - 0.12, UVS, false);
          addSolid(r.x0, 0, r.z1 - 0.55, r.x1, 0.25, r.z1);
        }
      }
      // baskets
      for (let i = 0; i < 2; i++) { const b = basket(0.2 + rnd() * 0.1, 0.35 + rnd() * 0.2); b.position.set(r.x0 + 0.4 + rnd() * (rw - 0.8), 0, r.z0 + 0.4 + rnd() * (rl - 0.8)); G.add(b); }
    }

    // --- everyday objects in the main room ---
    const nw = pNW || { x0: R.x0, x1: R.x0 + 1.5, z0: R.z0, z1: R.z0 + 0.6, h: 0 }, ne = pNE || { x0: R.x1 - 1.5, x1: R.x1, z0: R.z0, z1: R.z0 + 0.6, h: 0 };
    if (!grave) {
      { const b = basket(0.26, 0.42); b.position.set(nw.x0 + 0.45, nw.h, nw.z0 + 0.45); G.add(b); }
      { const b = basket(0.18, 0.3); b.position.set(nw.x1 - 0.4, nw.h, nw.z0 + 0.35); G.add(b); }
      { const bw = bowl(0.18); bw.position.set(nw.x0 + 1.2, nw.h, nw.z0 + 0.5); G.add(bw); }
    } else { const b = basket(0.22, 0.4); b.position.set(nw.x0 + 0.3, 0, nw.z1 + 0.35); G.add(b); }
    { const q = quern(); q.position.set(hearth.x + 1.0, 0, hearth.z + 0.2); q.rotation.y = rnd(); G.add(q); }
    { const cb = clayBalls(9); cb.position.set(ovenX + 0.75, 0, R.z1 - 1.0); G.add(cb); }
    { const ob = obsidianBlades(7); ob.position.set(hearth.x - 0.5, 0.012, hearth.z - 0.6); G.add(ob); const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), M.mat); sm.rotation.x = -Math.PI / 2; sm.position.set(hearth.x - 0.5, 0.008, hearth.z - 0.6); G.add(sm); }
    { const hd = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), M.hide); hd.rotation.x = -Math.PI / 2; hd.rotation.z = 0.3; hd.position.set((ne.x0 + ne.x1) / 2, ne.h + 0.01, (ne.z0 + ne.z1) / 2 + 0.1); G.add(hd); }
    if (rnd() < 0.6) { const a = antler(); a.position.set(R.x0 + 0.1, 1.3, R.z0 + L * 0.65); a.rotation.z = -0.9; G.add(a); }
    // a hide on its stretching frame leaning on the wall near the ladder, and a rope from the rafters
    if (rnd() < 0.7) {
      const hf = hideFrame();
      const eastFree = !nearDoor('E', Math.max(R.z0 + 1.9, R.z1 - 2.1), 0.9);
      if (eastFree) { hf.position.set(R.x1 - 0.34, 0, Math.max(R.z0 + 1.9, R.z1 - 2.1)); hf.rotation.y = -Math.PI / 2; hf.rotateOnAxis(new THREE.Vector3(1, 0, 0), -0.2); }
      else { hf.position.set(ovenX - 0.95, 0, R.z1 - 0.34); hf.rotation.y = Math.PI; hf.rotateOnAxis(new THREE.Vector3(1, 0, 0), -0.2); }
      G.add(hf);
    }
    { const tall = basket(0.24, 0.62); tall.position.set(R.x1 - 0.45, 0, Math.max(R.z0 + 1.0, R.z1 - 2.9)); if (!nearDoor('E', tall.position.z, 0.8)) G.add(tall); }
    // a few bone tools on the east platform
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.16 + rnd() * 0.08, 5), M.bone); t.rotation.set(Math.PI / 2, 0, rnd() * 3); t.position.set(ne.x1 - 0.4 - rnd() * 0.3, ne.h + 0.012, ne.z0 + 0.3 + rnd() * 0.5); G.add(t); }

    // --- decoration by kind ---
    const red = M.red;
    if (kind === 'plain') {
      if (rnd() < 0.45) { const side = rnd() < 0.6 ? 'N' : 'E'; const len = wallLen(side, R); hang(G, side, R, 0, 0.0, 0.0, len, 0.2 + rnd() * 0.15, red, 0.006); }
      // red-and-white geometric panel over a platform (as in the Killackey cutaway)
      const pr = rnd();
      if (pr < 0.3) hang(G, 'N', R, 0, 0.3, nw.h + 0.5, Math.min(1.6, W - 0.6), 0.5, paintMat(P.kilim(Math.min(1.6, W - 0.6), 0.5, Math.floor(rnd() * 3))));
      else if (pr < 0.55) { const pw = Math.min(1.8, L - 1.5); hang(G, 'E', R, 0, 0.2, ne.h + 0.45, pw, 0.55, paintMat(P.kilim(pw, 0.55, Math.floor(rnd() * 3)))); }
      // small red hunters and animals on the wall by the ladder (as in the Grant Cox model)
      if (rnd() < 0.3) { const pw = Math.min(1.3, L - 2.6); if (pw > 0.7 && (!doorW || doorW.z1 < R.z1 - 2.6)) hang(G, 'W', R, 0, 0.3, 0.9, pw, 0.5, paintMat(P.huntDeer(pw, 0.5))); }
      if (rnd() < 0.15) { const b = bucranium(1.0); b.position.set(R.x0 + 0.05, 1.3, R.z0 + L * 0.5); b.rotation.y = Math.PI / 2; G.add(b); }
    } else if (kind === 'b77') {
      // red dado on N and E walls, continuing over the NE platform faces
      hang(G, 'N', R, 0, 0, 0, W, 0.24, red, 0.006); hang(G, 'E', R, 0, 0, 0, L, 0.18, red, 0.006);
      // horned pedestals on the S and W edges of the NE platform
      for (const [px, pz, ry] of [[(ne.x0 + ne.x1) / 2, ne.z1 - 0.15, 0], [ne.x0 + 0.15, (ne.z0 + ne.z1) / 2, Math.PI / 2]]) {
        box(G, red, px - 0.2, ne.h, pz - 0.13, px + 0.2, ne.h + 0.28, pz + 0.13);
        const hp = hornPair(0.34); hp.position.set(px, ne.h + 0.28, pz); hp.rotation.y = ry; G.add(hp);
      }
      // ram's skull over the small niche, red frame drawn above
      const ram = bucranium(0.5, true); ram.scale.set(0.65, 0.65, 0.65); ram.position.set(R.x0 + 0.45, 1.6, R.z0 + 0.03); G.add(ram);
      // twelve red right hands along the north wall
      hang(G, 'N', R, 0, 0.8, 1.25, Math.min(2.6, W - 1.0), 0.32, paintMat(P.hands(Math.min(2.6, W - 1.0), 0.32, 12, 0)));
      // incised geometric panel west of the alcove
      hang(G, 'N', R, 0, 0.1, 0.5, Math.max(0.6, W / 2 - 0.6), 0.4, paintMat(P.incised(Math.max(0.6, W / 2 - 0.6), 0.4)));
      // east wall: two engaged pillars with red/black geometric panels between them
      for (const z of [R.z0 + 0.9, R.z0 + 2.1]) { if (nearDoor('E', z, 0.4)) continue; box(G, M.plaster, R.x1 - 0.22, 0, z - 0.14, R.x1, 2.0, z + 0.14); addSolid(R.x1 - 0.22, 0, z - 0.14, R.x1, 2.0, z + 0.14); }
      hang(G, 'E', R, 0, 1.1, 0.75, 0.9, 0.45, paintMat(P.kilim(0.9, 0.45, 1)));
      hang(G, 'E', R, 0, 2.4, 1.1, 0.3, 0.32, paintMat(P.hands(0.3, 0.32, 1, 0)));
      // beam stub projecting over the platform
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 7), M.plaster); stub.rotation.z = Math.PI / 2; stub.position.set(R.x1 - 0.15, 1.7, R.z0 + 1.5); G.add(stub);
    } else if (kind === 'b80') {
      // bench on the south part of the E wall with a pair of horn cores
      let bz0 = Math.min(R.z1 - 3.2, R.z0 + L * 0.55);
      if (doorsE.some((d) => bz0 + 1.1 > d.z0 - 0.1 && bz0 < d.z1 + 0.1)) bz0 = Math.max(R.z0 + neD + 0.1, Math.min(...doorsE.map((d) => d.z0)) - 1.3);
      bz0 = Math.max(bz0, R.z0 + neD + 0.1);
      box(G, M.plaster, R.x1 - 0.42, 0, bz0, R.x1, 0.45, bz0 + 1.1); addSolid(R.x1 - 0.42, 0, bz0, R.x1, 0.45, bz0 + 1.1);
      const hp = hornPair(0.3); hp.position.set(R.x1 - 0.21, 0.45, bz0 + 0.55); hp.rotation.y = Math.PI / 2; G.add(hp);
      hang(G, 'E', R, 0, uOf('E', R, 0, bz0), 0, 1.1, 0.45, red, 0.006);
      // tripartite E wall: horizontal grooves at 0.5 and 0.9 m
      for (const y of [0.5, 0.9]) { const g = new THREE.PlaneGeometry(L, 0.022); g.translate(L / 2, y, 0); G.add(wallMesh(g, 'E', R, 0, M.groove, 0.006)); }
      // brick motif panel above the central east platform
      hang(G, 'E', R, 0, uOf('E', R, 0, R.z0 + neD + 0.1), 0.18, 1.3, 0.55, paintMat(P.brickMotif(1.3, 0.55)));
      // three-post plastered installation on the W wall with a goat skull
      const iz = nearDoor('W', R.z0 + L * 0.45, 0.8) ? R.z0 + nwD + 0.6 : R.z0 + L * 0.45;
      for (const z of [iz - 0.35, iz, iz + 0.35]) { box(G, M.plaster, R.x0, 0, z - 0.1, R.x0 + 0.22, 1.7, z + 0.1); }
      box(G, M.plaster, R.x0, 1.7, iz - 0.5, R.x0 + 0.3, 1.82, iz + 0.5);
      addSolid(R.x0, 0, iz - 0.45, R.x0 + 0.22, 1.7, iz + 0.45);
      const goat = bucranium(0.45, true); goat.scale.set(0.5, 0.5, 0.5); goat.position.set(R.x0 + 0.3, 1.45, iz); goat.rotation.y = Math.PI / 2; G.add(goat);
      // four red spots on the W wall
      for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.CircleGeometry(0.06, 10), red); G.add(wallMesh(sp.geometry.clone().translate(0.6 + i * 0.3, 1.3, 0), 'W', R, 0, red, 0.006)); }
      // child's handprints near the oven on the south wall
      hang(G, 'S', R, 0, uOf('S', R, ovenX + 0.9, 0), 0.6, 0.5, 0.2, paintMat(P.hands(0.5, 0.2, 3, 0)));
    } else if (kind === 'hunters') {
      const ph = 1.35;
      hang(G, 'N', R, 0, 0.05, nw.h + 0.05, W - 0.1, ph, paintMat(P.hunt(W - 0.1, ph)));
      hang(G, 'W', R, 0, 0.05, 0.3, L - 0.1, ph, paintMat(P.huntDeer(L - 0.1, ph)));
      hang(G, 'E', R, 0, 0.05, 0.3, L - 0.1, ph, paintMat(P.huntDeer(L - 0.1, ph)));
      // bench on E wall (kept clear of the ladder foot in the south-east corner)
      { const bz1 = Math.min(R.z0 + neD + 1.4, R.z1 - 2.1); if (bz1 - (R.z0 + neD + 0.2) > 0.6) { box(G, M.plaster, R.x1 - 0.4, 0, R.z0 + neD + 0.2, R.x1, 0.4, bz1); addSolid(R.x1 - 0.4, 0, R.z0 + neD + 0.2, R.x1, 0.4, bz1); } }
    } else if (kind === 'vultures') {
      hang(G, 'E', R, 0, 0.05, 0.55, L - 0.1, 1.4, paintMat(P.vultures(L - 0.1, 1.4, Math.max(2, Math.round((L - 0.1) / 1.6)))));
      hang(G, 'N', R, 0, 0.05, nw.h + 0.35, W - 0.1, 1.3, paintMat(P.vultures(W - 0.1, 1.3, Math.max(2, Math.round((W - 0.1) / 1.6)))));
      const b = bucranium(1.2); b.position.set(R.x0 + 0.05, 1.25, R.z0 + L * 0.5); b.rotation.y = Math.PI / 2; G.add(b);
    } else if (kind === 'leopards') {
      // red panel with the leopard pair above it, on the north wall
      const pw = Math.min(3.4, W - 0.4), u0 = (W - pw) / 2;
      hang(G, 'N', R, 0, u0, nw.h + 0.25, pw, 0.5, red, 0.006);
      const lA = leopard(false), lB = leopard(true);
      lA.position.set(R.x0 + u0 + pw * 0.26, nw.h + 0.85, R.z0 + 0.002); lB.position.set(R.x0 + u0 + pw * 0.74, nw.h + 0.85, R.z0 + 0.002);
      G.add(lA, lB);
      // splayed figure on the west wall
      const sf = splayedFigure(); sf.rotation.y = Math.PI / 2; sf.position.set(R.x0 + 0.002, 1.25, R.z0 + L * 0.5); G.add(sf);
      // bull's head on a low pedestal below it
      const bz = nearDoor('W', R.z0 + L * 0.5, 0.7) ? R.z0 + nwD + 0.5 : R.z0 + L * 0.5;
      sf.position.z = bz;
      box(G, M.plaster, R.x0, 0, bz - 0.3, R.x0 + 0.35, 0.35, bz + 0.3); addSolid(R.x0, 0, bz - 0.3, R.x0 + 0.35, 0.35, bz + 0.3);
      const bh = bucranium(1.1); bh.position.set(R.x0 + 0.05, 0.55, bz); bh.rotation.y = Math.PI / 2; G.add(bh);
      // goats and tree below, east wall
      hang(G, 'E', R, 0, 0.3, 0.5, Math.min(2.0, L - 0.6), 0.6, paintMat(P.goatsTree(Math.min(2.0, L - 0.6), 0.6)));
    } else if (kind === 'map') {
      const pw = Math.min(2.7, W - 0.3);
      hang(G, 'N', R, 0, W - pw - 0.15, ne.h + 0.25, pw, 0.95, paintMat(P.volcanoMap(pw, 0.95)));
      hang(G, 'E', R, 0, 0.2, 1.1, Math.min(1.6, L - 0.5), 0.5, paintMat(P.kilim(Math.min(1.6, L - 0.5), 0.5, 2)));
      hang(G, 'W', R, 0, 0.3, 0.9, Math.min(1.2, L - 0.6), 0.6, paintMat(P.circles(Math.min(1.2, L - 0.6), 0.6)));
    }

    // --- light shaft from the hatch (geometry rebuilt when the sun moves) ---
    const shaft = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xfff0cf, transparent: true, opacity: 0.085, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    shaft.name = 'shaft'; shaft.frustumCulled = false;
    G.add(shaft);

    mergeByMaterial(G);
    G.position.y = h.floorY;
    G.applyMatrix4(Msector);
    G.updateMatrixWorld(true);
    parent.add(G);

    // registry entry for runtime (inside test, fire, captions)
    const hw = worldPt(s, hearth.x, h.floorY + 0.25, hearth.z);
    const hatchW = worldPt(s, hatchCx, h.roofY, (hatch.z0 + hatch.z1) / 2);
    const entry = {
      h, s, group: G, kind, caption: CAPTIONS[kind] || CAPTIONS.plain, grave: !!grave, doors,
      hearth: hw, hatchWorld: hatchW, shaft, solids,
      // local hatch rectangle corners (for shaft rebuild)
      hatchLocal: { x0: hatch.x0, x1: hatch.x1, z0: hatch.z0, z1: hatch.z1, yTop: h.roofY, yFloor: h.floorY },
      inside(x, z, y) {
        const dx = x - s.cx, dz = z - s.cz;
        const lx = s.c * dx + s.s * dz, lz = -s.s * dx + s.c * dz;
        return lx > h.x0 && lx < h.x1 && lz > h.z0 && lz < h.z1 && y < h.roofY - 0.4 && y > h.floorY - 0.5;
      },
    };
    registry.push(entry);
    return entry;
  };
}

// Tear down an interior built by the builder: scene graph, GPU buffers, collision.
export function disposeInterior(entry, registry, world) {
  const G = entry.group;
  if (G.parent) G.parent.remove(G);
  G.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    if (o.material && o.material.userData && o.material.userData.disposable) o.material.dispose();
    if (o === entry.shaft) o.material.dispose();
  });
  for (const s of entry.solids) world.removeBox(s);
  const i = registry.indexOf(entry); if (i >= 0) registry.splice(i, 1);
}

// Collapse the hundreds of small meshes of an interior into one mesh per material.
function mergeByMaterial(G) {
  G.updateMatrixWorld(true);
  const buckets = new Map();
  const keep = [];
  G.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === 'shaft' || !o.geometry.attributes.position || !o.geometry.attributes.uv) { keep.push(o); return; }
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    if (g.attributes.color) g.deleteAttribute('color');
    // bake the transform relative to G
    const m = new THREE.Matrix4().copy(G.matrixWorld).invert().multiply(o.matrixWorld);
    g.applyMatrix4(m);
    if (!buckets.has(o.material)) buckets.set(o.material, { geos: [], shadow: o.castShadow });
    buckets.get(o.material).geos.push(g);
  });
  const kept = new Set(keep);
  for (const c of G.children.slice()) if (!kept.has(c)) G.remove(c);
  for (const k of keep) { if (k.parent !== G) { const mw = k.matrixWorld.clone(); G.add(k); k.matrix.copy(new THREE.Matrix4().copy(G.matrixWorld).invert().multiply(mw)); k.matrix.decompose(k.position, k.quaternion, k.scale); } }
  for (const [mat, b] of buckets) {
    const merged = mergeGeometries(b.geos);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    G.add(mesh);
  }
}

// Rebuild the light-shaft prisms for a given world-space sun direction.
export function updateShafts(registry, sunDir) {
  for (const e of registry) {
    if (e.static) continue;
    const { x0, x1, z0, z1, yTop, yFloor } = e.hatchLocal;
    const s = e.s;
    const top = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => worldPt(s, x, yTop, z));
    // sun direction points from the scene towards the sun; light travels along -sunDir
    const d = sunDir.clone().normalize();
    const drop = yTop - yFloor;
    // project the hatch down the sun's rays onto the floor, but keep the patch inside the main room
    const R = e.h.main, s2 = e.s;
    const bottom = top.map((p) => {
      const w = new THREE.Vector3(p.x - d.x / d.y * drop, yFloor, p.z - d.z / d.y * drop);
      const dx = w.x - s2.cx, dz = w.z - s2.cz;
      let lx = s2.c * dx + s2.s * dz, lz = -s2.s * dx + s2.c * dz;
      lx = Math.max(R.x0 + 0.05, Math.min(R.x1 - 0.05, lx)); lz = Math.max(R.z0 + 0.05, Math.min(R.z1 - 0.05, lz));
      return worldPt(s2, lx, yFloor, lz);
    });
    const pos = [];
    for (let i = 0; i < 4; i++) {
      const a = top[i], b = top[(i + 1) % 4], c = bottom[(i + 1) % 4], dd = bottom[i];
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, dd.x, dd.y, dd.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    // fade alpha towards the floor using vertex colors is not supported by MeshBasic alpha; keep constant
    e.shaft.geometry.dispose();
    e.shaft.geometry = g;
    // shaft lives in the interior group which is transformed: compensate by using world coords and inverting the group matrix
    e.shaft.matrixAutoUpdate = false;
    e.shaft.matrix.copy(e.group.matrixWorld).invert();
    e.shaft.matrixWorldNeedsUpdate = true;
    // light patch on the floor: brighter spot
    e.floorPatch = bottom;
  }
}

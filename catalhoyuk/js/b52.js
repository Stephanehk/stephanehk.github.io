// Building 52, after the reconstruction by Alicia Walsh (Sketchfab, CC BY 4.0), built from the excavated plan
// (Wright 2014; Çatalhöyük Research Project). Stands in the town as a house in the course of rebuilding:
// walls up, store rooms roofed, the central room still open to the sky under its shade canopies.
import * as THREE from 'three';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';
import { ladderGeo, LADDER_ANGLE, scaleUV, worldPt, worldDir, sectorMatrix } from './town.js';
import { gravePit, burialLayout } from './burial.js';

const WALL_TOP = 2.0;   // the model's walls
export const ASSET_V = '3';

export async function buildB52(plot, tex, world, parent, rnd, registry) {
  const [meta, buf] = await Promise.all([
    fetch('./assets/b52/b52.json?v=' + ASSET_V).then((r) => r.json()),
    fetch('./assets/b52/b52.bin?v=' + ASSET_V).then((r) => r.arrayBuffer()),
  ]);
  const s = plot.sector;
  const floorY = plot.floorY;
  // the model's footprint centre goes to the plot centre
  const b = meta.bounds;
  const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  const px = (plot.x0 + plot.x1) / 2, pz = (plot.z0 + plot.z1) / 2;
  const G = new THREE.Group(); G.name = 'building52';
  const M = new THREE.Matrix4().makeTranslation(px - cx, floorY, pz - cz);
  // decode: int16 xyz (mm), uint16 uv
  const dv = new DataView(buf);
  const n = meta.vertexCount;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const o = i * 10;
    pos[i * 3] = dv.getInt16(o, true) / 1000; pos[i * 3 + 1] = dv.getInt16(o + 2, true) / 1000; pos[i * 3 + 2] = dv.getInt16(o + 4, true) / 1000;
    uv[i * 2] = dv.getUint16(o + 6, true) / 65535; uv[i * 2 + 1] = dv.getUint16(o + 8, true) / 65535;
  }
  const mats = {
    wall_plaster: tex.loam ? new THREE.MeshStandardMaterial({ map: tex.loam, normalMap: tex.loamN, normalScale: new THREE.Vector2(0.6, 0.6), color: 0xf2e9da, roughness: 1 })
                           : new THREE.MeshStandardMaterial({ map: tex.white, roughness: 1 }),
    wood: tex.timber ? new THREE.MeshStandardMaterial({ map: tex.timber, normalMap: tex.timberN, roughness: 0.9 }) : new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.9 }),
  };
  for (const [name, range] of Object.entries(meta.materials)) {
    const g = new THREE.BufferGeometry();
    const P = pos.subarray(range.first * 3, (range.first + range.count) * 3);
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    // the model's own UVs are stretched; project the textures by face orientation instead (metres per tile below)
    const tile = name === 'wood' ? 0.6 : 2.0;
    const U = new Float32Array(range.count * 2);
    for (let t = 0; t < range.count; t += 3) {
      const ax = P[t * 3 + 3] - P[t * 3], ay = P[t * 3 + 4] - P[t * 3 + 1], az = P[t * 3 + 5] - P[t * 3 + 2];
      const bx = P[t * 3 + 6] - P[t * 3], by = P[t * 3 + 7] - P[t * 3 + 1], bz = P[t * 3 + 8] - P[t * 3 + 2];
      const nx = Math.abs(ay * bz - az * by), ny = Math.abs(az * bx - ax * bz), nz = Math.abs(ax * by - ay * bx);
      for (let k = 0; k < 3; k++) {
        const x = P[(t + k) * 3], y = P[(t + k) * 3 + 1], z = P[(t + k) * 3 + 2];
        if (nx >= ny && nx >= nz) { U[(t + k) * 2] = z / tile; U[(t + k) * 2 + 1] = y / tile; }
        else if (ny >= nz) { U[(t + k) * 2] = x / tile; U[(t + k) * 2 + 1] = z / tile; }
        else { U[(t + k) * 2] = x / tile; U[(t + k) * 2 + 1] = y / tile; }
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mats[name] || mats.wall_plaster);
    mesh.castShadow = mesh.receiveShadow = true; mesh.name = 'b52-' + name;
    G.add(mesh);
  }
  // floors: the main room is open earth and plaster; store rooms get plaster floors
  const floorMat = tex.dirt ? new THREE.MeshStandardMaterial({ map: tex.dirt, color: 0xe4d8c2, roughness: 1 }) : new THREE.MeshStandardMaterial({ map: tex.soil, roughness: 1 });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(b.max[0] - b.min[0], b.max[2] - b.min[2]), floorMat);
  scaleUV(fl.geometry, (b.max[0] - b.min[0]) / 2.5, (b.max[2] - b.min[2]) / 2.5);
  fl.rotation.x = -Math.PI / 2; fl.position.set(cx, 0.003, cz); fl.receiveShadow = true; G.add(fl);
  // shade canopies: mats of reeds and straw on the model's poles (the original strands are far too heavy for the web)
  const strawMat = new THREE.MeshStandardMaterial({ map: tex.reed, color: 0xd8c488, roughness: 1, side: THREE.DoubleSide });
  const canopies = [[-4.32, 3.45, -0.16, -2.21, 3.67, 2.05], [-1.3, 3.38, -5.01, 0.49, 3.62, -3.03]];
  for (const [x0, y0, z0, x1, y1, z1] of canopies) {
    const g = new THREE.BoxGeometry(x1 - x0 + 0.2, 0.1, z1 - z0 + 0.2); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const m = new THREE.Mesh(g, strawMat); m.castShadow = true; m.receiveShadow = true; G.add(m);
  }
  // small straw heaps on the roofs become baskets of reeds
  for (const [x0, y0, z0, x1, y1, z1] of [[-4.04, 2.14, 0.84, -3.59, 2.79, 1.37], [1.84, 2.0, 2.1, 2.47, 2.69, 2.97], [-2.82, 2.13, -4.75, -2.08, 2.8, -3.95]]) {
    const g = new THREE.CylinderGeometry((x1 - x0) / 2, (x1 - x0) / 2.6, 0.5, 10, 1, true); g.translate((x0 + x1) / 2, y0 + 0.25, (z0 + z1) / 2);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex.basket, roughness: 1, side: THREE.DoubleSide })); m.castShadow = true; G.add(m);
    const top = new THREE.Mesh(new THREE.CylinderGeometry((x1 - x0) / 2 + 0.06, (x1 - x0) / 2, 0.22, 10), strawMat); top.position.set((x0 + x1) / 2, y0 + 0.6, (z0 + z1) / 2); G.add(top);
  }
  // the multiple burial opened in the north-west platform: the platform's plaster has been cut away over the pit
  // (the opening is cut out of the model's geometry in the asset), an adult and children laid tightly flexed below
  if (meta.burialPit) {
    const P = meta.burialPit, gw = P.x1 - P.x0, gd = P.z1 - P.z0, gx = (P.x0 + P.x1) / 2, gz = (P.z0 + P.z1) / 2, depth = 0.62;
    const mats2 = { earth: new THREE.MeshStandardMaterial({ map: tex.dirt || tex.soil, color: 0x5e4e3e, roughness: 1 }), earthWall: new THREE.MeshStandardMaterial({ map: tex.dirt || tex.soil, color: 0x7a6752, roughness: 1 }), matting: new THREE.MeshStandardMaterial({ map: tex.mat, color: 0x6a553c, roughness: 1 }), bone: new THREE.MeshStandardMaterial({ color: 0xf2eadb, roughness: 0.7 }), wood: mats.wood };
    const pit = gravePit(mats2, rnd, gw, gd, depth, burialLayout(rnd, true), 1);
    pit.position.set(gx, P.top - depth, gz);
    G.add(pit);
    // the earth dug out, heaped on the platform beside the grave
    const spoil = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), floorMat); spoil.scale.set(1.3, 0.45, 1); spoil.position.set(P.x1 + 0.45, P.top, gz + 0.1); spoil.castShadow = true; G.add(spoil);
  }
  G.applyMatrix4(M); G.applyMatrix4(sectorMatrix(s)); G.updateMatrixWorld(true);   // model -> plot (sector-local) -> world
  parent.add(G);

  // ---- collision, in a frame of its own (the model is axis-aligned to within 3°) ----
  const worldC = worldPt(s, px - cx, 0, pz - cz);     // world position of the model origin
  const fi = world.addFrame(worldC.x, worldC.z, s.angle);
  const base = floorY - 1.4;
  world.addBox(fi, b.min[0] - 0.05, base, b.min[2] - 0.05, b.max[0] + 0.05, floorY, b.max[2] + 0.05, 'b52');
  for (const [x0, z0, x1, z1] of meta.wallBoxes) world.addBox(fi, x0, floorY - 0.1, z0, x1, floorY + WALL_TOP, z1, 'b52');
  // platforms and roofs over the store rooms (the west strip and the north room)
  for (const o of meta.objects) {
    const w = o.max[0] - o.min[0], d = o.max[2] - o.min[2];
    if (o.name.toLowerCase().startsWith('platform')) world.addBox(fi, o.min[0], floorY, o.min[2], o.max[0], floorY + o.max[1], o.max[2], 'b52');
    else if (o.name.startsWith('wall') && w * d > 2.5 && (o.max[0] < 0.7 || o.min[2] > 3.3)) world.addBox(fi, o.min[0], floorY + WALL_TOP - 0.22, o.min[2], o.max[0], floorY + WALL_TOP, o.max[2], 'b52');
  }
  for (const [x0, y0, z0, x1, y1, z1] of canopies) {
    for (const [x, z] of [[x0 + 0.1, z0 + 0.1], [x1 - 0.1, z0 + 0.1], [x0 + 0.1, z1 - 0.1], [x1 - 0.1, z1 - 0.1]]) world.addBox(fi, x - 0.06, floorY + WALL_TOP, z - 0.06, x + 0.06, floorY + y1, z + 0.06, 'post');
  }
  // the model's ladders: floor to the east platforms, platform to the west roof, and the one in the room up to the roofs
  const ladders = [
    { x: 1.05, z: -1.62, yb: 0, yt: 1.0, ex: 0, ez: -1 },        // up onto the raised platforms
    { x: -1.0, z: -1.0, yb: 0.82, yt: WALL_TOP, ex: -1, ez: 0 },   // from the west platform onto the store-room roofs
    { x: 2.02, z: 1.36, yb: 0, yt: WALL_TOP, ex: 1, ez: 0 },       // the tall ladder in the central room up to the wall tops
  ];
  for (const L of ladders) {
    const w = worldPt(s, px - cx + L.x, 0, pz - cz + L.z); const e = worldDir(s, L.ex, L.ez);
    world.addLadder(w.x, w.z, floorY + L.yb, floorY + L.yt, e.x, e.z, 0.8, w.x + e.x * 0.3, w.z + e.z * 0.3);
  }
  // a ladder from the west roof up to the nearest neighbouring roof, so the house connects to the roofscape
  const neighbours = s.houses.filter((h) => h.x1 > plot.x0 - 0.5 && h.x0 < plot.x1 + 0.5 && h.z1 > plot.z0 - 0.5 && h.z0 < plot.z1 + 0.5);
  let link = null;
  for (const h of neighbours) {
    // west neighbour sharing the plot's west edge
    if (Math.abs(h.x1 - plot.x0) < 0.6 && h.z0 < plot.z1 - 1 && h.z1 > plot.z0 + 1) link = { h, side: 'W' };
    if (!link && Math.abs(h.z0 - plot.z1) < 0.6 && h.x0 < plot.x1 - 1 && h.x1 > plot.x0 + 1) link = { h, side: 'S' };
  }
  const extra = [];
  if (link) {
    const roof = floorY + WALL_TOP, H = link.h.roofY - roof;
    if (H > 0.6) {
      const run = H / Math.tan(LADDER_ANGLE);
      if (link.side === 'W') {
        const z = Math.max(link.h.z0 + 0.8, Math.min(link.h.z1 - 0.8, (plot.z0 + plot.z1) / 2 - 1.5));
        const tx = plot.x0 + 0.05, bx = tx + run;
        extra.push(ladderGeo(bx, roof, z, tx, link.h.roofY, z, 0.6));
        const mid = worldPt(s, (bx + tx) / 2, 0, z), e = worldDir(s, -1, 0), top = worldPt(s, tx, 0, z);
        world.addLadder(mid.x, mid.z, roof, link.h.roofY, e.x, e.z, 0.85, top.x, top.z);
      } else {
        const x = Math.max(link.h.x0 + 0.8, Math.min(link.h.x1 - 0.8, plot.x0 + 1.5));
        const tz = plot.z1 - 0.05, bz = tz - run;
        extra.push(ladderGeo(x, roof, bz, x, link.h.roofY, tz, 0.6));
        const mid = worldPt(s, x, 0, (bz + tz) / 2), e = worldDir(s, 0, 1), top = worldPt(s, x, 0, tz);
        world.addLadder(mid.x, mid.z, roof, link.h.roofY, e.x, e.z, 0.85, top.x, top.z);
      }
    }
  }
  if (extra.length) {
    const g = mergeGeometries(extra); g.applyMatrix4(new THREE.Matrix4().makeTranslation(s.cx, 0, s.cz).multiply(new THREE.Matrix4().makeRotationY(-s.angle)));
    const m = new THREE.Mesh(g, mats.wood); m.castShadow = true; parent.add(m);
  }
  // inside test for lighting: anywhere over the footprint below the wall tops counts as "inside"
  registry.push({
    h: null, s, group: G, kind: 'b52', caption: '', static: true,
    hearth: worldPt(s, px - cx + 0.95, floorY + 0.3, pz - cz + 0.34),
    hatchWorld: worldPt(s, px - cx + 2.0, floorY + WALL_TOP, pz - cz + 1.36),
    shaft: null, solids: [],
    inside(x, z, y) {
      const dx = x - s.cx, dz = z - s.cz; const lx = s.c * dx + s.s * dz, lz = -s.s * dx + s.c * dz;
      return lx > plot.x0 && lx < plot.x1 && lz > plot.z0 && lz < plot.z1 && y < floorY + WALL_TOP - 0.3 && y > floorY - 0.5;
    },
  });
  return G;
}

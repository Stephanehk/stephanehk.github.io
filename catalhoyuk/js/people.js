// Low-poly inhabitants in natural poses, merged into a single mesh.
import * as THREE from 'three';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';
import { addColor, worldPt } from './town.js';
import { terrainHeight } from './landscape.js';

const SKIN = [0x8b5a3c, 0x9c6b4a, 0x7a4d33, 0xa87858];
const CLOTH = [0xb3a284, 0xa08c6c, 0x8a6a4c, 0x6e5540, 0xbfb196, 0x9a8468, 0x5a4636, 0x7d6a52];
const HAIR = [0x1d1612, 0x2a1d14, 0x120e0b];

function cyl(rt, rb, h, color, segs = 7) { const g = new THREE.CylinderGeometry(rt, rb, h, segs); addColor(g, color); return g; }
function sph(r, color) { const g = new THREE.SphereGeometry(r, 9, 7); addColor(g, color); return g; }
function place(g, x, y, z, rx = 0, ry = 0, rz = 0) { g.rotateX(rx); g.rotateZ(rz); g.rotateY(ry); g.translate(x, y, z); return g; }

// returns a geometry of one figure standing at the origin facing +z, with its
// feet at y=0. pose: stand | sit | kneel | carry | squat
export function figureGeometry(rnd, pose) {
  const skin = new THREE.Color(SKIN[Math.floor(rnd() * SKIN.length)]);
  const cloth = new THREE.Color(CLOTH[Math.floor(rnd() * CLOTH.length)]);
  const hair = new THREE.Color(HAIR[Math.floor(rnd() * HAIR.length)]);
  const sc = 0.92 + rnd() * 0.14;
  const parts = [];
  const legH = 0.8, torsoH = 0.55, headR = 0.105;
  let hipY, lean = 0;
  if (pose === 'sit') {
    hipY = 0.3;
    // legs folded forward on the ground
    parts.push(place(cyl(0.07, 0.065, 0.5, skin), -0.12, 0.08, 0.28, Math.PI / 2 - 0.3));
    parts.push(place(cyl(0.07, 0.065, 0.5, skin), 0.12, 0.08, 0.28, Math.PI / 2 - 0.3));
    parts.push(place(cyl(0.17, 0.19, 0.3, cloth), 0, 0.17, 0.04));            // lap / skirt
  } else if (pose === 'kneel') {
    hipY = 0.45; lean = 0.55;
    parts.push(place(cyl(0.07, 0.065, 0.45, skin), -0.11, 0.07, -0.15, Math.PI / 2));
    parts.push(place(cyl(0.07, 0.065, 0.45, skin), 0.11, 0.07, -0.15, Math.PI / 2));
    parts.push(place(cyl(0.16, 0.18, 0.35, cloth), 0, 0.3, 0));
  } else if (pose === 'squat') {
    hipY = 0.42; lean = 0.25;
    parts.push(place(cyl(0.07, 0.06, 0.45, skin), -0.13, 0.25, 0.1, 0.9));
    parts.push(place(cyl(0.07, 0.06, 0.45, skin), 0.13, 0.25, 0.1, 0.9));
    parts.push(place(cyl(0.16, 0.2, 0.3, cloth), 0, 0.42, 0));
  } else {
    hipY = legH;
    const stride = pose === 'walk' ? 0.16 : 0.04;
    parts.push(place(cyl(0.07, 0.06, legH, skin), -0.1, legH / 2, 0, stride));
    parts.push(place(cyl(0.07, 0.06, legH, skin), 0.1, legH / 2, 0, -stride));
    if (rnd() < 0.6) parts.push(place(cyl(0.17, 0.24, 0.5, cloth), 0, legH - 0.2, 0));   // hide / woven skirt
  }
  // torso (leaning forward by `lean`)
  const torso = cyl(0.17, 0.15, torsoH, cloth, 9);
  torso.translate(0, torsoH / 2, 0); torso.rotateX(lean); torso.translate(0, hipY, 0);
  parts.push(torso);
  const shoulder = new THREE.Vector3(0, torsoH, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), lean).add(new THREE.Vector3(0, hipY, 0));
  // head + hair
  const headPos = shoulder.clone().add(new THREE.Vector3(0, headR * 1.2, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), lean));
  parts.push(place(sph(headR, skin), headPos.x, headPos.y, headPos.z));
  const hairG = new THREE.SphereGeometry(headR * 1.04, 9, 7, 0, Math.PI * 2, 0, Math.PI * 0.42); addColor(hairG, hair);
  parts.push(place(hairG, headPos.x, headPos.y + 0.01, headPos.z - 0.012, -0.55));
  // arms
  const armL = 0.56;
  const arm = (side, ax, az) => {
    const g = cyl(0.045, 0.04, armL, skin);
    g.translate(0, -armL / 2, 0); g.rotateX(ax); g.rotateZ(side * az);
    g.translate(side * 0.2, shoulder.y - 0.02, shoulder.z); parts.push(g);
  };
  if (pose === 'carry') { arm(-1, 0.1, -2.6); arm(1, 0.2, 0.25); const b = cyl(0.3, 0.22, 0.4, new THREE.Color(0xb48f5a), 10); b.translate(-0.05, headPos.y + headR + 0.2, 0); parts.push(b); }
  else if (pose === 'kneel') { arm(-1, -1.3, 0.1); arm(1, -1.3, 0.1); }
  else if (pose === 'sit') { arm(-1, -0.9, 0.15); arm(1, -0.6, 0.2); }
  else if (pose === 'squat') { arm(-1, -1.1, 0.2); arm(1, -1.1, 0.2); }
  else { arm(-1, 0.1 + rnd() * 0.3, 0.12); arm(1, -0.1 - rnd() * 0.4, 0.14); }
  const g = mergeGeometries(parts);
  g.scale(sc, sc, sc);
  return g;
}

export function buildPeople(town, world, rnd, startPos, pens) {
  const geos = [];
  const spots = [];
  const poses = ['stand', 'stand', 'walk', 'sit', 'sit', 'kneel', 'carry', 'squat'];
  for (const s of town.sectors) {
    for (const h of s.houses) {
      const d = Math.hypot(h.wx - startPos.x, h.wz - startPos.z);
      const p = d < 50 ? 0.34 : d < 120 ? 0.16 : 0.08;
      if (rnd() > p) continue;
      const w = h.x1 - h.x0, l = h.z1 - h.z0;
      if (w < 3.5 || l < 4) continue;
      let x, z, tries = 0, bad;
      do {
        x = h.x0 + 0.7 + rnd() * (w - 1.4); z = h.z0 + 0.7 + rnd() * (l - 1.4); tries++;
        bad = (x > h.hatch.x0 - 0.9 && z > h.hatch.z0 - 0.9) || h.ladders.some((L) => L.type === 'roof' && Math.hypot(L.bx - x, L.bz - z) < 1.4);
      } while (tries < 8 && bad);
      if (bad) continue;
      const wp0 = worldPt(s, x, h.roofY, z);
      if (Math.hypot(wp0.x - startPos.x, wp0.z - startPos.z) < 2.5) continue;
      if (h.upper && x > h.upper.x0 - 0.5 && x < h.upper.x1 + 0.5 && z > h.upper.z0 - 0.5 && z < h.upper.z1 + 0.5) continue;
      const pose = poses[Math.floor(rnd() * poses.length)];
      spots.push({ p: worldPt(s, x, h.roofY, z), pose, ry: rnd() * Math.PI * 2, fi: s.fi, lx: x, lz: z, y: h.roofY, s });
      // sometimes a companion
      if (rnd() < 0.3) spots.push({ p: worldPt(s, x + 0.9, h.roofY, z + 0.2), pose: poses[Math.floor(rnd() * poses.length)], ry: rnd() * Math.PI * 2, fi: s.fi, lx: x + 0.9, lz: z + 0.2, y: h.roofY, s });
    }
  }
  // herders by the pens and people in the open yards
  for (const g of pens) {
    for (let i = 0; i < 1 + Math.floor(rnd() * 2); i++) {
      const a = rnd() * Math.PI * 2, r = g.r + 1.2;
      const x = g.x + Math.cos(a) * r, z = g.z + Math.sin(a) * r;
      spots.push({ p: new THREE.Vector3(x, terrainHeight(x, z) + 0.1, z), pose: rnd() < 0.5 ? 'stand' : 'squat', ry: a + Math.PI, fi: 0, lx: x, lz: z, y: terrainHeight(x, z) + 0.1 });
    }
  }
  for (const sp of spots) {
    const g = figureGeometry(rnd, sp.pose);
    g.rotateY(sp.ry); g.translate(sp.p.x, sp.p.y, sp.p.z);
    geos.push(g);
    // small collision volume
    const hgt = sp.pose === 'stand' || sp.pose === 'walk' || sp.pose === 'carry' ? 1.6 : 0.9;
    world.addBox(sp.fi, sp.lx - 0.22, sp.y, sp.lz - 0.22, sp.lx + 0.22, sp.y + hgt, sp.lz + 0.22, 'person');
  }
  if (!geos.length) return null;
  const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'people';
  mesh.userData.count = spots.length;
  return mesh;
}

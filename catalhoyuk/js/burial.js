// Burials beneath the platforms, as excavated: tightly flexed bodies laid on their side in a pit cut
// through the plaster of a sleeping platform, sometimes several in one grave (Building 52's north-west
// platform held an adult man and at least five children, a wooden bowl set over one child's head).
import * as THREE from 'three';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';

// A flexed skeleton lying on its side, seen in plan: built flat in the XZ plane at y=0, head towards -x.
// `scale` 1 = adult; children 0.5–0.7. Returns a merged geometry.
export function flexedSkeleton(rnd, scale = 1) {
  const parts = [];
  const bone = (x0, z0, x1, z1, r) => {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
    const g = new THREE.CylinderGeometry(r * 1.5, r * 1.9, L, 5);
    g.translate(0, L / 2, 0);
    g.rotateZ(-Math.PI / 2);                         // along +x
    g.rotateY(-Math.atan2(dz, dx));
    g.translate(x0, r, z0);
    parts.push(g);
  };
  const s = scale;
  // skull: a flattened sphere with a jaw
  const skull = new THREE.SphereGeometry(0.085 * s, 10, 8); skull.scale(1.25, 0.8, 1); skull.translate(-0.42 * s, 0.07 * s, 0.02 * s); parts.push(skull);
  const jaw = new THREE.BoxGeometry(0.1 * s, 0.03 * s, 0.07 * s); jaw.translate(-0.36 * s, 0.03 * s, 0.07 * s); parts.push(jaw);
  // spine: an arc of vertebrae from the skull curving down to the pelvis
  const nV = 14;
  let px = -0.33 * s, pz = 0.0;
  for (let i = 0; i < nV; i++) {
    const t = i / nV;
    const ang = -0.1 + t * 0.9;                       // curving away
    const nx = px + Math.cos(ang) * 0.036 * s, nz = pz + Math.sin(ang) * 0.036 * s;
    const v = new THREE.CylinderGeometry(0.026 * s, 0.026 * s, 0.03 * s, 6); v.rotateZ(Math.PI / 2); v.rotateY(-ang); v.translate((px + nx) / 2, 0.02 * s, (pz + nz) / 2); parts.push(v);
    // ribs over the thorax
    if (i > 1 && i < 9) {
      const rib = new THREE.TorusGeometry(0.11 * s * (1 - Math.abs(i - 5) * 0.08), 0.011 * s, 5, 10, Math.PI * 0.9);
      rib.rotateX(Math.PI / 2); rib.rotateY(-ang + Math.PI * 0.55); rib.translate(px, 0.02 * s, pz + 0.1 * s);
      parts.push(rib);
    }
    px = nx; pz = nz;
  }
  // pelvis
  const pelvis = new THREE.SphereGeometry(0.075 * s, 8, 6); pelvis.scale(1.1, 0.5, 1.3); pelvis.translate(px + 0.02 * s, 0.03 * s, pz + 0.02 * s); parts.push(pelvis);
  // legs drawn up tightly: femur forward along the body, tibia folded back
  const hipX = px, hipZ = pz;
  const kneeX = hipX - 0.28 * s, kneeZ = hipZ + 0.33 * s;
  const ankleX = hipX + 0.02 * s, ankleZ = hipZ + 0.36 * s;
  for (const off of [0, 0.05 * s]) {
    bone(hipX, hipZ + off, kneeX, kneeZ + off, 0.016 * s);
    bone(kneeX, kneeZ + off, ankleX, ankleZ + off, 0.013 * s);
    const foot = new THREE.BoxGeometry(0.16 * s, 0.025 * s, 0.05 * s); foot.translate(ankleX + 0.06 * s, 0.013 * s, ankleZ + off); parts.push(foot);
  }
  // arms folded before the chest, hands near the face
  const shX = -0.26 * s, shZ = 0.03 * s;
  bone(shX, shZ, shX - 0.02 * s, shZ + 0.26 * s, 0.013 * s);
  bone(shX - 0.02 * s, shZ + 0.26 * s, shX - 0.2 * s, shZ + 0.1 * s, 0.011 * s);
  bone(shX + 0.02 * s, shZ + 0.04 * s, shX + 0.04 * s, shZ + 0.24 * s, 0.013 * s);
  bone(shX + 0.04 * s, shZ + 0.24 * s, shX - 0.16 * s, shZ + 0.15 * s, 0.011 * s);
  const g = mergeGeometries(parts);
  if (rnd) g.rotateY((rnd() - 0.5) * 0.3);
  return g;
}

// A grave pit with its occupants, built flat at y=0 (the floor of the pit), centred on the origin.
// `bodies` is a list of { scale, dx, dz, rot }. Returns a Group.
export function gravePit(mats, rnd, w, d, depth, bodies, bowlOver = -1) {
  const G = new THREE.Group();
  // pit floor of brown earth and the four cut faces
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mats.earth); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; G.add(floor);
  const side = (sx, sz, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, depth), mats.earthWall); m.position.set(x, depth / 2, z); m.rotation.y = ry; G.add(m); };
  side(w, depth, 0, -d / 2, 0); side(w, depth, 0, d / 2, Math.PI); side(d, depth, -w / 2, 0, Math.PI / 2); side(d, depth, w / 2, 0, -Math.PI / 2);
  // a reed mat the body was wrapped in
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, d * 0.8), mats.matting); mat.rotation.x = -Math.PI / 2; mat.position.y = 0.004; mat.rotation.z = (rnd() - 0.5) * 0.3; G.add(mat);
  bodies.forEach((b, i) => {
    const sk = new THREE.Mesh(flexedSkeleton(rnd, b.scale), mats.bone);
    sk.position.set(b.dx, 0.006, b.dz); sk.rotation.y = b.rot; sk.castShadow = true; G.add(sk);
    if (i === bowlOver) {
      // wooden bowl set upside down over the head
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * b.scale + 0.04, 0.07 * b.scale + 0.03, 0.07, 12, 1, false), mats.wood);
      const hx = b.dx + Math.cos(b.rot) * -0.42 * b.scale, hz = b.dz - Math.sin(b.rot) * -0.42 * b.scale;
      bowl.position.set(hx, 0.04, hz); bowl.rotation.x = Math.PI; bowl.castShadow = true; G.add(bowl);
    }
  });
  return G;
}

// Body layout for a single adult, or an adult with children packed around (Building 52 style)
export function burialLayout(rnd, multiple) {
  if (!multiple) return [{ scale: 0.95 + rnd() * 0.1, dx: 0, dz: 0, rot: (rnd() - 0.5) * 0.4 }];
  const out = [{ scale: 1.0, dx: 0.05, dz: -0.08, rot: 0.1 }];
  const n = 4 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
    out.push({ scale: 0.45 + rnd() * 0.25, dx: Math.cos(a) * 0.33, dz: Math.sin(a) * 0.26, rot: a + Math.PI / 2 + (rnd() - 0.5) * 0.6 });
  }
  return out;
}

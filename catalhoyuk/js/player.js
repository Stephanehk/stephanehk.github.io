// First-person controller with box collision (boxes may live in rotated
// frames), step-up, crouching/crawling and ladders.
import * as THREE from 'three';

export const STAND_H = 1.70, CROUCH_H = 0.78, RADIUS = 0.26, STEP_H = 0.55;
const WALK = 3.0, RUN = 5.4, CLIMB = 1.9, GRAVITY = 18, JUMP = 4.4;

export class CollisionWorld {
  constructor(cell = 8) {
    this.cell = cell;
    this.grid = new Map();
    this.solids = [];
    this.ladders = [];
    this.frames = [{ cx: 0, cz: 0, c: 1, s: 0 }]; // frame 0 = world axes
    this.groundFn = () => 0;
    this._q = [];
  }
  addFrame(cx, cz, angle) {
    this.frames.push({ cx, cz, c: Math.cos(angle), s: Math.sin(angle) });
    return this.frames.length - 1;
  }
  // world -> frame-local
  toLocal(f, x, z, out) {
    const dx = x - f.cx, dz = z - f.cz;
    out.x = f.c * dx + f.s * dz; out.z = -f.s * dx + f.c * dz; return out;
  }
  toWorldVec(f, lx, lz, out) { out.x = f.c * lx - f.s * lz; out.z = f.s * lx + f.c * lz; return out; }
  key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }
  // box given in local coords of frame fi: min/max are plain {x,y,z}
  addBox(fi, minx, miny, minz, maxx, maxy, maxz, tag) {
    const f = this.frames[fi];
    const s = { fi, min: { x: minx, y: miny, z: minz }, max: { x: maxx, y: maxy, z: maxz }, tag, cells: [] };
    this.solids.push(s);
    // world bounds for the broadphase
    let wx0 = Infinity, wx1 = -Infinity, wz0 = Infinity, wz1 = -Infinity;
    const t = { x: 0, z: 0 };
    for (const [lx, lz] of [[minx, minz], [maxx, minz], [minx, maxz], [maxx, maxz]]) {
      this.toWorldVec(f, lx, lz, t);
      const wx = t.x + f.cx, wz = t.z + f.cz;
      wx0 = Math.min(wx0, wx); wx1 = Math.max(wx1, wx); wz0 = Math.min(wz0, wz); wz1 = Math.max(wz1, wz);
    }
    const c = this.cell;
    for (let ix = Math.floor(wx0 / c); ix <= Math.floor(wx1 / c); ix++)
      for (let iz = Math.floor(wz0 / c); iz <= Math.floor(wz1 / c); iz++) {
        const k = this.key(ix, iz);
        let arr = this.grid.get(k);
        if (!arr) { arr = []; this.grid.set(k, arr); }
        arr.push(s); s.cells.push(arr);
      }
    return s;
  }
  removeBox(s) {
    for (const arr of s.cells) { const i = arr.indexOf(s); if (i >= 0) arr.splice(i, 1); }
    s.cells.length = 0;
    const i = this.solids.indexOf(s); if (i >= 0) this.solids.splice(i, 1);
  }
  // ladder: climb zone centred at world (x,z); exitDir is a world-space unit
  // vector pointing from the ladder onto the upper surface.
  // (topX, topZ) is where the ladder meets the upper edge; players standing on
  // the upper surface are only taken onto the ladder when they step past it.
  addLadder(x, z, yBottom, yTop, exitX, exitZ, r = 0.75, topX = x, topZ = z) {
    const l = Math.hypot(exitX, exitZ) || 1;
    this.ladders.push({ x, z, yBottom, yTop, r, ex: exitX / l, ez: exitZ / l, tx: topX, tz: topZ });
  }
  queryAround(x, z, r, out) {
    out.length = 0;
    const c = this.cell;
    for (let ix = Math.floor((x - r) / c); ix <= Math.floor((x + r) / c); ix++)
      for (let iz = Math.floor((z - r) / c); iz <= Math.floor((z + r) / c); iz++) {
        const arr = this.grid.get(this.key(ix, iz));
        if (!arr) continue;
        for (const s of arr) if (out.indexOf(s) < 0) out.push(s);
      }
    return out;
  }
  // horizontal overlap test of a square of half-size r at world (x,z) with solid s;
  // returns penetration info in local coords or null
  hOverlap(s, x, z, r, out) {
    const f = this.frames[s.fi];
    const dx = x - f.cx, dz = z - f.cz;
    const lx = f.c * dx + f.s * dz, lz = -f.s * dx + f.c * dz;
    const px = Math.min(lx + r - s.min.x, s.max.x - (lx - r));
    const pz = Math.min(lz + r - s.min.z, s.max.z - (lz - r));
    if (px <= 0 || pz <= 0) return null;
    if (out) {
      // push direction along the axis of least penetration
      if (px < pz) { const dir = (lx < (s.min.x + s.max.x) / 2) ? -1 : 1; out.lx = dir * px; out.lz = 0; }
      else { const dir = (lz < (s.min.z + s.max.z) / 2) ? -1 : 1; out.lx = 0; out.lz = dir * pz; }
      out.f = f;
    }
    return out || true;
  }
}

export class Player {
  constructor(camera, world, dom) {
    this.camera = camera;
    this.world = world;
    this.dom = dom;
    this.pos = new THREE.Vector3(0, 0, 0); // feet position
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.crouch = false;
    this.height = STAND_H;
    this.onGround = false;
    this.onLadder = null;
    this.ladderDir = -1;        // direction W continues on the current ladder (+1 up, -1 down)
    this.ladderBlock = null;    // ladder just dismounted; ignored until we leave it or ask for it
    this.keys = Object.create(null);
    this.locked = false;
    this.bobPhase = 0; this.bobAmt = 0;
    this.stepDist = 0;
    this.onStep = null;
    this.enabled = true;
    this.touch = { move: null, look: null };
    this._tmp = [];
    this._pen = { lx: 0, lz: 0, f: null };
    this._v = { x: 0, z: 0 };
    this._bind();
  }

  _bind() {
    const dom = this.dom;
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (e.code === 'KeyC') this.toggleCrouch();
      if (e.code === 'Space' && this.locked) e.preventDefault();
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { for (const k in this.keys) this.keys[k] = false; });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom;
      this.dom.dispatchEvent(new CustomEvent(this.locked ? 'player-lock' : 'player-unlock'));
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.rotate(e.movementX, e.movementY);
    });
    // touch controls: left half = move stick, right half = look
    dom.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        const left = t.clientX < window.innerWidth / 2;
        if (left && !this.touch.move) this.touch.move = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY };
        else if (!left && !this.touch.look) this.touch.look = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
      this.dom.dispatchEvent(new CustomEvent('player-touch'));
      e.preventDefault();
    }, { passive: false });
    dom.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (this.touch.move && t.identifier === this.touch.move.id) { this.touch.move.x = t.clientX; this.touch.move.y = t.clientY; }
        if (this.touch.look && t.identifier === this.touch.look.id) {
          this.rotate((t.clientX - this.touch.look.x) * 2.4, (t.clientY - this.touch.look.y) * 2.4);
          this.touch.look.x = t.clientX; this.touch.look.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (this.touch.move && t.identifier === this.touch.move.id) this.touch.move = null;
        if (this.touch.look && t.identifier === this.touch.look.id) this.touch.look = null;
      }
    };
    dom.addEventListener('touchend', end); dom.addEventListener('touchcancel', end);
  }

  rotate(dx, dy) {
    this.yaw -= dx * 0.0021;
    this.pitch -= dy * 0.0021;
    this.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, this.pitch));
  }

  lock() { if (this.dom.requestPointerLock) this.dom.requestPointerLock(); }

  toggleCrouch() {
    if (this.crouch) { if (!this._hit(this.pos.x, this.pos.y, this.pos.z, STAND_H)) this.crouch = false; }
    else this.crouch = true;
  }

  teleport(x, y, z, yaw = 0, pitch = 0) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.yaw = yaw; this.pitch = pitch; this.onLadder = null;
  }

  get eyeHeight() { return this.height - 0.12; }

  // first solid overlapping the player's volume at (x, y..y+h, z)
  _hit(x, y, z, h) {
    const list = this.world.queryAround(x, z, RADIUS, this._tmp);
    const y0 = y + 0.03, y1 = y + h - 0.02;
    for (const s of list) {
      if (s.max.y <= y0 || s.min.y >= y1) continue;
      if (this.world.hOverlap(s, x, z, RADIUS, null)) return s;
    }
    return null;
  }

  _support(x, y, z) {
    let g = this.world.groundFn(x, z);
    const list = this.world.queryAround(x, z, RADIUS, this._tmp);
    for (const s of list) {
      if (s.max.y <= y + 0.06 && s.max.y > g && this.world.hOverlap(s, x, z, RADIUS - 0.04, null)) g = s.max.y;
    }
    return g;
  }
  _ceiling(x, y, z, h) {
    let c = Infinity;
    const list = this.world.queryAround(x, z, RADIUS, this._tmp);
    for (const s of list) {
      if (s.min.y >= y + h * 0.5 && s.min.y < c && this.world.hOverlap(s, x, z, RADIUS, null)) c = s.min.y;
    }
    return c;
  }

  // ladder we are (or should be) on this frame, or null. (mx, mz) is the intended walking direction.
  _findLadder(fwd, standing, mx, mz) {
    const p = this.pos, k = this.keys;
    let best = null, bd = Infinity;
    for (const l of this.world.ladders) {
      const dx = p.x - l.x, dz = p.z - l.z, d2 = dx * dx + dz * dz;
      if (l === this.ladderBlock && d2 > 0.36) this.ladderBlock = null;   // stepped clear of a ladder we just left
      if (d2 >= l.r * l.r || p.y < l.yBottom - 0.7 || p.y > l.yTop + 0.45) continue;
      if (d2 < bd) { best = l; bd = d2; }
    }
    if (!best) return null;
    if (this.onLadder === best) return best;
    const toX = best.x - p.x, toZ = best.z - p.z;
    const toward = fwd > 0 && (bd < 0.04 || toX * mx + toZ * mz > 0);
    const wantUp = k.Space || (fwd > 0 && this.pitch > 0.2);
    if (best === this.ladderBlock) { if (!wantUp) return null; this.ladderBlock = null; this.ladderDir = 1; return best; }
    const atTop = standing && p.y > best.yTop - 0.2;
    if (atTop) {
      // standing on the upper surface: only step on when stepping off the edge, backing on, or looking down and walking
      const over = (p.x - best.tx) * best.ex + (p.z - best.tz) * best.ez < 0.05;
      if (!(over || fwd < 0 || (fwd > 0 && this.pitch < -0.35))) return null;
      this.ladderDir = -1;
    } else if (standing) {
      // on the ground by the ladder: take hold of it when walking into it or asking to climb
      if (!(toward || wantUp)) return null;
      this.ladderDir = 1;
    } else {
      this.ladderDir = -1;   // caught in mid-air: we go down
    }
    return best;
  }

  update(dt) {
    if (!this.enabled) return;
    dt = Math.min(dt, 0.05);
    const k = this.keys;
    let fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    let side = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const run = !!(k.ShiftLeft || k.ShiftRight);
    if (this.touch.move) {
      const dx = (this.touch.move.x - this.touch.move.x0) / 55, dy = (this.touch.move.y - this.touch.move.y0) / 55;
      side += Math.max(-1, Math.min(1, dx)); fwd -= Math.max(-1, Math.min(1, dy));
    }
    const holdCrouch = !!(k.ControlLeft || k.ControlRight);
    if (holdCrouch) { this.crouch = true; this._held = true; }
    else if (this._held) { this._held = false; if (!this._hit(this.pos.x, this.pos.y, this.pos.z, STAND_H)) this.crouch = false; }
    const targetH = this.crouch ? CROUCH_H : STAND_H;
    this.height += (targetH - this.height) * Math.min(1, dt * 9);

    const speed = (run ? RUN : WALK) * (this.crouch ? 0.5 : 1);
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    const fx = -sinY, fz = -cosY, rx = cosY, rz = -sinY;
    let mx = fx * fwd + rx * side, mz = fz * fwd + rz * side;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }

    const standing = this.onGround || this.onLadder === null && this.pos.y <= this._support(this.pos.x, this.pos.y + 0.01, this.pos.z) + 0.05;
    const ladder = this._findLadder(fwd, standing, mx, mz);
    if (ladder) {
      // W continues the way we got on (unless looking clearly up or down), S always descends, Space climbs
      let climb = 0;
      if (fwd > 0) climb = this.pitch < -0.35 ? -1 : (this.pitch > 0.25 && this.pos.y < ladder.yTop - 0.3) ? 1 : this.ladderDir;
      else if (fwd < 0) climb = -1;
      if (k.Space) climb = 1;
      if (climb !== 0) this.ladderDir = climb;
      this.vel.y = climb * CLIMB;
      const toX = ladder.x - this.pos.x, toZ = ladder.z - this.pos.z;
      let hx = toX * 3 + mx * 0.5, hz = toZ * 3 + mz * 0.5;
      // sidestep (A/D without W/S) lets go of the ladder: walk straight off it
      if (side !== 0 && fwd === 0) { hx = mx * WALK; hz = mz * WALK; this.vel.y = 0; }
      const exiting = this.pos.y >= ladder.yTop - 0.04 && climb > 0;
      if (exiting) { hx = ladder.ex * 1.7; hz = ladder.ez * 1.7; this.vel.y = 0.5; }
      const bx = this.pos.x, bz = this.pos.z;
      this._move(hx * dt, hz * dt);
      if (exiting && Math.hypot(this.pos.x - bx, this.pos.z - bz) < 0.4 * Math.hypot(hx, hz) * dt) {
        // the way off the top is blocked: try sideways along the edge
        this._move(-ladder.ez * 1.7 * dt, ladder.ex * 1.7 * dt);
        if (Math.hypot(this.pos.x - bx, this.pos.z - bz) < 0.4 * 1.7 * dt) this._move(ladder.ez * 1.7 * dt, -ladder.ex * 1.7 * dt);
      }
      this.pos.y += this.vel.y * dt;
      const sup = this._support(this.pos.x, this.pos.y + 0.01, this.pos.z);
      if (this.pos.y < sup) { this.pos.y = sup; this.vel.y = 0; }
      if (this.pos.y > ladder.yTop + 0.45) this.pos.y = ladder.yTop + 0.45;
      // reached the bottom: let go of the ladder so the player can walk away
      if (climb <= 0 && this.pos.y <= Math.max(ladder.yBottom, sup) + 0.03 && this.pos.y < ladder.yTop - 0.5) {
        this.ladderBlock = ladder; this.onLadder = null; this.onGround = true; this.vel.y = 0;
      } else { this.onLadder = ladder; this.onGround = false; }
      this.bobAmt *= 0.9;
    } else {
      this.onLadder = null;
      this._move(mx * speed * dt, mz * speed * dt);
      this.vel.y -= GRAVITY * dt;
      if (this.onGround && k.Space && !this.crouch) { this.vel.y = JUMP; this.onGround = false; }
      let ny = this.pos.y + this.vel.y * dt;
      const sup = this._support(this.pos.x, Math.max(this.pos.y, ny) + 0.01, this.pos.z);
      if (ny <= sup) { if (this.vel.y < -7 && this.onLand) this.onLand(); ny = sup; this.vel.y = 0; this.onGround = true; } else this.onGround = false;
      const ceil = this._ceiling(this.pos.x, ny, this.pos.z, this.height);
      if (ny + this.height > ceil) { ny = ceil - this.height; if (this.vel.y > 0) this.vel.y = 0; }
      this.pos.y = ny;
      const moving = ml > 0.1 && this.onGround;
      if (moving) {
        const d = speed * dt;
        this.bobPhase += d * 2.0;
        this.stepDist += d;
        if (this.stepDist > (run ? 2.3 : 1.7)) { this.stepDist = 0; if (this.onStep) this.onStep(); }
      }
      this.bobAmt += ((moving ? 1 : 0) - this.bobAmt) * Math.min(1, dt * 8);
    }
    const bob = Math.sin(this.bobPhase) * 0.03 * this.bobAmt;
    this.camera.position.set(this.pos.x, this.pos.y + this.eyeHeight + bob, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bobPhase * 0.5) * 0.004 * this.bobAmt);
  }

  _move(dx, dz) {
    if (dx === 0 && dz === 0) return;
    const ox = this.pos.x, oz = this.pos.z, oy = this.pos.y;
    this.pos.x += dx; this.pos.z += dz;
    const h = this.height;
    for (let iter = 0; iter < 4; iter++) {
      const s = this._hit(this.pos.x, this.pos.y, this.pos.z, h);
      if (!s) break;
      // step up onto low obstacles
      const rise = s.max.y - this.pos.y;
      if (rise > -0.01 && rise <= STEP_H && !this._hit(this.pos.x, s.max.y + 0.01, this.pos.z, h)) {
        this.pos.y = s.max.y; if (this.vel.y < 0) this.vel.y = 0; continue;
      }
      // push out along the axis of least penetration (in the solid's frame)
      const p = this.world.hOverlap(s, this.pos.x, this.pos.z, RADIUS, this._pen);
      if (!p) break;
      this.world.toWorldVec(p.f, p.lx + Math.sign(p.lx) * 0.002, p.lz + Math.sign(p.lz) * 0.002, this._v);
      this.pos.x += this._v.x; this.pos.z += this._v.z;
    }
    if (this._hit(this.pos.x, this.pos.y, this.pos.z, h)) { this.pos.x = ox; this.pos.z = oz; this.pos.y = oy; return; }
    // terrain too steep?
    const g = this.world.groundFn(this.pos.x, this.pos.z);
    if (g > this.pos.y + STEP_H + 0.3) { this.pos.x = ox; this.pos.z = oz; this.pos.y = oy; return; }
    if (g > this.pos.y) this.pos.y = g;
  }
}

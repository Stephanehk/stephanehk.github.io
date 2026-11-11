// Procedurally drawn wall paintings in the Çatalhöyük palette: red ochre
// (several shades), carbon black, and the cream marl plaster as "white".
import * as THREE from 'three';
import { mulberry32 } from './textures.js';

const PX = 200; // pixels per metre
export const RED = '#a8422c', RED_DARK = '#7f3424', RED_DUSKY = '#6a3f36', RED_CINNABAR = '#c43b2b', RED_PALE = '#c8846c';
export const BLACK = '#262019';

function canvasFor(wM, hM) {
  const c = document.createElement('canvas');
  c.width = Math.max(64, Math.round(wM * PX)); c.height = Math.max(64, Math.round(hM * PX));
  return c;
}

// plaster background drawn from the shared plaster canvas
function plasterBg(ctx, c, plasterCanvas, tint = 1) {
  const s = plasterCanvas.width;
  for (let y = 0; y < c.height; y += s) for (let x = 0; x < c.width; x += s) ctx.drawImage(plasterCanvas, x, y);
  if (tint !== 1) { ctx.fillStyle = `rgba(0,0,0,${1 - tint})`; ctx.fillRect(0, 0, c.width, c.height); }
}

// age the paint: flake off small patches so the plaster shows through
function wear(ctx, c, plasterCanvas, amount, rnd) {
  ctx.save();
  ctx.globalAlpha = 0.9;
  const n = Math.floor(amount * c.width * c.height / 1800);
  for (let i = 0; i < n; i++) {
    const x = rnd() * c.width, y = rnd() * c.height, r = 1 + rnd() * 5;
    ctx.beginPath(); ctx.ellipse(x, y, r * (0.5 + rnd()), r, rnd() * 3, 0, Math.PI * 2);
    ctx.clip(); ctx.drawImage(plasterCanvas, x - (x % plasterCanvas.width), y - (y % plasterCanvas.height)); ctx.restore(); ctx.save(); ctx.globalAlpha = 0.9;
  }
  ctx.restore();
  // light dust haze
  ctx.fillStyle = 'rgba(240,232,210,0.08)'; ctx.fillRect(0, 0, c.width, c.height);
}

function finish(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ----- figure primitives -----
function human(ctx, x, y, h, color, rnd, opts = {}) {
  // x,y = feet position; h = height. Lively running/leaping silhouette.
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round';
  const headR = h * 0.075;
  const lean = (opts.lean !== undefined ? opts.lean : (rnd() - 0.5) * 0.6);
  const hipY = y - h * 0.5, shY = y - h * 0.85;
  const hipX = x, shX = x + lean * h * 0.3;
  // torso
  ctx.lineWidth = h * 0.11; ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(shX, shY); ctx.stroke();
  // shoulders wide
  ctx.lineWidth = h * 0.07; ctx.beginPath(); ctx.moveTo(shX - h * 0.14, shY + h * 0.02); ctx.lineTo(shX + h * 0.14, shY + h * 0.02); ctx.stroke();
  // head
  if (!opts.headless) { ctx.beginPath(); ctx.arc(shX + lean * h * 0.05, shY - headR * 1.3, headR, 0, Math.PI * 2); ctx.fill(); }
  // arms
  const armUp = opts.armsUp !== undefined ? opts.armsUp : rnd() < 0.6;
  ctx.lineWidth = h * 0.055;
  for (const sgn of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(shX + sgn * h * 0.12, shY + h * 0.02);
    const ex = shX + sgn * h * (0.25 + rnd() * 0.1), ey = armUp ? shY - h * (0.15 + rnd() * 0.15) : shY + h * (0.15 + rnd() * 0.15);
    ctx.lineTo(ex, ey); ctx.stroke();
  }
  // legs in stride
  ctx.lineWidth = h * 0.07;
  const stride = opts.stride !== undefined ? opts.stride : 0.15 + rnd() * 0.2;
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(hipX - stride * h, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(hipX + stride * h * 0.8, y - h * 0.05); ctx.stroke();
}

function bull(ctx, x, y, w, color, rnd) {
  // x,y = position of the belly centre bottom; w = body length. Facing +x.
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const h = w * 0.42;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y - h * 0.15);
  ctx.bezierCurveTo(x - w * 0.55, y - h * 0.8, x - w * 0.25, y - h * 1.05, x, y - h * 0.95);     // back to hump
  ctx.bezierCurveTo(x + w * 0.2, y - h * 1.15, x + w * 0.42, y - h * 1.0, x + w * 0.5, y - h * 0.75); // hump to neck
  ctx.bezierCurveTo(x + w * 0.56, y - h * 0.5, x + w * 0.5, y - h * 0.2, x + w * 0.42, y - h * 0.1);  // chest
  ctx.bezierCurveTo(x + w * 0.2, y, x - w * 0.2, y, x - w * 0.5, y - h * 0.15);                        // belly
  ctx.closePath(); ctx.fill();
  // head: lowered
  ctx.beginPath();
  ctx.moveTo(x + w * 0.48, y - h * 0.8);
  ctx.bezierCurveTo(x + w * 0.62, y - h * 0.85, x + w * 0.72, y - h * 0.5, x + w * 0.7, y - h * 0.25);
  ctx.bezierCurveTo(x + w * 0.68, y - h * 0.15, x + w * 0.58, y - h * 0.15, x + w * 0.52, y - h * 0.3);
  ctx.closePath(); ctx.fill();
  // horns: long, lyre-shaped
  ctx.lineWidth = w * 0.02;
  for (const sgn of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(x + w * 0.55, y - h * 0.82);
    ctx.bezierCurveTo(x + w * (0.55 + 0.12 * sgn), y - h * 1.25, x + w * (0.75 + 0.1 * sgn), y - h * 1.35, x + w * (0.68 + 0.18 * sgn), y - h * 1.55);
    ctx.stroke();
  }
  // legs
  ctx.lineWidth = w * 0.055;
  const legs = [[-0.38, -0.3], [-0.3, -0.42], [0.3, 0.38], [0.38, 0.28]];
  for (const [a, b] of legs) { ctx.beginPath(); ctx.moveTo(x + w * a, y - h * 0.15); ctx.lineTo(x + w * b, y + h * 0.42); ctx.stroke(); }
  // tail
  ctx.lineWidth = w * 0.018; ctx.beginPath(); ctx.moveTo(x - w * 0.5, y - h * 0.75); ctx.bezierCurveTo(x - w * 0.62, y - h * 0.6, x - w * 0.6, y - h * 0.2, x - w * 0.55, y + h * 0.1); ctx.stroke();
}

function stag(ctx, x, y, w, color, rnd) {
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round';
  const h = w * 0.5;
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.55, w * 0.42, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  // neck + head
  ctx.lineWidth = w * 0.09; ctx.beginPath(); ctx.moveTo(x + w * 0.35, y - h * 0.7); ctx.lineTo(x + w * 0.55, y - h * 1.15); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x + w * 0.6, y - h * 1.2, w * 0.1, h * 0.09, 0.4, 0, Math.PI * 2); ctx.fill();
  // antlers
  ctx.lineWidth = w * 0.018;
  for (const sgn of [-1, 1]) {
    const bx = x + w * 0.58 + sgn * w * 0.02, by = y - h * 1.28;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + sgn * w * 0.08 - w * 0.05, by - h * 0.6); ctx.stroke();
    for (let k = 1; k <= 3; k++) {
      const t = k / 3.5, px = bx + (sgn * w * 0.08 - w * 0.05) * t, py = by - h * 0.6 * t;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - w * 0.09 - sgn * w * 0.03, py - h * 0.2); ctx.stroke();
    }
  }
  ctx.lineWidth = w * 0.04;
  for (const [a, b] of [[-0.32, -0.3], [-0.25, -0.15], [0.25, 0.3], [0.32, 0.2]]) { ctx.beginPath(); ctx.moveTo(x + w * a, y - h * 0.4); ctx.lineTo(x + w * b, y + h * 0.3); ctx.stroke(); }
}

function boar(ctx, x, y, w, color) {
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round';
  const h = w * 0.5;
  ctx.beginPath(); ctx.ellipse(x, y - h * 0.5, w * 0.45, h * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w * 0.35, y - h * 0.75); ctx.lineTo(x + w * 0.65, y - h * 0.35); ctx.lineTo(x + w * 0.4, y - h * 0.2); ctx.closePath(); ctx.fill();
  ctx.lineWidth = w * 0.05;
  for (const [a, b] of [[-0.3, -0.3], [-0.2, -0.15], [0.2, 0.25], [0.3, 0.2]]) { ctx.beginPath(); ctx.moveTo(x + w * a, y - h * 0.3); ctx.lineTo(x + w * b, y + h * 0.15); ctx.stroke(); }
  // bristles
  ctx.lineWidth = w * 0.012; for (let i = 0; i < 8; i++) { const px = x - w * 0.3 + i * w * 0.08; ctx.beginPath(); ctx.moveTo(px, y - h * 0.85); ctx.lineTo(px + w * 0.02, y - h * 1.02); ctx.stroke(); }
}

function vulture(ctx, x, y, span, color, rnd) {
  // wings outstretched, seen from above/side as in Shrine VII.8. x,y = body centre.
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round';
  const bodyL = span * 0.3, bodyH = span * 0.11;
  // wings: broad, with 6 finger feathers
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x, y - bodyH * 0.4);
    ctx.bezierCurveTo(x + sgn * span * 0.2, y - span * 0.18, x + sgn * span * 0.4, y - span * 0.2, x + sgn * span * 0.5, y - span * 0.1);
    // feather tips
    for (let k = 0; k < 6; k++) {
      const t = k / 5;
      const fx = x + sgn * span * (0.5 - t * 0.28), fy = y - span * 0.1 + t * span * 0.14;
      ctx.lineTo(fx, fy); ctx.lineTo(fx - sgn * span * 0.03, fy - span * 0.03);
    }
    ctx.lineTo(x, y + bodyH * 0.6);
    ctx.closePath(); ctx.fill();
  }
  // body
  ctx.beginPath(); ctx.ellipse(x, y, bodyL / 2, bodyH, 0, 0, Math.PI * 2); ctx.fill();
  // neck and head with hooked beak
  ctx.lineWidth = span * 0.03;
  ctx.beginPath(); ctx.moveTo(x + bodyL * 0.4, y - bodyH * 0.3); ctx.lineTo(x + bodyL * 0.6, y - bodyH * 1.2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + bodyL * 0.63, y - bodyH * 1.4, span * 0.028, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = span * 0.014; ctx.beginPath(); ctx.moveTo(x + bodyL * 0.66, y - bodyH * 1.45); ctx.quadraticCurveTo(x + bodyL * 0.78, y - bodyH * 1.4, x + bodyL * 0.74, y - bodyH * 1.0); ctx.stroke();
  // legs with three toes
  ctx.lineWidth = span * 0.016;
  for (const off of [-0.1, 0.05]) {
    const lx = x + bodyL * off;
    ctx.beginPath(); ctx.moveTo(lx, y + bodyH * 0.8); ctx.lineTo(lx, y + bodyH * 2.2); ctx.stroke();
    for (const d of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(lx, y + bodyH * 2.2); ctx.lineTo(lx + d * span * 0.03, y + bodyH * 2.7); ctx.stroke(); }
  }
}

function hand(ctx, x, y, size, color, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color;
  // palm
  ctx.beginPath(); ctx.ellipse(0, size * 0.1, size * 0.33, size * 0.38, 0, 0, Math.PI * 2); ctx.fill();
  // fingers
  const fingers = [[-0.24, -0.55, 0.11], [-0.09, -0.72, 0.11], [0.07, -0.75, 0.11], [0.22, -0.62, 0.1]];
  for (const [fx, fy, fw] of fingers) {
    ctx.beginPath(); ctx.roundRect(fx * size - fw * size / 2, fy * size, fw * size, size * 0.5, fw * size / 2); ctx.fill();
  }
  // thumb
  ctx.save(); ctx.rotate(-0.8); ctx.beginPath(); ctx.roundRect(-size * 0.5, -size * 0.1, size * 0.11, size * 0.42, size * 0.05); ctx.fill(); ctx.restore();
  ctx.restore();
}

// ----- panel generators -----
export function makePaintings(plasterCanvas, seed = 7) {
  const rnd = mulberry32(seed);
  const P = {};

  // solid red dado / panel
  P.redPanel = (wM, hM, shade = RED) => {
    const c = canvasFor(wM, hM), ctx = c.getContext('2d');
    plasterBg(ctx, c, plasterCanvas);
    ctx.fillStyle = shade; ctx.globalAlpha = 0.92; ctx.fillRect(0, 0, c.width, c.height); ctx.globalAlpha = 1;
    // uneven brushwork
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(120,40,25,${0.08 + rnd() * 0.1})`; ctx.fillRect(rnd() * c.width, 0, 8 + rnd() * 40, c.height); }
    wear(ctx, c, plasterCanvas, 0.5, rnd);
    return finish(c);
  };

  // geometric "kilim" panel: rows of lozenges / triangles / zigzags in red and black
  P.kilim = (wM, hM, variant = 0) => {
    const c = canvasFor(wM, hM), ctx = c.getContext('2d');
    plasterBg(ctx, c, plasterCanvas);
    const rows = 3 + Math.floor(rnd() * 3);
    const rh = c.height / rows;
    for (let r = 0; r < rows; r++) {
      const y0 = r * rh;
      const col = (r + variant) % 2 === 0 ? RED : BLACK;
      const kind = (r + variant) % 3;
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = rh * 0.12;
      const n = Math.round(c.width / (rh * 0.9));
      const cw = c.width / n;
      for (let i = 0; i < n; i++) {
        const x0 = i * cw;
        if (kind === 0) { // lozenges with a dot
          ctx.beginPath(); ctx.moveTo(x0 + cw / 2, y0 + rh * 0.08); ctx.lineTo(x0 + cw * 0.92, y0 + rh / 2); ctx.lineTo(x0 + cw / 2, y0 + rh * 0.92); ctx.lineTo(x0 + cw * 0.08, y0 + rh / 2); ctx.closePath(); ctx.stroke();
          ctx.beginPath(); ctx.arc(x0 + cw / 2, y0 + rh / 2, rh * 0.1, 0, Math.PI * 2); ctx.fill();
        } else if (kind === 1) { // triangles alternating up/down
          ctx.beginPath();
          if (i % 2) { ctx.moveTo(x0, y0 + rh * 0.1); ctx.lineTo(x0 + cw, y0 + rh * 0.1); ctx.lineTo(x0 + cw / 2, y0 + rh * 0.9); }
          else { ctx.moveTo(x0, y0 + rh * 0.9); ctx.lineTo(x0 + cw, y0 + rh * 0.9); ctx.lineTo(x0 + cw / 2, y0 + rh * 0.1); }
          ctx.closePath(); ctx.fill();
        } else { // zigzag band
          ctx.beginPath(); ctx.moveTo(x0, y0 + rh * 0.75); ctx.lineTo(x0 + cw / 2, y0 + rh * 0.25); ctx.lineTo(x0 + cw, y0 + rh * 0.75); ctx.stroke();
        }
      }
    }
    wear(ctx, c, plasterCanvas, 0.9, rnd);
    return finish(c);
  };

  // row of positive red handprints (Building 77 north wall), optionally on their sides with a palm circle
  P.hands = (wM, hM, n = 12, variant = 0) => {
    const c = canvasFor(wM, hM), ctx = c.getContext('2d');
    plasterBg(ctx, c, plasterCanvas);
    const size = Math.min(c.height * 0.55, c.width / n * 0.9);
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * c.width / n, y = c.height * 0.55 + (rnd() - 0.5) * size * 0.1;
      const col = variant === 2 && i % 2 ? BLACK : RED;
      hand(ctx, x, y, size, col, variant === 1 ? Math.PI / 2 : (rnd() - 0.5) * 0.15);
      if (variant === 1) { ctx.fillStyle = '#efe6d2'; ctx.beginPath(); ctx.arc(x, y + size * 0.1, size * 0.12, 0, Math.PI * 2); ctx.fill(); }
    }
    wear(ctx, c, plasterCanvas, 0.8, rnd);
    return finish(c);
  };

  // Shrine F.V.1-style hunting / baiting scene: huge red bull with dozens of small figures
  P.hunt = (wM, hM) => {
    const c = canvasFor(wM, hM), ctx = c.getContext('2d');
    plasterBg(ctx, c, plasterCanvas);
    const W = c.width, H = c.height;
    bull(ctx, W * 0.5, H * 0.62, W * 0.62, RED, rnd);
    // figures: black (some pinkish-red), about a sixth of the bull's height
    const fh = H * 0.16;
    for (let i = 0; i < 34; i++) {
      const ang = rnd() * Math.PI * 2, r = 0.3 + rnd() * 0.42;
      let x = W * 0.5 + Math.cos(ang) * W * r * 0.55, y = H * 0.62 + Math.sin(ang) * H * r * 0.55 + fh * 0.5;
      x = Math.max(fh * 0.3, Math.min(W - fh * 0.3, x)); y = Math.max(fh * 1.1, Math.min(H - fh * 0.1, y));
      const col = rnd() < 0.7 ? BLACK : (rnd() < 0.5 ? RED_PALE : RED_DARK);
      human(ctx, x, y, fh * (0.8 + rnd() * 0.4), col, rnd);
    }
    // one figure leaping on the back
    human(ctx, W * 0.5, H * 0.62 - H * 0.26 * 0.95, fh, BLACK, rnd, { armsUp: true, lean: 0.4 });
    // a deer at the edge
    stag(ctx, W * 0.14, H * 0.9, W * 0.16, RED_DARK, rnd);
    wear(ctx, c, plasterCanvas, 0.8, rnd);
    return finish(c);
  };

  // deer / boar baiting scene (west wall)
  P.huntDeer = (wM, hM) => {
    const c = canvasFor(wM, hM), ctx = c.getContext('2d');
    plasterBg(ctx, c, plasterCanvas);
    const W = c.width, H = c.height;
    stag(ctx, W * 0.32, H * 0.72, W * 0.36, RED, rnd);
    boar(ctx, W * 0.78, H * 0.78, W * 0.22, RED_DARK);
    const fh = H * 0.17;
    for (let i = 0; i < 18; i++) {
      const x = W * (0.05 + rnd() * 0.9), y = H * (0.3 + rnd() * 0.68);
      human(ctx, x, y, fh * (0.8 + rnd() * 0.4), BLACK, rnd);
    }
    wear(ctx, c, plasterCanvas, 0.8, rnd);
    return finish(c);
  };

  // Shrine VII.8: red griffon vultures (wingspan ~1.5 m) and tiny headless men
  P.vultures = (wM, hM, nV = 3) => {
    const c = canvasFor(wM, hM), ctx = c.getContext('2d');
    plasterBg(ctx, c, plasterCanvas);
    const W = c.width, H = c.height;
    const span = Math.min(1.5 * PX, W / nV * 0.95);
    for (let i = 0; i < nV; i++) {
      const x = (i + 0.5) * W / nV, y = H * (0.42 + (rnd() - 0.5) * 0.15);
      vulture(ctx, x, y, span, RED, rnd);
    }
    const fh = H * 0.22;
    for (let i = 0; i < nV * 2; i++) {
      const x = W * (0.08 + rnd() * 0.84), y = H * 0.97;
      ctx.save();
      if (rnd() < 0.5) { ctx.translate(x, y - fh * 0.1); ctx.rotate(Math.PI / 2); human(ctx, 0, 0, fh * 0.8, BLACK, rnd, { headless: true, armsUp: false, stride: 0.1 }); }
      else human(ctx, x, y, fh * 0.8, BLACK, rnd, { headless: true, armsUp: false, stride: 0.08 });
      ctx.restore();
    }
    wear(ctx, c, plasterCanvas, 0.7, rnd);
    return finish(c);
  };

  // Shrine VII.14 "map": terraced rows of subdivided rectangles under a twin-peaked, dotted form
  P.volcanoMap = (wM, hM) => {
    const c = canvasFor(wM, hM), ctx = c.getContext('2d');
    plasterBg(ctx, c, plasterCanvas);
    const W = c.width, H = c.height;
    ctx.fillStyle = RED; ctx.strokeStyle = RED;
    // upper register: twin peaks with dots
    const baseY = H * 0.42;
    ctx.beginPath(); ctx.moveTo(W * 0.1, baseY);
    ctx.quadraticCurveTo(W * 0.28, H * 0.02, W * 0.42, baseY * 0.55);
    ctx.quadraticCurveTo(W * 0.5, baseY * 0.7, W * 0.56, baseY * 0.5);
    ctx.quadraticCurveTo(W * 0.72, H * 0.02, W * 0.9, baseY);
    ctx.closePath();
    ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
    // dots over the body
    ctx.fillStyle = '#efe6d2';
    for (let i = 0; i < 260; i++) {
      const x = W * (0.12 + rnd() * 0.76), y = baseY * (0.3 + rnd() * 0.68);
      // inside the double curve?
      const peak = x < W * 0.5 ? 1 - Math.pow((x - W * 0.42) / (W * 0.32), 2) : 1 - Math.pow((x - W * 0.56) / (W * 0.34), 2);
      if (y > baseY * (1 - peak * 0.92) + baseY * 0.02) { ctx.beginPath(); ctx.arc(x, y, W * 0.004, 0, Math.PI * 2); ctx.fill(); }
    }
    // dotted line from the right peak upward, rows of dots above
    ctx.fillStyle = RED;
    for (let k = 0; k < 10; k++) { ctx.beginPath(); ctx.arc(W * 0.56 + k * W * 0.012, baseY * 0.5 - k * baseY * 0.045, W * 0.004, 0, Math.PI * 2); ctx.fill(); }
    for (let r = 0; r < 2; r++) for (let k = 0; k < 24; k++) { ctx.beginPath(); ctx.arc(W * 0.15 + k * W * 0.03, H * 0.03 + r * H * 0.03, W * 0.003, 0, Math.PI * 2); ctx.fill(); }
    // lower register: ~80 stacked rectangles in terraced rows, each subdivided
    const rows = 5, y0 = H * 0.46, rh = (H * 0.5) / rows;
    for (let r = 0; r < rows; r++) {
      const n = 12 + r * 2, cw = W * 0.92 / n, off = W * 0.04 + (r % 2) * cw * 0.3;
      for (let i = 0; i < n; i++) {
        const x = off + i * cw, y = y0 + r * rh;
        if (x + cw > W * 0.98) continue;
        ctx.fillStyle = RED; ctx.globalAlpha = 0.9;
        ctx.fillRect(x + cw * 0.06, y + rh * 0.1, cw * 0.88, rh * 0.8);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#efe6d2'; ctx.lineWidth = Math.max(1, W * 0.0025);
        ctx.beginPath(); ctx.moveTo(x + cw * 0.5, y + rh * 0.1); ctx.lineTo(x + cw * 0.5, y + rh * 0.9); ctx.stroke();
        if (rnd() < 0.5) { ctx.beginPath(); ctx.moveTo(x + cw * 0.06, y + rh * 0.5); ctx.lineTo(x + cw * 0.94, y + rh * 0.5); ctx.stroke(); }
      }
    }
    wear(ctx, c, plasterCanvas, 0.6, rnd);
    return finish(c);
  };

  // Building 80: vertical columns of stacked "brick" motifs in fresh red, spiral by the post
  P.brickMotif = (wM, hM) => {
    const c = canvasFor(wM, hM), ctx = c.getContext('2d');
    plasterBg(ctx, c, plasterCanvas);
    const W = c.width, H = c.height;
    const cols = 5, cw = W / cols;
    ctx.fillStyle = RED_CINNABAR;
    for (let i = 0; i < cols; i++) {
      const rows = 4 + (i % 2);
      const rh = H / rows;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * cw * 0.25;
        ctx.globalAlpha = 0.88;
        ctx.fillRect(i * cw + cw * 0.18 + off * 0.4, r * rh + rh * 0.12, cw * 0.5, rh * 0.62);
      }
    }
    ctx.globalAlpha = 1;
    // spiral at the left edge
    ctx.strokeStyle = RED_CINNABAR; ctx.lineWidth = Math.max(2, W * 0.008); ctx.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.1) { const r = W * 0.012 * a; const x = W * 0.08 + Math.cos(a) * r, y = H * 0.5 + Math.sin(a) * r; if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    wear(ctx, c, plasterCanvas, 0.6, rnd);
    return finish(c);
  };

  // goats and a tree (below the VII.44 leopards)
  P.goatsTree = (wM, hM) => {
    const c = canvasFor(wM, hM), ctx = c.getContext('2d');
    plasterBg(ctx, c, plasterCanvas);
    const W = c.width, H = c.height;
    // tree
    ctx.strokeStyle = BLACK; ctx.lineWidth = H * 0.03; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(W * 0.5, H * 0.95); ctx.lineTo(W * 0.5, H * 0.2); ctx.stroke();
    ctx.lineWidth = H * 0.018;
    for (let k = 0; k < 6; k++) { const y = H * (0.3 + k * 0.1); for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(W * 0.5, y); ctx.lineTo(W * 0.5 + s * W * (0.08 + rnd() * 0.06), y - H * 0.12); ctx.stroke(); } }
    // goats
    for (let i = 0; i < 9; i++) {
      const x = i < 5 ? W * (0.05 + i * 0.08) : W * (0.62 + (i - 5) * 0.09), y = H * (0.75 + (rnd() - 0.5) * 0.3);
      const gw = W * 0.07, gh = gw * 0.55, col = rnd() < 0.5 ? RED : BLACK;
      ctx.fillStyle = col; ctx.strokeStyle = col;
      ctx.beginPath(); ctx.ellipse(x, y - gh * 0.5, gw * 0.4, gh * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = gw * 0.08; ctx.beginPath(); ctx.moveTo(x + gw * 0.3, y - gh * 0.6); ctx.lineTo(x + gw * 0.5, y - gh * 1.1); ctx.stroke();
      ctx.lineWidth = gw * 0.05; ctx.beginPath(); ctx.moveTo(x + gw * 0.5, y - gh * 1.1); ctx.quadraticCurveTo(x + gw * 0.3, y - gh * 1.6, x + gw * 0.2, y - gh * 1.7); ctx.stroke();
      for (const [a, b] of [[-0.3, -0.32], [-0.2, -0.15], [0.2, 0.22], [0.3, 0.35]]) { ctx.beginPath(); ctx.moveTo(x + gw * a, y - gh * 0.35); ctx.lineTo(x + gw * b, y + gh * 0.1); ctx.stroke(); }
    }
    wear(ctx, c, plasterCanvas, 0.7, rnd);
    return finish(c);
  };

  // concentric circles and rows of red/black triangles (Level VIII style)
  P.circles = (wM, hM) => {
    const c = canvasFor(wM, hM), ctx = c.getContext('2d');
    plasterBg(ctx, c, plasterCanvas);
    const W = c.width, H = c.height;
    const n = Math.max(2, Math.round(wM / 0.5));
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * W / n, cy = H * 0.38, R = Math.min(W / n, H * 0.6) * 0.42;
      for (let k = 0; k < 4; k++) { ctx.strokeStyle = k % 2 ? BLACK : RED; ctx.lineWidth = R * 0.12; ctx.beginPath(); ctx.arc(cx, cy, R * (1 - k * 0.24), 0, Math.PI * 2); ctx.stroke(); }
    }
    const tn = n * 4, tw = W / tn;
    for (let i = 0; i < tn; i++) { ctx.fillStyle = i % 2 ? BLACK : RED; ctx.beginPath(); ctx.moveTo(i * tw, H * 0.95); ctx.lineTo((i + 1) * tw, H * 0.95); ctx.lineTo((i + 0.5) * tw, H * 0.72); ctx.closePath(); ctx.fill(); }
    wear(ctx, c, plasterCanvas, 0.8, rnd);
    return finish(c);
  };

  // incised geometric panel (B.77): red-washed squares with 8-segment stars and spirals
  P.incised = (wM, hM) => {
    const c = canvasFor(wM, hM), ctx = c.getContext('2d');
    plasterBg(ctx, c, plasterCanvas);
    const W = c.width, H = c.height;
    ctx.fillStyle = 'rgba(168,66,44,0.55)'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(60,30,20,0.8)'; ctx.lineWidth = Math.max(1.5, W * 0.004);
    const n = Math.max(2, Math.round(wM / 0.4));
    const cw = W / n;
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * cw, cy = H / 2, r = Math.min(cw, H) * 0.42;
      ctx.strokeRect(cx - r, cy - r, 2 * r, 2 * r);
      if (i % 2 === 0) { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); } }
      else { ctx.beginPath(); for (let a = 0; a < Math.PI * 5; a += 0.15) { const rr = r * a / (Math.PI * 5); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
    }
    wear(ctx, c, plasterCanvas, 0.3, rnd);
    return finish(c);
  };

  // leopard relief surface: cream plaster with black rosette spots (tiled texture)
  P.leopardSpots = () => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.drawImage(plasterCanvas, 0, 0, 256, 256);
    ctx.fillStyle = BLACK;
    for (let i = 0; i < 24; i++) {
      const x = rnd() * 256, y = rnd() * 256, r = 9 + rnd() * 5;
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + rnd() * 0.5; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, 5, 3.4, a, 0, Math.PI * 2); ctx.fill(); }
    }
    const t = finish(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  };

  return P;
}

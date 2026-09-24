import * as THREE from 'three';

export const FONT = '"Overpass", system-ui, sans-serif';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, repeat = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
}

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Facade: a grid of window panes, some lit, over a wall colour.
const facadeCache = new Map();
export function facade({ wall = '#6f7b86', glass = '#2b3a48', lit = '#ffe6a8', frame = null, cols = 4, rows = 4, glassy = false } = {}) {
  const key = JSON.stringify(arguments[0] ?? {});
  if (facadeCache.has(key)) return facadeCache.get(key);
  const [c, g] = canvas(256, 256);
  g.fillStyle = wall; g.fillRect(0, 0, 256, 256);
  const cw = 256 / cols, rh = 256 / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const pad = glassy ? 2 : cw * 0.18;
    const padY = glassy ? 2 : rh * 0.22;
    const grad = g.createLinearGradient(0, y * rh, 0, (y + 1) * rh);
    const on = rand() < 0.03;
    const sky = rand() * 30;
    grad.addColorStop(0, on ? lit : shade(glass, 55 + sky));
    grad.addColorStop(0.55, on ? shade(lit, -20) : shade(glass, 18 + sky * 0.5));
    grad.addColorStop(1, on ? shade(lit, -40) : glass);
    g.fillStyle = grad;
    g.fillRect(x * cw + pad, y * rh + padY, cw - pad * 2, rh - padY * 2);
    if (frame) { g.strokeStyle = frame; g.lineWidth = 2; g.strokeRect(x * cw + pad, y * rh + padY, cw - pad * 2, rh - padY * 2); }
  }
  const t = toTexture(c);
  facadeCache.set(key, t);
  return t;
}

// Limestone blocks (K-State campus, capitol)
export function stone(base = '#d9ccb1') {
  const [c, g] = canvas(256, 256);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    const h = 256 / rows, off = r % 2 ? 24 : 0;
    for (let x = -off; x < 256; x += 48) {
      g.fillStyle = shade(base, (rand() - 0.5) * 22);
      g.fillRect(x + 1, r * h + 1, 46, h - 2);
    }
  }
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(60,50,30,${rand() * 0.08})`;
    g.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  return toTexture(c);
}

export function brick(base = '#8e4a36') {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#cbbfae'; g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 16; r++) {
    const off = r % 2 ? 16 : 0;
    for (let x = -off; x < 256; x += 32) {
      g.fillStyle = shade(base, (rand() - 0.5) * 30);
      g.fillRect(x + 1, r * 16 + 1, 30, 14);
    }
  }
  return toTexture(c);
}

// Asphalt with lane lines baked in: u across the road, v along it.
export function asphalt() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#34363a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = 40 + rand() * 40;
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + rand() * 0.4})`;
    g.fillRect(rand() * 512, rand() * 512, 1.5, 1.5);
  }
  // edge lines
  g.fillStyle = '#e9e6dc';
  g.fillRect(18, 0, 10, 512); g.fillRect(512 - 28, 0, 10, 512);
  // centre double yellow
  g.fillStyle = '#e8b923';
  g.fillRect(246, 0, 7, 512); g.fillRect(259, 0, 7, 512);
  // tyre wear
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(110, 0, 50, 512); g.fillRect(352, 0, 50, 512);
  const t = toTexture(c);
  return t;
}

// Painted label for barricades/cones and green gantry signs.
export function label(lines, { w = 512, h = 160, bg = '#0b6b3a', fg = '#f7f9f4', border = true, weight = 800 } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(0, 0, w, h, h * 0.14); g.fill();
  if (border) {
    g.strokeStyle = fg; g.lineWidth = h * 0.045;
    g.beginPath(); g.roundRect(h * 0.07, h * 0.07, w - h * 0.14, h - h * 0.14, h * 0.1); g.stroke();
  }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((line, i) => {
    let size = i === 0 ? h * (n > 1 ? 0.36 : 0.5) : h * 0.22;
    g.font = `${i === 0 ? weight : 600} ${size}px ${FONT}`;
    while (g.measureText(line).width > w - h * 0.4 && size > 8) { size -= 2; g.font = `${i === 0 ? weight : 600} ${size}px ${FONT}`; }
    const y = n === 1 ? h / 2 : h * (0.38 + (i - (n - 1) / 2) * 0.34) + (i === 0 ? 0 : h * 0.06);
    g.fillText(line, w / 2, y + h * 0.03);
  });
  return toTexture(c);
}

// Diagonal orange/white stripes for barricade rails
export function stripes() {
  const [c, g] = canvas(256, 64);
  g.fillStyle = '#f7f4ee'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#f06a1b';
  for (let x = -64; x < 320; x += 48) {
    g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 24, 64); g.lineTo(x + 88, 0); g.lineTo(x + 64, 0); g.fill();
  }
  return toTexture(c);
}

export function billboard(title, sub, color) {
  const [c, g] = canvas(1024, 400);
  const grad = g.createLinearGradient(0, 0, 1024, 400);
  grad.addColorStop(0, color); grad.addColorStop(1, shade(color, -40));
  g.fillStyle = grad; g.fillRect(0, 0, 1024, 400);
  g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.font = `800 120px ${FONT}`; g.fillText(title, 60, 200);
  g.font = `600 52px ${FONT}`; g.fillText(sub, 64, 290);
  return toTexture(c);
}

export function screen(lines, bg = '#101826') {
  const [c, g] = canvas(1024, 576);
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 576);
  g.fillStyle = '#f7f9f4'; g.textAlign = 'center';
  g.font = `800 96px ${FONT}`; g.fillText(lines[0], 512, 270);
  g.font = `600 44px ${FONT}`; g.fillText(lines[1] ?? '', 512, 350);
  return toTexture(c);
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

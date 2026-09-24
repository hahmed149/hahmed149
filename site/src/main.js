import * as THREE from 'three';
import './style.css';
import { person, stops } from './data.js';
import { C, buildRoad, buildWorld, buildStops } from './world.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s) => document.querySelector(s);

renderResumeList();
wireUi();

if (!webglAvailable()) {
  document.body.classList.add('no-webgl');
  openList();
} else {
  document.fonts.load('800 64px Overpass').finally(start);
}

function webglAvailable() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

function start() {
  const canvas = $('#scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.sky);
  scene.fog = new THREE.Fog(C.sky, 90, 320);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 900);
  scene.add(new THREE.HemisphereLight(0xdcefff, 0x8a6f3c, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 260 });
  scene.add(sun, sun.target);

  const road = buildRoad();
  buildWorld(scene, road);
  const { placed, animated } = buildStops(scene, road, stops);
  const car = buildCar();
  scene.add(car.group);

  // Start just before the first exit, pointing down the highway
  const s0 = road.samples[6];
  const state = { x: s0.p.x, z: s0.p.z, heading: Math.atan2(s0.t.x, s0.t.z), speed: 0, auto: null, active: null, visited: new Set() };
  car.group.position.set(state.x, 0, state.z);
  camera.position.set(state.x - Math.sin(state.heading) * 16, 9, state.z - Math.cos(state.heading) * 16);

  const keys = new Set();
  addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, dialog')) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    keys.add(k);
    if (k === 'n') driveToNext();
    if (k === 'escape') closeSign();
    state.auto = state.auto && !['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k) ? state.auto : null;
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  document.querySelectorAll('[data-key]').forEach((btn) => {
    const k = btn.dataset.key;
    const on = (e) => { e.preventDefault(); keys.add(k); state.auto = null; btn.classList.add('down'); };
    const off = () => { keys.delete(k); btn.classList.remove('down'); };
    btn.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, off));
  });

  // Exit strip: jump (drive) to any stop
  const strip = $('#exits');
  placed.forEach((stop, i) => {
    const b = document.createElement('button');
    b.className = 'exit-chip';
    b.textContent = stop.exit;
    b.title = stop.company;
    b.setAttribute('aria-label', `Drive to exit ${stop.exit}: ${stop.company}`);
    b.addEventListener('click', () => driveTo(i));
    strip.appendChild(b);
  });
  $('#next').addEventListener('click', driveToNext);

  function currentU() { return road.nearest(state).sample.u; }
  function driveToNext() {
    const u = currentU();
    const i = placed.findIndex((s) => s.u > u + 0.004);
    driveTo(i === -1 ? 0 : i);
  }
  function driveTo(i) {
    const target = placed[i].u;
    if (reduceMotion) {
      const s = road.samples.find((x) => x.u >= target) ?? road.samples.at(-1);
      Object.assign(state, { x: s.p.x, z: s.p.z, heading: Math.atan2(s.t.x, s.t.z), speed: 0, auto: null });
      return;
    }
    state.auto = { u: currentU(), target };
  }

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 700 ? 68 : 55;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  const camTarget = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    step(dt);

    car.group.position.set(state.x, 0, state.z);
    car.group.rotation.y = state.heading;
    car.spin(state.speed * dt);
    car.steer(state.steerVis ?? 0);

    // Chase camera
    const back = state.speed < -1 ? -1 : 1;
    camTarget.set(state.x - Math.sin(state.heading) * 15 * back, 8.5, state.z - Math.cos(state.heading) * 15 * back);
    camera.position.lerp(camTarget, reduceMotion ? 1 : 1 - Math.pow(0.02, dt));
    lookAt.set(state.x + Math.sin(state.heading) * 6, 2, state.z + Math.cos(state.heading) * 6);
    camera.lookAt(lookAt);

    sun.position.set(state.x + 50, 90, state.z + 30);
    sun.target.position.set(state.x, 0, state.z);

    if (!reduceMotion) animated.forEach((fn) => fn(t));
    placed.forEach((p) => { p.pad.material.opacity = p === state.active ? 0.9 : 0.45 + Math.sin(t * 2) * 0.1; });
    renderer.render(scene, camera);
  });

  function step(dt) {
    const up = keys.has('w') || keys.has('arrowup');
    const down = keys.has('s') || keys.has('arrowdown');
    const left = keys.has('a') || keys.has('arrowleft');
    const right = keys.has('d') || keys.has('arrowright');
    const near = road.nearest(state);
    const offRoad = near.dist > 5.5;

    if (state.auto) {
      // Follow the highway toward the target stop
      const dir = Math.sign(state.auto.target - state.auto.u);
      state.auto.u += dir * dt * 0.035;
      if ((dir > 0 && state.auto.u >= state.auto.target) || (dir < 0 && state.auto.u <= state.auto.target) || dir === 0) {
        state.auto.u = state.auto.target;
      }
      const p = road.curve.getPointAt(state.auto.u), tan = road.curve.getTangentAt(state.auto.u);
      const h = Math.atan2(tan.x, tan.z) + (dir < 0 ? Math.PI : 0);
      state.speed = dir === 0 ? 0 : 22;
      state.x = p.x; state.z = p.z;
      state.heading = lerpAngle(state.heading, h, 1 - Math.pow(0.001, dt));
      state.steerVis = 0;
      if (state.auto.u === state.auto.target) { state.auto = null; state.speed = 0; }
    } else {
      const max = offRoad ? 12 : 30;
      if (up) state.speed += 24 * dt;
      else if (down) state.speed -= (state.speed > 0 ? 40 : 14) * dt;
      else state.speed *= Math.pow(offRoad ? 0.25 : 0.55, dt);
      state.speed = THREE.MathUtils.clamp(state.speed, -9, max);
      if (Math.abs(state.speed) < 0.05 && !up && !down) state.speed = 0;

      const steer = (left ? 1 : 0) - (right ? 1 : 0);
      state.steerVis = steer;
      const grip = THREE.MathUtils.clamp(Math.abs(state.speed) / 8, 0, 1);
      state.heading += steer * 1.9 * dt * grip * Math.sign(state.speed || 1);
      state.x += Math.sin(state.heading) * state.speed * dt;
      state.z += Math.cos(state.heading) * state.speed * dt;

      // Keep the car within the prairie corridor along the highway
      if (near.dist > 24) {
        const k = (near.dist - 24) / near.dist;
        state.x -= (state.x - near.sample.p.x) * k;
        state.z -= (state.z - near.sample.p.z) * k;
        state.speed *= 0.9;
      }
    }

    // Arrive at a stop
    let active = null;
    for (const p of placed) if (Math.hypot(p.pos.x - state.x, p.pos.z - state.z) < 7) active = p;
    if (active !== state.active) {
      state.active = active;
      if (active) openSign(active, placed.indexOf(active));
      else closeSign();
    }
    $('#speed').textContent = `${Math.round(Math.abs(state.speed) * 2.2)} mph`;
    document.querySelectorAll('.exit-chip').forEach((b, i) => {
      b.classList.toggle('here', placed[i] === state.active);
    });
  }

  function openSign(stop, i) {
    state.visited.add(stop.id);
    document.querySelectorAll('.exit-chip')[i]?.classList.add('seen');
    const sign = $('#sign');
    sign.querySelector('.sign-exit').textContent = stop.exit === 'Now' ? 'Now' : `Exit ${stop.exit}`;
    sign.querySelector('h2').textContent = stop.company;
    sign.querySelector('.sign-role').textContent = stop.title;
    sign.querySelector('.sign-meta').textContent = [stop.dates, stop.place].filter(Boolean).join(', ');
    const ul = sign.querySelector('ul');
    ul.replaceChildren(...stop.points.map((pt) => Object.assign(document.createElement('li'), { textContent: pt })));
    sign.hidden = false;
    requestAnimationFrame(() => sign.classList.add('open'));
    $('#hint').hidden = true;
  }
  function closeSign() {
    const sign = $('#sign');
    sign.classList.remove('open');
    sign.hidden = true;
  }
  $('#sign-close').addEventListener('click', closeSign);
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function buildCar() {
  const group = new THREE.Group();
  const m = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, flatShading: true, ...o });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 4.6), m(0xc8322b, { metalness: 0.3, roughness: 0.35 }));
  body.position.y = 0.95;
  const hood = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.3, 1.4), m(0xb02a24, { metalness: 0.3, roughness: 0.35 }));
  hood.position.set(0, 1.5, 1.4);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 2.2), m(0x1d2833, { metalness: 0.6, roughness: 0.15 }));
  cabin.position.set(0, 1.85, -0.35);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.12, 2), m(0xc8322b, { metalness: 0.3, roughness: 0.35 }));
  roof.position.set(0, 2.35, -0.4);
  const lights = [-0.75, 0.75].map((x) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.1), m(0xfff6d0, { emissive: 0xfff1b0, emissiveIntensity: 1.2 }));
    l.position.set(x, 1.05, 2.31);
    return l;
  });
  const tails = [-0.8, 0.8].map((x) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.1), m(0x7a0f0c, { emissive: 0xa0140f, emissiveIntensity: 0.8 }));
    l.position.set(x, 1.1, -2.31);
    return l;
  });
  group.add(body, hood, cabin, roof, ...lights, ...tails);

  const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.4, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  const fronts = [];
  for (const [x, z] of [[-1.2, 1.5], [1.2, 1.5], [-1.2, -1.5], [1.2, -1.5]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.48, z);
    const w = new THREE.Mesh(wheelGeo, m(0x1b1b1d, { roughness: 0.9 }));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 8).rotateZ(Math.PI / 2), m(0xc9ccd1, { metalness: 0.7 }));
    w.add(hub);
    pivot.add(w);
    group.add(pivot);
    wheels.push(w);
    if (z > 0) fronts.push(pivot);
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return {
    group,
    spin: (d) => wheels.forEach((w) => { w.rotation.x += d / 0.48; }),
    steer: (s) => fronts.forEach((p) => { p.rotation.y += (s * 0.45 - p.rotation.y) * 0.2; }),
  };
}

function renderResumeList() {
  $('#who h1').textContent = person.name;
  $('#who p').textContent = person.role;
  const list = $('#list-body');
  const head = document.createElement('header');
  head.innerHTML = `<h2>${person.name}</h2><p class="list-role">${person.role}, ${person.location}</p><p>${person.summary}</p>`;
  const contact = document.createElement('p');
  contact.className = 'list-contact';
  const mail = Object.assign(document.createElement('a'), { href: `mailto:${person.email}`, textContent: person.email });
  contact.append(mail);
  if (person.linkedin) contact.append(' ', Object.assign(document.createElement('a'), { href: person.linkedin, textContent: 'LinkedIn', rel: 'me noopener', target: '_blank' }));
  head.append(contact);
  list.append(head);
  [...stops].reverse().forEach((s) => {
    const sec = document.createElement('section');
    sec.innerHTML = `<p class="list-exit">${s.exit === 'Now' ? 'Now' : 'Exit ' + s.exit}</p><h3></h3><p class="list-role"></p><ul></ul>`;
    sec.querySelector('h3').textContent = s.company;
    sec.querySelector('.list-role').textContent = [s.title, s.dates, s.place].filter(Boolean).join(', ');
    sec.querySelector('ul').append(...s.points.map((p) => Object.assign(document.createElement('li'), { textContent: p })));
    list.append(sec);
  });
  $('#contact').href = `mailto:${person.email}`;
}

function openList() { $('#list').showModal(); }
function wireUi() {
  $('#open-list').addEventListener('click', openList);
  $('#close-list').addEventListener('click', () => $('#list').close());
}

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import './style.css';
import { person, sections, semesters, skills } from './data.js';
import { layout, buildRoad, buildWorld, ROAD_W } from './world.js';
import { buildLandmark } from './landmarks.js';
import { buildCar } from './car.js';
import { buildObstacles } from './obstacles.js';
import { createAudio } from './audio.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };

renderList();
$('#open-list').addEventListener('click', () => $('#list').showModal());
$('#close-list').addEventListener('click', () => $('#list').close());

const gl = (() => { try { return document.createElement('canvas').getContext('webgl2'); } catch { return null; } })();
if (!gl) {
  document.body.classList.add('no-webgl');
  $('#loading').hidden = true;
  $('#list').showModal();
} else {
  document.fonts.load('800 64px Overpass').finally(() => requestAnimationFrame(start));
}

function start() {
  const { plan, length } = layout(sections, semesters);
  const renderer = new THREE.WebGLRenderer({ canvas: $('#scene'), antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.42;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 2600);

  // Sky, sun, and image-based lighting from the sky itself
  const sky = new Sky();
  sky.scale.setScalar(10000);
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(62), THREE.MathUtils.degToRad(210));
  sky.material.uniforms.turbidity.value = 4;
  sky.material.uniforms.rayleigh.value = 2.2;
  sky.material.uniforms.mieCoefficient.value = 0.004;
  sky.material.uniforms.mieDirectionalG.value = 0.85;
  sky.material.uniforms.sunPosition.value.copy(sunDir);
  scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); const skyClone = sky.clone(); envScene.add(skyClone);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.45;
  scene.fog = new THREE.Fog('#c9d9e4', 260, 1500);

  const sun = new THREE.DirectionalLight('#fff1dc', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 500 });
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#cfe4ff', '#6b5a3a', 0.6));

  const road = buildRoad(length);
  buildWorld(scene, road, plan);
  const animate = [];
  const landmarks = plan.map((sec) => {
    const f = road.at(sec.landmarkS);
    const lm = buildLandmark(sec.landmark, animate);
    const pos = f.p.clone().addScaledVector(f.n, sec.side * 50);
    lm.position.copy(pos);
    const toRoad = f.n.clone().multiplyScalar(-sec.side);
    lm.rotation.y = Math.atan2(toRoad.x, toRoad.z);
    scene.add(lm);
    return { sec, pos, s: sec.landmarkS };
  });
  const obstacles = buildObstacles(scene, road, plan);
  const car = buildCar();
  scene.add(car.group);
  const audio = createAudio();

  // ---------- state ----------
  const startSec = plan.find((p) => p.id === location.hash.slice(1));
  const s0 = road.at(startSec ? startSec.landmarkS - 45 : 20);
  road.reset(s0.i);
  if (startSec) obstacles.list.filter((o) => o.s < s0.s).forEach((o) => { o.hit = true; o.skipped = true; o.mesh.removeFromParent(); });
  const live = obstacles.list.filter((o) => !o.skipped);
  const totals = { course: live.filter((o) => o.kind === 'course').length, feat: live.filter((o) => o.kind === 'feat').length };
  const state = { x: s0.p.x, z: s0.p.z, heading: s0.heading, speed: 0, steer: 0, s: s0.s, prevS: s0.s, lateral: 0, auto: null, section: -1, done: { course: 0, feat: 0 }, shake: 0, finished: false };
  const keys = new Set();
  const driveKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('dialog')) return;
    const k = e.key.toLowerCase();
    if ([...driveKeys, ' '].includes(k)) e.preventDefault();
    if (driveKeys.includes(k)) { keys.add(k); state.auto = null; state.autoS = null; }
    if (k === 'n') driveToNext();
    if (k === 'm') toggleSound();
    if (k === 'j') toggleJournal();
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  document.querySelectorAll('[data-key]').forEach((btn) => {
    const k = btn.dataset.key;
    const on = (e) => { e.preventDefault(); keys.add(k); state.auto = null; state.autoS = null; btn.classList.add('down'); };
    const off = () => { keys.delete(k); btn.classList.remove('down'); };
    btn.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, off));
  });

  // ---------- HUD ----------
  const stopsNav = $('#stops');
  plan.forEach((sec, i) => {
    const b = el('button', { className: 'stop', textContent: sec.years === 'Now' ? 'Now' : sec.years.slice(0, 4), title: sec.company });
    b.setAttribute('aria-label', `Drive to ${sec.company}`);
    b.addEventListener('click', () => driveTo(sec.landmarkS - 40));
    stopsNav.append(b);
  });
  $('#next').addEventListener('click', driveToNext);
  $('#sound').addEventListener('click', toggleSound);
  $('#journal-btn').addEventListener('click', toggleJournal);
  $('#journal-close').addEventListener('click', toggleJournal);
  $('#finish-close').addEventListener('click', () => { $('#finish').hidden = true; });
  function toggleSound() { const on = audio.toggle(); $('#sound').textContent = on ? 'Sound on' : 'Sound off'; $('#sound').setAttribute('aria-pressed', on); }
  function toggleJournal() { const j = $('#journal'); j.hidden = !j.hidden; $('#journal-btn').setAttribute('aria-expanded', !j.hidden); }

  // Journal: every obstacle, checked off as it's overcome
  const journalBody = $('#journal-body');
  const rows = new Map();
  plan.forEach((sec, si) => {
    const items = obstacles.list.filter((o) => o.section === si);
    const list = el('ul');
    items.forEach((o) => {
      const li = el('li', { textContent: o.kind === 'course' ? o.text : o.text });
      if (o.kind === 'course') li.classList.add('course');
      rows.set(o, li);
      list.append(li);
    });
    journalBody.append(el('section', {}, el('h3', { textContent: sec.company }), el('p', { className: 'j-meta', textContent: `${sec.title}, ${sec.years}` }), list));
  });

  function updateCounts() {
    $('#count-feat').textContent = `${state.done.feat} / ${totals.feat}`;
    $('#count-course').textContent = `${state.done.course} / ${totals.course}`;
  }
  updateCounts();

  let toastTimer;
  const feed = $('#feed');
  function toast(o, direct) {
    const item = el('div', { className: `toast ${o.kind}` },
      el('strong', { textContent: o.kind === 'course' ? `${o.term}: ${o.title}` : o.title }),
      el('span', { textContent: o.kind === 'course' ? o.text.split(': ')[1] : o.text }));
    feed.prepend(item);
    while (feed.children.length > 3) feed.lastChild.remove();
    clearTimeout(toastTimer);
    setTimeout(() => item.classList.add('out'), 5200);
    setTimeout(() => item.remove(), 5800);
    if (direct) state.shake = 0.35;
  }

  function onHit(o, direct) {
    state.done[o.kind]++;
    rows.get(o)?.classList.add('done');
    updateCounts();
    toast(o, direct);
    audio.hit(direct ? 1 : 0.4);
    if (direct) state.speed *= o.kind === 'feat' ? 0.82 : 0.95;
  }

  // Section card as you reach each landmark
  function showSection(i) {
    const sec = plan[i];
    const card = $('#card');
    card.querySelector('.card-years').textContent = sec.years;
    card.querySelector('h2').textContent = sec.company;
    card.querySelector('.card-role').textContent = sec.title;
    card.querySelector('.card-place').textContent = sec.place;
    card.querySelector('.card-blurb').textContent = sec.blurb;
    card.hidden = false;
    card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
    clearTimeout(showSection.t);
    if (innerWidth < 760) showSection.t = setTimeout(() => { card.hidden = true; }, 6000);
    document.querySelectorAll('.stop').forEach((b, k) => { b.classList.toggle('here', k === i); if (k <= i) b.classList.add('seen'); });
  }

  // Minimap
  const mini = $('#minimap'), mctx = mini.getContext('2d');
  const box = new THREE.Box3().setFromPoints(road.samples.map((s) => s.p));
  function drawMini() {
    const dpr = Math.min(devicePixelRatio, 2);
    const W = mini.clientWidth * dpr, H = mini.clientHeight * dpr;
    if (mini.width !== W) { mini.width = W; mini.height = H; }
    const pad = 10 * dpr;
    const sc = Math.min((W - pad * 2) / (box.max.x - box.min.x), (H - pad * 2) / (box.max.z - box.min.z));
    const px = (x) => pad + (x - box.min.x) * sc + ((W - pad * 2) - (box.max.x - box.min.x) * sc) / 2;
    const pz = (z) => pad + (z - box.min.z) * sc;
    mctx.clearRect(0, 0, W, H);
    mctx.lineCap = 'round'; mctx.lineJoin = 'round';
    mctx.lineWidth = 3 * dpr; mctx.strokeStyle = 'rgba(255,255,255,0.35)';
    mctx.beginPath();
    road.samples.forEach((s, i) => { if (i % 6) return; i ? mctx.lineTo(px(s.p.x), pz(s.p.z)) : mctx.moveTo(px(s.p.x), pz(s.p.z)); });
    mctx.stroke();
    mctx.strokeStyle = '#f2c230';
    mctx.beginPath();
    road.samples.forEach((s, i) => { if (i % 6 || s.s > state.s) return; i ? mctx.lineTo(px(s.p.x), pz(s.p.z)) : mctx.moveTo(px(s.p.x), pz(s.p.z)); });
    mctx.stroke();
    landmarks.forEach((l, i) => {
      const f = road.at(l.s);
      mctx.fillStyle = i <= state.section ? '#1f9d5b' : '#f7f9f4';
      mctx.beginPath(); mctx.arc(px(f.p.x), pz(f.p.z), 3.5 * dpr, 0, Math.PI * 2); mctx.fill();
    });
    mctx.save();
    mctx.translate(px(state.x), pz(state.z));
    mctx.rotate(-state.heading + Math.PI);
    mctx.fillStyle = '#e8352b';
    mctx.beginPath(); mctx.moveTo(0, -6 * dpr); mctx.lineTo(4.5 * dpr, 5 * dpr); mctx.lineTo(-4.5 * dpr, 5 * dpr); mctx.fill();
    mctx.restore();
  }

  // ---------- auto-drive ----------
  function driveToNext() {
    const next = plan.find((p) => p.landmarkS - 40 > state.s + 5);
    driveTo(next ? next.landmarkS - 40 : plan[0].landmarkS - 40);
  }
  function driveTo(target) {
    if (target < state.s) { // jump back
      const f = road.at(target);
      Object.assign(state, { x: f.p.x, z: f.p.z, heading: f.heading, speed: 0, s: target, prevS: target, auto: null });
      road.reset(f.i);
      return;
    }
    state.auto = { target }; state.autoS = state.s;
  }

  // ---------- loop ----------
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = innerWidth < 700 ? 68 : 55;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  const timer = new THREE.Timer();
  const camPos = new THREE.Vector3(state.x, 12, state.z + 20);
  const look = new THREE.Vector3();
  const reveal = new THREE.Vector3();
  camera.position.copy(camPos);
  $('#loading').classList.add('gone');
  setTimeout(() => { $('#loading').hidden = true; }, 600);

  renderer.setAnimationLoop(() => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    const t = timer.getElapsed();
    step(dt);
    obstacles.update(dt, state, t, onHit);
    if (!reduceMotion) animate.forEach((fn) => fn(t));

    car.group.position.set(state.x, 0, state.z);
    car.group.rotation.y = state.heading;
    car.group.rotation.z = -state.steer * Math.min(Math.abs(state.speed) / 40, 1) * 0.05;
    car.spin(state.speed * dt);
    car.steer(state.steer);
    car.brake(state.braking);

    // chase camera, pulls back with speed
    const dist = 11 + Math.abs(state.speed) * 0.12;
    const back = state.speed < -2 ? -1 : 1;
    const tx = state.x - Math.sin(state.heading) * dist * back, tz = state.z - Math.cos(state.heading) * dist * back;
    camPos.lerp(new THREE.Vector3(tx, 4.8 + Math.abs(state.speed) * 0.04, tz), reduceMotion ? 1 : 1 - Math.pow(0.004, dt));
    camera.position.copy(camPos);
    if (state.shake > 0 && !reduceMotion) {
      camera.position.x += (Math.random() - 0.5) * state.shake;
      camera.position.y += (Math.random() - 0.5) * state.shake;
      state.shake = Math.max(0, state.shake - dt);
    }
    look.set(state.x + Math.sin(state.heading) * 8, 1.6, state.z + Math.cos(state.heading) * 8);
    // Turn toward the landmark as you pass it
    const lm = landmarks.find((l) => state.s > l.s - 110 && state.s < l.s + 30);
    let w = 0;
    if (lm) {
      w = Math.sin(THREE.MathUtils.clamp((state.s - (lm.s - 110)) / 140, 0, 1) * Math.PI) * 0.5;
      reveal.set(lm.pos.x, 16, lm.pos.z);
      look.lerp(reveal, w);
      camera.position.y += w * 9;
    }
    camera.lookAt(look);

    sun.position.set(state.x + sunDir.x * 200, sunDir.y * 200, state.z + sunDir.z * 200);
    sun.target.position.set(state.x + Math.sin(state.heading) * 30, 0, state.z + Math.cos(state.heading) * 30);

    audio.engine(state.speed);
    $('#speed').textContent = Math.round(Math.abs(state.speed) * 2.1);
    drawMini();
    renderer.render(scene, camera);
  });

  function step(dt) {
    const up = keys.has('w') || keys.has('arrowup');
    const down = keys.has('s') || keys.has('arrowdown');
    const left = keys.has('a') || keys.has('arrowleft');
    const right = keys.has('d') || keys.has('arrowright');
    state.prevS = state.s;

    if (state.auto) {
      // Cruise along the centre of the right lane toward the target
      const remaining = state.auto.target - (state.autoS ?? state.s);
      const target = THREE.MathUtils.clamp(remaining * 0.8, 6, 34);
      state.speed += (target - state.speed) * Math.min(1, dt * 2);
      state.autoS = (state.autoS ?? state.s) + state.speed * dt;
      const u = Math.min(state.autoS / road.total, 1);
      const p = road.curve.getPointAt(u), tan = road.curve.getTangentAt(u);
      state.x = p.x; state.z = p.z;
      state.heading = Math.atan2(tan.x, tan.z);
      state.steer = 0;
      state.braking = false;
      if (remaining < 1) { state.auto = null; state.autoS = null; state.speed = 0; }
    } else {
      const near = road.nearest(state);
      const offRoad = near.dist > ROAD_W / 2 + 1.5;
      const max = offRoad ? 14 : 42;
      state.braking = down && state.speed > 0.5;
      if (up) state.speed += (state.speed < 0 ? 40 : 20 - state.speed * 0.25) * dt;
      else if (down) state.speed -= (state.speed > 0 ? 38 : 12) * dt;
      else state.speed *= Math.pow(offRoad ? 0.3 : 0.7, dt);
      if (state.speed > max) state.speed += (max - state.speed) * Math.min(1, dt * 3);
      state.speed = Math.max(state.speed, -10);
      if (Math.abs(state.speed) < 0.1 && !up && !down) state.speed = 0;
      const steerIn = (left ? 1 : 0) - (right ? 1 : 0);
      state.steer += (steerIn - state.steer) * Math.min(1, dt * 8);
      const grip = Math.min(1, Math.abs(state.speed) / 6) * (1 - Math.min(Math.abs(state.speed), 42) / 110);
      state.heading += state.steer * 1.8 * dt * grip * Math.sign(state.speed || 1);
      state.x += Math.sin(state.heading) * state.speed * dt;
      state.z += Math.cos(state.heading) * state.speed * dt;
      if (near.dist > 60) { // keep within the corridor
        const k = (near.dist - 60) / near.dist;
        state.x -= (state.x - near.sample.p.x) * k; state.z -= (state.z - near.sample.p.z) * k;
        state.speed *= 0.9;
      }
    }
    const near = road.nearest(state);
    state.s = near.sample.s;
    const dx = state.x - near.sample.p.x, dz = state.z - near.sample.p.z;
    state.lateral = dx * near.sample.n.x + dz * near.sample.n.z;

    // Arriving at a landmark
    const idx = plan.findIndex((p) => state.s > p.landmarkS - 60 && state.s < p.end);
    if (idx !== -1 && idx !== state.section) { state.section = idx; showSection(idx); }
    if (!state.finished && state.s > plan.at(-1).landmarkS) {
      state.finished = true;
      $('#finish-count').textContent = `You overcame ${state.done.feat} of ${totals.feat} accomplishments and passed ${state.done.course} of ${totals.course} courses.`;
      $('#finish').hidden = false;
    }
    if (state.s > 80) $('#hint').classList.add('gone');
  }
}

function renderList() {
  const body = $('#list-body');
  const contact = el('p', { className: 'list-contact' },
    el('a', { href: `mailto:${person.email}`, textContent: person.email }), ' ',
    el('a', { href: person.linkedin, textContent: 'LinkedIn', rel: 'me noopener', target: '_blank' }), ' ',
    el('a', { href: person.github, textContent: 'GitHub', rel: 'me noopener', target: '_blank' }));
  body.append(el('header', {}, el('h2', { textContent: person.name }), el('p', { className: 'list-role', textContent: `${person.role}, ${person.location}` }), el('p', { textContent: person.summary }), contact));
  [...sections].reverse().forEach((s) => {
    body.append(el('section', {},
      el('h3', { textContent: s.company }),
      el('p', { className: 'list-role', textContent: [s.title, s.years, s.place].filter(Boolean).join(', ') }),
      el('ul', {}, ...s.obstacles.map(([, text]) => el('li', { textContent: text })))));
  });
  body.append(el('section', {}, el('h3', { textContent: 'Kansas State coursework' }),
    ...semesters.map((sem) => el('p', { className: 'list-courses' }, el('strong', { textContent: `${sem.term}${sem.honors ? ' (semester honors)' : ''}: ` }), sem.courses.map(([c, n]) => `${c} ${n}`).join(', ')))));
  body.append(el('section', {}, el('h3', { textContent: 'Skills' }),
    el('dl', { className: 'list-skills' }, ...skills.flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v })]))));
  $('#contact').href = `mailto:${person.email}`;
  $('#linkedin').href = person.linkedin;
}

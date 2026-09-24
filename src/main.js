import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import './style.css';
import * as data from './data.js';
import { layout, buildRoad, buildWorld, ROAD_W } from './world.js';
import { buildLandmark } from './landmarks.js';
import { buildCar } from './car.js';
import { buildObstacles } from './obstacles.js';
import { createAudio } from './audio.js';

const { person, sections, semesters, skills } = data;
const SHORT = { ksu: 'K-State', collegian: 'Collegian', softek: 'Softek', cerner: 'Cerner', rxss: 'RxSS', fluxpilot: 'Fluxpilot', annovox: 'Annovox', nac: 'NAC', addi: 'Addi', oneimaging: 'OneImaging' };
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
  const T = layout(data);
  const renderer = new THREE.WebGLRenderer({ canvas: $('#scene'), antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.42;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 2600);

  // Sky, sun, and image-based lighting from the sky
  const sky = new Sky();
  sky.scale.setScalar(10000);
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(62), THREE.MathUtils.degToRad(210));
  const u = sky.material.uniforms;
  u.turbidity.value = 4; u.rayleigh.value = 2.2; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.85;
  u.sunPosition.value.copy(sunDir);
  scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); envScene.add(sky.clone());
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.45;
  scene.fog = new THREE.Fog('#c9d9e4', 280, 1600);
  const sun = new THREE.DirectionalLight('#fff1dc', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  Object.assign(sun.shadow.camera, { left: -100, right: 100, top: 100, bottom: -100, near: 1, far: 500 });
  scene.add(sun, sun.target, new THREE.HemisphereLight('#cfe4ff', '#6b5a3a', 0.6));

  const road = buildRoad(T.length);
  buildWorld(scene, road, T);
  const animate = [];
  [...T.roles, T.finish].forEach((r) => {
    const f = road.at(r.landmarkS);
    const lm = buildLandmark(r.landmark, animate);
    lm.position.copy(f.p).addScaledVector(f.n, r.landmarkOffset);
    const toRoad = f.n.clone().multiplyScalar(-Math.sign(r.landmarkOffset));
    lm.rotation.y = Math.atan2(toRoad.x, toRoad.z);
    scene.add(lm);
  });
  const obstacles = buildObstacles(scene, road, T);
  const car = buildCar();
  scene.add(car.group);
  const audio = createAudio();
  const laneOff = (r, s) => (r && r.slot ? T.offset(r, s) : 0);
  const entryS = (r) => (r.slot ? r.s0 + r.taper + 4 : r.s0 + 4);

  // ---------- state ----------
  const startRole = T.roles.find((r) => r.id === location.hash.slice(1));
  const startS = startRole ? entryS(startRole) - (startRole.slot ? 18 : 50) : 30;
  const startLat = startRole ? laneOff(startRole, startS) : 0;
  const sp = road.point(startS, startLat);
  road.reset(road.at(startS).i);
  const state = {
    x: sp.p.x, z: sp.p.z, heading: Math.atan2(sp.t.x, sp.t.z), speed: 0, steer: 0, braking: false,
    s: startS, prevS: startS, lateral: startLat, auto: null, role: null, done: { course: 0, feat: 0 }, shake: 0, finished: false,
  };
  if (startRole) obstacles.list.filter((o) => o.s < startS).forEach((o) => { o.hit = true; o.skipped = true; o.mesh.removeFromParent(); });
  const live = obstacles.list.filter((o) => !o.skipped);
  const totals = { course: live.filter((o) => o.kind === 'course').length, feat: live.filter((o) => o.kind !== 'course').length };

  const keys = new Set();
  const driveKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('dialog')) return;
    const k = e.key.toLowerCase();
    if ([...driveKeys, ' '].includes(k)) e.preventDefault();
    if (driveKeys.includes(k)) { keys.add(k); state.auto = null; }
    if (k === 'n') driveToNext();
    if (k === 'm') toggleSound();
    if (k === 'j') toggleJournal();
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

  // ---------- HUD ----------
  const ordered = [...T.roles].sort((a, b) => a.s0 - b.s0);
  const stopsNav = $('#stops');
  const chips = new Map();
  ordered.forEach((r) => {
    const b = el('button', { className: 'stop', textContent: SHORT[r.id] ?? r.company, title: `${r.company}, ${r.years}` });
    b.setAttribute('aria-label', `Drive to ${r.company}, ${r.years}`);
    b.addEventListener('click', () => driveTo(r));
    chips.set(r, b);
    stopsNav.append(b);
  });
  $('#next').addEventListener('click', driveToNext);
  $('#sound').addEventListener('click', toggleSound);
  $('#journal-btn').addEventListener('click', toggleJournal);
  $('#journal-close').addEventListener('click', toggleJournal);
  $('#finish-close').addEventListener('click', () => { $('#finish').hidden = true; });
  function toggleSound() { const on = audio.toggle(); $('#sound').textContent = on ? 'Sound on' : 'Sound off'; $('#sound').setAttribute('aria-pressed', on); }
  function toggleJournal() { const j = $('#journal'); j.hidden = !j.hidden; $('#journal-btn').setAttribute('aria-expanded', !j.hidden); }

  const journalBody = $('#journal-body');
  const rows = new Map();
  ordered.forEach((r) => {
    const list = el('ul');
    obstacles.list.filter((o) => o.role === r.index).forEach((o) => {
      const li = el('li', { textContent: o.text, className: o.kind });
      rows.set(o, li);
      list.append(li);
    });
    journalBody.append(el('section', {}, el('h3', { textContent: r.company }), el('p', { className: 'j-meta', textContent: `${r.title}, ${r.years}` }), list));
  });

  function updateCounts() {
    $('#count-feat').textContent = `${state.done.feat} / ${totals.feat}`;
    $('#count-course').textContent = `${state.done.course} / ${totals.course}`;
  }
  updateCounts();

  const feed = $('#feed');
  function toast(o) {
    const head = o.kind === 'course' ? `${o.term}: ${o.title}` : o.title;
    const body = o.kind === 'course' ? o.text.split(': ')[1] : o.text;
    const item = el('div', { className: `toast ${o.kind}` }, el('strong', { textContent: head }), el('span', { textContent: body }));
    feed.prepend(item);
    while (feed.children.length > 3) feed.lastChild.remove();
    setTimeout(() => item.classList.add('out'), 5200);
    setTimeout(() => item.remove(), 5800);
  }
  function onHit(o, direct) {
    state.done[o.kind === 'course' ? 'course' : 'feat']++;
    rows.get(o)?.classList.add('done');
    updateCounts();
    toast(o);
    audio.hit(direct ? 1 : 0.4);
    if (direct) { state.shake = 0.3; state.speed *= o.kind === 'course' ? 0.96 : 0.85; }
  }

  // The card always describes the road the car is on
  function showRole(r) {
    const card = $('#card');
    card.querySelector('.card-years').textContent = r.years;
    card.querySelector('h2').textContent = r.company;
    card.querySelector('.card-role').textContent = r.title;
    card.querySelector('.card-place').textContent = r.place;
    card.querySelector('.card-blurb').textContent = r.blurb;
    card.hidden = false;
    card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
    clearTimeout(showRole.t);
    if (innerWidth < 760) showRole.t = setTimeout(() => { card.hidden = true; }, 6000);
    chips.forEach((b, rr) => { b.classList.toggle('here', rr === r); });
    chips.get(r)?.classList.add('seen');
  }
  function roleUnderCar() {
    if (state.s > T.finishS - 10) return T.finish;
    const open = T.roles.filter((r) => state.s >= entryS(r) && state.s <= r.s1 && (!r.slot || Math.abs(T.offset(r, state.s)) > Math.abs(r.slot) * 16 * 0.6));
    let best = null, bd = ROAD_W / 2 + 3;
    for (const r of open) {
      const d = Math.abs(state.lateral - laneOff(r, state.s));
      if (d < bd) { bd = d; best = r; }
    }
    if (!best) { // on the main road between jobs: keep the latest main-road role
      const main = T.roles.filter((r) => !r.slot && state.s >= entryS(r)).at(-1);
      if (main && Math.abs(state.lateral) < ROAD_W / 2 + 3) best = main;
    }
    return best;
  }

  // Minimap: every road, progress in yellow
  const mini = $('#minimap'), mctx = mini.getContext('2d');
  const box = new THREE.Box3().setFromPoints(road.samples.map((s) => s.p));
  const lanePaths = [{ from: 0, to: road.total, off: () => 0 }, ...T.roles.filter((r) => r.slot).map((r) => ({ from: r.s0, to: r.s1, off: (s) => T.offset(r, s) }))]
    .map((L) => road.samples.filter((s, i) => i % 8 === 0 && s.s >= L.from && s.s <= L.to).map((s) => { const o = L.off(s.s); return [s.p.x + s.n.x * o, s.p.z + s.n.z * o, s.s]; }));
  function drawMini() {
    const dpr = Math.min(devicePixelRatio, 2);
    const W = mini.clientWidth * dpr, H = mini.clientHeight * dpr;
    if (mini.width !== W) { mini.width = W; mini.height = H; }
    const pad = 10 * dpr;
    const sc = Math.min((W - pad * 2) / (box.max.x - box.min.x + 60), (H - pad * 2) / (box.max.z - box.min.z + 60));
    const ox = (W - (box.max.x - box.min.x) * sc) / 2, oz = (H - (box.max.z - box.min.z) * sc) / 2;
    const px = (x) => ox + (x - box.min.x) * sc, pz = (z) => oz + (z - box.min.z) * sc;
    mctx.clearRect(0, 0, W, H);
    mctx.lineCap = mctx.lineJoin = 'round';
    lanePaths.forEach((path) => {
      mctx.lineWidth = 2 * dpr; mctx.strokeStyle = 'rgba(255,255,255,0.35)';
      mctx.beginPath(); path.forEach(([x, z], i) => (i ? mctx.lineTo(px(x), pz(z)) : mctx.moveTo(px(x), pz(z)))); mctx.stroke();
      mctx.strokeStyle = '#f2c230';
      mctx.beginPath(); let started = false;
      path.forEach(([x, z, s]) => { if (s > state.s) return; started ? mctx.lineTo(px(x), pz(z)) : mctx.moveTo(px(x), pz(z)); started = true; });
      mctx.stroke();
    });
    mctx.save();
    mctx.translate(px(state.x), pz(state.z));
    mctx.rotate(-state.heading + Math.PI);
    mctx.fillStyle = '#e8352b';
    mctx.beginPath(); mctx.moveTo(0, -6 * dpr); mctx.lineTo(4.5 * dpr, 5 * dpr); mctx.lineTo(-4.5 * dpr, 5 * dpr); mctx.fill();
    mctx.restore();
  }

  // ---------- auto-drive: follow a role's own road ----------
  function driveToNext() {
    const next = ordered.find((r) => entryS(r) > state.s + 5);
    if (next) driveTo(next);
    else state.auto = { role: null, target: T.finishS + 60, s: state.s, lat: state.lateral };
  }
  function driveTo(r) {
    const target = entryS(r) + 20;
    if (target < state.s) {
      const s = entryS(r) - (r.slot ? 18 : 30), lat = laneOff(r, s), p = road.point(s, lat);
      Object.assign(state, { x: p.p.x, z: p.p.z, heading: Math.atan2(p.t.x, p.t.z), speed: 0, s, prevS: s, lateral: lat, auto: null });
      road.reset(road.at(s).i);
      return;
    }
    state.auto = { role: r, target, s: state.s, lat: state.lateral };
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = innerWidth < 700 ? 66 : 55;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  const timer = new THREE.Timer();
  const camPos = new THREE.Vector3(state.x - Math.sin(state.heading) * 14, 7, state.z - Math.cos(state.heading) * 14);
  const camGoal = new THREE.Vector3();
  const look = new THREE.Vector3();
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

    // Chase camera locked behind the car; it only pulls back with speed
    const dist = 12 + Math.abs(state.speed) * 0.12;
    const back = state.speed < -2 ? -1 : 1;
    camGoal.set(state.x - Math.sin(state.heading) * dist * back, 5.6 + Math.abs(state.speed) * 0.05, state.z - Math.cos(state.heading) * dist * back);
    camPos.lerp(camGoal, reduceMotion ? 1 : 1 - Math.pow(0.002, dt));
    camera.position.copy(camPos);
    if (state.shake > 0 && !reduceMotion) {
      camera.position.x += (Math.random() - 0.5) * state.shake;
      camera.position.y += (Math.random() - 0.5) * state.shake;
      state.shake = Math.max(0, state.shake - dt);
    }
    look.set(state.x + Math.sin(state.heading) * 10, 1.8, state.z + Math.cos(state.heading) * 10);
    camera.lookAt(look);

    sun.position.set(state.x + sunDir.x * 200, sunDir.y * 200, state.z + sunDir.z * 200);
    sun.target.position.set(state.x + Math.sin(state.heading) * 40, 0, state.z + Math.cos(state.heading) * 40);

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
      const A = state.auto;
      const remaining = A.target - A.s;
      const want = THREE.MathUtils.clamp(remaining * 0.7, 8, 34);
      state.speed += (want - state.speed) * Math.min(1, dt * 2);
      A.s += state.speed * dt;
      const goalLat = laneOff(A.role, A.s);
      A.lat += (goalLat - A.lat) * Math.min(1, dt * 1.6);
      const p = road.point(A.s, A.lat), q = road.point(A.s + 2, A.lat + (goalLat - A.lat) * Math.min(1, 2 * 1.6 / Math.max(state.speed, 1)));
      state.heading = Math.atan2(q.p.x - p.p.x, q.p.z - p.p.z);
      state.x = p.p.x; state.z = p.p.z;
      state.steer = 0; state.braking = false;
      if (remaining < 1) { state.auto = null; state.speed = 0; }
    } else {
      const lanes = T.lanesAt(state.s);
      const onRoad = lanes.some((o) => Math.abs(state.lateral - o) < ROAD_W / 2 + 1.5);
      const max = onRoad ? 42 : 16;
      state.braking = down && state.speed > 0.5;
      if (up) state.speed += (state.speed < 0 ? 40 : 20 - state.speed * 0.25) * dt;
      else if (down) state.speed -= (state.speed > 0 ? 38 : 12) * dt;
      else state.speed *= Math.pow(onRoad ? 0.7 : 0.3, dt);
      if (state.speed > max) state.speed += (max - state.speed) * Math.min(1, dt * 3);
      state.speed = Math.max(state.speed, -10);
      if (Math.abs(state.speed) < 0.1 && !up && !down) state.speed = 0;
      const steerIn = (left ? 1 : 0) - (right ? 1 : 0);
      state.steer += (steerIn - state.steer) * Math.min(1, dt * 8);
      const grip = Math.min(1, Math.abs(state.speed) / 6) * (1 - Math.min(Math.abs(state.speed), 42) / 110);
      state.heading += state.steer * 1.8 * dt * grip * Math.sign(state.speed || 1);
      state.x += Math.sin(state.heading) * state.speed * dt;
      state.z += Math.cos(state.heading) * state.speed * dt;
      const limit = Math.max(...lanes.map(Math.abs)) + 45;
      if (Math.abs(state.lateral) > limit) {
        const n = road.nearest(state).sample, k = (Math.abs(state.lateral) - limit) * Math.sign(state.lateral);
        state.x -= n.n.x * k; state.z -= n.n.z * k; state.speed *= 0.9;
      }
    }
    const near = road.nearest(state);
    state.s = near.sample.s;
    state.lateral = (state.x - near.sample.p.x) * near.sample.n.x + (state.z - near.sample.p.z) * near.sample.n.z;

    const r = roleUnderCar();
    if (r && r !== state.role) { state.role = r; showRole(r); }
    if (!state.finished && state.s > T.finishS + 50) {
      state.finished = true;
      $('#finish-count').textContent = `You overcame ${state.done.feat} of ${totals.feat} accomplishments and passed ${state.done.course} of ${totals.course} courses. Missed some? They're on the other roads. Check the journal.`;
      $('#finish').hidden = false;
    }
    if (state.s > startS + 60) $('#hint').classList.add('gone');
  }
}

function renderList() {
  const body = $('#list-body');
  const contact = el('p', { className: 'list-contact' },
    el('a', { href: `mailto:${person.email}`, textContent: person.email }),
    el('a', { href: person.linkedin, textContent: 'LinkedIn', rel: 'me noopener', target: '_blank' }),
    el('a', { href: person.github, textContent: 'GitHub', rel: 'me noopener', target: '_blank' }));
  body.append(el('header', {}, el('h2', { textContent: person.name }), el('p', { className: 'list-role', textContent: `${person.role}, ${person.location}` }), el('p', { textContent: person.summary }), contact));
  [...sections].sort((a, b) => b.start.localeCompare(a.start)).forEach((s) => {
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

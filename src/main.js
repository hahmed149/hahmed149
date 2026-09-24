import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import './style.css';
import * as data from './data.js';
import { layout, buildRoad, buildWorld, ROAD_W } from './world.js';
import { buildLandmark } from './landmarks.js';
import { hologram } from './holo.js';
import { buildCar } from './car.js';
import { buildObstacles } from './obstacles.js';
import { buildAirport, buildMiami, createCutscene } from './miami.js';
import { createAudio } from './audio.js';
import { BRANCH, GOLD } from './theme.js';

const { person, sections, semesters, skills, community } = data;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };

renderList();
$('#open-list').addEventListener('click', () => $('#list').showModal());
$('#close-list').addEventListener('click', () => $('#list').close());

const gl = (() => { try { return document.createElement('canvas').getContext('webgl2'); } catch { return null; } })();
if (!gl) {
  document.body.classList.add('no-webgl');
  $('#loading').hidden = true;
  $('#nogl').hidden = false;
  $('#nogl-open').addEventListener('click', () => $('#list').showModal());
  $('#list').showModal();
} else {
  Promise.all([document.fonts.load('800 64px Overpass'), document.fonts.load('700 40px "JetBrains Mono"')]).finally(() => requestAnimationFrame(start));
}

function start() {
  const T = layout(data);
  const renderer = new THREE.WebGLRenderer({ canvas: $('#scene'), antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); $('#list').showModal(); });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#03050b');
  scene.fog = new THREE.FogExp2('#050812', 0.0022);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.5, 5000);

  // Night lighting: cool moonlight with shadows, faint sky fill
  const moon = new THREE.DirectionalLight('#9fb4ff', 1.1);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.5;
  Object.assign(moon.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 400 });
  scene.add(moon, moon.target, new THREE.HemisphereLight('#3a4f86', '#05070c', 0.9));
  // Stars and a moon disc, kept centred on the camera
  const sky = new THREE.Group();
  {
    const n = 3500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.95);
      pos.set([Math.sin(ph) * Math.cos(th) * 3000, Math.cos(ph) * 3000, Math.sin(ph) * Math.sin(th) * 3000], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sky.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfd9ff', size: 1.3, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.7 })));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(55, 48), new THREE.MeshBasicMaterial({ color: '#e8eeff', fog: false, toneMapped: false }));
    disc.position.set(-1500, 900, -2000); disc.lookAt(0, 0, 0);
    sky.add(disc);
  }
  scene.add(sky);

  const road = buildRoad(T.length);
  buildWorld(scene, road, T);
  const animate = [];
  const one = T.roles.find((r) => r.id === 'oneimaging');
  let airport, airportGroup;
  [...T.roles, T.finish].forEach((r) => {
    const f = road.at(r.landmarkS);
    const toRoad = f.n.clone().multiplyScalar(-Math.sign(r.landmarkOffset));
    let g;
    if (r.id === 'oneimaging') { airport = buildAirport(); g = airportGroup = airport.group; }
    else g = hologram(buildLandmark(r.landmark, animate), BRANCH[r.id] ?? BRANCH.main);
    g.position.copy(f.p).addScaledVector(f.n, r.landmarkOffset + (r.id === 'oneimaging' ? Math.sign(r.landmarkOffset) * 20 : 0));
    g.rotation.y = Math.atan2(toRoad.x, toRoad.z);
    scene.add(g);
  });
  // Miami lies far beyond the horizon, away from the road
  const miami = buildMiami();
  {
    const f = road.at(one.landmarkS);
    const away = f.n.clone().multiplyScalar(Math.sign(one.landmarkOffset));
    miami.group.position.copy(f.p).addScaledVector(away, 2300).addScaledVector(f.t, 900);
    miami.group.rotation.y = Math.atan2(-away.x, -away.z);
    scene.add(miami.group);
  }
  const obstacles = buildObstacles(scene, road, T);
  const car = buildCar();
  scene.add(car.group);
  const under = new THREE.PointLight('#2ee6b6', 3, 7, 1.8); under.position.set(0, 0.3, 0); car.group.add(under);
  const key = new THREE.PointLight('#dfe8ff', 10, 14, 1.5); key.position.set(0, 4, -3.5); car.group.add(key);
  const head = new THREE.SpotLight('#eaf2ff', 14, 70, 0.42, 0.6, 1.4); head.position.set(0, 0.6, 2.4); head.target.position.set(0, 0, 30); car.group.add(head, head.target);
  const audio = createAudio();

  // Light streaks from the rear tyres
  const TRAIL = 80;
  const streaks = [-0.86, 0.86].map((side) => {
    const pos = new Float32Array(TRAIL * 2 * 3), col = new Float32Array(TRAIL * 2 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const idx = [];
    for (let i = 0; i < TRAIL - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { side, pos, col, geo };
  });
  const trailPts = [];

  // Post-processing: bloom makes the neon glow
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), mobile ? 0.5 : 0.62, 0.4, 0.72));
  composer.addPass(new OutputPass());

  const laneOff = (r, s) => (r && r.slot ? T.offset(r, s) : 0);
  const entryS = (r) => (r.slot ? r.s0 + r.taper + 4 : r.s0 + 4);

  // ---------- state ----------
  const hashId = () => decodeURIComponent(location.hash.slice(1)).toLowerCase().trim();
  const startRole = T.roles.find((r) => r.id === hashId());
  const startS = startRole ? entryS(startRole) - (startRole.slot ? 18 : 50) : 30;
  const startLat = startRole ? laneOff(startRole, startS) : 0;
  const sp = road.point(startS, startLat);
  road.reset(road.at(startS).i);
  const state = {
    x: sp.p.x, z: sp.p.z, heading: Math.atan2(sp.t.x, sp.t.z), speed: 0, steer: 0, braking: false,
    s: startS, prevS: startS, lateral: startLat, auto: null, role: null, shake: 0, finished: false,
    flown: !!startRole && startS > entryS(one) + 25,
    done: { commit: 0, course: 0, release: 0 },
  };
  const kindKey = (k) => (k === 'course' ? 'course' : k === 'commit' ? 'commit' : 'release');
  if (startRole) obstacles.list.filter((o) => o.s < startS).forEach((o) => { o.hit = true; o.skipped = true; o.mesh.removeFromParent(); });
  const totals = { commit: 0, course: 0, release: 0 };
  obstacles.list.filter((o) => !o.skipped).forEach((o) => { totals[kindKey(o.kind)]++; });

  // ---------- flight to Miami ----------
  const cut = createCutscene({
    scene, airportGroup, airport, miamiGroup: miami.group, miami,
    onCaption: (text) => { $('#caption').textContent = text; $('#caption').hidden = false; },
    onDone: () => {
      $('#fade').classList.add('on');
      setTimeout(() => {
        placeCar(state.resumeS, 0);
        car.group.visible = true;
        $('#caption').hidden = true; $('#cutscene').hidden = true;
        document.body.classList.remove('flying');
        $('#fade').classList.remove('on');
        log([['$ ', 'p'], ['git switch main', ''], ['  # back on I-70 from Miami', 'dim']]);
      }, 450);
    },
  });
  function startFlight() {
    state.flown = true; state.auto = null; state.speed = 0; state.resumeS = state.s + 0.5; keys.clear();
    $('#fade').classList.add('on');
    setTimeout(() => {
      car.group.visible = false;
      document.body.classList.add('flying');
      $('#cutscene').hidden = false;
      cut.start();
      $('#fade').classList.remove('on');
      log([['$ ', 'p'], ['ssh hamza@miami', ''], ['  # flying to OneImaging HQ', 'dim']]);
    }, 450);
  }
  function placeCar(s, lat) {
    const p = road.point(s, lat);
    Object.assign(state, { x: p.p.x, z: p.p.z, heading: Math.atan2(p.t.x, p.t.z), speed: 0, s, prevS: s, lateral: lat, auto: null });
    road.reset(road.at(s).i);
    trailPts.length = 0;
  }

  // ---------- input ----------
  const keys = new Set();
  const driveKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  const typing = (e) => e.target.closest?.('input, textarea, dialog, #journal');
  const onControl = (e) => e.target.closest?.('button, a');
  addEventListener('keydown', (e) => {
    if (typing(e)) return;
    const k = e.key.toLowerCase();
    if (cut.active) { if (['escape', ' ', 'enter'].includes(k)) { e.preventDefault(); cut.skip(); } return; }
    if (k === ' ' && onControl(e)) return;
    if ([...driveKeys, ' '].includes(k)) e.preventDefault();
    if (driveKeys.includes(k)) { keys.add(k); state.auto = null; }
    if (k === 'n') driveToNext();
    if (k === 'm') toggleSound();
    if (k === 'j') toggleJournal();
    if (k === '/' || k === '`') { e.preventDefault(); $('#cmd').focus(); }
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => { keys.clear(); document.querySelectorAll('.pad-btn.down').forEach((b) => b.classList.remove('down')); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); audio.pause(); } else audio.resume(); });
  document.querySelectorAll('[data-key]').forEach((btn) => {
    const k = btn.dataset.key;
    const on = (e) => { e.preventDefault(); if (cut.active) return; keys.add(k); state.auto = null; btn.classList.add('down'); };
    const off = () => { keys.delete(k); btn.classList.remove('down'); };
    btn.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, off));
  });
  addEventListener('hashchange', () => { const r = T.roles.find((x) => x.id === hashId()); if (r) driveTo(r); });

  // ---------- HUD ----------
  const ordered = [...T.roles].sort((a, b) => a.s0 - b.s0);
  const chips = new Map();
  ordered.forEach((r) => {
    const b = el('button', { className: 'branch', textContent: r.id, title: `${r.company}, ${r.years}` });
    b.style.setProperty('--c', BRANCH[r.id]);
    b.setAttribute('aria-label', `Drive to ${r.company}, ${r.years}`);
    b.addEventListener('click', () => driveTo(r));
    chips.set(r, b);
    $('#branches').append(b);
  });
  $('#next').addEventListener('click', driveToNext);
  $('#sound').addEventListener('click', toggleSound);
  $('#journal-btn').addEventListener('click', toggleJournal);
  $('#journal-close').addEventListener('click', toggleJournal);
  $('#finish-close').addEventListener('click', () => { $('#finish').hidden = true; });
  $('#finish-journal').addEventListener('click', () => { $('#finish').hidden = true; if ($('#journal').hidden) toggleJournal(); });
  $('#skip').addEventListener('click', () => cut.skip());
  function toggleSound() { const on = audio.toggle(); $('#sound').textContent = on ? 'Sound on' : 'Sound off'; $('#sound').setAttribute('aria-pressed', on); }
  function toggleJournal() { const j = $('#journal'); j.hidden = !j.hidden; $('#journal-btn').setAttribute('aria-expanded', !j.hidden); }

  // Journal
  const rows = new Map();
  const addJournal = (title, meta, items, color) => {
    const list = el('ul');
    items.forEach((o) => {
      const li = el('li', { className: o.kind }, el('code', { textContent: o.hash }), ' ', o.text);
      rows.set(o, li); list.append(li);
    });
    const h = el('h3', { textContent: title }); h.style.color = color;
    $('#journal-body').append(el('section', {}, h, el('p', { className: 'j-meta', textContent: meta }), list));
  };
  ordered.forEach((r) => addJournal(r.company, `${r.title}, ${r.years}`, obstacles.list.filter((o) => o.role === r.index && o.kind !== 'community'), BRANCH[r.id]));
  addJournal('Hackathons & community', 'Not tied to an employer', obstacles.list.filter((o) => o.kind === 'community'), GOLD);

  function updateCounts() {
    $('#c-commit').textContent = `${state.done.commit}/${totals.commit}`;
    $('#c-course').textContent = `${state.done.course}/${totals.course}`;
    $('#c-release').textContent = `${state.done.release}/${totals.release}`;
  }
  updateCounts();

  // Terminal
  const term = $('#term-log');
  function log(parts) {
    const line = el('div', { className: 'tl' });
    parts.forEach(([text, cls, color]) => { const s = el('span', { textContent: text, className: cls ?? '' }); if (color) s.style.color = color; line.append(s); });
    term.append(line);
    while (term.children.length > 60) term.firstChild.remove();
    term.scrollTop = term.scrollHeight;
  }
  log([['$ ', 'p'], ['git log --graph --all', ''], ['  # drive to write history', 'dim']]);

  function onHit(o, direct) {
    state.done[kindKey(o.kind)]++;
    rows.get(o)?.classList.add('done');
    updateCounts();
    const r = T.roles[o.role];
    if (o.kind === 'course') log([['* ', '', o.color], [o.hash + ' ', 'h', o.color], [`(tag: ${o.term}) `, 'dim'], [o.text, '']]);
    else if (o.kind === 'commit') log([['* ', '', o.color], [o.hash + ' ', 'h', o.color], [`(${r.id}) `, '', o.color], [o.text, '']]);
    else log([['★ ', '', GOLD], [o.hash + ' ', 'h', GOLD], [o.kind === 'community' ? '(release: community) ' : `(release: ${r.id}) `, '', GOLD], [o.text, '']]);
    audio.hit(o.kind === 'course' ? 0.3 : 0.8);
    if (direct && o.kind !== 'course') state.shake = 0.18;
  }

  // Commands typed into the terminal
  $('#cmd-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = $('#cmd').value.trim(); $('#cmd').value = '';
    if (!raw) return;
    log([['$ ', 'p'], [raw, '']]);
    const w = raw.split(/\s+/);
    const cmd = w[0] === 'git' ? w[1] : w[0], arg = w[0] === 'git' ? w[2] : w[1];
    const out = (t, cls = 'dim') => log([[t, cls]]);
    if (cmd === 'help') out('commands: git branch · git checkout <branch> · git log · whoami · contact · resume · clear');
    else if (cmd === 'branch') ordered.forEach((r) => log([[state.role === r ? '* ' : '  ', ''], [r.id, 'h', BRANCH[r.id]], [`  ${r.company}, ${r.years}`, 'dim']]));
    else if (cmd === 'checkout' || cmd === 'switch') {
      const r = T.roles.find((x) => x.id === arg);
      if (r) { out(`Switched to branch '${r.id}'`); driveTo(r); } else out(`error: pathspec '${arg ?? ''}' did not match any branch. Try: git branch`);
    } else if (cmd === 'log') {
      const done = obstacles.list.filter((o) => o.hit && !o.skipped).slice(-8);
      if (!done.length) out('No commits yet. Start driving.');
      done.forEach((o) => log([[o.hash + ' ', 'h', o.color], [o.text, '']]));
    } else if (cmd === 'whoami') out(`${person.name}, ${person.role}, ${person.location}`, '');
    else if (cmd === 'contact') out(`${person.email} · ${person.linkedin}`, '');
    else if (cmd === 'resume' || cmd === 'cat') $('#list').showModal();
    else if (cmd === 'clear') term.replaceChildren();
    else out(`${cmd}: command not found. Type help.`);
    $('#cmd').blur();
  });

  // Card: `git show` for the branch under the car
  function showRole(r) {
    const card = $('#card');
    const color = BRANCH[r.id] ?? GOLD;
    card.style.setProperty('--c', color);
    card.querySelector('.card-cmd').textContent = r.id === 'chicago' ? '$ git log --graph' : `$ git show ${r.id}`;
    card.querySelector('h2').textContent = r.company;
    card.querySelector('.card-role').textContent = r.title;
    card.querySelector('.card-meta').textContent = `${r.years} · ${r.place}`;
    card.querySelector('.card-blurb').textContent = r.blurb;
    card.hidden = false;
    card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
    clearTimeout(showRole.t);
    if (mobile) showRole.t = setTimeout(() => { card.hidden = true; }, 6000);
    chips.forEach((b, rr) => b.classList.toggle('here', rr === r));
    chips.get(r)?.classList.add('seen');
    $('#sr').textContent = `Now on ${r.company}, ${r.title}, ${r.years}.`;
    $('#on-branch').textContent = r.id === 'chicago' ? 'main' : r.id;
    $('#on-branch').style.color = color;
    if (r.id !== 'chicago') log([['$ ', 'p'], [r.slot ? `git checkout -b ${r.id}` : 'git switch main', ''], [`  # ${r.company}`, 'dim']]);
  }
  function roleUnderCar() {
    if (state.s > T.finishS - 10) return T.finish;
    const open = T.roles.filter((r) => state.s >= entryS(r) && state.s <= r.s1);
    let best = null, bd = ROAD_W / 2 + 3;
    for (const r of open) { const d = Math.abs(state.lateral - laneOff(r, state.s)); if (d < bd) { bd = d; best = r; } }
    if (!best) {
      const main = T.roles.filter((r) => !r.slot && state.s >= entryS(r)).at(-1);
      if (main && Math.abs(state.lateral) < ROAD_W / 2 + 3) best = main;
    }
    return best;
  }

  // Git-graph minimap: time runs bottom → top, branches as columns
  const mini = $('#graph'), mctx = mini.getContext('2d');
  const slots = [...new Set(T.roles.map((r) => r.slot))].sort((a, b) => a - b);
  function drawGraph() {
    const dpr = Math.min(devicePixelRatio, 2);
    const W = Math.round(mini.clientWidth * dpr), H = Math.round(mini.clientHeight * dpr);
    if (!W) return;
    if (mini.width !== W || mini.height !== H) { mini.width = W; mini.height = H; }
    const pad = 12 * dpr, col = (W - pad * 2) / (slots.length - 1);
    const X = (lat) => pad + (lat / 16 - slots[0]) * col;
    const Y = (s) => H - pad - (s / (T.finishS + 60)) * (H - pad * 2);
    mctx.clearRect(0, 0, W, H);
    mctx.lineCap = 'round'; mctx.lineWidth = 2.5 * dpr;
    mctx.strokeStyle = 'rgba(219,231,255,0.55)';
    mctx.beginPath(); mctx.moveTo(X(0), Y(0)); mctx.lineTo(X(0), Y(T.finishS + 60)); mctx.stroke();
    T.roles.filter((r) => r.slot).forEach((r) => {
      mctx.strokeStyle = BRANCH[r.id]; mctx.beginPath();
      for (let s = r.s0; s <= r.s1; s += 20) (s === r.s0 ? mctx.moveTo : mctx.lineTo).call(mctx, X(T.offset(r, s)), Y(s));
      mctx.stroke();
    });
    for (const o of obstacles.list) {
      if (o.kind === 'course') continue;
      mctx.fillStyle = o.hit && !o.skipped ? o.color : '#0a0e18';
      mctx.strokeStyle = o.color; mctx.lineWidth = 1.4 * dpr;
      mctx.beginPath(); mctx.arc(X(o.kind === 'commit' ? o.lateral - Math.sign(o.lateral - Math.round(o.lateral / 16) * 16) * 1.6 : o.lateral), Y(o.s), 2.4 * dpr, 0, Math.PI * 2); mctx.fill(); mctx.stroke();
    }
    const cx = X(state.lateral), cy = Y(state.s);
    mctx.fillStyle = '#ffffff'; mctx.shadowColor = '#2ee6b6'; mctx.shadowBlur = 10 * dpr;
    mctx.beginPath(); mctx.moveTo(cx, cy - 7 * dpr); mctx.lineTo(cx + 5 * dpr, cy + 5 * dpr); mctx.lineTo(cx - 5 * dpr, cy + 5 * dpr); mctx.fill();
    mctx.shadowBlur = 0;
  }

  // ---------- auto-drive ----------
  function driveToNext() {
    if (cut.active) return;
    const next = ordered.find((r) => entryS(r) > state.s + 5);
    if (next) driveTo(next);
    else state.auto = { role: null, target: T.finishS + 60, s: state.s, lat: state.lateral };
  }
  function driveTo(r) {
    if (cut.active) return;
    const target = entryS(r) + 20;
    if (target < state.s) { placeCar(entryS(r) - (r.slot ? 18 : 30), laneOff(r, entryS(r) - (r.slot ? 18 : 30))); return; }
    state.auto = { role: r, target, s: state.s, lat: state.lateral };
  }

  let baseFov = 58;
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    baseFov = innerWidth < 700 ? 68 : 58;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  const timer = new THREE.Timer();
  const camPos = new THREE.Vector3(state.x - Math.sin(state.heading) * 12, 5, state.z - Math.cos(state.heading) * 12);
  const camGoal = new THREE.Vector3(), look = new THREE.Vector3(), tmpC = new THREE.Color();
  camera.position.copy(camPos);
  $('#loading').classList.add('gone');
  setTimeout(() => { $('#loading').hidden = true; }, 600);

  if (new URLSearchParams(location.search).has('debug')) window.__hah = { state, T, road, obstacles, totals, placeCar, driveTo, driveToNext, cut, keys, sim: (dt) => { if (cut.active) cut.update(dt, camera, 0); else { step(dt); obstacles.update(dt, state, 0, onHit); } } };

  renderer.setAnimationLoop(() => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    const t = timer.getElapsed();
    if (!reduceMotion) animate.forEach((fn) => fn(t));
    airport.beacon.visible = Math.sin(t * 3) > 0;

    if (cut.active) {
      cut.update(dt, camera, t);
    } else {
      step(dt);
      obstacles.update(dt, state, reduceMotion ? 0 : t, onHit);
      car.group.position.set(state.x, 0, state.z);
      car.group.rotation.y = state.heading;
      car.group.rotation.z = -state.steer * Math.min(Math.abs(state.speed) / 40, 1) * 0.04;
      car.spin(state.speed * dt);
      car.steer(state.steer);
      car.brake(state.braking);

      // Chase camera locked behind the car
      const dist = 9 + Math.abs(state.speed) * 0.08;
      const back = state.speed < -2 ? -1 : 1;
      camGoal.set(state.x - Math.sin(state.heading) * dist * back, 3.4 + Math.abs(state.speed) * 0.03, state.z - Math.cos(state.heading) * dist * back);
      camPos.lerp(camGoal, reduceMotion ? 1 : 1 - Math.pow(0.001, dt));
      camera.position.copy(camPos);
      if (state.shake > 0 && !reduceMotion) { camera.position.x += (Math.random() - 0.5) * state.shake; camera.position.y += (Math.random() - 0.5) * state.shake; state.shake = Math.max(0, state.shake - dt); }
      look.set(state.x + Math.sin(state.heading) * 10, 1.4, state.z + Math.cos(state.heading) * 10);
      camera.lookAt(look);
      const fov = baseFov + (reduceMotion ? 0 : Math.min(Math.abs(state.speed), 42) * 0.28);
      if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }

      // Light streaks in the branch colour
      const color = BRANCH[state.role?.id] ?? BRANCH.main;
      trailPts.unshift([state.x - Math.sin(state.heading) * 1.5, state.z - Math.cos(state.heading) * 1.5, state.heading]);
      if (trailPts.length > TRAIL) trailPts.pop();
      tmpC.set(color);
      const fade = Math.min(1, Math.abs(state.speed) / 18);
      for (const st of streaks) {
        for (let i = 0; i < TRAIL; i++) {
          const p = trailPts[Math.min(i, trailPts.length - 1)];
          const nx = Math.cos(p[2]), nz = -Math.sin(p[2]);
          const cx = p[0] + nx * st.side, cz = p[1] + nz * st.side, w = 0.07 * (1 - i / TRAIL) + 0.01;
          st.pos.set([cx + nx * w, 0.2, cz + nz * w, cx - nx * w, 0.2, cz - nz * w], i * 6);
          const k = 0.9 * (1 - i / TRAIL) * fade;
          st.col.set([tmpC.r * k, tmpC.g * k, tmpC.b * k, tmpC.r * k, tmpC.g * k, tmpC.b * k], i * 6);
        }
        st.geo.attributes.position.needsUpdate = true; st.geo.attributes.color.needsUpdate = true;
      }
      under.color.set(color);
    }

    moon.position.set(camera.position.x - 120, 220, camera.position.z + 60);
    moon.target.position.set(camera.position.x, 0, camera.position.z);
    sky.position.set(camera.position.x, 0, camera.position.z);
    audio.engine(cut.active ? 0 : state.speed);
    $('#speed').textContent = Math.round(Math.abs(state.speed) * 3.4);
    drawGraph();
    composer.render();
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
      const want = THREE.MathUtils.clamp(remaining * 0.7, 8, 36);
      state.speed += (want - state.speed) * Math.min(1, dt * 2);
      A.s = Math.min(A.s + state.speed * dt, road.total - 5);
      const goalLat = laneOff(A.role, A.s);
      A.lat += (goalLat - A.lat) * Math.min(1, dt * 1.6);
      const p = road.point(A.s, A.lat), q = road.point(A.s + 2, A.lat + (goalLat - A.lat) * 0.3);
      state.heading = Math.atan2(q.p.x - p.p.x, q.p.z - p.p.z);
      state.x = p.p.x; state.z = p.p.z;
      state.steer = 0; state.braking = false;
      if (remaining < 1 || A.s >= road.total - 5) { state.auto = null; state.speed = 0; }
    } else {
      const lanes = T.lanesAt(state.s);
      const onRoad = lanes.some((o) => Math.abs(state.lateral - o) < ROAD_W / 2 + 1.5);
      const max = onRoad ? 42 : 16;
      state.braking = down && state.speed > 0.5;
      if (up && !down) state.speed += (state.speed < 0 ? 40 : 22 - state.speed * 0.25) * dt;
      else if (down && up) state.speed = Math.max(0, state.speed - 40 * dt);
      else if (down) state.speed -= (state.speed > 0 ? 40 : 12) * dt;
      else state.speed *= Math.pow(onRoad ? 0.7 : 0.3, dt);
      if (state.speed > max) state.speed += (max - state.speed) * Math.min(1, dt * 3);
      state.speed = Math.max(state.speed, -10);
      if (Math.abs(state.speed) < 0.1 && !up && !down) state.speed = 0;
      const steerIn = (left ? 1 : 0) - (right ? 1 : 0);
      state.steer += (steerIn - state.steer) * Math.min(1, dt * 8);
      const grip = Math.min(1, Math.abs(state.speed) / 6) * (1 - Math.min(Math.abs(state.speed), 42) / 100);
      state.heading += state.steer * 2.0 * dt * grip * Math.sign(state.speed || 1);
      state.x += Math.sin(state.heading) * state.speed * dt;
      state.z += Math.cos(state.heading) * state.speed * dt;
    }
    let near = road.nearest(state);
    state.s = near.sample.s;
    state.lateral = (state.x - near.sample.p.x) * near.sample.n.x + (state.z - near.sample.p.z) * near.sample.n.z;
    // Stay inside the corridor and don't run off either end of the road
    const lanes = T.lanesAt(state.s);
    const lo = Math.min(...lanes) - 22, hi = Math.max(...lanes) + 22;
    const along = (state.x - near.sample.p.x) * near.sample.t.x + (state.z - near.sample.p.z) * near.sample.t.z;
    let push = 0, pushAlong = 0;
    if (state.lateral < lo) push = lo - state.lateral; else if (state.lateral > hi) push = hi - state.lateral;
    if (near.sample.i === 0 && along < -2) pushAlong = -2 - along;
    if (near.sample.s > road.total - 3 && along > 2) pushAlong = 2 - along;
    if (push || pushAlong) {
      state.x += near.sample.n.x * push + near.sample.t.x * pushAlong;
      state.z += near.sample.n.z * push + near.sample.t.z * pushAlong;
      state.speed *= pushAlong ? 0 : 0.9;
      near = road.nearest(state);
      state.s = near.sample.s;
      state.lateral = (state.x - near.sample.p.x) * near.sample.n.x + (state.z - near.sample.p.z) * near.sample.n.z;
    }

    const r = roleUnderCar();
    if (r && r !== state.role) { state.role = r; showRole(r); }
    if (!state.flown && state.role === one && state.s > entryS(one) + 25) startFlight();
    if (!state.finished && state.s > T.finishS + 50) {
      state.finished = true;
      $('#finish-count').textContent = `You wrote ${state.done.commit} of ${totals.commit} commits, tagged ${state.done.course} of ${totals.course} courses, and shipped ${state.done.release} of ${totals.release} releases. Anything missed is on another branch; the journal lists it.`;
      $('#finish').hidden = false;
      $('#finish .btn-solid').focus({ preventScroll: true });
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
  body.append(el('section', {}, el('h3', { textContent: 'Hackathons & community' }), el('ul', {}, ...community.map(([, text]) => el('li', { textContent: text })))));
  body.append(el('section', {}, el('h3', { textContent: 'Kansas State coursework' }),
    ...semesters.map((sem) => el('p', { className: 'list-courses' }, el('strong', { textContent: `${sem.term}${sem.honors ? ' (semester honors)' : ''}: ` }), sem.courses.map(([c, n]) => `${c} ${n}`).join(', ')))));
  body.append(el('section', {}, el('h3', { textContent: 'Skills' }),
    el('dl', { className: 'list-skills' }, ...skills.flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v })]))));
  $('#contact').href = `mailto:${person.email}`;
  $('#linkedin').href = person.linkedin;
}

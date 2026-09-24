import * as THREE from 'three';
import { neonSign } from './world.js';
import { hologram } from './holo.js';

const place = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const glowM = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });

// Airport beside the main road at OneImaging. Built facing +z (the road); runway runs along x.
export function buildAirport() {
  const g = new THREE.Group();
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(260, 16), new THREE.MeshStandardMaterial({ color: '#0c0f16', roughness: 0.5, metalness: 0.5 }));
  runway.rotation.x = -Math.PI / 2; runway.position.set(0, 0.06, -40);
  g.add(runway);
  const lightG = new THREE.SphereGeometry(0.25, 8, 6);
  const edgeLights = new THREE.InstancedMesh(lightG, glowM('#ffd9a0'), 2 * 44);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 44; i++) {
    const x = -128 + i * 6;
    m.makeTranslation(x, 0.3, -40 - 8.4); edgeLights.setMatrixAt(i * 2, m);
    m.makeTranslation(x, 0.3, -40 + 8.4); edgeLights.setMatrixAt(i * 2 + 1, m);
  }
  g.add(edgeLights);
  const centre = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 0.03, 0.4), glowM('#dbe7ff'), 22);
  for (let i = 0; i < 22; i++) { m.makeTranslation(-120 + i * 11.5, 0.08, -40); centre.setMatrixAt(i, m); }
  g.add(centre);
  // Terminal with a curved roof, and the control tower, as holograms
  const term = new THREE.Group();
  term.add(place(new THREE.Mesh(new THREE.BoxGeometry(46, 8, 14), new THREE.MeshStandardMaterial()), 0, 4, 4));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 48, 24, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial());
  roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.scale.set(1, 1, 0.35); roof.position.set(0, 8, 4);
  term.add(roof);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 30, 10), new THREE.MeshStandardMaterial()); tower.position.set(38, 15, 2);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(4, 3, 4, 10), new THREE.MeshStandardMaterial()); cab.position.set(38, 32, 2);
  term.add(tower, cab);
  hologram(term, '#5aa9ff');
  g.add(term);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), glowM('#2ee6b6')); beacon.position.set(38, 35, 2);
  g.add(beacon);
  const sign = neonSign(['Fly to Miami', 'OneImaging HQ'], '#5aa9ff', 10, 2.6);
  sign.position.set(0, 13, 12); g.add(sign);
  return { group: g, runwayStart: new THREE.Vector3(-115, 0, -40), runwayEnd: new THREE.Vector3(125, 0, -40), apron: new THREE.Vector3(-20, 0, 14), beacon };
}

// A twin-engine jet, nose along +x, with navigation lights
export function buildPlane() {
  const g = new THREE.Group();
  const white = new THREE.MeshPhysicalMaterial({ color: '#e9eef3', metalness: 0.3, roughness: 0.35, clearcoat: 1 });
  const teal = new THREE.MeshStandardMaterial({ color: '#00c2b0', metalness: 0.3, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1c222b', metalness: 0.6, roughness: 0.4 });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 26, 20), white); fus.rotation.z = Math.PI / 2; g.add(fus);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.7, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), white);
  nose.rotation.z = -Math.PI / 2; nose.scale.set(1, 2.1, 1); nose.position.x = 13; g.add(nose);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(1.7, 7, 20), white); tail.rotation.z = Math.PI / 2; tail.position.set(-16.5, 0.5, 0); g.add(tail);
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 2.4), dark); cockpit.position.set(14.2, 0.9, 0); cockpit.rotation.z = -0.35; g.add(cockpit);
  const windows = new THREE.Mesh(new THREE.BoxGeometry(20, 0.35, 3.45), glowM('#ffe7b0')); windows.position.set(-1, 0.55, 0); g.add(windows);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(26, 0.3, 3.46), teal); stripe.position.set(-1, -0.4, 0); g.add(stripe);
  const wingShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-5, 15), new THREE.Vector2(-7.5, 15), new THREE.Vector2(-7, 0)]);
  for (const side of [-1, 1]) {
    const wg = new THREE.ExtrudeGeometry(wingShape, { depth: 0.35, bevelEnabled: false });
    const wing = new THREE.Mesh(wg, white);
    wing.rotation.x = side > 0 ? Math.PI / 2 : -Math.PI / 2; wing.position.set(3, -0.6, 0);
    g.add(wing);
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.75, 4, 16), dark); eng.rotation.z = Math.PI / 2; eng.position.set(1.8, -1.6, side * 5.5); g.add(eng);
    const hs = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 5), white); hs.position.set(-16, 0.8, side * 2.8); hs.rotation.y = side * -0.35; g.add(hs);
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), glowM(side > 0 ? '#ff3b3b' : '#35ff7a')); nav.position.set(-3.8, -0.4, side * 15); g.add(nav);
  }
  const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-4.5, 6.5), new THREE.Vector2(-6.5, 6.5), new THREE.Vector2(-5, 0)]), { depth: 0.3, bevelEnabled: false }), teal);
  fin.position.set(-13, 1.2, -0.15); g.add(fin);
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), glowM('#ffffff')); strobe.position.set(-19.5, 7.2, 0); g.add(strobe);
  g.userData.strobe = strobe;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(0.8);
  return g;
}

// Neon Miami: ocean, beach, Art Deco strip, Brickell towers, palms, and OneImaging HQ
export function buildMiami() {
  const g = new THREE.Group();
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200, 1, 1), new THREE.MeshStandardMaterial({ color: '#06121f', metalness: 0.9, roughness: 0.12 }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.y = -1.5; g.add(ocean);
  const land = new THREE.Mesh(new THREE.BoxGeometry(700, 3, 320), new THREE.MeshStandardMaterial({ color: '#0a0d14', roughness: 0.9 }));
  land.position.set(0, -0.5, -40); g.add(land);
  const beach = new THREE.Mesh(new THREE.BoxGeometry(700, 2.8, 26), new THREE.MeshStandardMaterial({ color: '#3a3326', roughness: 1 }));
  beach.position.set(0, -0.4, 133); g.add(beach);
  // Art Deco hotels along the beach
  const deco = ['#ff6bcb', '#2ee6b6', '#c792ea', '#ffb454', '#5aa9ff'];
  for (let i = 0; i < 16; i++) {
    const h = 10 + (i % 4) * 4, w = 22 + (i % 3) * 6;
    const b = new THREE.Group();
    b.add(place(new THREE.Mesh(new THREE.BoxGeometry(w, h, 16), new THREE.MeshStandardMaterial()), 0, h / 2, 0));
    b.add(place(new THREE.Mesh(new THREE.BoxGeometry(6, h + 6, 6), new THREE.MeshStandardMaterial()), -w / 2 + 5, (h + 6) / 2, 6));
    hologram(b, deco[i % deco.length], { faceOpacity: 0.35 });
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.5, 16.2), glowM(deco[(i + 2) % deco.length]));
    band.position.y = h * 0.7; b.add(band);
    b.position.set(-330 + i * 44, 0, 100);
    g.add(b);
  }
  // Brickell towers
  for (let i = 0; i < 22; i++) {
    const h = 60 + ((i * 37) % 11) * 12, w = 14 + (i % 3) * 4;
    const t = new THREE.Group();
    t.add(place(new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial()), 0, h / 2, 0));
    hologram(t, i % 2 ? '#5aa9ff' : '#2ee6b6', { faceOpacity: 0.3, edgeOpacity: 0.7 });
    for (let y = 8; y < h; y += 6) { const l = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.25, w + 0.1), glowM('#9fc9ff')); l.material.transparent = true; l.material.opacity = 0.35; l.position.y = y; t.add(l); }
    t.position.set(-260 + (i % 11) * 50, 0, -60 - Math.floor(i / 11) * 60);
    g.add(t);
  }
  // OneImaging HQ
  const hq = new THREE.Group();
  hq.add(place(new THREE.Mesh(new THREE.BoxGeometry(24, 150, 24), new THREE.MeshStandardMaterial()), 0, 75, 0));
  hq.add(place(new THREE.Mesh(new THREE.CylinderGeometry(10, 12, 12, 16), new THREE.MeshStandardMaterial()), 0, 156, 0));
  hologram(hq, '#5aa9ff', { faceOpacity: 0.4 });
  const hqSign = neonSign(['OneImaging', 'HQ · Miami, FL'], '#5aa9ff', 30, 9);
  hqSign.position.set(0, 128, 12.2); hq.add(hqSign);
  const hqSign2 = hqSign.clone(); hqSign2.position.set(0, 128, -12.2); hqSign2.rotation.y = Math.PI; hq.add(hqSign2);
  hq.position.set(40, 0, 10);
  g.add(hq);
  // Palm trees along the beach
  const trunkM = new THREE.MeshStandardMaterial({ color: '#2a2218', roughness: 1 });
  const frondM = new THREE.MeshStandardMaterial({ color: '#12301f', roughness: 0.9, side: THREE.DoubleSide, emissive: '#0b3b2a', emissiveIntensity: 0.4 });
  for (let i = 0; i < 40; i++) {
    const p = new THREE.Group();
    const lean = (i % 5 - 2) * 0.8;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean, 7, 0), new THREE.Vector3(lean * 2.2, 13, 0));
    p.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.35, 6), trunkM));
    for (let k = 0; k < 7; k++) {
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), frondM);
      fr.position.set(lean * 2.2, 13, 0); fr.rotation.set(0.5, (k / 7) * Math.PI * 2, -0.4);
      fr.geometry.translate(3, 0, 0);
      p.add(fr);
    }
    p.position.set(-340 + i * 17.5, 0, 130 + (i % 3) * 3);
    g.add(p);
  }
  return { group: g, hq: new THREE.Vector3(40, 110, 10) };
}

// Plays the flight: taxi and take off, cruise to Miami, circle the HQ, then return to the road.
export function createCutscene({ scene, airportGroup, airport, miamiGroup, miami, onCaption, onDone }) {
  const plane = buildPlane();
  plane.visible = false;
  scene.add(plane);
  const W = (v, grp) => grp.localToWorld(v.clone());
  let active = false, t = 0, path, durs;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();

  function start() {
    airportGroup.updateMatrixWorld(); miamiGroup.updateMatrixWorld();
    const a = W(airport.runwayStart, airportGroup), b = W(airport.runwayEnd, airportGroup);
    const hq = W(miami.hq, miamiGroup);
    const dir = b.clone().sub(a).normalize();
    const lift = a.clone().lerp(b, 0.55);
    const climb = b.clone().addScaledVector(dir, 200); climb.y = 120;
    const mid = climb.clone().lerp(hq, 0.5); mid.y = 260;
    const toHQ = hq.clone().sub(climb).setY(0).normalize();
    const approach = hq.clone().addScaledVector(toHQ, -320); approach.y = 150;
    const side = new THREE.Vector3(-toHQ.z, 0, toHQ.x);
    const orbit = [0, 1, 2, 3, 4].map((k) => {
      const ang = (k / 4) * Math.PI * 1.6;
      return hq.clone().addScaledVector(toHQ, -Math.cos(ang) * 150).addScaledVector(side, Math.sin(ang) * 150).setY(135);
    });
    path = {
      roll: [a.clone().setY(1.6), lift.clone().setY(1.6)],
      air: new THREE.CatmullRomCurve3([lift.clone().setY(1.6), b.clone().setY(24), climb, mid, approach, ...orbit], false, 'centripetal', 0.5),
      hq,
    };
    durs = { roll: 3.2, air: 13 };
    t = 0; active = true; plane.visible = true;
    onCaption('Jumping out of the car. OneImaging is headquartered in Miami, and I work remotely and fly in when needed.');
  }

  function update(dt, camera, time) {
    if (!active) return false;
    t += dt;
    plane.userData.strobe.visible = Math.sin(time * 12) > 0.6;
    if (t < durs.roll) {
      const k = (t / durs.roll) ** 2;
      plane.position.lerpVectors(path.roll[0], path.roll[1], k);
      const d = path.roll[1].clone().sub(path.roll[0]).normalize();
      plane.rotation.set(0, Math.atan2(-d.z, d.x), 0);
      camPos.copy(plane.position).addScaledVector(d, -34).add(new THREE.Vector3(0, 9, 0)).addScaledVector(new THREE.Vector3(-d.z, 0, d.x), 14);
      camLook.copy(plane.position).addScaledVector(d, 10);
    } else {
      const u = Math.min(1, (t - durs.roll) / durs.air);
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      const p = path.air.getPointAt(e), q = path.air.getPointAt(Math.min(1, e + 0.01));
      const d = q.clone().sub(p).normalize();
      plane.position.copy(p);
      plane.rotation.set(0, 0, 0);
      plane.lookAt(p.clone().add(d)); plane.rotateY(-Math.PI / 2);
      const bank = new THREE.Vector3(-d.z, 0, d.x).dot(path.air.getPointAt(Math.min(1, e + 0.03)).sub(q).normalize());
      plane.rotateX(-bank * 1.2);
      if (u > 0.62) {
        if (!update.hqShown) { update.hqShown = true; onCaption('OneImaging HQ, Miami. Staff Software Engineer, remote since January 2026.'); }
        camPos.lerp(path.hq.clone().add(new THREE.Vector3(260, 170, 260)), Math.min(1, dt * 1.5));
        camLook.lerp(path.hq, Math.min(1, dt * 2));
      } else {
        camPos.copy(p).addScaledVector(d, -40).add(new THREE.Vector3(0, 12, 0));
        camLook.copy(p).addScaledVector(d, 20);
      }
      if (u >= 1) { finish(); return false; }
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    return true;
  }

  function finish() {
    active = false; plane.visible = false; update.hqShown = false;
    onDone();
  }

  return { start, update, skip: () => active && finish(), get active() { return active; } };
}

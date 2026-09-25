// Audits content consistency and world geometry. Run: node scripts/audit.mjs
import * as data from '../src/data.js';
import { layout, buildRoad, ROAD_W, LANE_GAP } from '../src/world.js';

const errs = [], warns = [];
const E = (m) => errs.push(m), Wn = (m) => warns.push(m);
const ym = (d) => (d === 'now' ? data.NOW : d);
const inRange = (d, a, b) => d >= a && d <= ym(b);

// ---- content ----
let courses = 0;
data.semesters.forEach((s) => { courses += s.courses.length; if (!s.date) E(`semester ${s.term} has no date`); });
if (courses !== 46) E(`expected 46 courses from transcript, found ${courses}`);
const ksu = data.sections.find((s) => s.id === 'ksu');
data.semesters.forEach((s) => { if (!inRange(s.date, ksu.start.slice(0, 4) + '-01', ksu.end)) E(`semester ${s.term} ${s.date} outside K-State dates`); });
data.sections.forEach((s) => {
  for (const k of ['id', 'company', 'place', 'title', 'start', 'end', 'years', 'blurb']) if (!s[k]) E(`${s.id}: missing ${k}`);
  const y0 = s.start.slice(0, 4), y1 = s.end === 'now' ? 'now' : s.end.slice(0, 4);
  const want = y0 === y1 ? y0 : `${y0}–${y1}`;
  if (s.years !== want) E(`${s.id}: years label "${s.years}" should be "${want}"`);
  s.obstacles.forEach(([lbl, text, date, kind]) => {
    if (!lbl || !text) E(`${s.id}: obstacle missing label/text`);
    if (lbl.length > 20) Wn(`${s.id}: label "${lbl}" is long for a sign`);
    if (date && !inRange(date, s.start, s.end)) E(`${s.id}: "${lbl}" dated ${date} outside ${s.start}..${s.end}`);
    if (kind && kind !== 'award') E(`${s.id}: unknown kind ${kind}`);
  });
});
(data.community ?? []).forEach(([l, t, d]) => { if (!d) E(`community "${l}" needs a date`); });

// ---- geometry ----
const T = layout(data);
const road = buildRoad(T.length);
const MONTH = 36;
for (let i = 1; i < T.roles.length; i++) if (T.roles[i].s0 < T.roles[i - 1].s0 && T.roles[i].start >= T.roles[i - 1].start) E('roles out of order');
T.roles.forEach((r) => {
  r.items.forEach((it) => {
    if (it.s < r.s0 || it.s > r.s1) E(`${r.id}: item "${it.label ?? it.sem?.term}" at ${it.s.toFixed(0)} outside road ${r.s0}..${r.s1}`);
    if (r.slot) {
      const off = Math.abs(T.offset(r, it.s)), full = Math.abs(r.slot) * LANE_GAP;
      if (off < full * 0.98) E(`${r.id}: item "${it.label}" sits on the merge taper (offset ${off.toFixed(1)} of ${full})`);
    }
  });
  const src = data.sections.find((s) => s.id === r.id);
  src.obstacles.forEach(([lbl, , date]) => {
    if (!date) return;
    const it = r.items.find((x) => x.label === lbl);
    const drift = (it.s - T.sOf(date)) / MONTH;
    if (Math.abs(drift) > 2) Wn(`${r.id}: "${lbl}" placed ${drift.toFixed(1)} months from its date (${date}) to keep spacing`);
  });
  if (r.slot && r.end !== 'now') {
    const drift = (r.s1 - T.sOf(r.end)) / MONTH;
    if (drift > 0.5) Wn(`${r.id}: branch runs ${drift.toFixed(1)} months past its end date to fit ${r.obstacles.length} items`);
  }
});
// lanes never overlap
for (let s = 0; s < T.finishS; s += 3) {
  const act = T.activeAt(s);
  const slots = act.map((r) => r.slot);
  if (new Set(slots).size !== slots.length) E(`two branches share a slot at s=${s}`);
  // lanes must be contiguous: every active branch lane touches main or another active lane
  act.forEach((r) => { if (Math.abs(r.slot) > 1 && !act.some((o) => o.slot === r.slot - Math.sign(r.slot))) Wn(`${r.id} lane at s=${s} has no neighbour between it and main`); });
}
// landmarks clear of roads and each other
const lms = [...T.roles, T.finish].map((r) => ({ id: r.id, s: r.landmarkS, off: r.landmarkOffset }));
lms.forEach((l) => {
  for (let s = l.s - 60; s <= l.s + 60; s += 5) {
    const clash = T.lanesAt(s).find((o) => Math.abs(o - l.off) < ROAD_W / 2 + 26);
    if (clash !== undefined) { E(`landmark ${l.id} within 26 of a road at s=${s.toFixed(0)}`); break; }
  }
  if (Math.abs(l.off) + 45 > 150) Wn(`landmark ${l.id} extends past the flat corridor (offset ${l.off})`);
});
for (let i = 0; i < lms.length; i++) for (let j = i + 1; j < lms.length; j++) {
  const a = road.point(lms[i].s, lms[i].off).p, b = road.point(lms[j].s, lms[j].off).p;
  if (a.distanceTo(b) < 110) E(`landmarks ${lms[i].id} and ${lms[j].id} only ${a.distanceTo(b).toFixed(0)} apart`);
}
// curvature vs widest road offset
let minR = Infinity, at = 0;
for (let i = 2; i < road.samples.length - 2; i++) {
  const a = road.samples[i - 2], b = road.samples[i + 2];
  const dh = Math.abs(Math.atan2(Math.sin(b.heading - a.heading), Math.cos(b.heading - a.heading)));
  const ds = b.s - a.s, R = dh > 1e-6 ? ds / dh : Infinity;
  const widest = Math.max(...T.lanesAt(road.samples[i].s).map(Math.abs)) + ROAD_W;
  if (R - widest < minR) { minR = R - widest; at = road.samples[i].s; }
}
if (minR < 10) E(`road curves too tightly for its branches near s=${at.toFixed(0)} (margin ${minR.toFixed(0)})`);
T.roles.forEach((r) => { if (r.end === 'now' && r.s1 > T.finishS) E(`${r.id} ends after the finish`); });

console.log(`roles ${T.roles.length}, items ${T.roles.reduce((a, r) => a + r.items.length, 0)}, road ${road.total.toFixed(0)} units, curvature margin ${minR.toFixed(0)}`);
warns.forEach((w) => console.log('WARN ', w));
errs.forEach((e) => console.log('ERROR', e));
console.log(errs.length ? `${errs.length} errors` : 'no errors');
process.exit(errs.length ? 1 : 0);

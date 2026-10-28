'use strict';
const assert = require('node:assert/strict');
const L = require('../logic.js');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { console.error('FAIL ' + name + '\n     ' + e.message); process.exitCode = 1; }
}

function doneSession(state, area, date, startedAt, picks) {
  // picks: [{exId, sets:[{w,r,t}]}]
  const s = { id: 's_' + date + '_' + startedAt, date, area, startedAt, endedAt: startedAt + 1, items: [] };
  picks.forEach((p, i) => s.items.push({ slot: i, exId: p.exId, sets: p.sets.map(x => ({ w: x.w ?? null, r: x.r ?? null, t: x.t ?? null, done: true })) }));
  state.sessions.push(s);
  return s;
}

t('Zahlen: Komma und Punkt, leere Eingaben', () => {
  assert.equal(L.parseNum('77,5'), 77.5);
  assert.equal(L.parseNum(' 10 '), 10);
  assert.equal(L.parseNum(''), null);
  assert.equal(L.parseNum('abc'), null);
  assert.equal(L.parseNum(null), null);
  assert.equal(L.fmt(77.5), '77,5');
  assert.equal(L.fmt(80), '80');
  assert.equal(L.fmtSigned(10), '+10');
  assert.equal(L.fmtSigned(-1.5), '\u22121,5');
  assert.equal(L.fmtSigned(0), '0');
});

t('Datum: Wochenstart ist Montag, Differenzen über Sommerzeit', () => {
  assert.equal(L.weekStart('2026-10-28'), '2026-10-26'); // Mittwoch
  assert.equal(L.weekStart('2026-10-25'), '2026-10-19'); // Sonntag
  assert.equal(L.weekStart('2026-10-26'), '2026-10-26');
  assert.equal(L.daysBetween('2026-10-24', '2026-10-26'), 2); // Zeitumstellung 25.10.2026
  assert.equal(L.addDays('2026-10-28', 5), '2026-11-02');
});

t('Wechsel: schlägt die Variante vor, die länger nicht dran war', () => {
  const s = L.defaultState();
  assert.equal(L.suggestVariant(s, ['squat', 'hacksquat']), 'squat'); // nie gemacht, erste
  doneSession(s, 'lower', '2026-10-20', 1000, [{ exId: 'squat', sets: [{ w: 100, r: 8 }] }]);
  assert.equal(L.suggestVariant(s, ['squat', 'hacksquat']), 'hacksquat');
  doneSession(s, 'lower', '2026-10-23', 2000, [{ exId: 'hacksquat', sets: [{ w: 120, r: 8 }] }]);
  assert.equal(L.suggestVariant(s, ['squat', 'hacksquat']), 'squat');
});

t('Wechsel: archivierte Variante wird nicht vorgeschlagen', () => {
  const s = L.defaultState();
  L.getEx(s, 'squat').archived = true;
  assert.equal(L.suggestVariant(s, ['squat', 'hacksquat']), 'hacksquat');
});

t('Vorbefüllung: übernimmt Werte vom letzten Mal, ohne Haken', () => {
  const s = L.defaultState();
  doneSession(s, 'upper', '2026-10-19', 1, [{ exId: 'schraegbank', sets: [{ w: 70, r: 10 }, { w: 75, r: 8 }] }]);
  const p = L.prefillSets(s, 'schraegbank');
  assert.equal(p.length, 2);
  assert.deepEqual(p.map(x => x.w), [70, 75]);
  assert.ok(p.every(x => x.done === false));
  const fresh = L.prefillSets(s, 'fliegende');
  assert.equal(fresh.length, 3);
  assert.equal(L.prefillSets(s, 'klimmzuege')[0].w, 0); // Körpergewicht = 0 Zusatz
});

t('Training: Start legt alle Übungen an, Beenden behält nur erledigte Sätze', () => {
  const s = L.defaultState();
  const ses = L.startSession(s, 'lower', '2026-10-28', 5000);
  assert.equal(ses.items.length, 4);
  assert.equal(L.startSession(s, 'lower', '2026-10-28', 6000).id, ses.id); // fortsetzen
  ses.items[0].sets[0] = { w: 100, r: 8, t: null, done: true };
  ses.items[0].sets[1] = { w: 100, r: 8, t: null, done: false };
  L.finishSession(s, ses.id, 7000);
  const saved = s.sessions[0];
  assert.equal(saved.items.length, 1);
  assert.equal(saved.items[0].sets.length, 1);
  assert.equal(saved.endedAt, 7000);
});

t('Training: leere Einheit wird beim Beenden verworfen', () => {
  const s = L.defaultState();
  const ses = L.startSession(s, 'upper', '2026-10-28', 1);
  L.finishSession(s, ses.id, 2);
  assert.equal(s.sessions.length, 0);
});

t('Training: neuer Bereich beendet die offene Einheit', () => {
  const s = L.defaultState();
  const a = L.startSession(s, 'upper', '2026-10-28', 1);
  a.items[0].sets[0] = { w: 50, r: 10, t: null, done: true };
  const b = L.startSession(s, 'lower', '2026-10-28', 2);
  assert.notEqual(a.id, b.id);
  assert.ok(s.sessions.find(x => x.id === a.id).endedAt);
});

t('Körpergewicht: nächster Eintrag zum Trainingstag, Gleichstand nimmt den früheren', () => {
  const s = L.defaultState();
  L.upsertWeight(s, '2026-10-12', '81,1');
  L.upsertWeight(s, '2026-10-19', '80,8');
  L.upsertWeight(s, '2026-10-26', '80,5');
  assert.equal(L.bodyweightAt(s, '2026-10-20'), 80.8);
  assert.equal(L.bodyweightAt(s, '2026-10-28'), 80.5);
  assert.equal(L.bodyweightAt(s, '2026-10-22'), 80.8); // 3 Tage zu 19., 4 zu 26.
  assert.equal(L.bodyweightAt(s, '2026-10-15'), 81.1); // 3 Tage zu 12., 4 zu 19.
  L.upsertWeight(s, '2026-10-26', '80,6'); // gleicher Tag überschreibt
  assert.equal(s.weights.length, 3);
  assert.equal(L.upsertWeight(s, '2026-10-27', '5'), false);
  assert.equal(L.upsertWeight(s, 'kaputt', '80'), false);
});

t('Klimmzüge: Gesamtlast = Körpergewicht plus Zusatz, ohne Zusatz nur Körpergewicht', () => {
  const s = L.defaultState();
  L.upsertWeight(s, '2026-10-26', '80,5');
  const ex = L.getEx(s, 'klimmzuege');
  assert.deepEqual(L.setLoad(s, ex, { w: 0, r: 10 }, '2026-10-26'), { load: 80.5, approx: false });
  assert.deepEqual(L.setLoad(s, ex, { w: 10, r: 8 }, '2026-10-26'), { load: 90.5, approx: false });
  const s2 = L.defaultState(); // ohne Körpergewicht
  assert.deepEqual(L.setLoad(s2, L.getEx(s2, 'dips'), { w: 15, r: 8 }, '2026-10-26'), { load: 15, approx: true });
});

t('Verlauf: bester Satz pro Einheit, Körpergewicht rückwirkend passend', () => {
  const s = L.defaultState();
  L.upsertWeight(s, '2026-10-01', '82');
  L.upsertWeight(s, '2026-10-20', '80');
  doneSession(s, 'upper', '2026-10-02', 1, [{ exId: 'klimmzuege', sets: [{ w: 0, r: 10 }, { w: 5, r: 8 }] }]);
  doneSession(s, 'upper', '2026-10-21', 2, [{ exId: 'klimmzuege', sets: [{ w: 10, r: 6 }, { w: 10, r: 8 }] }]);
  const series = L.exerciseSeries(s, 'klimmzuege');
  assert.equal(series.length, 2);
  assert.equal(series[0].value, 87);  // 82 + 5
  assert.equal(series[1].value, 90);  // 80 + 10
  assert.equal(series[1].r, 8);       // bei gleichem Gewicht mehr Wiederholungen
});

t('Verlauf: Wiederholungs- und Zeitübungen', () => {
  const s = L.defaultState();
  doneSession(s, 'upper', '2026-10-02', 1, [{ exId: 'beinheben', sets: [{ r: 12 }, { r: 15 }] }]);
  doneSession(s, 'core', '2026-10-03', 2, [{ exId: 'plank', sets: [{ t: 1 }, { t: 1.5 }] }]);
  assert.equal(L.exerciseSeries(s, 'beinheben')[0].value, 15);
  assert.equal(L.exerciseSeries(s, 'plank')[0].value, 1.5);
});

t('Trend und Steigung', () => {
  const w = [{ date: '2026-10-01', kg: 82 }, { date: '2026-10-08', kg: 81 }, { date: '2026-10-15', kg: 80 }];
  const tr = L.trendSeries(w);
  assert.equal(tr.length, 3);
  assert.ok(Math.abs(tr[1].kg - 81) < 1e-9);
  const slope = L.slopePerWeek(w);
  assert.ok(Math.abs(slope + 1) < 1e-9, 'Steigung ' + slope);
  assert.equal(L.slopePerWeek([w[0]]), null);
});

t('Wochen in Folge zählt nur Ober- und Unterkörper', () => {
  const s = L.defaultState();
  const mk = (d, a, i) => doneSession(s, a, d, i, [{ exId: a === 'upper' ? 'dips' : a === 'lower' ? 'squat' : 'plank', sets: [{ w: 1, r: 1, t: 1 }] }]);
  // Woche 12.10.: 2 Einheiten, Woche 19.10.: 2 Einheiten, aktuelle Woche 26.10.: 1 Einheit + Core
  mk('2026-10-12', 'upper', 1); mk('2026-10-14', 'lower', 2);
  mk('2026-10-19', 'upper', 3); mk('2026-10-21', 'lower', 4);
  mk('2026-10-26', 'upper', 5); mk('2026-10-27', 'core', 6);
  assert.equal(L.mainSessionsInWeek(s, '2026-10-26'), 1);
  assert.equal(L.weekStreak(s, '2026-10-28', 2), 2); // aktuelle Woche zählt noch nicht, bricht aber nicht ab
  mk('2026-10-28', 'lower', 7);
  assert.equal(L.weekStreak(s, '2026-10-28', 2), 3);
  assert.equal(L.weekStreak(s, '2026-10-28', 3), 0);
});

t('Nächster Bereich wechselt zwischen Ober- und Unterkörper, Core zählt nie', () => {
  const s = L.defaultState();
  assert.equal(L.nextMainArea(s, '2026-10-28'), 'upper');
  doneSession(s, 'upper', '2026-10-26', 1, [{ exId: 'dips', sets: [{ w: 0, r: 8 }] }]);
  assert.equal(L.nextMainArea(s, '2026-10-28'), 'lower');
  doneSession(s, 'lower', '2026-10-27', 2, [{ exId: 'squat', sets: [{ w: 80, r: 8 }] }]);
  assert.equal(L.nextMainArea(s, '2026-10-28'), 'upper');
  doneSession(s, 'core', '2026-10-28', 3, [{ exId: 'plank', sets: [{ t: 1 }] }]);
  assert.equal(L.nextMainArea(s, '2026-10-29'), 'upper');
});

t('Muskelgruppen: Tage seit dem letzten Training, Core wird nicht als überfällig markiert', () => {
  const s = L.defaultState();
  doneSession(s, 'upper', '2026-10-26', 1, [{ exId: 'dips', sets: [{ w: 0, r: 8 }] }]);
  const r = L.muscleRecency(s, '2026-10-28');
  const chest = r.find(x => x.muscle === 'chest');
  const tri = r.find(x => x.muscle === 'triceps');
  const legs = r.find(x => x.muscle === 'legs');
  assert.equal(chest.days, 2);
  assert.equal(tri.days, 2);
  assert.equal(legs.days, null);
});

t('Übungen: anlegen im Wechsel, ändern, archivieren oder löschen', () => {
  const s = L.defaultState();
  const ex = L.addExercise(s, { name: '  Rudern am Kabel ', area: 'upper', muscles: ['back', 'quatsch'], type: 'weight', altWith: 'klimmzuege' });
  assert.equal(ex.name, 'Rudern am Kabel');
  assert.deepEqual(ex.muscles, ['back']);
  const slot = s.templates.upper.find(x => x.ids.includes('klimmzuege'));
  assert.ok(slot.ids.includes(ex.id));
  const own = L.addExercise(s, { name: 'Face Pulls', area: 'upper', muscles: ['shoulders'], type: 'weight', optional: true });
  assert.ok(s.templates.upper.some(x => x.ids.length === 1 && x.ids[0] === own.id && x.optional));
  // Typ ändern geht nur ohne Verlauf
  L.updateExercise(s, own.id, { type: 'reps' });
  assert.equal(L.getEx(s, own.id).type, 'reps');
  doneSession(s, 'upper', '2026-10-20', 1, [{ exId: own.id, sets: [{ r: 10 }] }]);
  L.updateExercise(s, own.id, { type: 'weight' });
  assert.equal(L.getEx(s, own.id).type, 'reps');
  assert.equal(L.removeExercise(s, own.id), 'archived');
  assert.ok(L.getEx(s, own.id).archived);
  assert.equal(L.removeExercise(s, ex.id), 'deleted');
  assert.equal(L.getEx(s, ex.id), null);
  assert.ok(!s.templates.upper.some(x => x.ids.includes(ex.id)));
});

t('Übungen: Bereich wechseln verschiebt sie in die andere Vorlage', () => {
  const s = L.defaultState();
  L.updateExercise(s, 'plank', { area: 'upper', optional: true });
  assert.ok(!s.templates.core.some(x => x.ids.includes('plank')));
  assert.ok(s.templates.upper.some(x => x.ids.includes('plank')));
});

t('Import: wirft bei kaputten Daten und bereinigt fremde Inhalte', () => {
  assert.throws(() => L.normalizeState(null));
  assert.throws(() => L.normalizeState({ exercises: 1 }));
  const s = L.defaultState();
  const bad = JSON.parse(JSON.stringify(s));
  bad.exercises.push({ id: 'x', name: 'A'.repeat(500), area: 'unsinn', type: 'unsinn', muscles: ['nix'] });
  bad.sessions.push({ id: 'k', date: 'gestern', area: 'upper', items: [] });
  bad.sessions.push({ id: 'g', date: '2026-10-01', area: 'upper', items: [{ exId: 'dips', slot: 0, sets: [{ w: '10,5', r: '8', done: true }] }, { exId: 'gibtsnicht', sets: [] }] });
  bad.weights.push({ date: '2026-10-01', kg: 5 }, { date: '2026-10-02', kg: '80,5' });
  bad.settings = { weeklyGoal: 99, restSeconds: 'x' };
  const n = L.normalizeState(bad);
  const x = L.getEx(n, 'x');
  assert.equal(x.name.length, 80);
  assert.equal(x.area, 'upper');
  assert.equal(x.type, 'weight');
  assert.deepEqual(x.muscles, []);
  assert.equal(n.sessions.length, 1);
  assert.equal(n.sessions[0].items.length, 1);
  assert.equal(n.sessions[0].items[0].sets[0].w, 10.5);
  assert.equal(n.weights.length, 1);
  assert.equal(n.weights[0].kg, 80.5);
  assert.equal(n.settings.weeklyGoal, 4);
  assert.equal(n.settings.restSeconds, 90);
});

t('Import: Export und Import ergibt dieselben Daten', () => {
  const s = L.defaultState();
  L.upsertWeight(s, '2026-10-26', '80,5');
  doneSession(s, 'upper', '2026-10-26', 1, [{ exId: 'dips', sets: [{ w: 10, r: 8 }] }]);
  const again = L.normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(again, s);
});

t('Diagrammachse: schöne Schritte', () => {
  assert.deepEqual(L.niceTicks(60, 77.5, 3), [60, 70, 80]);
  const flat = L.niceTicks(80, 80, 3);
  assert.ok(flat.length >= 2 && flat[0] <= 80 && flat[flat.length - 1] >= 80);
});

console.log('\n' + passed + ' Tests bestanden' + (process.exitCode ? ', mit Fehlern' : ''));

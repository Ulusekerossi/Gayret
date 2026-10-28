'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail && e.detail.message || e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, { url: 'https://gayret.test/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
const w = dom.window;
w.confirm = () => true;
w.scrollTo = () => {};
w.addEventListener('error', e => errors.push('window error: ' + e.message));
w.eval(fs.readFileSync(path.join(root, 'logic.js'), 'utf8'));
w.eval(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));

const $ = sel => w.document.querySelector(sel);
const $$ = sel => Array.from(w.document.querySelectorAll(sel));
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function go(hash) { w.location.hash = hash; await sleep(30); }
function click(el) { assert.ok(el, 'Element zum Klicken fehlt'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); }
function type(el, value) { el.value = value; el.dispatchEvent(new w.Event('input', { bubbles: true })); }
const text = () => w.document.getElementById('screen').textContent;
const S = () => w.__gayret.state;

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('ok   ' + name); }
  catch (e) { console.error('FAIL ' + name + '\n     ' + e.message); process.exitCode = 1; }
}

(async () => {
  await t('Start zeigt Auswahl, Core ist als freiwillig markiert', async () => {
    assert.match(text(), /Was trainierst/);
    assert.match(text(), /Oberkörper/);
    assert.match(text(), /Unterkörper/);
    assert.match(text(), /Zusätzlich, wenn du Lust hast/);
    assert.match(text(), /Heute dran/);
    assert.equal($$('nav.tabs a').length, 3);
  });

  await t('Oberkörper starten: erste Übung offen, Wechsel-Auswahl vorhanden', async () => {
    click($$('.area-card')[0]);
    await sleep(40);
    assert.match(w.location.hash, /#\/train\/upper/);
    assert.match(text(), /Schrägbankdrücken Smith/);
    assert.ok($$('[data-act="variant"]').length === 2, 'Variantenwahl Schrägbank/Fliegende');
    assert.ok($('#bar .btn'), 'Beenden-Knopf in der unteren Leiste');
    assert.equal($('nav.tabs').style.display, 'none');
  });

  await t('Satz ohne Eingabe lässt sich nicht abhaken', async () => {
    click($('[data-act="check"][data-j="0"]'));
    assert.match($('#toast').textContent, /Gewicht und Wiederholungen/);
    assert.equal(S().sessions[0].items[0].sets[0].done, false);
  });

  await t('Satz mit Komma-Gewicht eintragen und abhaken startet die Pause', async () => {
    type($('[data-field="w"][data-j="0"]'), '77,5');
    type($('[data-field="r"][data-j="0"]'), '8');
    click($('[data-act="check"][data-j="0"]'));
    const s = S().sessions[0].items[0].sets[0];
    assert.deepEqual([s.w, s.r, s.done], [77.5, 8, true]);
    assert.ok($('#rest-time').textContent !== '01:30' || $('#bar .meter'), 'Pause läuft');
    assert.ok(w.__gayret.ui.restUntil > Date.now());
  });

  await t('Variante tauschen geht nicht mehr, sobald ein Satz abgehakt ist', async () => {
    click($$('[data-act="variant"]')[1]);
    assert.match($('#toast').textContent, /nicht mehr tauschen/);
    assert.equal(S().sessions[0].items[0].exId, 'schraegbank');
  });

  await t('Klimmzüge: Körpergewicht statt Null, Zusatz per Schnellwahl', async () => {
    click($('[data-act="open"][data-i="1"]'));
    assert.match(text(), /Klimmzüge/);
    const btn = $('[data-act="wpick"][data-j="0"]');
    assert.equal(btn.textContent.trim(), 'Körpergewicht');
    click(btn);
    click($('[data-act="pickw"][data-v="10"]'));
    assert.equal(S().sessions[0].items[1].sets[0].w, 10);
    assert.equal($('[data-act="wpick"][data-j="0"]').textContent.trim(), '+10 kg');
    // zweiter Satz bleibt Körpergewicht
    assert.equal($('[data-act="wpick"][data-j="1"]').textContent.trim(), 'Körpergewicht');
    // eigene Zahl
    click($('[data-act="wpick"][data-j="1"]'));
    type($('#pick-other'), '12,5');
    click($('[data-act="pickother"]'));
    assert.equal(S().sessions[0].items[1].sets[1].w, 12.5);
  });

  await t('Klimmzüge: Gesamtlast braucht Körpergewicht, Hinweis führt zum Eintragen', async () => {
    assert.match(text(), /Körpergewicht fehlt|Für die Gesamtlast/);
  });

  await t('Klimmzug-Satz abhaken und Training beenden speichert nur Erledigtes', async () => {
    type($('[data-field="r"][data-i="1"][data-j="0"]'), '8');
    click($('[data-act="check"][data-i="1"][data-j="0"]'));
    click($('[data-act="finish"]'));
    await sleep(40);
    const ses = S().sessions[0];
    assert.ok(ses.endedAt);
    assert.equal(ses.items.length, 2);
    assert.equal(ses.items[0].sets.length, 1);
    assert.match(w.location.hash, /#\/$|^#?$|#\/$/);
    assert.match(text(), /Training gespeichert/);
    assert.match(text(), /2 Sätze/);
  });

  await t('Daten liegen in localStorage und überleben einen Neustart', async () => {
    const raw = w.localStorage.getItem('gayret.v1');
    assert.ok(raw && raw.includes('schraegbank'));
  });

  await t('Körpergewicht: eintragen, ändern mit Plus und Minus, Verlauf, löschen', async () => {
    await go('#/weight');
    assert.match(text(), /Körpergewicht/);
    type($('#w-val'), '81,2');
    click($('[data-act="wsave"]'));
    assert.equal(S().weights.length, 1);
    assert.equal(S().weights[0].kg, 81.2);
    click($('[data-act="wminus"]'));
    assert.equal($('#w-val').value, '81,1');
    type($('#w-val'), 'abc');
    click($('[data-act="wsave"]'));
    assert.match($('#toast').textContent, /zwischen 20 und 400/);
    assert.equal(S().weights.length, 1);
    // zweiter Tag erzeugt Kurve
    w.document.getElementById('w-date').value = '2026-10-01';
    w.document.getElementById('w-date').dispatchEvent(new w.Event('change', { bubbles: true }));
    type($('#w-val'), '82');
    click($('[data-act="wsave"]'));
    assert.equal(S().weights.length, 2);
    assert.ok($('svg[role="img"]'), 'Diagramm vorhanden');
  });

  await t('Klimmzüge nutzen jetzt das eingetragene Körpergewicht in der Auswertung', async () => {
    await go('#/progress/klimmzuege');
    assert.match(text(), /Klimmzüge/);
    assert.match(text(), /Aktuell, Topsatz/);
    assert.match(text(), /Gezählt wird Körpergewicht plus Zusatz/);
  });

  await t('Fortschritt: Muskelgruppen mit Tagen seit dem Training, Core ohne Alarm', async () => {
    assert.match(text(), /Zuletzt trainiert/);
    assert.match(text(), /Brust/);
    assert.match(text(), /noch nie/);
  });

  await t('Kalender: heutiger Tag ist eingefärbt und zeigt die Einheit', async () => {
    await go('#/calendar');
    const today = w.GayretLogic.ymd(new Date());
    const btn = $('[data-act="calday"][data-d="' + today + '"]');
    assert.ok(btn.className.includes('upper'));
    click(btn);
    assert.match(text(), /Schrägbankdrücken Smith/);
    assert.match(text(), /Einheit löschen/);
    click($('[data-act="calprev"]'));
    click($('[data-act="calnext"]'));
  });

  await t('Neue Übung anlegen, im Wechsel mit einer vorhandenen, erscheint im Training', async () => {
    await go('#/exercises');
    click($('a[href="#/exercise/new"].btn'));
    await sleep(40);
    click($('[data-act="exsave"]'));
    assert.match($('#toast').textContent, /Namen/);
    type($('#ex-name'), 'Rudern am Kabel');
    click($$('[data-act="exmuscle"][data-v="back"]')[0]);
    const alt = $('#ex-alt');
    alt.value = 'klimmzuege';
    alt.dispatchEvent(new w.Event('change', { bubbles: true }));
    click($('[data-act="exsave"]'));
    await sleep(40);
    const ex = S().exercises.find(e => e.name === 'Rudern am Kabel');
    assert.ok(ex, 'Übung gespeichert');
    assert.equal(JSON.stringify(ex.muscles), '["back"]');
    const slot = S().templates.upper.find(s => s.ids.includes('klimmzuege'));
    assert.ok(slot.ids.includes(ex.id));
  });

  await t('Doppelte Namen werden abgelehnt', async () => {
    await go('#/exercise/new');
    type($('#ex-name'), 'dips');
    click($('[data-act="exsave"]'));
    assert.match($('#toast').textContent, /schon/);
  });

  await t('Core-Training ist freiwillig: Beenden ohne Satz speichert nichts', async () => {
    await go('#/train/core');
    assert.match(text(), /Plank/);
    assert.match(text(), /optional/);
    click($('[data-act="finish"]'));
    await sleep(40);
    assert.equal(S().sessions.filter(s => s.area === 'core').length, 0);
  });

  await t('Zweites Training: Unterkörper schlägt die Kniebeuge vor, danach Hack-Squat im Wechsel', async () => {
    await go('#/train/lower');
    assert.match(text(), /Kniebeuge mit Langhantel/);
    type($('[data-field="w"][data-j="0"]'), '100');
    type($('[data-field="r"][data-j="0"]'), '8');
    click($('[data-act="check"][data-j="0"]'));
    click($('[data-act="finish"]'));
    await sleep(40);
    // Datum künstlich auf gestern setzen, damit "nächstes Mal" eindeutig ist
    const lower = S().sessions.find(s => s.area === 'lower');
    lower.date = w.GayretLogic.addDays(w.GayretLogic.ymd(new Date()), -1);
    lower.startedAt -= 86400000;
    await go('#/train/lower');
    assert.match($('.seg button.on').textContent, /Hack-Squat/);
    click($('[data-act="finish"]'));
    await sleep(40);
  });

  await t('Vorbefüllung: zweites Mal Oberkörper zeigt Werte von letzter Einheit', async () => {
    // alte Oberkörper-Einheit auf vorgestern schieben
    const up = S().sessions.find(s => s.area === 'upper');
    up.date = w.GayretLogic.addDays(w.GayretLogic.ymd(new Date()), -2);
    up.startedAt -= 2 * 86400000;
    await go('#/train/upper');
    // Schrägbank war zuletzt dran, also schlägt die App Fliegende vor
    assert.match($('.seg button.on').textContent, /Fliegende/);
    click($$('[data-act="variant"]')[0]);
    assert.equal($('[data-field="w"][data-j="0"]').value, '77,5');
    assert.equal($('[data-field="r"][data-j="0"]').value, '8');
    click($('[data-act="finish"]'));
    await sleep(40);
  });

  await t('Einstellungen: Wochenziel und Pause lassen sich ändern', async () => {
    await go('#/settings');
    click($('[data-act="goal"][data-v="3"]'));
    click($('[data-act="rest"][data-v="120"]'));
    assert.equal(S().settings.weeklyGoal, 3);
    assert.equal(S().settings.restSeconds, 120);
  });

  await t('Einstellungen: kaputte Sicherung wird abgelehnt, Daten bleiben', async () => {
    const before = S().sessions.length;
    const input = $('#import-file');
    const file = new w.File(['{"hallo": 1}'], 'x.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(80);
    assert.match($('#toast').textContent, /erwarteten Daten|gültige/);
    assert.equal(S().sessions.length, before);
  });

  await t('Einstellungen: gültige Sicherung wird eingespielt', async () => {
    const backup = JSON.parse(JSON.stringify(S()));
    backup.weights.push({ date: '2026-09-01', kg: 79.9 });
    await go('#/settings');
    const input = $('#import-file');
    const file = new w.File([JSON.stringify(backup)], 'x.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new w.Event('change', { bubbles: true }));
    await sleep(80);
    assert.ok(S().weights.some(x => x.date === '2026-09-01'));
  });

  await t('HTML-Zeichen in Übungsnamen werden entschärft', async () => {
    await go('#/exercise/new');
    type($('#ex-name'), '<img src=x onerror=alert(1)>');
    click($('[data-act="exsave"]'));
    await sleep(40);
    await go('#/exercises');
    assert.equal($$('#screen img').length, 0);
    assert.match(text(), /<img src=x/);
  });

  await t('Zurücksetzen löscht alles und stellt die Startübungen wieder her', async () => {
    await go('#/settings');
    click($('[data-act="reset"]'));
    assert.equal(S().sessions.length, 0);
    assert.ok(S().exercises.length >= 15);
  });

  await t('Keine Skriptfehler während des gesamten Ablaufs', async () => {
    assert.deepEqual(errors, []);
  });

  console.log('\n' + passed + ' UI-Tests bestanden' + (process.exitCode ? ', mit Fehlern' : ''));
  process.exit(process.exitCode || 0);
})();

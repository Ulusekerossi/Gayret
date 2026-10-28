/* Gayret: Logik ohne Oberfläche. Läuft im Browser (window.GayretLogic) und in Node (Tests). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GayretLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 1;

  var AREAS = {
    upper: { label: 'Oberkörper', color: '#FF9A52', main: true },
    lower: { label: 'Unterkörper', color: '#6FB3FF', main: true },
    core: { label: 'Core und Ausdauer', color: '#D4F25C', main: false }
  };

  var MUSCLES = {
    chest: 'Brust',
    back: 'Rücken',
    shoulders: 'Schultern',
    biceps: 'Bizeps',
    triceps: 'Trizeps',
    legs: 'Beine',
    calves: 'Waden',
    abs: 'Bauch',
    cardio: 'Ausdauer'
  };

  var TYPES = {
    weight: { label: 'Gewicht', hint: 'Zum Beispiel Kabel, Maschine, Langhantel' },
    bodyweight: { label: 'Körpergewicht plus Zusatz', hint: 'Zum Beispiel Klimmzüge und Dips. Leer bedeutet Körpergewicht, sonst nur die Zahl' },
    reps: { label: 'Nur Wiederholungen', hint: 'Zum Beispiel Hängendes Beinheben oder Ab-Wheel' },
    time: { label: 'Zeit', hint: 'Zum Beispiel Plank, Rudergerät oder Laufband, in Minuten' }
  };

  /* ---------- Datum ---------- */

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYmd(s) {
    var p = String(s).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function isYmd(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseYmd(s).getTime()); }
  function dayNum(s) {
    var p = String(s).split('-').map(Number);
    return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000);
  }
  function daysBetween(a, b) { return dayNum(b) - dayNum(a); }
  function addDays(s, n) { var d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
  function weekStart(s) {
    var d = parseYmd(s);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return ymd(d);
  }

  /* ---------- Zahlen ---------- */

  function parseNum(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim().replace(',', '.');
    if (s === '') return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }
  function round1(n) { return Math.round(n * 10) / 10; }
  function fmt(n, digits) {
    if (n === null || n === undefined || isNaN(n)) return '';
    var d = digits === undefined ? 1 : digits;
    var f = Math.pow(10, d);
    var r = Math.round(n * f) / f;
    return String(r).replace('.', ',');
  }
  function fmtSigned(n, digits) {
    if (n === null || n === undefined || isNaN(n)) return '';
    var t = fmt(n, digits);
    if (n > 0 && t !== '0') return '+' + t;
    if (n < 0 && t !== '0') return '\u2212' + t.replace('-', '');
    return t;
  }
  function e1rm(w, r) {
    if (!w || !r || w <= 0 || r <= 0) return null;
    if (r === 1) return w;
    return w * (1 + r / 30);
  }

  /* ---------- Startdaten ---------- */

  function defaultState() {
    function ex(id, name, area, muscles, type) {
      return { id: id, name: name, area: area, muscles: muscles, type: type, archived: false };
    }
    return {
      v: VERSION,
      exercises: [
        ex('schraegbank', 'Schrägbankdrücken Smith', 'upper', ['chest'], 'weight'),
        ex('fliegende', 'Fliegende', 'upper', ['chest'], 'weight'),
        ex('klimmzuege', 'Klimmzüge', 'upper', ['back'], 'bodyweight'),
        ex('chinups', 'Chin-Ups', 'upper', ['back', 'biceps'], 'bodyweight'),
        ex('dips', 'Dips', 'upper', ['chest', 'triceps'], 'bodyweight'),
        ex('bizepscurls', 'Bizeps-Curls', 'upper', ['biceps'], 'weight'),
        ex('trizepskabel', 'Trizeps am Kabel', 'upper', ['triceps'], 'weight'),
        ex('seitenheben', 'Seitenheben an der Maschine', 'upper', ['shoulders'], 'weight'),
        ex('squat', 'Kniebeuge mit Langhantel', 'lower', ['legs'], 'weight'),
        ex('hacksquat', 'Hack-Squat', 'lower', ['legs'], 'weight'),
        ex('beinbeuger', 'Beinbeuger', 'lower', ['legs'], 'weight'),
        ex('beinstrecker', 'Beinstrecker', 'lower', ['legs'], 'weight'),
        ex('wadenheben', 'Wadenheben', 'lower', ['calves'], 'weight'),
        ex('kabelcrunch', 'Kabel-Crunch', 'upper', ['abs'], 'weight'),
        ex('beinheben', 'Hängendes Beinheben', 'upper', ['abs'], 'reps'),
        ex('plank', 'Plank', 'core', ['abs'], 'time'),
        ex('abwheel', 'Ab-Wheel', 'core', ['abs'], 'reps'),
        ex('pallof', 'Pallof Press', 'core', ['abs'], 'weight'),
        ex('rudergeraet', 'Rudergerät', 'core', ['cardio'], 'time'),
        ex('laufband', 'Laufband', 'core', ['cardio'], 'time')
      ],
      templates: {
        upper: [
          { ids: ['schraegbank', 'fliegende'], optional: false },
          { ids: ['klimmzuege', 'chinups'], optional: false },
          { ids: ['dips'], optional: false },
          { ids: ['bizepscurls'], optional: false },
          { ids: ['trizepskabel'], optional: false },
          { ids: ['seitenheben'], optional: false },
          { ids: ['kabelcrunch', 'beinheben'], optional: true }
        ],
        lower: [
          { ids: ['squat', 'hacksquat'], optional: false },
          { ids: ['beinbeuger'], optional: false },
          { ids: ['beinstrecker'], optional: false },
          { ids: ['wadenheben'], optional: false }
        ],
        core: [
          { ids: ['plank'], optional: true },
          { ids: ['abwheel'], optional: true },
          { ids: ['pallof'], optional: true },
          { ids: ['rudergeraet'], optional: true },
          { ids: ['laufband'], optional: true }
        ]
      },
      sessions: [],
      weights: [],
      settings: { weeklyGoal: 4, restSeconds: 90 }
    };
  }

  /* ---------- Prüfen und Normalisieren (Import, Laden) ---------- */

  function str(v, max) { return String(v === undefined || v === null ? '' : v).slice(0, max || 200); }
  function numOrNull(v) { var n = parseNum(v); return n === null ? null : n; }

  function normalizeState(input) {
    if (!input || typeof input !== 'object') throw new Error('Keine gültige Gayret-Datei.');
    if (!Array.isArray(input.exercises) || !Array.isArray(input.sessions) || !Array.isArray(input.weights)) {
      throw new Error('Die Datei enthält nicht die erwarteten Daten.');
    }
    var out = defaultState();
    out.exercises = [];
    var seen = {};
    input.exercises.forEach(function (e) {
      if (!e || typeof e !== 'object' || !e.id || seen[e.id]) return;
      var area = AREAS[e.area] ? e.area : 'upper';
      var type = TYPES[e.type] ? e.type : 'weight';
      var muscles = (Array.isArray(e.muscles) ? e.muscles : []).filter(function (m) { return MUSCLES[m]; });
      seen[e.id] = true;
      out.exercises.push({ id: str(e.id, 60), name: str(e.name, 80) || 'Übung', area: area, muscles: muscles, type: type, archived: !!e.archived });
    });
    var ids = {};
    out.exercises.forEach(function (e) { ids[e.id] = true; });

    out.templates = { upper: [], lower: [], core: [] };
    Object.keys(out.templates).forEach(function (area) {
      var src = input.templates && Array.isArray(input.templates[area]) ? input.templates[area] : [];
      src.forEach(function (slot) {
        if (!slot || !Array.isArray(slot.ids)) return;
        var sids = slot.ids.filter(function (id) { return ids[id]; });
        if (sids.length) out.templates[area].push({ ids: sids, optional: !!slot.optional });
      });
    });

    out.sessions = [];
    input.sessions.forEach(function (s) {
      if (!s || !isYmd(s.date) || !AREAS[s.area] || !Array.isArray(s.items)) return;
      var items = [];
      s.items.forEach(function (it) {
        if (!it || !ids[it.exId] || !Array.isArray(it.sets)) return;
        var sets = it.sets.map(function (st) {
          st = st || {};
          return { w: numOrNull(st.w), r: numOrNull(st.r), t: numOrNull(st.t), done: !!st.done };
        });
        items.push({ slot: typeof it.slot === 'number' ? it.slot : 0, exId: it.exId, sets: sets });
      });
      out.sessions.push({
        id: str(s.id, 60) || ('s_' + out.sessions.length),
        date: s.date,
        area: s.area,
        startedAt: numOrNull(s.startedAt) || 0,
        endedAt: numOrNull(s.endedAt),
        items: items
      });
    });

    out.weights = [];
    var wseen = {};
    input.weights.forEach(function (w) {
      if (!w || !isYmd(w.date)) return;
      var kg = parseNum(w.kg);
      if (kg === null || kg < 20 || kg > 400) return;
      wseen[w.date] = kg;
    });
    Object.keys(wseen).sort().forEach(function (d) { out.weights.push({ date: d, kg: wseen[d] }); });

    var st = input.settings || {};
    var goal = parseNum(st.weeklyGoal);
    var rest = parseNum(st.restSeconds);
    out.settings = {
      weeklyGoal: goal >= 1 && goal <= 7 ? Math.round(goal) : 4,
      restSeconds: rest >= 15 && rest <= 600 ? Math.round(rest) : 90
    };
    out.v = VERSION;
    return out;
  }

  /* ---------- Übungen ---------- */

  function getEx(state, id) {
    for (var i = 0; i < state.exercises.length; i++) if (state.exercises[i].id === id) return state.exercises[i];
    return null;
  }

  function doneSets(item) { return item.sets.filter(function (s) { return s.done; }); }

  function sessionsWithDone(state) {
    return state.sessions.filter(function (s) {
      return s.items.some(function (it) { return doneSets(it).length > 0; });
    });
  }

  function sortedSessions(sessions) {
    return sessions.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.startedAt || 0) - (b.startedAt || 0);
    });
  }

  function exerciseHasHistory(state, exId) {
    return state.sessions.some(function (s) {
      return s.items.some(function (it) { return it.exId === exId && doneSets(it).length > 0; });
    });
  }

  function lastDone(state, exId, excludeSessionId) {
    var best = null;
    sortedSessions(state.sessions).forEach(function (s) {
      if (s.id === excludeSessionId) return;
      s.items.forEach(function (it) {
        if (it.exId === exId && doneSets(it).length) best = { session: s, item: it };
      });
    });
    return best;
  }

  function lastSets(state, exId, excludeSessionId) {
    var found = lastDone(state, exId, excludeSessionId);
    return found ? doneSets(found.item) : [];
  }

  function suggestVariant(state, ids) {
    var cands = ids.filter(function (id) { var e = getEx(state, id); return e && !e.archived; });
    if (!cands.length) return null;
    var best = cands[0], bestKey = null;
    cands.forEach(function (id) {
      var ld = lastDone(state, id);
      var key = ld ? ld.session.date + '|' + ('000000000000000' + String(ld.session.startedAt || 0)).slice(-15) : '';
      if (bestKey === null || key < bestKey) { best = id; bestKey = key; }
    });
    return best;
  }

  function prefillSets(state, exId, excludeSessionId) {
    var ex = getEx(state, exId);
    var prev = lastSets(state, exId, excludeSessionId).slice(0, 8);
    if (prev.length) {
      return prev.map(function (s) { return { w: s.w, r: s.r, t: s.t, done: false }; });
    }
    var base = { w: ex && ex.type === 'bodyweight' ? 0 : null, r: null, t: null, done: false };
    return [0, 1, 2].map(function () { return { w: base.w, r: base.r, t: base.t, done: false }; });
  }

  function makeItem(state, slotIdx, exId, excludeSessionId) {
    return { slot: slotIdx, exId: exId, sets: prefillSets(state, exId, excludeSessionId) };
  }

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function finishSession(state, sessionId, nowMs) {
    var idx = -1;
    state.sessions.forEach(function (s, i) { if (s.id === sessionId) idx = i; });
    if (idx < 0) return;
    var s = state.sessions[idx];
    var items = [];
    s.items.forEach(function (it) {
      var d = doneSets(it);
      if (d.length) items.push({ slot: it.slot, exId: it.exId, sets: d });
    });
    if (!items.length) { state.sessions.splice(idx, 1); return; }
    s.items = items;
    s.endedAt = nowMs;
  }

  function activeSession(state) {
    for (var i = state.sessions.length - 1; i >= 0; i--) if (!state.sessions[i].endedAt) return state.sessions[i];
    return null;
  }

  function startSession(state, area, today, nowMs) {
    var cur = activeSession(state);
    if (cur && cur.area === area && cur.date === today) return cur;
    while ((cur = activeSession(state))) finishSession(state, cur.id, nowMs);
    var tpl = state.templates[area] || [];
    var id = uid('s_');
    var items = [];
    tpl.forEach(function (slot, i) {
      var exId = suggestVariant(state, slot.ids);
      if (exId) items.push(makeItem(state, i, exId, id));
    });
    var session = { id: id, date: today, area: area, startedAt: nowMs, endedAt: null, items: items };
    state.sessions.push(session);
    return session;
  }

  function slotOptional(state, session, item) {
    if (session.area === 'core') return true;
    var slot = (state.templates[session.area] || [])[item.slot];
    return slot ? !!slot.optional : false;
  }

  function addExercise(state, data) {
    var id = uid('ex_');
    var ex = {
      id: id,
      name: str(data.name, 80).trim() || 'Neue Übung',
      area: AREAS[data.area] ? data.area : 'upper',
      muscles: (data.muscles || []).filter(function (m) { return MUSCLES[m]; }),
      type: TYPES[data.type] ? data.type : 'weight',
      archived: false
    };
    state.exercises.push(ex);
    attachToTemplate(state, ex, data.altWith || null, !!data.optional);
    return ex;
  }

  function detachFromTemplates(state, exId) {
    Object.keys(state.templates).forEach(function (area) {
      state.templates[area].forEach(function (slot) {
        slot.ids = slot.ids.filter(function (id) { return id !== exId; });
      });
      state.templates[area] = state.templates[area].filter(function (slot) { return slot.ids.length > 0; });
    });
  }

  function attachToTemplate(state, ex, altWith, optional) {
    var tpl = state.templates[ex.area];
    if (altWith) {
      for (var i = 0; i < tpl.length; i++) {
        if (tpl[i].ids.indexOf(altWith) >= 0) { tpl[i].ids.push(ex.id); return; }
      }
    }
    tpl.push({ ids: [ex.id], optional: ex.area === 'core' ? true : !!optional });
  }

  function updateExercise(state, id, data) {
    var ex = getEx(state, id);
    if (!ex) return null;
    if (data.name !== undefined) ex.name = str(data.name, 80).trim() || ex.name;
    if (data.muscles) ex.muscles = data.muscles.filter(function (m) { return MUSCLES[m]; });
    if (data.type && TYPES[data.type] && !exerciseHasHistory(state, id)) ex.type = data.type;
    var newArea = data.area && AREAS[data.area] ? data.area : ex.area;
    var moved = newArea !== ex.area || data.altWith !== undefined || data.optional !== undefined;
    if (moved) {
      detachFromTemplates(state, id);
      ex.area = newArea;
      attachToTemplate(state, ex, data.altWith || null, !!data.optional);
    }
    return ex;
  }

  function removeExercise(state, id) {
    var ex = getEx(state, id);
    if (!ex) return 'none';
    if (exerciseHasHistory(state, id)) {
      ex.archived = true;
      return 'archived';
    }
    state.exercises = state.exercises.filter(function (e) { return e.id !== id; });
    detachFromTemplates(state, id);
    state.sessions.forEach(function (s) { s.items = s.items.filter(function (it) { return it.exId !== id; }); });
    return 'deleted';
  }

  function restoreExercise(state, id) {
    var ex = getEx(state, id);
    if (ex) ex.archived = false;
  }

  /* ---------- Körpergewicht ---------- */

  function upsertWeight(state, date, kg) {
    var k = parseNum(kg);
    if (!isYmd(date) || k === null || k < 20 || k > 400) return false;
    k = round1(k);
    var found = false;
    state.weights.forEach(function (w) { if (w.date === date) { w.kg = k; found = true; } });
    if (!found) state.weights.push({ date: date, kg: k });
    state.weights.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return true;
  }

  function removeWeight(state, date) {
    state.weights = state.weights.filter(function (w) { return w.date !== date; });
  }

  function bodyweightAt(state, date) {
    var best = null, bestDiff = Infinity;
    state.weights.forEach(function (w) {
      var diff = Math.abs(daysBetween(w.date, date));
      if (diff < bestDiff || (diff === bestDiff && best && w.date < best.date)) { best = w; bestDiff = diff; }
    });
    return best ? best.kg : null;
  }

  function trendSeries(weights) {
    var n = weights.length;
    return weights.map(function (w, i) {
      var from = Math.max(0, i - 1), to = Math.min(n - 1, i + 1);
      var sum = 0, c = 0;
      for (var j = from; j <= to; j++) { sum += weights[j].kg; c++; }
      return { date: w.date, kg: sum / c };
    });
  }

  function slopePerWeek(points) {
    if (points.length < 2) return null;
    var xs = points.map(function (p) { return dayNum(p.date); });
    var ys = points.map(function (p) { return p.kg; });
    var n = xs.length;
    var mx = xs.reduce(function (a, b) { return a + b; }, 0) / n;
    var my = ys.reduce(function (a, b) { return a + b; }, 0) / n;
    var num = 0, den = 0;
    for (var i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) * (xs[i] - mx); }
    if (den === 0) return null;
    return (num / den) * 7;
  }

  var RANGES = { '4w': 28, '3m': 92, '6m': 183, '1y': 365, all: null };

  function inRange(date, rangeKey, today) {
    var days = RANGES[rangeKey];
    if (days === null || days === undefined) return true;
    return daysBetween(date, today) <= days && daysBetween(date, today) >= -1;
  }

  /* ---------- Auswertung pro Übung ---------- */

  function setLoad(state, ex, set, date) {
    if (!ex) return null;
    if (ex.type === 'weight') return set.w !== null && set.w > 0 ? { load: set.w, approx: false } : null;
    if (ex.type === 'bodyweight') {
      var bw = bodyweightAt(state, date);
      var extra = set.w || 0;
      if (bw === null) return { load: extra, approx: true };
      return { load: bw + extra, approx: false };
    }
    return null;
  }

  function exerciseSeries(state, exId) {
    var ex = getEx(state, exId);
    if (!ex) return [];
    var out = [];
    sortedSessions(state.sessions).forEach(function (s) {
      s.items.forEach(function (it) {
        if (it.exId !== exId) return;
        var d = doneSets(it);
        if (!d.length) return;
        var best = null;
        d.forEach(function (st) {
          var val, load = null, approx = false;
          if (ex.type === 'weight' || ex.type === 'bodyweight') {
            var l = setLoad(state, ex, st, s.date);
            if (!l) return;
            val = l.load; load = l.load; approx = l.approx;
          } else if (ex.type === 'reps') {
            if (st.r === null) return;
            val = st.r;
          } else {
            if (st.t === null) return;
            val = st.t;
          }
          var cand = { date: s.date, value: val, w: st.w, r: st.r, t: st.t, approx: approx, e1rm: load !== null ? e1rm(load, st.r) : null };
          if (!best || cand.value > best.value || (cand.value === best.value && (cand.r || 0) > (best.r || 0))) best = cand;
        });
        if (best) out.push(best);
      });
    });
    return out;
  }

  /* ---------- Muskelgruppen, Bereiche, Wochen ---------- */

  function muscleRecency(state, today) {
    var last = {};
    sortedSessions(state.sessions).forEach(function (s) {
      s.items.forEach(function (it) {
        if (!doneSets(it).length) return;
        var ex = getEx(state, it.exId);
        if (!ex) return;
        ex.muscles.forEach(function (m) { last[m] = s.date; });
      });
    });
    return Object.keys(MUSCLES).map(function (m) {
      return { muscle: m, label: MUSCLES[m], date: last[m] || null, days: last[m] ? Math.max(0, daysBetween(last[m], today)) : null };
    });
  }

  function areaLast(state, area, today) {
    var last = null;
    sessionsWithDone(state).forEach(function (s) { if (s.area === area && (!last || s.date > last)) last = s.date; });
    return last ? { date: last, days: Math.max(0, daysBetween(last, today)) } : null;
  }

  function nextMainArea(state, today) {
    var u = areaLast(state, 'upper', today), l = areaLast(state, 'lower', today);
    if (!u && !l) return 'upper';
    if (!u) return 'upper';
    if (!l) return 'lower';
    if (u.date === l.date) return 'upper';
    return u.date < l.date ? 'upper' : 'lower';
  }

  function mainSessionsInWeek(state, weekStartStr) {
    var end = addDays(weekStartStr, 6);
    return sessionsWithDone(state).filter(function (s) {
      return AREAS[s.area].main && s.date >= weekStartStr && s.date <= end;
    }).length;
  }

  function weekStreak(state, today, goal) {
    var ws = weekStart(today);
    var streak = 0;
    if (mainSessionsInWeek(state, ws) >= goal) streak++;
    var w = addDays(ws, -7);
    for (var i = 0; i < 520; i++) {
      if (mainSessionsInWeek(state, w) >= goal) { streak++; w = addDays(w, -7); } else break;
    }
    return streak;
  }

  function monthStats(state, year, month) {
    var prefix = year + '-' + pad(month + 1);
    var main = 0, core = 0;
    sessionsWithDone(state).forEach(function (s) {
      if (s.date.indexOf(prefix) !== 0) return;
      if (AREAS[s.area].main) main++; else core++;
    });
    return { main: main, core: core };
  }

  function sessionSummary(state, session) {
    return session.items.map(function (it) {
      var ex = getEx(state, it.exId);
      return { name: ex ? ex.name : 'Übung', sets: doneSets(it).length };
    }).filter(function (x) { return x.sets > 0; });
  }

  function niceTicks(min, max, target) {
    var range = max - min;
    if (!(range > 0)) { range = Math.max(Math.abs(max) * 0.1, 1); min = max - range; }
    var raw = range / (target || 3);
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var steps = [1, 2, 2.5, 5, 10];
    var step = mag * 10;
    for (var i = 0; i < steps.length; i++) { if (steps[i] * mag >= raw) { step = steps[i] * mag; break; } }
    var start = Math.floor(min / step + 1e-9) * step;
    var ticks = [];
    for (var v = start; v < max + step - 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
    if (ticks.length < 2) ticks.push(ticks[0] + step);
    return ticks;
  }

  return {
    VERSION: VERSION, AREAS: AREAS, MUSCLES: MUSCLES, TYPES: TYPES, RANGES: RANGES,
    ymd: ymd, parseYmd: parseYmd, isYmd: isYmd, dayNum: dayNum, daysBetween: daysBetween, addDays: addDays, weekStart: weekStart,
    parseNum: parseNum, round1: round1, fmt: fmt, fmtSigned: fmtSigned, e1rm: e1rm,
    defaultState: defaultState, normalizeState: normalizeState,
    getEx: getEx, doneSets: doneSets, sessionsWithDone: sessionsWithDone, sortedSessions: sortedSessions,
    exerciseHasHistory: exerciseHasHistory, lastDone: lastDone, lastSets: lastSets,
    suggestVariant: suggestVariant, prefillSets: prefillSets, makeItem: makeItem,
    startSession: startSession, finishSession: finishSession, activeSession: activeSession, slotOptional: slotOptional,
    addExercise: addExercise, updateExercise: updateExercise, removeExercise: removeExercise, restoreExercise: restoreExercise,
    upsertWeight: upsertWeight, removeWeight: removeWeight, bodyweightAt: bodyweightAt,
    trendSeries: trendSeries, slopePerWeek: slopePerWeek, inRange: inRange,
    setLoad: setLoad, exerciseSeries: exerciseSeries,
    muscleRecency: muscleRecency, areaLast: areaLast, nextMainArea: nextMainArea,
    mainSessionsInWeek: mainSessionsInWeek, weekStreak: weekStreak, monthStats: monthStats,
    sessionSummary: sessionSummary, niceTicks: niceTicks, uid: uid
  };
});

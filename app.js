/* Gayret: Oberfläche. Alle Daten bleiben im Browser dieses Geräts (localStorage). */
(function () {
  'use strict';

  var L = window.GayretLogic;
  var KEY = 'gayret.v1';
  var KEY_EXPORT = 'gayret.lastExport';
  var A = L.AREAS;

  /* ---------- Zustand ---------- */

  var S = load();
  var ui = {
    open: null, openSession: null, picker: null,
    restUntil: 0, restTotal: 0, restDone: false,
    calY: null, calM: null, calSel: null,
    progEx: null, progRange: '3m', weightRange: '3m',
    weightDate: null, weightVal: null,
    exFilter: 'all', form: null,
    summary: null
  };

  function today() { return L.ymd(new Date()); }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return L.normalizeState(JSON.parse(raw));
    } catch (e) { /* kaputte Daten: mit Startdaten weiter, Original bleibt im Speicher bis zum nächsten Speichern */ }
    return L.defaultState();
  }

  var saveFailed = false;
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
      saveFailed = false;
    } catch (e) {
      if (!saveFailed) toast('Speichern nicht möglich. Ist der private Modus aktiv?');
      saveFailed = true;
    }
  }

  /* ---------- Hilfen ---------- */

  var DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var DAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  var MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function longDate(s) { var d = L.parseYmd(s); return DAYS[d.getDay()] + ', ' + d.getDate() + '. ' + MONTHS[d.getMonth()]; }
  function shortDate(s) { var d = L.parseYmd(s); return d.getDate() + '.' + (d.getMonth() + 1) + '.'; }
  function agoText(days) { return days === 0 ? 'heute' : days === 1 ? 'gestern' : 'vor ' + days + ' Tagen'; }
  function mmss(ms) {
    var t = Math.max(0, Math.round(ms / 1000));
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return h ? h + ':' + p(m) + ':' + p(s) : p(m) + ':' + p(s);
  }

  var ICONS = {
    back: '<path d="M15 6l-6 6 6 6"/>',
    chevR: '<path d="M9 6l6 6-6 6"/>',
    chevD: '<path d="M6 9l6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    home: '<path d="M4 11l8-7 8 7v9H4z"/>',
    cal: '<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/>',
    chart: '<path d="M4 19V5M4 19h16M8 15l4-5 3 3 5-6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    scale: '<circle cx="12" cy="12" r="9"/><path d="M12 12l3-3"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    dumbbell: '<path d="M6 6v12M18 6v12M3 9v6M21 9v6M6 12h12"/>',
    squat: '<circle cx="12" cy="5" r="2"/><path d="M12 8v6M7 10h10M12 14l-4 6M12 14l4 6"/>',
    core: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>'
  };
  var AREA_ICON = { upper: 'dumbbell', lower: 'squat', core: 'core' };
  var AREA_DESC = {
    upper: 'Brust, Rücken, Dips, Arme, Schultern',
    lower: 'Kniebeuge, Beinbeuger, Beinstrecker, Waden',
    core: 'Bauch, Rumpf, Ausdauer'
  };

  function ic(name, size, color, sw) {
    return '<svg width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="' + (color || 'currentColor') +
      '" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = ''; }, 3200);
  }

  /* ---------- Beschriftungen für Sätze ---------- */

  function setLabel(ex, s) {
    if (!ex || !s) return '';
    if (ex.type === 'weight') return (s.r !== null ? L.fmt(s.r) + ' \u00d7 ' : '') + L.fmt(s.w) + ' kg';
    if (ex.type === 'bodyweight') return (s.r !== null ? L.fmt(s.r) + ' \u00d7 ' : '') + (s.w ? '+' + L.fmt(s.w) + ' kg' : 'Körpergewicht');
    if (ex.type === 'reps') return L.fmt(s.r) + ' Wdh.';
    return L.fmt(s.t) + ' Min';
  }
  function prevLabel(ex, s) {
    if (!s) return '\u2013';
    if (ex.type === 'weight') return L.fmt(s.w) + ' \u00d7 ' + L.fmt(s.r);
    if (ex.type === 'bodyweight') return (s.w ? '+' + L.fmt(s.w) : 'KG') + ' \u00d7 ' + L.fmt(s.r);
    if (ex.type === 'reps') return L.fmt(s.r);
    return L.fmt(s.t);
  }
  function bestSet(ex, sets) {
    var best = null;
    sets.forEach(function (s) {
      var v = ex.type === 'reps' ? s.r : ex.type === 'time' ? s.t : s.w;
      var key = (v === null ? -1 : v) * 1000 + (s.r || 0);
      if (!best || key > best.key) best = { key: key, set: s };
    });
    return best ? best.set : null;
  }

  /* ---------- Diagramm ---------- */

  function chart(points, opt) {
    opt = opt || {};
    var W = 350, H = 150, left = 38, right = 12, top = 12, bottom = 26;
    var vals = points.map(function (p) { return p.v; });
    if (opt.trend) opt.trend.forEach(function (p) { vals.push(p.v); });
    var ticks = L.niceTicks(Math.min.apply(null, vals), Math.max.apply(null, vals), 3);
    var lo = ticks[0], hi = ticks[ticks.length - 1];
    var d0 = L.dayNum(points[0].date), d1 = L.dayNum(points[points.length - 1].date);
    function X(date) { return d1 === d0 ? (left + (W - right)) / 2 : left + (L.dayNum(date) - d0) / (d1 - d0) * (W - right - left - 6) + 3; }
    function Y(v) { return top + (hi - v) / (hi - lo) * (H - top - bottom); }
    var color = opt.color || '#D4F25C';
    var g = '';
    ticks.forEach(function (t) {
      var y = Y(t).toFixed(1);
      g += '<line x1="' + left + '" y1="' + y + '" x2="' + W + '" y2="' + y + '" stroke="#2C343C" stroke-width="1"/>' +
        '<text x="0" y="' + (Number(y) + 4) + '" font-size="12" fill="#A9B1B9">' + L.fmt(t) + '</text>';
    });
    var dotsFill = opt.trend ? '#6A7580' : color;
    var line = '';
    if (opt.trend) {
      line = '<polyline points="' + opt.trend.map(function (p) { return X(p.date).toFixed(1) + ',' + Y(p.v).toFixed(1); }).join(' ') +
        '" fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    } else if (points.length > 1) {
      line = '<polyline points="' + points.map(function (p) { return X(p.date).toFixed(1) + ',' + Y(p.v).toFixed(1); }).join(' ') +
        '" fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    var dots = points.map(function (p) {
      return '<circle cx="' + X(p.date).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="3.5" fill="' + dotsFill + '"/>';
    }).join('');
    var lastP = opt.trend ? opt.trend[opt.trend.length - 1] : points[points.length - 1];
    var end = '<circle cx="' + X(lastP.date).toFixed(1) + '" cy="' + Y(lastP.v).toFixed(1) + '" r="6" fill="' + color + '"/>' +
      '<circle cx="' + X(lastP.date).toFixed(1) + '" cy="' + Y(lastP.v).toFixed(1) + '" r="11" fill="none" stroke="' + color + '" stroke-opacity="0.35" stroke-width="2"/>';
    var labels = '<text x="' + Math.max(left, X(points[0].date)).toFixed(1) + '" y="' + (H - 6) + '" font-size="12" fill="#A9B1B9" text-anchor="' + (d1 === d0 ? 'middle' : 'start') + '">' + shortDate(points[0].date) + '</text>';
    if (d1 !== d0) labels += '<text x="' + (W - 2) + '" y="' + (H - 6) + '" font-size="12" fill="#A9B1B9" text-anchor="end">' + shortDate(points[points.length - 1].date) + '</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(opt.label || 'Diagramm') + '">' + g + line + dots + end + labels + '</svg>';
  }

  /* ---------- Bausteine ---------- */

  function topBar(title, backHref, right) {
    return '<div class="top">' +
      (backHref ? '<a class="icon-btn" href="' + backHref + '" aria-label="Zurück">' + ic('back') + '</a>' : '') +
      '<h1 class="display grow">' + esc(title) + '</h1>' + (right || '') + '</div>';
  }

  function rangeChips(active, act) {
    var items = [['4w', '4 Wochen'], ['3m', '3 Monate'], ['6m', '6 Monate'], ['1y', '1 Jahr']];
    return '<div class="seg" style="grid-template-columns:repeat(4,minmax(0,1fr))">' + items.map(function (it) {
      return '<button type="button" class="' + (active === it[0] ? 'on' : '') + '" data-act="' + act + '" data-v="' + it[0] + '">' + it[1] + '</button>';
    }).join('') + '</div>';
  }

  /* ---------- Start ---------- */

  function viewHome() {
    var t = today();
    var d = L.parseYmd(t);
    var goal = S.settings.weeklyGoal;
    var ws = L.weekStart(t);
    var done = L.mainSessionsInWeek(S, ws);
    var withDone = L.sessionsWithDone(S);
    var next = L.nextMainArea(S, t);
    var act = L.activeSession(S);
    var h = '';

    h += '<div class="top"><div class="col grow" style="gap:6px"><div class="muted small" style="font-weight:500">' + esc(longDate(t)) + '</div>' +
      '<h1 class="display" style="font-size:44px">Was trainierst<br>du heute?</h1></div>' +
      '<a class="icon-btn" href="#/settings" aria-label="Einstellungen">' + ic('gear') + '</a></div>';

    if (ui.summary) {
      var sm = ui.summary;
      h += '<div class="banner accent"><div class="grow col" style="gap:3px"><div class="display" style="font-size:22px">Training gespeichert</div>' +
        '<div class="muted small">' + esc(A[sm.area].label) + ', ' + sm.sets + ' Sätze, ' + sm.minutes + ' Min</div>' +
        (sm.prs.length ? '<div class="small" style="font-weight:600;color:var(--accent)">Neue Bestleistung: ' + esc(sm.prs.join(', ')) + '</div>' : '') +
        '</div><button type="button" class="icon-btn" data-act="dismiss" aria-label="Schließen">' + ic('check') + '</button></div>';
    }

    if (act) {
      h += '<div class="banner"><div class="grow col" style="gap:3px"><div class="display" style="font-size:22px">Training läuft</div>' +
        '<div class="muted small">' + esc(A[act.area].label) + ' seit ' + new Date(act.startedAt).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }) + ' Uhr</div></div>' +
        '<a class="btn small" href="#/train/' + act.area + '">Fortsetzen</a></div>';
    }

    // Woche
    h += '<div class="card"><div class="row between" style="align-items:baseline"><div style="font-weight:600;font-size:14px">Diese Woche</div>' +
      '<div class="muted small">' + done + ' von ' + goal + ' Einheiten</div></div><div class="week">';
    for (var i = 0; i < 7; i++) {
      var ds = L.addDays(ws, i);
      var dd = L.parseYmd(ds);
      var ses = withDone.filter(function (s) { return s.date === ds; });
      var cls = ses.length ? ses[0].area : '';
      var isToday = ds === t;
      h += '<div class="wday' + (isToday ? ' today' : '') + '"><div>' + DAYS_SHORT[dd.getDay()] + '</div><div class="n ' + cls + '"' +
        (cls ? ' style="background:' + A[cls].color + '"' : '') + '>' + dd.getDate() + '</div></div>';
    }
    h += '</div></div>';

    // Hauptbereiche
    h += '<div class="col" style="gap:10px">';
    ['lower', 'upper'].forEach(function () { });
    ['upper', 'lower'].forEach(function (a) {
      var last = L.areaLast(S, a, t);
      h += '<a class="area-card" href="#/train/' + a + '"><div class="badge" style="background:' + A[a].color + '">' + ic(AREA_ICON[a], 30, '#111418') + '</div>' +
        '<div class="grow col" style="gap:3px"><div class="row" style="gap:8px"><div class="display" style="font-size:26px">' + A[a].label + '</div>' +
        (a === next ? '<span class="tag-now">Heute dran</span>' : '') + '</div>' +
        '<div class="muted small">' + AREA_DESC[a] + '</div>' +
        '<div class="muted small">' + (last ? 'Zuletzt ' + agoText(last.days) : 'Noch nicht trainiert') + '</div></div>' + ic('chevR', 22, '#A9B1B9') + '</a>';
    });
    h += '</div>';

    // Core, freiwillig
    var cl = L.areaLast(S, 'core', t);
    h += '<div class="col" style="gap:10px"><div class="muted small" style="font-weight:500;padding-top:6px">Zusätzlich, wenn du Lust hast</div>' +
      '<a class="area-card small-card" href="#/train/core"><div class="badge" style="background:' + A.core.color + '">' + ic('core', 24, '#111418') + '</div>' +
      '<div class="grow col" style="gap:2px"><div class="display" style="font-size:22px">Core und Ausdauer</div>' +
      '<div class="muted small">' + (cl ? 'Zuletzt ' + agoText(cl.days) : 'Noch nicht trainiert') + '</div></div>' + ic('chevR', 22, '#A9B1B9') + '</a></div>';

    // Schnellzugriff
    h += '<div class="quick"><a href="#/weight">' + ic('scale', 20) + 'Gewicht eintragen</a><a href="#/exercises">' + ic('list', 20) + 'Übungen verwalten</a></div>';

    // Sicherungshinweis
    var lastExp = null;
    try { lastExp = localStorage.getItem(KEY_EXPORT); } catch (e) { /* egal */ }
    var needBackup = withDone.length >= 8 && (!lastExp || L.daysBetween(lastExp, t) > 30);
    if (needBackup) {
      h += '<a class="banner" href="#/settings"><div class="grow col" style="gap:3px"><div style="font-weight:600">Zeit für eine Sicherung</div>' +
        '<div class="muted small">Deine Daten liegen nur auf diesem Gerät. Eine Sicherungsdatei schützt sie.</div></div>' + ic('chevR', 22, '#A9B1B9') + '</a>';
    }
    return h;
  }

  /* ---------- Training ---------- */

  function currentSession() { return L.activeSession(S); }

  function defaultOpen(ses) {
    for (var i = 0; i < ses.items.length; i++) {
      if (!L.slotOptional(S, ses, ses.items[i]) && !ses.items[i].sets.every(function (s) { return s.done; })) return i;
    }
    for (var j = 0; j < ses.items.length; j++) {
      if (!ses.items[j].sets.every(function (s) { return s.done; })) return j;
    }
    return 0;
  }

  function foldSub(ses, item) {
    var ex = L.getEx(S, item.exId);
    var d = L.doneSets(item).length;
    if (d > 0) return d + ' von ' + item.sets.length + ' Sätzen erledigt';
    var prev = L.lastSets(S, item.exId, ses.id);
    var top = prev.length ? bestSet(ex, prev) : null;
    return item.sets.length + ' Sätze' + (top ? ', zuletzt ' + setLabel(ex, top) : '');
  }

  function itemTag(ses, item, i) {
    var ex = L.getEx(S, item.exId);
    var muscles = ex.muscles.map(function (m) { return L.MUSCLES[m]; }).join(' und ');
    var allDone = item.sets.length && item.sets.every(function (s) { return s.done; });
    return 'Übung ' + (i + 1) + (muscles ? ' \u00b7 ' + muscles : '') + (L.slotOptional(S, ses, item) ? ' \u00b7 optional' : '') + (allDone ? ' \u00b7 erledigt' : '');
  }

  function setRows(ses, item, i, ex) {
    var prev = L.lastSets(S, item.exId, ses.id);
    var activeJ = -1;
    item.sets.forEach(function (s, j) { if (activeJ < 0 && !s.done) activeJ = j; });
    var cls = ex.type === 'weight' ? 'g-weight' : ex.type === 'bodyweight' ? 'g-body' : 'g-reps';
    var head = ex.type === 'weight' ? ['Satz', 'Vorher', 'kg', 'Wdh', ''] :
      ex.type === 'bodyweight' ? ['Satz', 'Gewicht', 'Wdh', ''] :
      ex.type === 'reps' ? ['Satz', 'Vorher', 'Wdh', ''] : ['Satz', 'Vorher', 'Min', ''];
    var h = '<div class="sets"><div class="sethead ' + cls + '">' + head.map(function (x) { return '<div>' + x + '</div>'; }).join('') + '</div>';
    item.sets.forEach(function (s, j) {
      var p = prev[j] || null;
      var n = j + 1;
      var da = 'data-i="' + i + '" data-j="' + j + '"';
      var field = function (f, val, label, mode, extra) {
        return '<input class="field" type="text" inputmode="' + mode + '" value="' + esc(val === null ? '' : L.fmt(val, 2)) + '" data-field="' + f + '" ' + da +
          ' aria-label="' + label + ' Satz ' + n + '" ' + (extra || '') + '>';
      };
      h += '<div class="set ' + cls + (j === activeJ ? ' active' : '') + (s.done ? ' isdone' : '') + '"><div class="num">' + n + '</div>';
      if (ex.type === 'weight') {
        h += '<div class="pre">' + esc(prevLabel(ex, p)) + '</div>' + field('w', s.w, 'Gewicht in Kilogramm', 'decimal') + field('r', s.r, 'Wiederholungen', 'numeric');
      } else if (ex.type === 'bodyweight') {
        h += '<div class="col"><button type="button" class="field wbtn" data-act="wpick" ' + da + ' aria-label="Gewicht Satz ' + n + ' wählen">' +
          (s.w ? '+' + L.fmt(s.w) + ' kg' : 'Körpergewicht') + '</button><div class="capt">Vorher: ' + esc(prevLabel(ex, p)) + '</div></div>' +
          field('r', s.r, 'Wiederholungen', 'numeric');
      } else if (ex.type === 'reps') {
        h += '<div class="pre">' + esc(prevLabel(ex, p)) + '</div>' + field('r', s.r, 'Wiederholungen', 'numeric');
      } else {
        h += '<div class="pre">' + esc(prevLabel(ex, p)) + '</div>' + field('t', s.t, 'Minuten', 'decimal');
      }
      h += '<button type="button" class="check' + (s.done ? ' on' : '') + '" data-act="check" ' + da + ' aria-pressed="' + (s.done ? 'true' : 'false') +
        '" aria-label="Satz ' + n + (s.done ? ' erledigt, rückgängig machen' : ' als erledigt markieren') + '">' + ic('check', 22, 'currentColor', 3) + '</button></div>';
      if (ui.picker && ui.picker.i === i && ui.picker.j === j && ex.type === 'bodyweight') {
        h += '<div class="picker"><div class="small muted">Zusatzgewicht für Satz ' + n + '</div><div class="chips scroll">';
        [[0, 'Körpergewicht'], [5, '+5'], [10, '+10'], [15, '+15'], [20, '+20']].forEach(function (c) {
          h += '<button type="button" class="chip' + ((s.w || 0) === c[0] ? ' on' : '') + '" data-act="pickw" ' + da + ' data-v="' + c[0] + '">' + c[1] + '</button>';
        });
        h += '</div><div class="row"><input id="pick-other" class="field" type="text" inputmode="decimal" placeholder="Andere Zahl in kg" aria-label="Andere Zahl für Zusatzgewicht in Kilogramm">' +
          '<button type="button" class="btn small" data-act="pickother" ' + da + '>OK</button></div></div>';
      }
    });
    return h + '</div>';
  }

  function loadHint(ses, item, ex) {
    if (ex.type !== 'bodyweight') return '';
    var bw = L.bodyweightAt(S, ses.date);
    var idx = 0;
    item.sets.some(function (s, j) { idx = j; return !s.done; });
    var s = item.sets[idx] || { w: 0 };
    var extra = s.w || 0;
    if (bw === null) {
      return '<a class="hint-box" href="#/weight"><span class="muted small">Für die Gesamtlast fehlt dein Körpergewicht</span><span style="font-weight:600;font-size:14px">Eintragen</span></a>';
    }
    return '<div class="hint-box"><span class="muted small">Gesamtlast für die Auswertung</span><span class="big" style="font-size:22px;white-space:nowrap">' + L.fmt(bw + extra) + ' kg</span></div>' +
      '<div class="muted small" style="margin-top:-6px">Körpergewicht ' + L.fmt(bw) + ' kg' + (extra ? ' plus ' + L.fmt(extra) + ' kg Zusatz' : ' ohne Zusatz') + '</div>';
  }

  function viewTrain(area) {
    var ses = currentSession();
    if (!ses) return '<p class="muted">Keine Einheit gefunden.</p><a class="btn" href="#/">Zur Startseite</a>';
    if (ui.openSession !== ses.id) { ui.open = defaultOpen(ses); ui.openSession = ses.id; ui.picker = null; }
    var totalMain = ses.items.length;
    var h = '<div class="top"><a class="icon-btn" href="#/" aria-label="Zurück zur Startseite">' + ic('back') + '</a>' +
      '<div class="grow col" style="gap:2px"><h1 class="display" style="font-size:32px">' + A[ses.area].label + '</h1><div class="muted small">' + esc(longDate(ses.date)) + '</div></div>' +
      '<div class="col" style="text-align:right;gap:2px"><div class="display" id="dur" style="font-size:26px;font-weight:600;color:var(--accent)">' + mmss(Date.now() - ses.startedAt) + '</div><div class="muted xs">Dauer</div></div></div>';

    h += '<div class="progress" style="grid-template-columns:repeat(' + totalMain + ',minmax(0,1fr))" aria-label="Fortschritt der Übungen">';
    ses.items.forEach(function (it, i) {
      var all = it.sets.length && it.sets.every(function (s) { return s.done; });
      h += '<i class="' + (all ? 'done' : i === ui.open ? 'now' : '') + '"></i>';
    });
    h += '</div>';

    ses.items.forEach(function (item, i) {
      var ex = L.getEx(S, item.exId);
      if (!ex) return;
      var tagCls = ses.area;
      if (i !== ui.open) {
        h += '<button type="button" class="fold" data-act="open" data-i="' + i + '"><div class="grow col" style="gap:3px"><div class="tag ' + tagCls + '">' + esc(itemTag(ses, item, i)) + '</div>' +
          '<div class="ttl">' + esc(ex.name) + '</div><div class="muted small">' + esc(foldSub(ses, item)) + '</div></div>' + ic('chevD', 22, '#A9B1B9') + '</button>';
        return;
      }
      var slot = (S.templates[ses.area] || [])[item.slot];
      var alts = slot ? slot.ids.filter(function (id) { var e = L.getEx(S, id); return e && !e.archived; }) : [item.exId];
      h += '<div class="card on-card" style="border-radius:20px"><div class="col" style="gap:4px"><div class="tag ' + tagCls + '">' + esc(itemTag(ses, item, i)) + '</div>' +
        '<h2 class="display" style="font-size:30px">' + esc(ex.name) + '</h2>';
      if (alts.length > 1) {
        var lastAlt = null, lastKey = '';
        alts.forEach(function (id) { var ld = L.lastDone(S, id, ses.id); if (ld && ld.session.date + ld.session.startedAt > lastKey) { lastKey = ld.session.date + ld.session.startedAt; lastAlt = id; } });
        if (lastAlt) h += '<div class="muted small">Letztes Mal ' + esc(L.getEx(S, lastAlt).name) + '</div>';
      }
      h += '</div>';
      if (alts.length > 1) {
        h += '<div class="seg" style="grid-template-columns:repeat(' + alts.length + ',minmax(0,1fr))">' + alts.map(function (id) {
          return '<button type="button" class="' + (id === item.exId ? 'on' : '') + '" data-act="variant" data-i="' + i + '" data-ex="' + esc(id) + '">' + esc(L.getEx(S, id).name) + '</button>';
        }).join('') + '</div>';
      }
      h += setRows(ses, item, i, ex);
      h += '<button type="button" class="addrow" data-act="addset" data-i="' + i + '">' + ic('plus', 18, 'currentColor', 2.5) + 'Satz hinzufügen</button>';
      if (item.sets.length > 1 && !item.sets[item.sets.length - 1].done) {
        h += '<button type="button" class="ghost-link" data-act="rmset" data-i="' + i + '">Letzten Satz entfernen</button>';
      }
      h += loadHint(ses, item, ex) + '</div>';
    });
    h += '<a class="ghost-link" href="#/exercise/new" style="color:var(--muted)">' + ic('plus', 18, 'currentColor', 2.5) + 'Übung hinzufügen</a>';
    return h;
  }

  function renderBar() {
    var el = document.getElementById('bar');
    var r = parseRoute();
    if (r.name !== 'train') { el.innerHTML = ''; return; }
    var now = Date.now();
    var running = ui.restUntil > now;
    var ready = !running && ui.restDone && now - ui.restUntil < 8000;
    var left = running ? ui.restUntil - now : ready ? 0 : S.settings.restSeconds * 1000;
    var pct = running ? Math.max(0, Math.min(100, (1 - (ui.restUntil - now) / ui.restTotal) * 100)) : ready ? 100 : 0;
    el.innerHTML = '<div class="bar' + (ready ? ' ready' : '') + '"><div class="bar-in"><button type="button" class="grow col" data-act="skiprest" style="gap:6px;background:none;border:0;text-align:left;padding:0;min-height:44px" aria-label="Pause überspringen">' +
      '<div class="row between" style="align-items:baseline"><div class="muted xs" style="font-weight:500">' + (ready ? 'Weiter geht\u2019s' : running ? 'Pause' : 'Pause nach jedem Satz') + '</div>' +
      '<div class="display" id="rest-time" style="font-size:26px;' + (running || ready ? '' : 'color:var(--muted)') + '">' + mmss(left) + '</div></div>' +
      '<div class="meter"><i id="rest-meter" style="width:' + pct.toFixed(0) + '%"></i></div></button>' +
      '<button type="button" class="btn" data-act="finish" style="height:52px">Beenden</button></div></div>';
  }

  function tick() {
    var ses = currentSession();
    var d = document.getElementById('dur');
    if (d && ses) d.textContent = mmss(Date.now() - ses.startedAt);
    var rt = document.getElementById('rest-time');
    if (!rt) return;
    var now = Date.now();
    if (ui.restUntil > now) {
      rt.textContent = mmss(ui.restUntil - now);
      var m = document.getElementById('rest-meter');
      if (m) m.style.width = Math.min(100, (1 - (ui.restUntil - now) / ui.restTotal) * 100).toFixed(0) + '%';
    } else if (ui.restUntil && !ui.restDone) {
      ui.restDone = true;
      try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* egal */ }
      renderBar();
    } else if (ui.restDone && now - ui.restUntil >= 8000) {
      ui.restDone = false; ui.restUntil = 0;
      renderBar();
    }
  }

  /* ---------- Kalender ---------- */

  function viewCalendar() {
    var t = today();
    var td = L.parseYmd(t);
    if (ui.calY === null) { ui.calY = td.getFullYear(); ui.calM = td.getMonth(); }
    var y = ui.calY, m = ui.calM;
    var withDone = L.sessionsWithDone(S);
    var first = new Date(y, m, 1);
    var offset = (first.getDay() + 6) % 7;
    var dim = new Date(y, m + 1, 0).getDate();
    var byDate = {};
    withDone.forEach(function (s) { (byDate[s.date] = byDate[s.date] || []).push(s); });
    Object.keys(byDate).forEach(function (k) { byDate[k].sort(function (a, b) { return a.startedAt - b.startedAt; }); });
    var stats = L.monthStats(S, y, m);
    var streak = L.weekStreak(S, t, S.settings.weeklyGoal);

    var h = '<h1 class="display">Kalender</h1>';
    h += '<div class="row between"><button type="button" class="icon-btn" data-act="calprev" aria-label="Vorheriger Monat">' + ic('back') + '</button>' +
      '<h2 class="display" style="font-size:26px;font-weight:600">' + MONTHS[m] + ' ' + y + '</h2>' +
      '<button type="button" class="icon-btn" data-act="calnext" aria-label="Nächster Monat">' + ic('chevR') + '</button></div>';
    h += '<div class="card on-card" style="padding:14px 10px"><div class="cal">';
    ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].forEach(function (d) { h += '<div class="wd">' + d + '</div>'; });
    for (var i = 0; i < offset; i++) h += '<div></div>';
    for (var d = 1; d <= dim; d++) {
      var ds = y + '-' + (m + 1 < 10 ? '0' : '') + (m + 1) + '-' + (d < 10 ? '0' : '') + d;
      var ss = byDate[ds] || [];
      var cls = (ss.length ? ss[0].area : '') + (ds === t ? ' today' : '') + (ds === ui.calSel ? ' sel' : '');
      var lab = d + (ss.length ? ', ' + ss.map(function (s) { return A[s.area].label; }).join(' und ') : '');
      h += '<button type="button" class="' + cls + '" data-act="calday" data-d="' + ds + '" aria-label="' + esc(lab) + '">' + d +
        (ss.length > 1 ? '<span class="dot2" style="background:' + A[ss[1].area].color + '"></span>' : '') + '</button>';
    }
    h += '</div><div class="legend"><span><i style="background:' + A.upper.color + '"></i>Oberkörper</span><span><i style="background:' + A.lower.color + '"></i>Unterkörper</span><span><i style="background:' + A.core.color + '"></i>Core, optional</span></div></div>';

    h += '<div class="stat-row"><div class="stat"><div class="big" style="font-size:32px">' + stats.main + '</div><div class="muted xs">Einheiten im ' + MONTHS[m] + '</div></div>' +
      '<div class="stat"><div class="big" style="font-size:32px">' + streak + '</div><div class="muted xs">Wochen in Folge</div></div>' +
      '<div class="stat"><div class="big" style="font-size:32px">' + stats.core + '</div><div class="muted xs">Core zusätzlich</div></div></div>';

    var sel = ui.calSel && byDate[ui.calSel] ? byDate[ui.calSel] : null;
    if (sel) {
      sel.forEach(function (s) {
        var mins = s.endedAt ? Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000)) : null;
        h += '<div class="card"><div class="row between" style="align-items:baseline"><div class="row"><span class="dot" style="background:' + A[s.area].color + '"></span><h3 class="display" style="font-size:24px">' + A[s.area].label + '</h3></div>' +
          '<div class="muted small">' + esc(longDate(s.date)) + (mins ? ' \u00b7 ' + mins + ' Min' : '') + '</div></div><div class="col" style="gap:6px;font-size:14px">';
        s.items.forEach(function (it) {
          var ex = L.getEx(S, it.exId);
          var ds2 = L.doneSets(it);
          if (!ex || !ds2.length) return;
          var b = bestSet(ex, ds2);
          h += '<div class="row between"><span>' + esc(ex.name) + '</span><span class="muted">' + ds2.length + ' Sätze, ' + esc(setLabel(ex, b)) + '</span></div>';
        });
        h += '</div><button type="button" class="ghost-link" data-act="delsession" data-id="' + esc(s.id) + '" style="justify-content:flex-start">' + ic('trash', 18) + 'Einheit löschen</button></div>';
      });
    } else if (ui.calSel) {
      h += '<div class="empty">' + esc(longDate(ui.calSel)) + ': kein Training eingetragen.</div>';
    } else {
      h += '<div class="empty">Tippe auf einen Tag, um das Training zu sehen.</div>';
    }
    return h;
  }

  /* ---------- Fortschritt ---------- */

  function viewProgress(arg) {
    var t = today();
    var exs = S.exercises.filter(function (e) { return !e.archived || L.exerciseHasHistory(S, e.id); });
    if (arg && L.getEx(S, arg)) ui.progEx = arg;
    if (!ui.progEx || !L.getEx(S, ui.progEx)) {
      var recent = L.sortedSessions(L.sessionsWithDone(S)).pop();
      ui.progEx = recent && recent.items.length ? recent.items[0].exId : (exs[0] ? exs[0].id : null);
    }
    var ex = ui.progEx ? L.getEx(S, ui.progEx) : null;
    var h = '<h1 class="display">Fortschritt</h1>';

    h += '<div class="fld"><label class="lab" for="prog-ex">Übung</label><select id="prog-ex" class="input" data-change="progex">';
    ['upper', 'lower', 'core'].forEach(function (a) {
      var list = exs.filter(function (e) { return e.area === a; });
      if (!list.length) return;
      h += '<optgroup label="' + A[a].label + '">' + list.map(function (e) { return '<option value="' + esc(e.id) + '"' + (e.id === ui.progEx ? ' selected' : '') + '>' + esc(e.name) + '</option>'; }).join('') + '</optgroup>';
    });
    h += '</select></div>';

    if (ex) {
      var all = L.exerciseSeries(S, ex.id);
      var series = all.filter(function (p) { return L.inRange(p.date, ui.progRange, t); });
      var unit = ex.type === 'reps' ? 'Wdh' : ex.type === 'time' ? 'Min' : 'kg';
      var color = A[ex.area].color;
      h += '<div class="card">';
      if (!series.length) {
        h += '<div class="empty">Noch keine Einheiten mit ' + esc(ex.name) + ' in diesem Zeitraum.</div>';
      } else {
        var cur = series[series.length - 1], firstP = series[0];
        var best = series.reduce(function (m, p) { return p.value > m ? p.value : m; }, 0);
        var diff = cur.value - firstP.value;
        h += '<div class="stat-row"><div class="stat"><div class="big" style="font-size:28px">' + L.fmt(cur.value) + ' ' + unit + '</div><div class="muted xs">Aktuell, Topsatz</div></div>' +
          '<div class="stat"><div class="big" style="font-size:28px;color:' + color + '">' + (series.length > 1 ? L.fmtSigned(diff) + ' ' + unit : '\u2013') + '</div><div class="muted xs">Veränderung</div></div>' +
          '<div class="stat"><div class="big" style="font-size:28px">' + series.length + '</div><div class="muted xs">Einheiten</div></div></div>';
        if (series.length > 1) {
          h += chart(series.map(function (p) { return { date: p.date, v: p.value }; }), { color: color, label: 'Verlauf ' + ex.name + ': von ' + L.fmt(firstP.value) + ' auf ' + L.fmt(cur.value) + ' ' + unit });
        } else {
          h += '<div class="empty">Ab der zweiten Einheit zeichne ich hier eine Kurve.</div>';
        }
        h += '<div class="muted small">Bestwert im Zeitraum: ' + L.fmt(best) + ' ' + unit;
        if ((ex.type === 'weight' || ex.type === 'bodyweight') && cur.e1rm) h += '. Geschätztes Maximum für eine Wiederholung: ' + L.fmt(cur.e1rm) + ' kg';
        h += '</div>';
        if (ex.type === 'bodyweight') {
          h += '<div class="muted small">' + (cur.approx ? 'Ohne eingetragenes Körpergewicht zählt nur das Zusatzgewicht.' : 'Gezählt wird Körpergewicht plus Zusatz.') + '</div>';
        }
      }
      h += rangeChips(ui.progRange, 'progrange') + '</div>';
    }

    var ws = S.weights;
    var lastW = ws.length ? ws[ws.length - 1] : null;
    var firstW = ws.length ? ws[0] : null;
    h += '<a class="banner" href="#/weight"><div class="grow col" style="gap:3px"><div class="muted xs">Körpergewicht</div>' +
      (lastW ? '<div class="row" style="align-items:baseline;gap:10px"><span class="big" style="font-size:28px">' + L.fmt(lastW.kg) + ' kg</span>' +
        (ws.length > 1 ? '<span class="muted small">' + L.fmtSigned(L.round1(lastW.kg - firstW.kg)) + ' kg seit ' + esc(shortDate(firstW.date)) + '</span>' : '') + '</div>' : '<div style="font-weight:600">Noch kein Gewicht eingetragen</div>') +
      '</div>' + ic('chevR', 22, '#A9B1B9') + '</a>';

    var rec = L.muscleRecency(S, t).filter(function (r) { return r.muscle !== 'cardio'; });
    h += '<div class="card" style="gap:6px"><div class="row between" style="align-items:baseline;padding-bottom:4px"><h2 class="display">Zuletzt trainiert</h2><div class="muted small">Tage seit dem Training</div></div>';
    rec.forEach(function (r) {
      var core = r.muscle === 'abs';
      var color = core ? '#5A656F' : (r.days !== null && r.days <= 3 ? A.upper.color : A.lower.color);
      var width = r.days === null ? 0 : Math.max(4, Math.min(r.days, 14) / 14 * 100);
      h += '<div class="mrow"><div class="nm">' + r.label + '</div><div class="track"><i style="width:' + width.toFixed(0) + '%;background:' + color + '"></i></div><div class="st">' + (r.days === null ? 'noch nie' : agoText(r.days)) + '</div></div>';
    });
    h += '</div>';
    return h;
  }

  /* ---------- Körpergewicht ---------- */

  function viewWeight() {
    var t = today();
    if (!ui.weightDate) ui.weightDate = t;
    if (ui.weightVal === null || ui.weightVal === undefined) ui.weightVal = S.weights.length ? S.weights[S.weights.length - 1].kg : null;
    var ws = S.weights;
    var inR = ws.filter(function (w) { return L.inRange(w.date, ui.weightRange, t); });
    var lastW = ws.length ? ws[ws.length - 1] : null;
    var h = topBar('Körpergewicht', '#/progress');

    h += '<div class="card"><div class="col" style="gap:2px"><div class="muted xs">Eintragen</div>' +
      '<div class="muted small">' + (lastW ? 'Zuletzt gewogen am ' + esc(longDate(lastW.date)) : 'Noch kein Eintrag') + '</div></div>' +
      '<div class="fld"><label class="muted xs" for="w-date">Datum</label><input id="w-date" type="date" class="input" value="' + ui.weightDate + '" max="' + t + '" data-change="wdate"></div>' +
      '<div class="stepper"><button type="button" class="round" data-act="wminus" aria-label="0,1 Kilogramm weniger">' + ic('minus', 22, '#F2F4F3', 2.5) + '</button>' +
      '<div class="val"><input id="w-val" type="text" inputmode="decimal" value="' + (ui.weightVal === null ? '' : L.fmt(ui.weightVal)) + '" placeholder="80,0" data-field="wval" aria-label="Körpergewicht in Kilogramm"><span class="muted">kg</span></div>' +
      '<button type="button" class="round" data-act="wplus" aria-label="0,1 Kilogramm mehr">' + ic('plus', 22, '#F2F4F3', 2.5) + '</button></div>' +
      '<button type="button" class="btn" data-act="wsave">Gewicht speichern</button></div>';

    h += '<div class="card">';
    if (inR.length) {
      var tr = L.trendSeries(inR);
      var cur = inR[inR.length - 1];
      var diff = inR.length > 1 ? L.round1(cur.kg - inR[0].kg) : null;
      var slope = L.slopePerWeek(inR);
      h += '<div class="stat-row"><div class="stat"><div class="big" style="font-size:28px">' + L.fmt(cur.kg) + ' kg</div><div class="muted xs">Aktuell</div></div>' +
        '<div class="stat"><div class="big" style="font-size:28px;color:var(--accent)">' + (diff === null ? '\u2013' : L.fmtSigned(diff) + ' kg') + '</div><div class="muted xs">Im Zeitraum</div></div>' +
        '<div class="stat"><div class="big" style="font-size:28px">' + (slope === null ? '\u2013' : L.fmtSigned(L.round1(slope)) + ' kg') + '</div><div class="muted xs">Trend pro Woche</div></div></div>';
      if (inR.length > 1) {
        h += chart(inR.map(function (w) { return { date: w.date, v: w.kg }; }), {
          trend: tr.map(function (w) { return { date: w.date, v: w.kg }; }),
          label: 'Körpergewicht von ' + L.fmt(inR[0].kg) + ' auf ' + L.fmt(cur.kg) + ' Kilogramm'
        });
        h += '<div class="legend"><span><i style="background:#6A7580"></i>Einzelwerte</span><span><i style="background:var(--accent);width:16px;height:4px;border-radius:2px"></i>Trend</span></div>';
      } else {
        h += '<div class="empty">Ab dem zweiten Eintrag zeichne ich hier eine Kurve.</div>';
      }
    } else {
      h += '<div class="empty">Im gewählten Zeitraum gibt es keine Einträge.</div>';
    }
    h += rangeChips(ui.weightRange, 'weightrange') + '</div>';

    h += '<div class="card tight"><h2 class="display" style="margin:10px 0 4px">Letzte Einträge</h2>';
    ws.slice(-8).reverse().forEach(function (w) {
      h += '<div class="hist"><span>' + esc(longDate(w.date)) + '</span><span class="row" style="gap:0"><b>' + L.fmt(w.kg) + ' kg</b>' +
        '<button type="button" class="del" data-act="wdel" data-d="' + w.date + '" aria-label="Eintrag vom ' + esc(longDate(w.date)) + ' löschen">' + ic('trash', 20) + '</button></span></div>';
    });
    if (!ws.length) h += '<div class="empty">Noch nichts eingetragen.</div>';
    h += '<div class="muted small" style="padding:6px 0 10px">Bei Klimmzügen und Dips zählt der Eintrag, der dem Trainingstag am nächsten liegt, als Körpergewicht.</div></div>';
    return h;
  }

  /* ---------- Übungen ---------- */

  function viewExercises() {
    var h = topBar('Übungen', '#/');
    h += '<div class="chips scroll">' + [['all', 'Alle'], ['upper', 'Oberkörper'], ['lower', 'Unterkörper'], ['core', 'Core']].map(function (c) {
      return '<button type="button" class="chip' + (ui.exFilter === c[0] ? ' on' : '') + '" data-act="exfilter" data-v="' + c[0] + '">' + c[1] + '</button>';
    }).join('') + '</div>';
    ['upper', 'lower', 'core'].forEach(function (a) {
      if (ui.exFilter !== 'all' && ui.exFilter !== a) return;
      var list = S.exercises.filter(function (e) { return e.area === a && !e.archived; });
      h += '<div class="col" style="gap:8px"><div class="sec"><span class="dot" style="background:' + A[a].color + '"></span><h2 class="display">' + A[a].label + '</h2>' + (a === 'core' ? '<span class="muted small">optional</span>' : '') + '</div>';
      h += '<div class="card tight">';
      if (!list.length) h += '<div class="empty">Noch keine Übung.</div>';
      list.forEach(function (e) {
        h += '<a class="item" href="#/exercise/' + esc(e.id) + '"><div class="grow"><div class="nm">' + esc(e.name) + '</div><div class="muted small">' +
          esc(e.muscles.map(function (m) { return L.MUSCLES[m]; }).join(' und ') || 'Ohne Muskelgruppe') + ' \u00b7 ' + esc(L.TYPES[e.type].label) + '</div></div>' + ic('chevR', 20, '#A9B1B9') + '</a>';
      });
      h += '</div></div>';
    });
    var arch = S.exercises.filter(function (e) { return e.archived; });
    if (arch.length) {
      h += '<div class="col" style="gap:8px"><div class="sec"><h2 class="display">Ausgeblendet</h2></div><div class="card tight">' + arch.map(function (e) {
        return '<div class="item"><div class="grow"><div class="nm">' + esc(e.name) + '</div><div class="muted small">Verlauf bleibt erhalten</div></div><button type="button" class="btn small ghost" data-act="exrestore" data-id="' + esc(e.id) + '">Einblenden</button></div>';
      }).join('') + '</div></div>';
    }
    h += '<a class="btn" href="#/exercise/new">' + ic('plus', 18, '#111418', 3) + 'Neue Übung</a>';
    return h;
  }

  function startForm(id) {
    var ex = id && id !== 'new' ? L.getEx(S, id) : null;
    var altWith = '';
    var optional = false;
    if (ex) {
      var slot = null;
      (S.templates[ex.area] || []).forEach(function (sl) { if (sl.ids.indexOf(ex.id) >= 0) slot = sl; });
      if (slot) { optional = !!slot.optional; var other = slot.ids.filter(function (x) { return x !== ex.id; })[0]; altWith = other || ''; }
    }
    ui.form = ex ?
      { id: ex.id, name: ex.name, area: ex.area, muscles: ex.muscles.slice(), type: ex.type, altWith: altWith, optional: optional } :
      { id: null, name: '', area: 'upper', muscles: [], type: 'weight', altWith: '', optional: false };
  }

  function viewExerciseForm(id) {
    if (!ui.form || (ui.form.id || 'new') !== id) startForm(id);
    var f = ui.form;
    var existing = f.id ? L.getEx(S, f.id) : null;
    if (f.id && !existing) return topBar('Übung', '#/exercises') + '<div class="empty">Diese Übung gibt es nicht mehr.</div>';
    var locked = existing ? L.exerciseHasHistory(S, f.id) : false;
    var h = topBar(existing ? 'Übung ändern' : 'Neue Übung', '#/exercises');

    h += '<div class="fld"><label class="lab" for="ex-name">Name</label><input id="ex-name" class="input" type="text" maxlength="80" value="' + esc(f.name) + '" placeholder="Zum Beispiel Rudern am Kabel" data-field="exname" autocomplete="off"></div>';

    h += '<div class="fld"><div class="lab">Trainingsbereich</div><div class="chips">' + ['upper', 'lower', 'core'].map(function (a) {
      return '<button type="button" class="chip' + (f.area === a ? ' on' : '') + '" data-act="exarea" data-v="' + a + '">' + A[a].label + '</button>';
    }).join('') + '</div></div>';

    h += '<div class="fld"><div class="lab">Muskelgruppe</div><div class="chips">' + Object.keys(L.MUSCLES).map(function (m) {
      return '<button type="button" class="chip' + (f.muscles.indexOf(m) >= 0 ? ' on' : '') + '" data-act="exmuscle" data-v="' + m + '" aria-pressed="' + (f.muscles.indexOf(m) >= 0) + '">' + L.MUSCLES[m] + '</button>';
    }).join('') + '</div></div>';

    h += '<div class="fld"><div class="lab">Was trägst du ein?</div>' + Object.keys(L.TYPES).map(function (k) {
      return '<button type="button" class="opt' + (f.type === k ? ' on' : '') + '" data-act="extype" data-v="' + k + '" aria-pressed="' + (f.type === k) + '"' + (locked && f.type !== k ? ' disabled style="opacity:.45"' : '') + '><span class="radio"></span><span class="col" style="gap:2px"><b style="font-size:16px">' +
        L.TYPES[k].label + '</b><span class="muted small">' + L.TYPES[k].hint + '</span></span></button>';
    }).join('') + (locked ? '<div class="muted small">Die Art lässt sich nicht mehr ändern, weil schon Training damit gespeichert ist.</div>' : '') + '</div>';

    var peers = S.exercises.filter(function (e) { return e.area === f.area && !e.archived && e.id !== f.id; });
    h += '<div class="fld"><label class="lab" for="ex-alt">Im Wechsel mit</label><select id="ex-alt" class="input" data-change="exalt"><option value="">Keine, eigener Platz im Training</option>' +
      peers.map(function (e) { return '<option value="' + esc(e.id) + '"' + (f.altWith === e.id ? ' selected' : '') + '>' + esc(e.name) + '</option>'; }).join('') + '</select>' +
      '<div class="muted small">Wie Langhantel und Hack-Squat: die App schlägt jeweils die Variante vor, die länger nicht dran war.</div></div>';

    if (f.area !== 'core' && !f.altWith) {
      h += '<div class="card" style="flex-direction:row;align-items:center"><div class="grow col" style="gap:2px"><div style="font-weight:600">Optional</div><div class="muted small">Zählt nicht als fehlend, wenn du sie auslässt</div></div>' +
        '<button type="button" class="switch' + (f.optional ? ' on' : '') + '" role="switch" aria-checked="' + f.optional + '" aria-label="Optional" data-act="exopt"><i></i></button></div>';
    }

    h += '<button type="button" class="btn" data-act="exsave">Übung speichern</button>';
    if (existing) h += '<button type="button" class="btn danger" data-act="exdel">' + (locked ? 'Übung ausblenden' : 'Übung löschen') + '</button>';
    return h;
  }

  /* ---------- Einstellungen ---------- */

  function viewSettings() {
    var h = topBar('Einstellungen', '#/');
    h += '<div class="card"><div class="lab">Wochenziel</div><div class="muted small">Einheiten Oberkörper und Unterkörper pro Woche. Core zählt nicht mit.</div><div class="chips">' +
      [2, 3, 4, 5, 6].map(function (n) { return '<button type="button" class="chip' + (S.settings.weeklyGoal === n ? ' on' : '') + '" data-act="goal" data-v="' + n + '">' + n + '</button>'; }).join('') + '</div></div>';
    h += '<div class="card"><div class="lab">Pause nach jedem Satz</div><div class="chips">' +
      [60, 90, 120, 180].map(function (n) { return '<button type="button" class="chip' + (S.settings.restSeconds === n ? ' on' : '') + '" data-act="rest" data-v="' + n + '">' + mmss(n * 1000) + '</button>'; }).join('') + '</div></div>';
    var lastExp = null;
    try { lastExp = localStorage.getItem(KEY_EXPORT); } catch (e) { /* egal */ }
    h += '<div class="card"><div class="lab">Sicherung</div><div class="muted small">Deine Daten liegen nur auf diesem Gerät. ' + (lastExp ? 'Letzte Sicherung: ' + esc(longDate(lastExp)) + '.' : 'Es gibt noch keine Sicherung.') + '</div>' +
      '<button type="button" class="btn" data-act="export">Sicherung speichern</button>' +
      '<button type="button" class="btn ghost" data-act="import">Sicherung einspielen</button>' +
      '<input id="import-file" type="file" accept="application/json,.json" hidden data-change="importfile"></div>';
    h += '<div class="card"><div class="lab">Alles zurücksetzen</div><div class="muted small">Löscht Training, Gewicht und eigene Übungen von diesem Gerät. Das lässt sich nicht rückgängig machen.</div>' +
      '<button type="button" class="btn danger" data-act="reset">Alle Daten löschen</button></div>';
    h += '<div class="muted small" style="text-align:center">Gayret, Version 1</div>';
    return h;
  }

  /* ---------- Rendern und Routing ---------- */

  function parseRoute() {
    var parts = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
    return { name: parts[0] || 'home', arg: parts[1] ? decodeURIComponent(parts[1]) : null };
  }

  function renderTabs(name) {
    var tabs = document.getElementById('tabs');
    var show = name === 'home' || name === 'calendar' || name === 'progress' || name === 'weight';
    tabs.style.display = show ? '' : 'none';
    if (!show) { tabs.innerHTML = ''; return; }
    var cur = name === 'weight' ? 'progress' : name;
    tabs.innerHTML = [['home', '#/', 'home', 'Heute'], ['calendar', '#/calendar', 'cal', 'Kalender'], ['progress', '#/progress', 'chart', 'Fortschritt']].map(function (t) {
      return '<a href="' + t[1] + '" class="' + (cur === t[0] ? 'on' : '') + '"' + (cur === t[0] ? ' aria-current="page"' : '') + '>' + ic(t[2], 24) + '<span>' + t[3] + '</span></a>';
    }).join('');
  }

  function render(keepScroll) {
    var r = parseRoute();
    var y = window.scrollY;
    var screen = document.getElementById('screen');
    var html;
    switch (r.name) {
      case 'train':
        if (!A[r.arg]) { location.hash = '#/'; return; }
        L.startSession(S, r.arg, today(), Date.now());
        save();
        html = viewTrain(r.arg); break;
      case 'calendar': html = viewCalendar(); break;
      case 'progress': html = viewProgress(r.arg); break;
      case 'weight': html = viewWeight(); break;
      case 'exercises': html = viewExercises(); break;
      case 'exercise': html = viewExerciseForm(r.arg || 'new'); break;
      case 'settings': html = viewSettings(); break;
      default: html = viewHome();
    }
    screen.className = r.name === 'train' ? 'has-bar' : '';
    screen.innerHTML = html;
    renderTabs(r.name);
    renderBar();
    window.scrollTo(0, keepScroll ? y : 0);
  }

  /* ---------- Aktionen ---------- */

  function sessionItem(i) { var s = currentSession(); return s ? { ses: s, item: s.items[i] } : null; }

  function toggleDone(i, j) {
    var cx = sessionItem(i); if (!cx) return;
    var ex = L.getEx(S, cx.item.exId);
    var s = cx.item.sets[j];
    if (!s) return;
    if (!s.done) {
      var ok = ex.type === 'weight' ? (s.w !== null && s.r !== null) : ex.type === 'bodyweight' ? s.r !== null : ex.type === 'reps' ? s.r !== null : s.t !== null;
      if (!ok) {
        toast(ex.type === 'weight' ? 'Bitte Gewicht und Wiederholungen eintragen.' : ex.type === 'time' ? 'Bitte die Minuten eintragen.' : 'Bitte die Wiederholungen eintragen.');
        return;
      }
      s.done = true;
      ui.restTotal = S.settings.restSeconds * 1000;
      ui.restUntil = Date.now() + ui.restTotal;
      ui.restDone = false;
    } else {
      s.done = false;
    }
    ui.picker = null;
    save(); render(true);
  }

  function finishTraining() {
    var ses = currentSession(); if (!ses) { location.hash = '#/'; return; }
    var hasDone = ses.items.some(function (it) { return L.doneSets(it).length > 0; });
    if (!hasDone) {
      if (!window.confirm('Noch kein Satz ist abgehakt. Die Einheit wird nicht gespeichert. Trotzdem beenden?')) return;
    }
    var now = Date.now();
    var exIds = ses.items.filter(function (it) { return L.doneSets(it).length > 0; }).map(function (it) { return it.exId; });
    var sets = ses.items.reduce(function (n, it) { return n + L.doneSets(it).length; }, 0);
    var area = ses.area, started = ses.startedAt;
    L.finishSession(S, ses.id, now);
    var prs = [];
    exIds.forEach(function (id) {
      var series = L.exerciseSeries(S, id);
      if (series.length < 2) return;
      var last = series[series.length - 1];
      var before = series.slice(0, -1).reduce(function (m, p) { return Math.max(m, p.value); }, 0);
      if (last.value > before) prs.push(L.getEx(S, id).name);
    });
    ui.restUntil = 0; ui.restDone = false; ui.openSession = null;
    ui.summary = hasDone ? { area: area, sets: sets, minutes: Math.max(1, Math.round((now - started) / 60000)), prs: prs } : null;
    save();
    location.hash = '#/';
    if (!hasDone) toast('Nichts gespeichert, es war kein Satz abgehakt.');
  }

  function exportData() {
    try {
      var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'gayret-sicherung-' + today() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      try { localStorage.setItem(KEY_EXPORT, today()); } catch (e) { /* egal */ }
      toast('Sicherung gespeichert.');
      setTimeout(function () { render(true); }, 300);
    } catch (e) { toast('Die Sicherung konnte nicht erstellt werden.'); }
  }

  function importData(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var next;
      try { next = L.normalizeState(JSON.parse(String(reader.result))); }
      catch (e) { toast(e && e.message ? e.message : 'Die Datei konnte nicht gelesen werden.'); return; }
      var n = L.sessionsWithDone(next).length;
      if (!window.confirm('Sicherung mit ' + n + ' Einheiten einspielen? Die aktuellen Daten auf diesem Gerät werden ersetzt.')) return;
      S = next; ui.openSession = null; ui.form = null; ui.progEx = null;
      save(); toast('Sicherung eingespielt.'); render();
    };
    reader.onerror = function () { toast('Die Datei konnte nicht gelesen werden.'); };
    reader.readAsText(file);
  }

  function saveForm() {
    var f = ui.form; if (!f) return;
    var name = f.name.trim();
    if (!name) { toast('Bitte gib der Übung einen Namen.'); return; }
    var dup = S.exercises.some(function (e) { return e.id !== f.id && !e.archived && e.name.toLowerCase() === name.toLowerCase(); });
    if (dup) { toast('Diese Übung gibt es schon.'); return; }
    var data = { name: name, area: f.area, muscles: f.muscles, type: f.type, altWith: f.altWith || null, optional: f.optional };
    if (f.id) L.updateExercise(S, f.id, data); else L.addExercise(S, data);
    ui.form = null; save();
    toast('Übung gespeichert.');
    location.hash = '#/exercises';
  }

  function onClick(ev) {
    var el = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!el) return;
    var act = el.getAttribute('data-act');
    var i = el.getAttribute('data-i') !== null ? Number(el.getAttribute('data-i')) : null;
    var j = el.getAttribute('data-j') !== null ? Number(el.getAttribute('data-j')) : null;
    var v = el.getAttribute('data-v');
    var cx;
    switch (act) {
      case 'dismiss': ui.summary = null; render(true); break;
      case 'open': ui.open = i; ui.picker = null; render(true); break;
      case 'variant':
        cx = sessionItem(i); if (!cx) break;
        if (cx.item.exId === el.getAttribute('data-ex')) break;
        if (L.doneSets(cx.item).length) { toast('Du hast schon Sätze abgehakt. Die Übung lässt sich danach nicht mehr tauschen.'); break; }
        cx.ses.items[i] = L.makeItem(S, cx.item.slot, el.getAttribute('data-ex'), cx.ses.id);
        ui.picker = null; save(); render(true); break;
      case 'check': toggleDone(i, j); break;
      case 'addset':
        cx = sessionItem(i); if (!cx) break;
        var last = cx.item.sets[cx.item.sets.length - 1];
        cx.item.sets.push({ w: last ? last.w : null, r: last ? last.r : null, t: last ? last.t : null, done: false });
        save(); render(true); break;
      case 'rmset':
        cx = sessionItem(i); if (!cx) break;
        if (cx.item.sets.length > 1 && !cx.item.sets[cx.item.sets.length - 1].done) cx.item.sets.pop();
        ui.picker = null; save(); render(true); break;
      case 'wpick':
        ui.picker = ui.picker && ui.picker.i === i && ui.picker.j === j ? null : { i: i, j: j };
        render(true); break;
      case 'pickw':
        cx = sessionItem(i); if (!cx) break;
        cx.item.sets[j].w = Number(v);
        ui.picker = null; save(); render(true); break;
      case 'pickother':
        cx = sessionItem(i); if (!cx) break;
        var val = L.parseNum((document.getElementById('pick-other') || {}).value);
        if (val === null || val < 0 || val > 200) { toast('Bitte eine Zahl zwischen 0 und 200 eintragen.'); break; }
        cx.item.sets[j].w = val;
        ui.picker = null; save(); render(true); break;
      case 'skiprest': ui.restUntil = 0; ui.restDone = false; renderBar(); break;
      case 'finish': finishTraining(); break;
      case 'calprev': ui.calM--; if (ui.calM < 0) { ui.calM = 11; ui.calY--; } render(true); break;
      case 'calnext': ui.calM++; if (ui.calM > 11) { ui.calM = 0; ui.calY++; } render(true); break;
      case 'calday': ui.calSel = el.getAttribute('data-d'); render(true); break;
      case 'delsession':
        if (window.confirm('Diese Einheit wirklich löschen?')) {
          var id = el.getAttribute('data-id');
          S.sessions = S.sessions.filter(function (s) { return s.id !== id; });
          save(); render(true);
        }
        break;
      case 'progrange': ui.progRange = v; render(true); break;
      case 'weightrange': ui.weightRange = v; render(true); break;
      case 'wminus': case 'wplus':
        var cur = L.parseNum((document.getElementById('w-val') || {}).value);
        if (cur === null) cur = S.weights.length ? S.weights[S.weights.length - 1].kg : 80;
        ui.weightVal = L.round1(cur + (act === 'wplus' ? 0.1 : -0.1)); render(true); break;
      case 'wsave':
        var kg = L.parseNum((document.getElementById('w-val') || {}).value);
        if (kg === null || kg < 20 || kg > 400) { toast('Bitte ein Gewicht zwischen 20 und 400 Kilogramm eintragen.'); break; }
        if (!L.upsertWeight(S, ui.weightDate || today(), kg)) { toast('Das Gewicht konnte nicht gespeichert werden.'); break; }
        ui.weightVal = L.round1(kg); save(); toast('Gewicht gespeichert.'); render(true); break;
      case 'wdel':
        if (window.confirm('Diesen Eintrag löschen?')) { L.removeWeight(S, el.getAttribute('data-d')); save(); render(true); }
        break;
      case 'exfilter': ui.exFilter = v; render(true); break;
      case 'exrestore': L.restoreExercise(S, el.getAttribute('data-id')); save(); render(true); break;
      case 'exarea': ui.form.area = v; ui.form.altWith = ''; render(true); break;
      case 'exmuscle':
        var k = ui.form.muscles.indexOf(v);
        if (k >= 0) ui.form.muscles.splice(k, 1); else ui.form.muscles.push(v);
        render(true); break;
      case 'extype': ui.form.type = v; render(true); break;
      case 'exopt': ui.form.optional = !ui.form.optional; render(true); break;
      case 'exsave': saveForm(); break;
      case 'exdel':
        var fx = ui.form && ui.form.id ? L.getEx(S, ui.form.id) : null;
        if (!fx) break;
        if (window.confirm(L.exerciseHasHistory(S, fx.id) ? 'Die Übung wird ausgeblendet. Dein bisheriges Training mit ihr bleibt erhalten.' : 'Diese Übung löschen?')) {
          L.removeExercise(S, fx.id); ui.form = null; save(); location.hash = '#/exercises';
        }
        break;
      case 'goal': S.settings.weeklyGoal = Number(v); save(); render(true); break;
      case 'rest': S.settings.restSeconds = Number(v); save(); render(true); break;
      case 'export': exportData(); break;
      case 'import': var inp = document.getElementById('import-file'); if (inp) inp.click(); break;
      case 'reset':
        if (window.confirm('Wirklich alle Daten auf diesem Gerät löschen?') && window.confirm('Letzte Rückfrage: Training, Gewicht und eigene Übungen sind danach weg.')) {
          S = L.defaultState(); ui.openSession = null; ui.form = null; ui.progEx = null; ui.summary = null;
          try { localStorage.removeItem(KEY_EXPORT); } catch (e) { /* egal */ }
          save(); toast('Alle Daten gelöscht.'); render();
        }
        break;
    }
  }

  function onInput(ev) {
    var el = ev.target;
    var field = el.getAttribute && el.getAttribute('data-field');
    if (!field) return;
    if (field === 'exname') { if (ui.form) ui.form.name = el.value; return; }
    if (field === 'wval') { ui.weightVal = L.parseNum(el.value); return; }
    var i = Number(el.getAttribute('data-i')), j = Number(el.getAttribute('data-j'));
    var cx = sessionItem(i);
    if (!cx || !cx.item.sets[j]) return;
    var n = L.parseNum(el.value);
    if (n !== null && (n < 0 || n > 1000)) n = null;
    cx.item.sets[j][field] = n;
    save();
  }

  function onChange(ev) {
    var el = ev.target;
    var ch = el.getAttribute && el.getAttribute('data-change');
    if (!ch) return;
    if (ch === 'progex') { ui.progEx = el.value; render(true); }
    else if (ch === 'wdate') { if (L.isYmd(el.value)) { ui.weightDate = el.value; } }
    else if (ch === 'exalt') { ui.form.altWith = el.value; render(true); }
    else if (ch === 'importfile') { importData(el.files && el.files[0]); el.value = ''; }
  }

  /* ---------- Start ---------- */

  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  window.addEventListener('hashchange', function () { render(); });
  setInterval(tick, 500);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* offline-Modus nicht verfügbar */ }); });
  }

  window.__gayret = { get state() { return S; }, ui: ui, render: render };
  render();
})();

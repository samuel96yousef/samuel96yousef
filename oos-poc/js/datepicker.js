/*
 * Egen datumväljare som ersätter webbläsarens. Det riktiga <input type="date"> ligger kvar dolt,
 * så att formulär, validering och ändringshändelser fungerar som vanligt. Ytan är ett textfält
 * som visar datumet som "1 okt 2026" och en kalender i appens stil.
 *
 * Man kan skriva datumet: 2026-10-01, 20261001, 1 okt 2026, 1 oktober, 1/10, 1.10.2026.
 * Kalendern har veckonummer, markerar i dag och, för ett par Från och Till, perioden mellan dem.
 * Tangentbord i kalendern: pilar (dag och vecka), PageUp/PageDown (månad, med Shift år),
 * Home/End (veckans början och slut), Enter eller mellanslag väljer, Esc stänger.
 * I textfältet öppnar pil ned kalendern och Enter tolkar det man skrivit.
 */
var OOSDate = (function () {
  var U = OOSUtil;
  var esc = U.esc;
  var MONTHS = U.MONTHS;
  var MONTHS_LONG = U.MONTHS_LONG;
  var DAYS = ['må', 'ti', 'on', 'to', 'fr', 'lö', 'sö'];
  var DAYS_LONG = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'];
  var PARTNER = { from: 'to', to: 'from' };
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
  var PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  var NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  var counter = 0;
  var cur = null;

  /* ---------- Datum som text ---------- */

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function parts(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
  }
  function daysIn(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }
  function valid(y, m, d) { return y >= 1900 && y <= 2200 && m >= 0 && m < 12 && d >= 1 && d <= daysIn(y, m); }
  function shift(s, days) {
    var p = parts(s);
    var t = new Date(Date.UTC(p.y, p.m, p.d + days));
    return iso(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  }
  function shiftMonths(s, n) {
    var p = parts(s);
    var t = new Date(Date.UTC(p.y, p.m + n, 1));
    var y = t.getUTCFullYear();
    var m = t.getUTCMonth();
    return iso(y, m, Math.min(p.d, daysIn(y, m)));
  }
  function weekday(s) { var p = parts(s); return (new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay() + 6) % 7; }
  function isoWeek(s) {
    var p = parts(s);
    var t = new Date(Date.UTC(p.y, p.m, p.d));
    var day = (t.getUTCDay() + 6) % 7;
    t.setUTCDate(t.getUTCDate() - day + 3);
    var first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((t - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  }
  function longText(s) {
    var p = parts(s);
    return DAYS_LONG[weekday(s)] + ' ' + p.d + ' ' + MONTHS_LONG[p.m] + ' ' + p.y;
  }

  /* Tolkar det man skriver. Dag före månad, som i Sverige. Utan år gäller årets. */
  function parse(text, refYear) {
    var t = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!t) return '';
    var y0 = refYear || +U.todayISO().slice(0, 4);
    var m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) return valid(+m[1], +m[2] - 1, +m[3]) ? iso(+m[1], +m[2] - 1, +m[3]) : null;
    if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(t))) return valid(+m[1], +m[2] - 1, +m[3]) ? iso(+m[1], +m[2] - 1, +m[3]) : null;
    if ((m = /^(\d{1,2})\.? ?([a-zåäö]{3,})\.?(?: (\d{4}))?$/.exec(t))) {
      var name = m[2];
      var mi = -1;
      MONTHS_LONG.forEach(function (full, i) { if (mi < 0 && (full.indexOf(name) === 0 || MONTHS[i] === name)) mi = i; });
      var yy = m[3] ? +m[3] : y0;
      return mi >= 0 && valid(yy, mi, +m[1]) ? iso(yy, mi, +m[1]) : null;
    }
    if ((m = /^(\d{1,2})[\/.](\d{1,2})(?:[\/. ](\d{2}|\d{4}))?$/.exec(t))) {
      var y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : y0;
      return valid(y, +m[2] - 1, +m[1]) ? iso(y, +m[2] - 1, +m[1]) : null;
    }
    return null;
  }

  /* ---------- Fältet ---------- */

  function labelText(input) {
    var fld = input.closest('.fld');
    var span = fld && fld.querySelector(':scope > span');
    return span ? span.textContent.replace(/\s*\*$/, '') : 'Datum';
  }

  function partnerOf(native) {
    var key = PARTNER[native.name];
    var form = native.form || native.closest('form');
    return key && form ? form.querySelector('input[name="' + key + '"]') : null;
  }

  function enhanceOne(native) {
    native.setAttribute('data-enhanced', '1');
    native.classList.add('date-native');
    native.tabIndex = -1;
    native.setAttribute('aria-hidden', 'true');
    var id = (native.id || 'date-' + ++counter) + '-text';
    var wrap = document.createElement('span');
    wrap.className = 'date-field';
    wrap.innerHTML = '<input type="text" class="date-text" id="' + id + '" role="combobox" autocomplete="off" spellcheck="false" aria-haspopup="dialog" aria-expanded="false">' +
      '<button type="button" class="date-btn" tabindex="-1" aria-label="Öppna kalendern">' + ICON + '</button>';
    native.parentNode.insertBefore(wrap, native);
    var text = wrap.querySelector('.date-text');
    var btn = wrap.querySelector('.date-btn');
    text.setAttribute('aria-label', labelText(native) + (native.required ? ', obligatoriskt' : '') + '. Skriv till exempel 1 okt 2026');
    if (native.required) text.setAttribute('aria-required', 'true');
    var state = { native: native, text: text, wrap: wrap, btn: btn };
    native._date = state;
    sync(state);

    native.addEventListener('input', function () { sync(state); });
    native.addEventListener('change', function () { sync(state); });
    text.addEventListener('click', function () { if (!cur || cur.native !== native) open(state, false); });
    btn.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (cur && cur.native === native) close(true);
      else { text.focus({ preventScroll: true }); open(state, true); }
    });
    text.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); open(state, true); }
      else if (ev.key === 'Enter') {
        /* Med kalendern öppen väljer Enter datumet. Annars tolkas texten och formuläret skickas som vanligt. */
        var isOpen = cur && cur.native === native;
        if (commit(state) && isOpen) { ev.preventDefault(); close(false); }
        else if (!isOpen && text.getAttribute('aria-invalid') === 'true') ev.preventDefault();
      }
      else if (ev.key === 'Escape' && cur && cur.native === native) { ev.preventDefault(); ev.stopPropagation(); close(false); }
      else if (ev.key === 'Tab' && cur && cur.native === native) close(false);
    });
    text.addEventListener('input', function () {
      text.removeAttribute('aria-invalid');
      var v = parse(text.value);
      if (v && cur && cur.native === native) { cur.month = v.slice(0, 7); cur.focus = v; render(); }
    });
    text.addEventListener('blur', function () {
      setTimeout(function () {
        if (cur && cur.native === native && cur.panel.contains(document.activeElement)) return;
        commit(state);
        if (cur && cur.native === native) close(false);
      }, 120);
    });
  }

  function sync(state) {
    var v = state.native.value;
    if (document.activeElement !== state.text || !state.text.value) state.text.value = v ? U.fmtDate(v) : '';
    state.text.removeAttribute('aria-invalid');
  }

  /* Det man skrivit blir värdet om det går att tolka. Annars markeras fältet som felaktigt. */
  function commit(state) {
    var raw = state.text.value;
    var v = parse(raw);
    if (v === null) { state.text.setAttribute('aria-invalid', 'true'); return false; }
    set(state, v, false);
    return true;
  }

  function set(state, v, refocus) {
    var native = state.native;
    var changed = native.value !== v;
    native.value = v;
    state.text.value = v ? U.fmtDate(v) : '';
    state.text.removeAttribute('aria-invalid');
    if (changed) {
      native.dispatchEvent(new Event('input', { bubbles: true }));
      native.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (refocus && document.contains(state.text)) state.text.focus({ preventScroll: true });
  }

  /* ---------- Kalendern ---------- */

  function open(state, focusGrid) {
    close(false);
    var today = U.todayISO();
    var v = state.native.value || parse(state.text.value) || '';
    var partner = partnerOf(state.native);
    var start = v || (partner && partner.value) || today;
    cur = {
      native: state.native, text: state.text, wrap: state.wrap, state: state,
      partner: partner, month: start.slice(0, 7), focus: start, mode: 'days', today: today,
      id: 'dp-' + ++counter
    };
    var panel = document.createElement('div');
    panel.className = 'dp';
    panel.id = cur.id;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Välj datum: ' + labelText(state.native));
    var host = state.text.closest('[role="dialog"], [role="alertdialog"]') || document.getElementById('main') || document.body;
    host.appendChild(panel);
    cur.panel = panel;
    state.text.setAttribute('aria-expanded', 'true');
    state.text.setAttribute('aria-controls', cur.id);
    panel.addEventListener('mousedown', function (ev) { if (!ev.target.closest('button')) ev.preventDefault(); });
    panel.addEventListener('click', onClick);
    panel.addEventListener('keydown', onKey);
    /* Lämnar fokus kalendern och fältet, med Tab eller på annat sätt, stängs den. */
    panel.addEventListener('focusout', function (ev) {
      var to = ev.relatedTarget;
      if (to && (panel.contains(to) || to === state.text)) return;
      setTimeout(function () {
        var a = document.activeElement;
        if (cur && cur.panel === panel && !panel.contains(a) && a !== state.text) close(false);
      }, 0);
    });
    render();
    position();
    if (focusGrid) focusDay();
  }

  function range() {
    if (!cur.partner || !cur.partner.value) return null;
    var mine = cur.native.value || '';
    var other = cur.partner.value;
    var from = cur.native.name === 'from' ? mine : other;
    var to = cur.native.name === 'from' ? other : mine;
    return from && to && from <= to ? { from: from, to: to } : null;
  }

  function render() {
    if (!cur) return;
    var y = +cur.month.slice(0, 4);
    var m = +cur.month.slice(5, 7) - 1;
    var value = cur.native.value;
    var h = '';
    if (cur.mode === 'months') {
      h += '<div class="dp-head"><button type="button" class="dp-nav" data-dp="prev-year" aria-label="Föregående år">' + PREV + '</button>' +
        '<button type="button" class="dp-title" data-dp="days" aria-label="Tillbaka till dagarna i ' + MONTHS_LONG[m] + ' ' + y + '">' + y + '</button>' +
        '<button type="button" class="dp-nav" data-dp="next-year" aria-label="Nästa år">' + NEXT + '</button></div>';
      h += '<div class="dp-months" role="group" aria-label="Månader ' + y + '">';
      MONTHS_LONG.forEach(function (name, i) {
        var key = y + '-' + pad(i + 1);
        var sel = value && value.slice(0, 7) === key;
        var now = cur.today.slice(0, 7) === key;
        h += '<button type="button" class="dp-month' + (sel ? ' sel' : '') + (now ? ' today' : '') + '" data-month="' + key + '" aria-pressed="' + !!sel + '" aria-label="' + name + ' ' + y + '">' + MONTHS[i] + '</button>';
      });
      h += '</div>';
    } else {
      var titleId = cur.id + '-title';
      h += '<div class="dp-head"><button type="button" class="dp-nav" data-dp="prev" aria-label="Föregående månad">' + PREV + '</button>' +
        '<button type="button" class="dp-title" id="' + titleId + '" data-dp="months" aria-label="' + MONTHS_LONG[m] + ' ' + y + ', välj månad">' + MONTHS_LONG[m] + ' ' + y + '</button>' +
        '<button type="button" class="dp-nav" data-dp="next" aria-label="Nästa månad">' + NEXT + '</button></div>';
      var r = range();
      var otherEnd = cur.partner && cur.partner.value;
      var minDay = cur.native.name === 'to' && otherEnd ? otherEnd : null;
      var first = iso(y, m, 1);
      var day = shift(first, -weekday(first));
      if (cur.focus.slice(0, 7) !== cur.month) cur.focus = value && value.slice(0, 7) === cur.month ? value : first;
      h += '<table class="dp-grid" role="grid" aria-labelledby="' + titleId + '"><thead><tr><th scope="col" class="dp-wk"><span class="sr-only">Vecka</span><span aria-hidden="true">v</span></th>';
      DAYS.forEach(function (d, i) { h += '<th scope="col"><abbr title="' + DAYS_LONG[i] + '">' + d + '</abbr></th>'; });
      h += '</tr></thead><tbody>';
      /* Bara de veckor månaden har, så att kalendern inte blir högre än den behöver. */
      var weeks = Math.ceil((weekday(first) + daysIn(y, m)) / 7);
      for (var w = 0; w < weeks; w++) {
        h += '<tr><th scope="row" class="dp-wk">' + isoWeek(day) + '</th>';
        for (var i = 0; i < 7; i++) {
          var inMonth = day.slice(0, 7) === cur.month;
          var cls = ['dp-day'];
          if (!inMonth) cls.push('out');
          if (day === cur.today) cls.push('today');
          if (day === value) cls.push('sel');
          if (r && day > r.from && day < r.to) cls.push('in-range');
          if (r && day === r.from) cls.push('range-start');
          if (r && day === r.to) cls.push('range-end');
          if (otherEnd && day === otherEnd) cls.push('partner');
          var off = minDay && day < minDay;
          var label = longText(day) + (day === cur.today ? ', i dag' : '') + (otherEnd && day === otherEnd ? (cur.native.name === 'to' ? ', startdatum' : ', slutdatum') : '');
          h += '<td role="gridcell" class="' + (r && day >= r.from && day <= r.to ? 'band' + (day === r.from ? ' band-start' : '') + (day === r.to ? ' band-end' : '') : '') + '"' + (day === value ? ' aria-selected="true"' : '') + '>' +
            '<button type="button" class="' + cls.join(' ') + '" data-iso="' + day + '" tabindex="' + (day === cur.focus ? 0 : -1) + '" aria-label="' + esc(label) + '"' +
            (off ? ' aria-disabled="true"' : '') + (day === value ? ' aria-pressed="true"' : '') + '>' + +day.slice(8) + '</button></td>';
          day = shift(day, 1);
        }
        h += '</tr>';
      }
      h += '</tbody></table>';
    }
    /* Snabbval efter vad fältet gäller: start eller slut på en period. */
    var chips = [];
    var t = cur.today;
    if (cur.native.name === 'to') {
      var base = (cur.partner && cur.partner.value) || value || t;
      var bp = parts(base);
      chips.push({ label: 'Månadens slut', iso: iso(bp.y, bp.m, daysIn(bp.y, bp.m)) });
      if (cur.partner && cur.partner.value) chips.push({ label: 'Ett år', iso: shift(shiftMonths(cur.partner.value, 12), -1) });
    } else {
      chips.push({ label: 'I dag', iso: t });
      var tp = parts(t);
      chips.push({ label: 'Nästa månad', iso: shiftMonths(iso(tp.y, tp.m, 1), 1) });
    }
    h += '<div class="dp-foot">' + chips.map(function (c) {
      return '<button type="button" class="dp-chip" data-iso="' + c.iso + '" aria-label="' + esc(c.label + ': ' + longText(c.iso)) + '">' + esc(c.label) + '</button>';
    }).join('') + (cur.native.required ? '' : '<button type="button" class="dp-chip quiet" data-iso="">Rensa</button>') + '</div>';
    var hadFocus = cur.panel.contains(document.activeElement) && document.activeElement.classList.contains('dp-day');
    cur.panel.innerHTML = h;
    /* Månadsvyn och dagarna är olika höga, så platsen räknas om varje gång. */
    position();
    if (hadFocus) focusDay();
  }

  function focusDay() {
    if (!cur) return;
    var b = cur.panel.querySelector('.dp-day[tabindex="0"]') || cur.panel.querySelector('.dp-month.sel, .dp-month');
    if (b) b.focus({ preventScroll: true });
  }

  function choose(v) {
    var state = cur.state;
    if (v && cur.native.name === 'to' && cur.partner && cur.partner.value && v < cur.partner.value) return;
    close(false);
    set(state, v, true);
  }

  function onClick(ev) {
    if (!cur) return;
    var b = ev.target.closest('button');
    if (!b) return;
    ev.stopPropagation();
    if (b.hasAttribute('data-iso')) {
      if (b.getAttribute('aria-disabled') === 'true') return;
      choose(b.getAttribute('data-iso'));
      return;
    }
    if (b.hasAttribute('data-month')) {
      cur.month = b.getAttribute('data-month');
      cur.mode = 'days';
      render();
      focusDay();
      return;
    }
    var act = b.getAttribute('data-dp');
    if (act === 'prev' || act === 'next') { cur.month = shiftMonths(cur.month + '-01', act === 'prev' ? -1 : 1).slice(0, 7); render(); cur.panel.querySelector('[data-dp="' + act + '"]').focus(); }
    else if (act === 'prev-year' || act === 'next-year') { cur.month = shiftMonths(cur.month + '-01', act === 'prev-year' ? -12 : 12).slice(0, 7); render(); cur.panel.querySelector('[data-dp="' + act + '"]').focus(); }
    else if (act === 'months') { cur.mode = 'months'; render(); focusDay(); }
    else if (act === 'days') { cur.mode = 'days'; render(); focusDay(); }
    position();
  }

  function onKey(ev) {
    if (!cur) return;
    var k = ev.key;
    if (k === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(true); return; }
    var day = ev.target.closest('.dp-day');
    if (!day) return;
    var f = cur.focus;
    var next = null;
    if (k === 'ArrowLeft') next = shift(f, -1);
    else if (k === 'ArrowRight') next = shift(f, 1);
    else if (k === 'ArrowUp') next = shift(f, -7);
    else if (k === 'ArrowDown') next = shift(f, 7);
    else if (k === 'Home') next = shift(f, -weekday(f));
    else if (k === 'End') next = shift(f, 6 - weekday(f));
    else if (k === 'PageUp') next = shiftMonths(f, ev.shiftKey ? -12 : -1);
    else if (k === 'PageDown') next = shiftMonths(f, ev.shiftKey ? 12 : 1);
    else if (k === 'Enter' || k === ' ') { ev.preventDefault(); if (day.getAttribute('aria-disabled') !== 'true') choose(day.getAttribute('data-iso')); return; }
    if (!next) return;
    ev.preventDefault();
    cur.focus = next;
    cur.month = next.slice(0, 7);
    render();
    focusDay();
  }

  function position() {
    if (!cur || !document.contains(cur.wrap)) { close(false); return; }
    var r = cur.wrap.getBoundingClientRect();
    var p = cur.panel;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    /* Lika bred som fältet, men aldrig så smal att dagarna trängs eller så bred att den dominerar. */
    var width = Math.min(Math.max(r.width, 248), 268, vw - 16);
    p.style.width = width + 'px';
    p.style.left = Math.max(8, Math.min(r.left, vw - width - 8)) + 'px';
    var h = p.offsetHeight;
    var below = vh - r.bottom - 12;
    var up = below < h && r.top - 12 > below;
    p.style.top = Math.max(8, up ? r.top - h - 6 : r.bottom + 6) + 'px';
  }

  function close(focusBack) {
    if (!cur) return;
    var st = cur;
    cur = null;
    if (st.panel && st.panel.parentNode) st.panel.parentNode.removeChild(st.panel);
    st.text.setAttribute('aria-expanded', 'false');
    st.text.removeAttribute('aria-controls');
    if (focusBack && document.contains(st.text)) st.text.focus({ preventScroll: true });
  }

  function enhance(scope) {
    (scope || document).querySelectorAll('input[type="date"]:not([data-enhanced])').forEach(enhanceOne);
  }

  document.addEventListener('mousedown', function (ev) {
    if (!cur) return;
    if (cur.panel.contains(ev.target) || cur.wrap.contains(ev.target)) return;
    close(false);
  }, true);
  window.addEventListener('scroll', function (ev) { if (cur && !cur.panel.contains(ev.target)) position(); }, true);
  window.addEventListener('resize', function () { if (cur) position(); });

  return { enhance: enhance, parse: parse, close: function () { close(false); }, isOpen: function () { return !!cur; }, _isoWeek: isoWeek };
})();

/*
 * Egna rullistor som ersätter webbläsarens. Den riktiga <select> ligger kvar dold, så att
 * formulär och ändringshändelser fungerar som vanligt. Knappen och listan är bara ytan.
 *
 * Samma komponent ger förslag i textfält som har en lista med vanliga värden (data-suggest).
 * Tangentbord: pil upp och ned, Home, End, Enter, Esc och Tab. Långa listor får ett sökfält.
 */
var OOSSelect = (function () {
  var esc = OOSUtil.esc;
  var SEARCH_FROM = 9;
  var CHEVRON = '<svg class="sel-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var CHECK = '<svg class="sel-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
  var SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>';
  var counter = 0;
  var cur = null;
  var quiet = null;

  function labelText(el) {
    var fld = el.closest('.fld');
    var span = fld && fld.querySelector(':scope > span');
    return span ? span.textContent.replace(/\s*\*$/, '') : '';
  }

  /* ---------- Rullistor ---------- */

  function optionsOf(select) {
    var items = [];
    Array.prototype.forEach.call(select.children, function (child) {
      if (child.tagName === 'OPTGROUP') {
        Array.prototype.forEach.call(child.children, function (o) {
          items.push({ value: o.value, label: o.textContent, sub: o.getAttribute('data-sub') || '', group: child.label });
        });
      } else if (child.tagName === 'OPTION') {
        /* I obligatoriska fält är det tomma alternativet bara en platshållare, inte ett val. */
        if (child.value === '' && select.required) return;
        items.push({ value: child.value, label: child.textContent, sub: child.getAttribute('data-sub') || '', group: '' });
      }
    });
    return items;
  }

  function sync(select, btn) {
    var opt = select.options[select.selectedIndex];
    var text = opt ? opt.textContent : '';
    btn.querySelector('.sel-value').textContent = text || '–';
    btn.classList.toggle('placeholder', !opt || opt.value === '');
    var label = labelText(btn);
    btn.setAttribute('aria-label', (label ? label + ': ' : '') + text);
  }

  function enhanceSelect(select) {
    select.setAttribute('data-enhanced', '1');
    select.hidden = true;
    select.tabIndex = -1;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sel-btn';
    btn.id = (select.id || 'sel-' + ++counter) + '-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="sel-value"></span>' + CHEVRON;
    select.parentNode.insertBefore(btn, select);
    sync(select, btn);
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (cur && cur.btn === btn) close(true);
      else open({ mode: 'select', select: select, btn: btn, items: optionsOf(select) });
    });
    btn.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        open({ mode: 'select', select: select, btn: btn, items: optionsOf(select) });
      }
    });
  }

  /* ---------- Förslag i textfält ---------- */

  function enhanceSuggest(input) {
    input.setAttribute('data-enhanced', '1');
    var values = JSON.parse(input.getAttribute('data-suggest') || '[]');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('autocomplete', 'off');
    var wrap = document.createElement('div');
    wrap.className = 'sel-input';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sel-input-btn';
    btn.tabIndex = -1;
    btn.setAttribute('aria-label', 'Visa förslag');
    btn.innerHTML = CHEVRON;
    wrap.appendChild(btn);
    function show(filter) {
      open({ mode: 'suggest', input: input, btn: input, filter: !!filter, items: values.map(function (v) { return { value: v, label: v, sub: '', group: '' }; }) });
    }
    btn.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (cur && cur.input === input) close(false);
      else { input.focus(); show(); }
    });
    input.addEventListener('click', function () { if (!cur || cur.input !== input) show(); });
    input.addEventListener('input', function () {
      if (quiet === input) return;
      if (!cur || cur.input !== input) show(true);
      else { cur.filter = true; render(); }
    });
    input.addEventListener('keydown', function (ev) {
      if (!cur || cur.input !== input) {
        if (ev.key === 'ArrowDown') { ev.preventDefault(); show(); }
        return;
      }
      onKey(ev);
    });
    input.addEventListener('blur', function () {
      setTimeout(function () { if (cur && cur.input === input && document.activeElement !== input) close(false); }, 120);
    });
  }

  /* ---------- Gemensam lista ---------- */

  function open(state) {
    close(false);
    cur = state;
    var searchable = state.mode === 'select' && state.items.length >= SEARCH_FROM;
    var listId = 'sel-list-' + ++counter;
    state.listId = listId;
    var panel = document.createElement('div');
    panel.className = 'sel-panel';
    panel.innerHTML =
      (searchable ? '<div class="sel-search">' + SEARCH + '<input type="text" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls="' + listId + '" placeholder="Sök …" aria-label="Sök bland alternativen" autocomplete="off"></div>' : '') +
      '<div class="sel-list" role="listbox" id="' + listId + '" tabindex="-1"' + (state.mode === 'select' ? ' aria-labelledby="' + state.btn.id + '"' : '') + '></div>';
    /* Listan läggs i dialogen eller huvudytan, så att skärmläsare når den även när en dialog är öppen. */
    var host = state.btn.closest('[role="dialog"], [role="alertdialog"]') || document.getElementById('main') || document.body;
    host.appendChild(panel);
    state.panel = panel;
    state.list = panel.querySelector('.sel-list');
    state.search = panel.querySelector('.sel-search input');
    state.btn.setAttribute('aria-expanded', 'true');
    if (state.mode === 'suggest') state.input.setAttribute('aria-controls', listId);

    panel.addEventListener('mousedown', function (ev) {
      if (ev.target !== state.search) ev.preventDefault();
    });
    state.list.addEventListener('mousemove', function (ev) {
      var o = ev.target.closest('.sel-opt');
      if (o) setActive(+o.getAttribute('data-i'), false);
    });
    state.list.addEventListener('click', function (ev) {
      var o = ev.target.closest('.sel-opt');
      if (o) choose(+o.getAttribute('data-i'));
    });
    if (state.search) {
      state.search.addEventListener('input', render);
      state.search.addEventListener('keydown', onKey);
    } else if (state.mode === 'select') {
      state.list.addEventListener('keydown', onKey);
    }

    render();
    position();
    if (state.mode === 'select') (state.search || state.list).focus({ preventScroll: true });
  }

  function query() {
    if (!cur) return '';
    if (cur.search) return cur.search.value.trim().toLowerCase();
    if (cur.mode === 'suggest') return cur.filter ? cur.input.value.trim().toLowerCase() : '';
    return '';
  }

  function render() {
    if (!cur) return;
    var q = query();
    var selected = cur.mode === 'select' ? cur.select.value : cur.input.value;
    cur.visible = [];
    var h = '';
    var group = null;
    cur.items.forEach(function (it, i) {
      var hay = (it.label + ' ' + it.sub + ' ' + it.group).toLowerCase();
      if (q && hay.indexOf(q) < 0) return;
      if (cur.mode === 'suggest' && q && it.label.toLowerCase() === q) return;
      if (it.group !== group) {
        group = it.group;
        if (group) h += '<div class="sel-group" role="presentation">' + esc(group) + '</div>';
      }
      var isSel = String(it.value) === String(selected) && cur.mode === 'select';
      cur.visible.push(i);
      h += '<div class="sel-opt" role="option" id="' + cur.listId + '-' + i + '" data-i="' + i + '" aria-selected="' + isSel + '">' +
        '<span class="sel-label">' + esc(it.label) + '</span>' + (it.sub ? '<span class="sel-sub">' + esc(it.sub) + '</span>' : '') + (isSel ? CHECK : '') + '</div>';
    });
    if (!cur.visible.length) {
      if (cur.mode === 'suggest') { hide(); return; }
      h = '<div class="sel-empty">Inga träffar</div>';
    }
    cur.panel.hidden = false;
    cur.list.innerHTML = h;
    var start = cur.items.map(function (it) { return String(it.value); }).indexOf(String(selected));
    setActive(cur.visible.indexOf(start) >= 0 ? start : cur.mode === 'select' ? cur.visible[0] : -1, true);
    position();
  }

  function hide() {
    if (cur) cur.panel.hidden = true;
  }

  function setActive(i, scroll) {
    if (!cur) return;
    cur.active = i;
    cur.list.querySelectorAll('.sel-opt.active').forEach(function (el) { el.classList.remove('active'); });
    var el = i >= 0 ? cur.list.querySelector('[data-i="' + i + '"]') : null;
    var owner = cur.search || (cur.mode === 'suggest' ? cur.input : cur.list);
    if (el) {
      el.classList.add('active');
      owner.setAttribute('aria-activedescendant', el.id);
      if (scroll) el.scrollIntoView({ block: 'nearest' });
    } else {
      owner.removeAttribute('aria-activedescendant');
    }
  }

  function move(delta) {
    var v = cur.visible;
    if (!v.length) return;
    var pos = v.indexOf(cur.active);
    var next = pos < 0 ? (delta > 0 ? 0 : v.length - 1) : Math.max(0, Math.min(v.length - 1, pos + delta));
    setActive(v[next], true);
  }

  function onKey(ev) {
    if (!cur) return;
    var k = ev.key;
    if (k === 'ArrowDown' || k === 'ArrowUp') { ev.preventDefault(); if (cur.panel.hidden) render(); move(k === 'ArrowDown' ? 1 : -1); }
    else if (k === 'PageDown' || k === 'PageUp') { ev.preventDefault(); move(k === 'PageDown' ? 8 : -8); }
    else if ((k === 'Home' || k === 'End') && !cur.search && cur.mode === 'select') { ev.preventDefault(); setActive(cur.visible[k === 'Home' ? 0 : cur.visible.length - 1], true); }
    else if (k === 'Enter') {
      if (cur.active >= 0 && !cur.panel.hidden) { ev.preventDefault(); ev.stopPropagation(); choose(cur.active); }
    } else if (k === 'Escape') {
      if (!cur.panel.hidden || cur.mode === 'select') { ev.preventDefault(); ev.stopPropagation(); close(true); }
    } else if (k === 'Tab') {
      if (cur.mode === 'select') { ev.preventDefault(); close(true); }
      else close(false);
    } else if (!cur.search && cur.mode === 'select' && k.length === 1 && /\S/.test(k)) {
      /* Hoppa till första alternativet som börjar på tecknet. */
      var ch = k.toLowerCase();
      var v = cur.visible;
      var from = v.indexOf(cur.active);
      for (var n = 1; n <= v.length; n++) {
        var idx = v[(from + n) % v.length];
        if (cur.items[idx].label.toLowerCase().indexOf(ch) === 0) { setActive(idx, true); break; }
      }
    }
  }

  function choose(i) {
    if (!cur) return;
    var it = cur.items[i];
    if (!it) return;
    if (cur.mode === 'select') {
      var select = cur.select;
      var btnId = cur.btn.id;
      var changed = select.value !== String(it.value);
      select.value = it.value;
      sync(select, cur.btn);
      close(false);
      if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
      /* Vyn kan ha ritats om av ändringen, så hämta knappen på nytt. */
      var b = document.getElementById(btnId);
      if (b) b.focus({ preventScroll: true });
    } else {
      var input = cur.input;
      input.value = it.value;
      close(false);
      quiet = input;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      quiet = null;
      input.focus({ preventScroll: true });
    }
  }

  function position() {
    if (!cur || !document.contains(cur.btn)) { close(false); return; }
    var anchor = cur.mode === 'suggest' ? cur.input.parentNode : cur.btn;
    var r = anchor.getBoundingClientRect();
    var p = cur.panel;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var width = Math.min(Math.max(r.width, 240), vw - 16);
    p.style.width = width + 'px';
    p.style.left = Math.max(8, Math.min(r.left, vw - width - 8)) + 'px';
    var below = vh - r.bottom - 12;
    var above = r.top - 12;
    var up = below < 220 && above > below;
    var maxH = Math.max(140, Math.min(360, up ? above : below));
    cur.list.style.maxHeight = maxH - (cur.search ? 46 : 0) + 'px';
    var h = p.offsetHeight;
    p.style.top = (up ? r.top - h - 6 : r.bottom + 6) + 'px';
  }

  function close(focusBack) {
    if (!cur) return;
    var st = cur;
    cur = null;
    if (st.panel && st.panel.parentNode) st.panel.parentNode.removeChild(st.panel);
    st.btn.setAttribute('aria-expanded', 'false');
    if (st.mode === 'suggest') st.input.removeAttribute('aria-activedescendant');
    if (focusBack && document.contains(st.btn)) st.btn.focus({ preventScroll: true });
  }

  function enhance(scope) {
    (scope || document).querySelectorAll('select:not([data-enhanced])').forEach(enhanceSelect);
    (scope || document).querySelectorAll('input[data-suggest]:not([data-enhanced])').forEach(enhanceSuggest);
  }

  /* Stäng vid klick utanför, och följ med när sidan scrollar eller ändrar storlek. */
  document.addEventListener('mousedown', function (ev) {
    if (!cur) return;
    if (cur.panel.contains(ev.target) || ev.target === cur.btn || cur.btn.contains(ev.target)) return;
    if (cur.mode === 'suggest' && cur.input.parentNode.contains(ev.target)) return;
    close(false);
  }, true);
  window.addEventListener('scroll', function (ev) {
    if (cur && !cur.panel.contains(ev.target)) position();
  }, true);
  window.addEventListener('resize', function () { if (cur) position(); });

  /* Alternativ som HTML, med grupper och undertext. Används av formulär och filter. */
  function optionsHtml(options, value, placeholder) {
    var h = placeholder !== undefined ? '<option value="">' + esc(placeholder) + '</option>' : '';
    var group = null;
    (options || []).forEach(function (o) {
      var g = o.group || '';
      if (g !== group) {
        if (group) h += '</optgroup>';
        if (g) h += '<optgroup label="' + esc(g) + '">';
        group = g;
      }
      h += '<option value="' + esc(o.value) + '"' + (o.sub ? ' data-sub="' + esc(o.sub) + '"' : '') + (String(o.value) === String(value) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
    });
    if (group) h += '</optgroup>';
    return h;
  }

  return { enhance: enhance, close: function () { close(false); }, isOpen: function () { return !!cur; }, optionsHtml: optionsHtml };
})();

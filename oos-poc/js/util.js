/* Små hjälpfunktioner som delas av alla moduler. Fungerar både i webbläsare och Node. */
var OOSUtil = (function () {
  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9);
  }

  function round(n, decimals) {
    var f = Math.pow(10, decimals || 0);
    return Math.round(n * f) / f;
  }

  var nf = typeof Intl !== 'undefined' ? new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }) : null;

  function fmtNum(n) {
    if (n === null || n === undefined || isNaN(n)) return '–';
    return nf ? nf.format(Math.round(n)) : String(Math.round(n));
  }

  function fmtH(n) {
    return fmtNum(n) + '\u00a0h';
  }

  function fmtPct(n) {
    if (n === null || n === undefined || isNaN(n)) return '–';
    return Math.round(n) + '\u00a0%';
  }

  function fmtSigned(n, suffix) {
    if (n === null || n === undefined || isNaN(n)) return '–';
    var r = Math.round(n);
    return (r > 0 ? '+' : r < 0 ? '−' : '±') + fmtNum(Math.abs(r)) + (suffix || '').replace(/^ /, '\u00a0');
  }

  function initials(name) {
    if (!name) return '?';
    var parts = String(name).replace(/[&]/g, ' ').split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* Deterministisk slumpgenerator så att demodatan blir likadan varje gång. */
  function prng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Datum hanteras som 'YYYY-MM-DD' och räknas i UTC för att slippa tidszonsfel. */
  function parseDate(s) {
    var p = String(s).split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  }

  function toISO(d) {
    return d.toISOString().slice(0, 10);
  }

  function addDays(s, n) {
    var d = parseDate(s);
    d.setUTCDate(d.getUTCDate() + n);
    return toISO(d);
  }

  function todayISO() {
    var d = new Date();
    return toISO(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
  }

  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var MONTHS_LONG = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

  function fmtDate(s) {
    if (!s) return '–';
    var d = parseDate(s);
    return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }

  function sum(arr, fn) {
    var t = 0;
    for (var i = 0; i < arr.length; i++) t += fn ? fn(arr[i]) : arr[i];
    return t;
  }

  function groupBy(arr, fn) {
    var m = new Map();
    arr.forEach(function (x) {
      var k = fn(x);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    });
    return m;
  }

  function byName(a, b) {
    return String(a.name).localeCompare(String(b.name), 'sv');
  }

  /* "1 medlem", "3 medlemmar". Talet formateras med mellanrum för tusental. */
  function plural(n, one, many) {
    return fmtNum(n) + '\u00a0' + (Math.round(n) === 1 ? one : many);
  }

  return {
    esc: esc,
    plural: plural,
    uid: uid,
    round: round,
    fmtNum: fmtNum,
    fmtH: fmtH,
    fmtPct: fmtPct,
    fmtSigned: fmtSigned,
    initials: initials,
    hash: hash,
    prng: prng,
    parseDate: parseDate,
    toISO: toISO,
    addDays: addDays,
    todayISO: todayISO,
    fmtDate: fmtDate,
    MONTHS: MONTHS,
    MONTHS_LONG: MONTHS_LONG,
    sum: sum,
    groupBy: groupBy,
    byName: byName
  };
})();

if (typeof module !== 'undefined') module.exports = OOSUtil;

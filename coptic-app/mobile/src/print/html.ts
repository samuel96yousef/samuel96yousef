/**
 * Turns reader rows into a printable HTML document in the Katameros style:
 * a running head over a rule, the title in a double-ruled cartouche, crimson
 * rubrics, and Swedish and Arabic side by side, line for line, or one alone.
 * Pure, so it can be tested; the fonts come in as ready @font-face rules.
 */
import type { Row } from '../components/Reader';
import { toArDigits } from '../lib/coptic';
import type { Role, Unit } from '../lib/types';

export type PrintLangs = 'both' | 'sv' | 'ar';
export type Paper = 'A4' | 'A5';
export type TextSize = 'S' | 'M' | 'L';

export interface PrintOptions {
  langs: PrintLangs;
  paper: Paper;
  size: TextSize;
  /** Crimson rubrics and rules; off prints in black and grey. */
  color: boolean;
}

export const DEFAULT_PRINT: PrintOptions = { langs: 'both', paper: 'A4', size: 'M', color: true };

/** One text in the document; each starts on a new page. */
export interface PrintPart {
  rows: Row[];
}

/** Page sizes in points (72 per inch), as the native print APIs want them. */
export const PAGE_POINTS: Record<Paper, { width: number; height: number }> = {
  A4: { width: 595, height: 842 },
  A5: { width: 420, height: 595 },
};

/** Swedish body size in points; Arabic is set larger, as in the app. */
const BASE: Record<Paper, Record<TextSize, number>> = {
  A4: { S: 9.5, M: 11, L: 13 },
  A5: { S: 8.5, M: 9.5, L: 11 },
};

/**
 * Where the frame sits on the page and how far the text keeps from it, in mm.
 * The page margin leaves room for the page number under the frame.
 */
const FRAME: Record<Paper, { margin: string; inset: number; pad: number; gap: number }> = {
  A4: { margin: '7mm 7mm 11mm', inset: 3, pad: 9, gap: 8 },
  A5: { margin: '5mm 5mm 9mm', inset: 2.5, pad: 6, gap: 6 },
};

/**
 * The app's Coptic cross: flared arms with three buds each, and a ring at the
 * centre. The arms are turned here rather than with SVG transforms, which
 * Chromium drops from a frame repeated on every page of a PDF.
 */
const CROSS = (() => {
  const turns: ((x: number, y: number) => [number, number])[] = [
    (x, y) => [x, y], (x, y) => [24 - y, x], (x, y) => [24 - x, 24 - y], (x, y) => [y, 24 - x],
  ];
  const n = (v: number) => Math.round(v * 100) / 100;
  const arms = turns.map((t) => {
    const P = (x: number, y: number) => t(x, y).map(n).join(' ');
    const dot = (x: number, y: number, r: number) => { const [cx, cy] = t(x, y).map(n); return `<circle cx="${cx}" cy="${cy}" r="${r}"/>`; };
    return `<path d="M${P(10.4, 12)}L${P(10.4, 5.6)}Q${P(10.4, 4.7)} ${P(9.3, 4.3)}L${P(14.7, 4.3)}Q${P(13.6, 4.7)} ${P(13.6, 5.6)}L${P(13.6, 12)}Z"/>${dot(12, 2.2, 1.55)}${dot(9.6, 3.4, 1.2)}${dot(14.4, 3.4, 1.2)}`;
  }).join('');
  return `<svg viewBox="0 0 24 24" fill="currentColor">${arms}<path fill-rule="evenodd" d="M12 8.6a3.4 3.4 0 1 1 0 6.8a3.4 3.4 0 1 1 0-6.8zM12 10.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z"/></svg>`;
})();

/** The Katameros frame, as in the app: a double rule with a cross on each corner. Fixed, so it is drawn on every page. */
const frame = () => `<div class="frame">${['tl', 'tr', 'bl', 'br'].map((c) => `<i class="${c}">${CROSS}</i>`).join('')}</div>`;

const ROLE_SV: Record<Role, string> = { priest: 'Prästen', deacon: 'Diakonen', people: 'Folket' };
const ROLE_AR: Record<Role, string> = { priest: 'الكاهن', deacon: 'الشماس', people: 'الشعب' };

/** Headings and references: centred, the languages stacked rather than side by side. */
const ALWAYS_BOTH = new Set<Unit['t']>(['ref', 'h', 'H']);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const arRef = (s: string) => toArDigits(s.replace(/\s*:\s*/g, ' : ').replace(/\s*–\s*/g, ' – '));

export function printHtml(parts: PrintPart[], o: PrintOptions, title: string, fontCss = ''): string {
  // Each part is a table whose empty head and foot repeat on every printed
  // page, keeping the text clear of the frame at the top and bottom of each page.
  const body = parts.map((p) =>
    `<table class="part"><thead><tr><td><div class="gap"></div></td></tr></thead><tfoot><tr><td><div class="gap"></div></td></tr></tfoot><tbody><tr><td>${p.rows.map((r) => rowHtml(r, o.langs)).join('')}</td></tr></tbody></table>`,
  ).join('');
  return `<!doctype html><html lang="${o.langs === 'ar' ? 'ar' : 'sv'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${fontCss}${css(o)}</style></head><body class="langs-${o.langs}">${frame()}${body}</body></html>`;
}

/** The text of one language, or the other when a unit only has that one. */
function pick(u: { ar?: string; sv?: string }, l: 'ar' | 'sv') {
  return (l === 'ar' ? u.ar : u.sv) || '';
}

function unitText(u: Unit, l: 'ar' | 'sv', showC?: boolean) {
  let s = pick(u, l);
  if (!s) return '';
  if (u.t === 'ref' && l === 'ar') s = arRef(s);
  const num = u.t === 'v' && u.n != null ? (showC ? `${u.c}:${u.n}` : String(u.n)) : '';
  return `${num ? `<span class="n">${l === 'ar' ? toArDigits(num) : num}</span> ` : ''}${esc(s)}`;
}

/** Both languages stacked and centred, the reading language first. */
function stack(ar: string, sv: string, langs: PrintLangs) {
  const a = ar ? `<div class="ar">${ar}</div>` : '';
  const s = sv ? `<div class="sv">${sv}</div>` : '';
  if (langs === 'ar') return a || s;
  if (langs === 'sv') return s || a;
  return a + s;
}

function rowHtml(row: Row, langs: PrintLangs): string {
  switch (row.k) {
    case 'top':
    case 'bottom':
      return '';
    case 'run': {
      const text = langs === 'ar' ? esc(row.ar) : langs === 'sv' ? esc(row.sv) : `${esc(row.sv)} <span class="ar">· ${esc(row.ar)}</span>`;
      return `<header class="run">${text}</header>`;
    }
    case 'cart':
      return `<div class="cart"><div class="cart-in">${stack(esc(row.ar), esc(row.sv), langs)}</div></div>`;
    case 'feast':
      return `<div class="feast">${row.items.map((f) => `<div class="fi">${stack(esc(f.ar), esc(f.sv), langs)}</div>`).join('')}</div>`;
    case 'title': {
      const cap = langs === 'ar' ? row.capAr : langs === 'sv' ? row.capSv : row.capSv || row.capAr;
      return `<div class="title">${stack(esc(row.ar), esc(row.sv), langs)}${cap ? `<div class="cap">${esc(cap)}</div>` : ''}</div>`;
    }
    case 'role': {
      const label = langs === 'ar' ? ROLE_AR[row.r] : langs === 'sv' ? ROLE_SV[row.r] : `${ROLE_SV[row.r]} · <span class="ar">${ROLE_AR[row.r]}</span>`;
      return `<div class="role role-${row.r}">${label}</div>`;
    }
    case 'sep':
      return '<div class="sep"><span>✠</span></div>';
    case 'u': {
      const u = row.u;
      if (u.t === 'role') return '';
      const cls = `u t-${u.t}${row.role ? ` r-${row.role}` : ''}`;
      if (ALWAYS_BOTH.has(u.t)) return `<div class="${cls} c">${stack(unitText(u, 'ar'), unitText(u, 'sv'), langs)}</div>`;
      if (langs === 'both') {
        // Line for line: Swedish on the left, Arabic on the right.
        return `<div class="${cls} pair"><div class="sv">${unitText(u, 'sv', row.showC)}</div><div class="ar">${unitText(u, 'ar', row.showC)}</div></div>`;
      }
      const l = pick(u, langs) ? langs : langs === 'ar' ? 'sv' : 'ar';
      return `<div class="${cls}"><div class="${l}">${unitText(u, l, row.showC)}</div></div>`;
    }
    default:
      return '';
  }
}

function css(o: PrintOptions): string {
  const b = BASE[o.paper][o.size];
  const rule = o.color ? '#9E1B32' : '#111';
  const gold = o.color ? '#A8751A' : '#555';
  const f = FRAME[o.paper];
  return `
@page { size: ${o.paper}; margin: ${f.margin}; @bottom-center { content: counter(page); font: ${b * 0.8}pt Literata, Georgia, serif; color: #777; } }
:root { --ink: #1B1517; --ink2: #3A3134; --rule: ${rule}; --rule2: ${o.color ? '#E09AA5' : '#999'}; --gold: ${gold}; --formula: ${o.color ? '#7E1D30' : '#1B1517'}; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; -webkit-text-size-adjust: 100%; }
body { margin: 0; color: var(--ink); font: ${b}pt/1.5 Literata, Georgia, 'Noto Sans Coptic', serif; }
body { padding: 0 ${f.inset + f.pad}mm; }
.frame { position: fixed; inset: ${f.inset}mm; border: 1.2pt solid var(--rule); color: var(--rule); pointer-events: none; }
.frame::before { content: ''; position: absolute; inset: 3pt; border: .6pt solid var(--rule2); }
.frame i { position: absolute; font-style: normal; width: 14pt; height: 14pt; background: #fff; display: block; }
.frame svg { display: block; width: 100%; height: 100%; }
.frame .tl { top: -7.6pt; left: -7.6pt; } .frame .tr { top: -7.6pt; right: -7.6pt; }
.frame .bl { bottom: -7.6pt; left: -7.6pt; } .frame .br { bottom: -7.6pt; right: -7.6pt; }
.part { width: 100%; border-collapse: collapse; font: inherit; color: inherit; }
.part > * > tr > td { padding: 0; }
.gap { height: ${f.inset + f.gap}mm; }
.ar { direction: rtl; text-align: right; font-family: Amiri, 'Noto Naskh Arabic', 'Noto Sans Coptic', serif; font-size: 1.24em; line-height: 1.75; }
.sv { direction: ltr; text-align: left; }
.part + .part { break-before: page; }
.run { text-align: center; color: var(--ink2); font-size: .85em; padding-bottom: 3pt; border-bottom: 1.6pt solid var(--ink); margin-bottom: 10pt; }
.run .ar { font-size: 1.1em; line-height: 1.3; display: inline; }
.cart { border: 1.4pt solid var(--rule); padding: 2.5pt; margin: 4pt auto 12pt; width: 78%; break-inside: avoid; }
.cart-in { border: .6pt solid var(--rule); padding: 5pt 10pt; text-align: center; }
.cart-in > div, .fi > div, .title > div, .c > div { text-align: center; }
.cart-in > :first-child { font-weight: 600; font-size: 1.15em; }
.cart-in .ar:first-child { font-weight: 700; font-size: 1.5em; }
.cart-in > :nth-child(2) { color: var(--ink2); }
.feast { margin: 0 0 10pt; color: var(--ink); }
.fi > .sv:nth-child(2) { font-style: italic; }
.fi > :nth-child(2) { color: var(--ink2); }
.title { margin: 16pt 0 8pt; break-after: avoid; break-inside: avoid; }
.title > .sv { font-weight: 600; font-size: 1.3em; }
.title > .ar { font-weight: 700; font-size: 1.55em; line-height: 1.5; }
.langs-both .title > .sv { font-size: .78em; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: var(--rule); }
.cap { text-align: center; color: var(--ink2); font-size: .9em; margin-top: 2pt; }
.sep { display: flex; align-items: center; gap: 8pt; margin: 14pt 0; color: var(--rule); }
.sep::before, .sep::after { content: ''; flex: 1; border-top: .6pt solid var(--ink); }
.role { margin: 9pt 0 2pt; font-size: .72em; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--rule); break-after: avoid; }
.role .ar { display: inline; font-size: 1.3em; letter-spacing: 0; }
.role-deacon { color: var(--gold); }
.role-people { color: var(--ink); }
.langs-ar .role { direction: rtl; text-align: right; }
.u { margin: 0 0 4pt; white-space: pre-line; }
.pair { display: grid; grid-template-columns: 1fr 1fr; column-gap: 7mm; break-inside: avoid; }
.n { color: var(--rule); font-size: .62em; font-weight: 600; vertical-align: .25em; }
.c { margin: 10pt 0 4pt; break-after: avoid; break-inside: avoid; }
.t-H { margin-top: 16pt; }
.t-H .sv { font-weight: 600; letter-spacing: .06em; }
.t-H .ar { font-weight: 700; font-size: 1.45em; }
.t-h .sv { font-weight: 600; }
.t-h .ar { font-weight: 700; }
.t-ref { padding-bottom: 4pt; border-bottom: 1.2pt dotted var(--ink); width: 62%; margin-left: auto; margin-right: auto; }
.t-ref .sv { font-weight: 600; font-size: .92em; }
.t-ref .ar { font-weight: 700; }
/* Slanted only in Swedish: Arabic has no italic, and a slanted Amiri is hard to read. */
/* Formulas ("Välsignad är han som kommer …") in a deep wine red, as in a printed Katameros:
   set apart from the text, and darker and larger than the crimson rubrics. */
.t-f > div { color: var(--formula); }
.t-secret > div { color: var(--ink2); }
.t-f .sv, .t-secret .sv, .langs-sv .cap, .langs-both .cap { font-style: italic; }
.t-rubric > div, .t-note > div { color: var(--rule); font-size: .88em; }
.t-rubric .sv, .t-note .sv { font-style: italic; }
.t-rubric .ar, .t-note .ar { font-size: 1.05em; font-style: normal; }
.r-people > div { font-weight: 600; }
.r-people .ar { font-weight: 700; }
.r-deacon .sv { border-left: 1.6pt solid var(--gold); padding-left: 5pt; }
.r-deacon .ar { border-right: 1.6pt solid var(--gold); padding-right: 5pt; }
.r-people .sv { border-left: 1.6pt solid var(--rule); padding-left: 5pt; }
.r-people .ar { border-right: 1.6pt solid var(--rule); padding-right: 5pt; }
`;
}

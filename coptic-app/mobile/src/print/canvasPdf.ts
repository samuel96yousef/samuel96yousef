/**
 * A PDF made in the browser, for the web, where the print dialog is not
 * always there (inside Claude's preview it never is). The text is laid out
 * here, page by page, in the same Katameros style as the printed HTML: the
 * frame with its crosses on every page, the running head, the cartouche,
 * Swedish and Arabic side by side. Each page is drawn with the app's own
 * fonts on a canvas, so the browser shapes the Arabic with its vowel marks
 * exactly as on screen, and the pages go into the PDF as images.
 */
import type { Row } from '../components/Reader';
import type { Role, Unit } from '../lib/types';
import { FONTS } from '../theme';
import { ALWAYS_BOTH, arRef, BASE, CROSS_PATHS, PAGE_POINTS, pick, ROLE_AR, ROLE_SV, type Paper, type PrintOptions, type PrintPart } from './html';
import { toArDigits } from '../lib/coptic';

/** Canvas pixels per point: 2.2 is about 160 dots per inch, sharp on paper. */
const S = 2.2;
const MM = 72 / 25.4;

/** Where the frame and the text sit, in points (as html.ts FRAME). */
const GEO: Record<Paper, { edge: number; edgeBottom: number; pad: number; gap: number }> = {
  A4: { edge: 10 * MM, edgeBottom: 14 * MM, pad: 9 * MM, gap: 8 * MM },
  A5: { edge: 7.5 * MM, edgeBottom: 11.5 * MM, pad: 6 * MM, gap: 6 * MM },
};

interface Palette { ink: string; ink2: string; rule: string; rule2: string; gold: string; formula: string }

interface Style {
  font: string;
  /** Size in points */
  size: number;
  color: string;
  /** Line height in points */
  lh: number;
  rtl?: boolean;
  upper?: boolean;
  /** Letter spacing in em */
  spacing?: number;
}

interface Line { text: string; style: Style; prefix?: { text: string; style: Style } }

/** Everything a page draws: a measured block that can sit at any height, and some can be split between lines. */
interface Block {
  h: number;
  top: number;
  bottom: number;
  withNext?: boolean;
  draw: (c: CanvasRenderingContext2D, y: number) => void;
  split?: (room: number) => [Block, Block] | null;
}

// ---------- Text ----------

let measurer: CanvasRenderingContext2D | null = null;
function ctx2d(): CanvasRenderingContext2D {
  if (!measurer) measurer = document.createElement('canvas').getContext('2d');
  if (!measurer) throw new Error('No canvas');
  return measurer;
}

function setFont(c: CanvasRenderingContext2D, st: Style) {
  c.font = `${st.size * S}px "${st.font}"`;
  const ls = c as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in ls) ls.letterSpacing = st.spacing ? `${st.spacing * st.size * S}px` : '0px';
}

function width(text: string, st: Style) {
  const c = ctx2d();
  setFont(c, st);
  return c.measureText(st.upper ? text.toLocaleUpperCase('sv-SE') : text).width / S;
}

/** Break text into lines of at most `w` points, word by word; a newline starts a new line. */
function wrap(text: string, st: Style, w: number, prefix?: { text: string; style: Style }): Line[] {
  const lines: Line[] = [];
  const pre = prefix ? width(`${prefix.text} `, prefix.style) : 0;
  text.split('\n').forEach((para, pi) => {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = '';
    const room = () => w - (lines.length === 0 && prefix ? pre : 0);
    for (const word of words) {
      const next = cur ? `${cur} ${word}` : word;
      if (cur && width(next, st) > room()) {
        lines.push({ text: cur, style: st, prefix: lines.length === 0 ? prefix : undefined });
        cur = word;
      } else cur = next;
    }
    if (cur || pi === 0) lines.push({ text: cur, style: st, prefix: lines.length === 0 ? prefix : undefined });
  });
  return lines;
}

const linesH = (lines: Line[]) => lines.reduce((h, l) => h + l.style.lh, 0);

/** Draw lines in a box from x to x + w, aligned left, right (Arabic) or centred. */
function drawLines(c: CanvasRenderingContext2D, lines: Line[], x: number, y: number, w: number, align: 'start' | 'center') {
  let top = y;
  for (const l of lines) {
    const st = l.style;
    const base = top + st.lh * 0.5 + st.size * 0.34;
    const text = st.upper ? l.text.toLocaleUpperCase('sv-SE') : l.text;
    c.fillStyle = st.color;
    c.textBaseline = 'alphabetic';
    if (align === 'center') {
      setFont(c, st);
      c.direction = st.rtl ? 'rtl' : 'ltr';
      c.textAlign = 'center';
      c.fillText(text, (x + w / 2) * S, base * S);
    } else {
      let start = st.rtl ? x + w : x;
      if (l.prefix) {
        const p = l.prefix;
        setFont(c, p.style);
        c.fillStyle = p.style.color;
        c.direction = st.rtl ? 'rtl' : 'ltr';
        c.textAlign = st.rtl ? 'right' : 'left';
        c.fillText(p.text, start * S, (base - st.size * 0.2) * S);
        const pw = width(`${p.text} `, p.style);
        start += st.rtl ? -pw : pw;
        c.fillStyle = st.color;
      }
      setFont(c, st);
      c.direction = st.rtl ? 'rtl' : 'ltr';
      c.textAlign = st.rtl ? 'right' : 'left';
      c.fillText(text, start * S, base * S);
    }
    top += st.lh;
  }
}

/** One line of pieces in different styles, centred or at the reading side (the role labels, the running head). */
function drawPieces(c: CanvasRenderingContext2D, pieces: { text: string; style: Style }[], x: number, y: number, w: number, align: 'center' | 'left' | 'right', lh: number) {
  const widths = pieces.map((p) => width(p.text, p.style));
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = align === 'center' ? x + (w - total) / 2 : align === 'left' ? x : x + w - total;
  pieces.forEach((p, i) => {
    setFont(c, p.style);
    c.fillStyle = p.style.color;
    c.direction = 'ltr';
    c.textAlign = 'left';
    const base = y + lh * 0.5 + p.style.size * 0.34;
    // An Arabic piece is placed by its width and drawn right to left inside it.
    if (p.style.rtl) { c.direction = 'rtl'; c.textAlign = 'right'; c.fillText(p.text, (cx + widths[i]) * S, base * S); }
    else c.fillText(p.style.upper ? p.text.toLocaleUpperCase('sv-SE') : p.text, cx * S, base * S);
    cx += widths[i];
  });
}

function rule(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, lw: number, dash?: number[]) {
  c.strokeStyle = color;
  c.lineWidth = lw * S;
  c.setLineDash(dash ? dash.map((d) => d * S) : []);
  c.lineCap = dash ? 'round' : 'butt';
  c.beginPath();
  c.moveTo(x1 * S, y1 * S);
  c.lineTo(x2 * S, y2 * S);
  c.stroke();
  c.setLineDash([]);
}

const ARMS = typeof Path2D !== 'undefined' ? new Path2D(CROSS_PATHS.arms) : null;
const RING = typeof Path2D !== 'undefined' ? new Path2D(CROSS_PATHS.ring) : null;

/** The Coptic cross, `size` points across, centred on (x, y), on a little white ground. */
function cross(c: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, ground = true) {
  if (!ARMS || !RING) return;
  if (ground) { c.fillStyle = '#FFFFFF'; c.fillRect((x - size / 2 - 1) * S, (y - size / 2 - 1) * S, (size + 2) * S, (size + 2) * S); }
  c.save();
  c.translate((x - size / 2) * S, (y - size / 2) * S);
  c.scale((size / 24) * S, (size / 24) * S);
  c.fillStyle = color;
  c.fill(ARMS);
  c.fill(RING, 'evenodd');
  c.restore();
}

// ---------- The rows as blocks ----------

function builder(o: PrintOptions, pal: Palette, W: number) {
  const b = BASE[o.paper][o.size];
  const a = b * 1.24;
  const sv = (size = b, extra: Partial<Style> = {}): Style => ({ font: FONTS.sv, size, color: pal.ink, lh: size * 1.5, ...extra });
  const ar = (size = a, extra: Partial<Style> = {}): Style => ({ font: FONTS.ar, size, color: pal.ink, lh: size * 1.75, rtl: true, ...extra });
  const langs = o.langs;

  /** Both languages stacked and centred (the reading language first), or the one printed. */
  const stack = (arText: string, svText: string, arSt: Style, svSt: Style, w: number): Line[] => {
    const A = arText ? wrap(arText, arSt, w) : [];
    const V = svText ? wrap(svText, svSt, w) : [];
    if (langs === 'ar') return A.length ? A : V;
    if (langs === 'sv') return V.length ? V : A;
    return [...A, ...V];
  };

  const centered = (lines: Line[], top: number, bottom: number, extra: Partial<Block> = {}): Block => ({
    h: linesH(lines), top, bottom, ...extra,
    draw: (c, y) => drawLines(c, lines, 0, y, W, 'center'),
  });

  /** A column of wrapped lines that can be split between two pages at a line. */
  const column = (lines: Line[], x: number, w: number, bar: string | null, top: number, bottom: number): Block => {
    const blk: Block = {
      h: linesH(lines), top, bottom,
      draw: (c, y) => {
        const rtl = lines[0]?.style.rtl;
        if (bar) rule(c, rtl ? x + w + 3 : x - 3, y + 2, rtl ? x + w + 3 : x - 3, y + linesH(lines) - 2, bar, 1.6);
        drawLines(c, lines, x, y, w, 'start');
      },
      split: (room) => {
        let n = 0, used = 0;
        while (n < lines.length && used + lines[n].style.lh <= room) { used += lines[n].style.lh; n++; }
        if (n === 0 || n === lines.length) return null;
        return [column(lines.slice(0, n), x, w, bar, top, 0), column(lines.slice(n), x, w, bar, 0, bottom)];
      },
    };
    return blk;
  };

  /** Swedish on the left and Arabic on the right, line for line, split together between pages. */
  const pair = (L: Line[], R: Line[], gap: number, bars: [string | null, string | null], top: number, bottom: number): Block => {
    const cw = (W - gap) / 2;
    const blk: Block = {
      h: Math.max(linesH(L), linesH(R)), top, bottom,
      draw: (c, y) => { column(L, 0, cw, bars[0], 0, 0).draw(c, y); column(R, cw + gap, cw, bars[1], 0, 0).draw(c, y); },
      split: (room) => {
        const cut = (ls: Line[]) => { let n = 0, used = 0; while (n < ls.length && used + ls[n].style.lh <= room) { used += ls[n].style.lh; n++; } return n; };
        const nl = cut(L), nr = cut(R);
        if ((nl === 0 && nr === 0) || (nl >= L.length && nr >= R.length)) return null;
        return [pair(L.slice(0, nl), R.slice(0, nr), gap, bars, top, 0), pair(L.slice(nl), R.slice(nr), gap, bars, 0, bottom)];
      },
    };
    return blk;
  };

  function unitStyles(t: Unit['t'], role?: Role) {
    const people = role === 'people';
    switch (t) {
      case 'f': return { s: sv(b, { font: FONTS.svItalic, color: pal.formula }), r: ar(a, { color: pal.formula }) };
      case 'secret': return { s: sv(b, { font: FONTS.svItalic, color: pal.ink2 }), r: ar(a, { color: pal.ink2 }) };
      case 'rubric':
      case 'note': return { s: sv(b * 0.88, { font: FONTS.svItalic, color: pal.rule }), r: ar(a * 0.92, { color: pal.rule }) };
      default: return { s: sv(b, people ? { font: FONTS.svSemi } : {}), r: ar(a, people ? { font: FONTS.arBold } : {}) };
    }
  }

  function unitText(u: Unit, l: 'ar' | 'sv', showC?: boolean) {
    let s = pick(u, l);
    if (u.t === 'ref' && l === 'ar') s = arRef(s);
    const num = u.t === 'v' && u.n != null ? (showC ? `${u.c}:${u.n}` : String(u.n)) : '';
    return { text: s, num: num ? (l === 'ar' ? toArDigits(num) : num) : '' };
  }

  return (row: Row): Block[] => {
    switch (row.k) {
      case 'top':
      case 'bottom':
        return [];
      case 'run': {
        const sSt = sv(b * 0.85, { color: pal.ink2 });
        const aSt = ar(b * 0.85 * 1.15, { color: pal.ink2, font: FONTS.ar });
        const pieces = langs === 'ar' ? [{ text: row.ar, style: aSt }] : langs === 'sv' ? [{ text: row.sv, style: sSt }]
          : [{ text: `${row.sv} · `, style: sSt }, { text: row.ar, style: aSt }];
        const lh = Math.max(sSt.lh, langs === 'sv' ? 0 : aSt.lh * 0.8);
        return [{ h: lh + 4, top: 0, bottom: 10, draw: (c, y) => { drawPieces(c, pieces, 0, y, W, 'center', lh); rule(c, 0, y + lh + 3, W, y + lh + 3, pal.ink, 1.6); } }];
      }
      case 'cart': {
        const bw = W * 0.78;
        const inner = bw - 2 * (2.5 + 0.6 + 10);
        // The reading language large, the other under it in grey.
        const lines = langs === 'sv'
          ? wrap(row.sv, sv(b * 1.15, { font: FONTS.svSemi }), inner)
          : [...wrap(row.ar, ar(b * 1.5, { font: FONTS.arBold }), inner), ...(langs === 'both' ? wrap(row.sv, sv(b, { color: pal.ink2 }), inner) : [])];
        const h = linesH(lines) + 2 * (5 + 3.1);
        return [{
          h, top: 4, bottom: 12,
          draw: (c, y) => {
            const x0 = (W - bw) / 2;
            c.strokeStyle = pal.rule; c.lineWidth = 1.4 * S; c.strokeRect(x0 * S, y * S, bw * S, h * S);
            c.lineWidth = 0.6 * S; c.strokeRect((x0 + 2.5) * S, (y + 2.5) * S, (bw - 5) * S, (h - 5) * S);
            drawLines(c, lines, x0 + 13.1, y + 8.1, inner, 'center');
          },
        }];
      }
      case 'feast': {
        const lines = row.items.flatMap((f) => {
          const main = langs === 'ar' ? stack(f.ar, '', ar(), sv(), W) : langs === 'sv' ? stack('', f.sv, ar(), sv(), W)
            : [...wrap(f.ar, ar(), W), ...wrap(f.sv, sv(b, { font: FONTS.svItalic, color: pal.ink2 }), W)];
          return main;
        });
        return [centered(lines, 0, 10)];
      }
      case 'title': {
        const big = ar(b * 1.55, { font: FONTS.arBold, lh: b * 1.55 * 1.5 });
        const svTitle = langs === 'both' ? sv(b * 0.78, { font: FONTS.svSemi, color: pal.rule, upper: true, spacing: 0.18 }) : sv(b * 1.3, { font: FONTS.svSemi });
        const lines = stack(row.ar, row.sv, big, svTitle, W);
        const cap = langs === 'ar' ? row.capAr : langs === 'sv' ? row.capSv : row.capSv || row.capAr;
        if (cap) lines.push(...wrap(cap, langs === 'ar' || (!row.capSv && row.capAr) ? ar(a * 0.9, { color: pal.ink2 }) : sv(b * 0.9, { font: FONTS.svItalic, color: pal.ink2 }), W));
        return [centered(lines, 16, 8, { withNext: true })];
      }
      case 'role': {
        const color = row.r === 'deacon' ? pal.gold : row.r === 'people' ? pal.ink : pal.rule;
        const sSt = sv(b * 0.72, { font: FONTS.svSemi, color, upper: true, spacing: 0.14 });
        const aSt = ar(b * 0.72 * 1.5, { font: FONTS.arBold, color });
        const pieces = langs === 'ar' ? [{ text: ROLE_AR[row.r], style: aSt }] : langs === 'sv' ? [{ text: ROLE_SV[row.r], style: sSt }]
          : [{ text: `${ROLE_SV[row.r]} · `, style: sSt }, { text: ROLE_AR[row.r], style: aSt }];
        const lh = langs === 'sv' ? sSt.lh : aSt.lh * 0.85;
        return [{ h: lh, top: 9, bottom: 2, withNext: true, draw: (c, y) => drawPieces(c, pieces, 0, y, W, langs === 'ar' ? 'right' : 'left', lh) }];
      }
      case 'sep':
        return [{ h: 10, top: 14, bottom: 14, draw: (c, y) => {
          rule(c, 0, y + 5, W / 2 - 10, y + 5, pal.ink, 0.6);
          rule(c, W / 2 + 10, y + 5, W, y + 5, pal.ink, 0.6);
          cross(c, W / 2, y + 5, 10, pal.rule, false);
        } }];
      case 'u': {
        const u = row.u;
        if (u.t === 'role') return [];
        if (ALWAYS_BOTH.has(u.t)) {
          const sSt = u.t === 'ref' ? sv(b * 0.92, { font: FONTS.svSemi }) : u.t === 'H' ? sv(b, { font: FONTS.svSemi, spacing: 0.06 }) : sv(b, { font: FONTS.svSemi });
          const aSt = u.t === 'H' ? ar(b * 1.45, { font: FONTS.arBold }) : ar(a, { font: FONTS.arBold });
          const lines = stack(unitText(u, 'ar').text, unitText(u, 'sv').text, aSt, sSt, W);
          const h = linesH(lines) + (u.t === 'ref' ? 5 : 0);
          return [{
            h, top: u.t === 'H' ? 16 : 10, bottom: 4, withNext: true,
            draw: (c, y) => {
              drawLines(c, lines, 0, y, W, 'center');
              if (u.t === 'ref') rule(c, W * 0.19, y + h - 1, W * 0.81, y + h - 1, pal.ink, 1.2, [0.01, 3]);
            },
          }];
        }
        const st = unitStyles(u.t, row.role);
        const bar = row.role === 'deacon' ? pal.gold : row.role === 'people' ? pal.rule : null;
        const make = (l: 'ar' | 'sv', w: number) => {
          const s = l === 'ar' ? st.r : st.s;
          const tx = unitText(u, l, row.showC);
          if (!tx.text) return [];
          const prefix = tx.num ? { text: tx.num, style: { ...s, font: FONTS.svSemi, size: s.size * 0.62, color: pal.rule } } : undefined;
          return wrap(tx.text, s, w - (bar ? 6 : 0), prefix);
        };
        if (langs === 'both') {
          const gap = 7 * MM;
          const cw = (W - gap) / 2;
          return [pair(make('sv', cw), make('ar', cw), gap, [bar, bar], 0, 4)];
        }
        const l = pick(u, langs) ? langs : langs === 'ar' ? 'sv' : 'ar';
        return [column(make(l, W), bar && l === 'sv' ? 6 : 0, W - (bar ? 6 : 0), bar, 0, 4)];
      }
      default:
        return [];
    }
  };
}

// ---------- Pages ----------

export async function renderPdf(parts: PrintPart[], o: PrintOptions, onProgress?: (page: number) => void): Promise<Blob> {
  const fonts = [FONTS.sv, FONTS.svItalic, FONTS.svSemi, FONTS.ar, FONTS.arBold];
  await Promise.all(fonts.map((f) => document.fonts.load(`16px "${f}"`, 'Aa ع').catch(() => [])));
  const pal: Palette = o.color
    ? { ink: '#1B1517', ink2: '#3A3134', rule: '#9E1B32', rule2: '#E09AA5', gold: '#A8751A', formula: '#7E1D30' }
    : { ink: '#1B1517', ink2: '#3A3134', rule: '#111111', rule2: '#999999', gold: '#555555', formula: '#1B1517' };
  const { width: PW, height: PH } = PAGE_POINTS[o.paper];
  const g = GEO[o.paper];
  const left = g.edge + g.pad;
  const W = PW - 2 * left;
  const top = g.edge + g.gap;
  const bottom = PH - g.edgeBottom - g.gap;
  const blocksOf = builder(o, pal, W);

  // Lay out: each part from a new page; a heading never ends a page; a block
  // that does not fit moves on, or is split at a line if it is too tall for any page.
  const pages: { block: Block; y: number }[][] = [];
  let page: { block: Block; y: number }[] = [];
  let y = top;
  const newPage = () => { if (page.length) pages.push(page); page = []; y = top; };
  for (const part of parts) {
    newPage();
    const queue = part.rows.flatMap(blocksOf);
    for (let i = 0; i < queue.length; i++) {
      const blk = queue[i];
      const before = page.length ? blk.top : 0;
      const next = queue[i + 1];
      const keep = blk.withNext && next ? Math.min(next.h, 40) + (next.top || 0) : 0;
      if (y + before + blk.h + keep <= bottom || (!page.length && blk.h + keep > bottom - top)) {
        page.push({ block: blk, y: y + before });
        y += before + blk.h + blk.bottom;
        continue;
      }
      const room = bottom - y - before;
      const parts2 = blk.split && room > 30 && blk.h > 3 * 20 ? blk.split(room) : null;
      if (parts2) {
        page.push({ block: parts2[0], y: y + before });
        newPage();
        queue.splice(i + 1, 0, parts2[1]);
        continue;
      }
      newPage();
      if (blk.h > bottom - top && blk.split) {
        const fit = blk.split(bottom - top);
        if (fit) { page.push({ block: fit[0], y }); newPage(); queue.splice(i + 1, 0, fit[1]); continue; }
      }
      page.push({ block: blk, y });
      y += blk.h + blk.bottom;
    }
  }
  newPage();

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PW * S);
  canvas.height = Math.round(PH * S);
  const c = canvas.getContext('2d');
  if (!c) throw new Error('No canvas');
  const jpegs: Uint8Array[] = [];
  for (let n = 0; n < pages.length; n++) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#FFFFFF';
    c.fillRect(0, 0, canvas.width, canvas.height);
    // The frame: a double rule with a cross on each corner.
    const fx = g.edge, fy = g.edge, fw = PW - 2 * g.edge, fh = PH - g.edge - g.edgeBottom;
    c.strokeStyle = pal.rule; c.lineWidth = 1.2 * S; c.strokeRect(fx * S, fy * S, fw * S, fh * S);
    c.strokeStyle = pal.rule2; c.lineWidth = 0.6 * S; c.strokeRect((fx + 3) * S, (fy + 3) * S, (fw - 6) * S, (fh - 6) * S);
    for (const [cx, cy] of [[fx, fy], [fx + fw, fy], [fx, fy + fh], [fx + fw, fy + fh]]) cross(c, cx, cy, 12, pal.rule);
    // The page number under the frame.
    c.fillStyle = '#777777'; c.font = `${BASE[o.paper][o.size] * 0.8 * S}px "${FONTS.sv}"`; c.textAlign = 'center'; c.direction = 'ltr';
    c.fillText(String(n + 1), (PW / 2) * S, (PH - g.edgeBottom / 2 + 3) * S);
    c.save();
    c.translate(left * S, 0);
    for (const { block, y: by } of pages[n]) block.draw(c, by);
    c.restore();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) throw new Error('Could not draw a page');
    jpegs.push(new Uint8Array(await blob.arrayBuffer()));
    onProgress?.(n + 1);
  }
  return pdfOfImages(jpegs, canvas.width, canvas.height, PW, PH);
}

/** A PDF whose pages are the given JPEG images, each filling a page of pw × ph points. */
function pdfOfImages(jpegs: Uint8Array[], iw: number, ih: number, pw: number, ph: number): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let size = 0;
  const put = (x: string | Uint8Array) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); size += b.length; };
  const obj = (id: number, body: () => void) => { offsets[id] = size; put(`${id} 0 obj\n`); body(); put('\nendobj\n'); };
  put('%PDF-1.4\n%âãÏÓ\n');
  const n = jpegs.length;
  // 1 catalog, 2 page tree, then for page i: 3+3i page, 4+3i content, 5+3i image.
  obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => put(`<< /Type /Pages /Count ${n} /Kids [${jpegs.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] >>`));
  jpegs.forEach((jpg, i) => {
    const p = 3 + 3 * i;
    obj(p, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`));
    const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    obj(p + 1, () => put(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    obj(p + 2, () => {
      put(`<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
      put(jpg);
      put('\nendstream');
    });
  });
  const xref = size;
  const total = 3 + 3 * n;
  put(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) put(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  put(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

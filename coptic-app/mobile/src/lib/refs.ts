import type { BibleBook, BookData, Verse } from './types';

/**
 * Abbreviations used by the Katameros data. Index == bid in the Bible files.
 * Columns: abbreviation, short Arabic name, Arabic name in the epistle intro,
 * Swedish name in the intro formulas.
 */
export const BOOKS: [string, string, string?, string?][] = [
  ['gen', 'تك'], ['ex', 'خر'], ['lev', 'لا'], ['num', 'عد'], ['deut', 'تث'],
  ['josh', 'يش'], ['judg', 'قض'], ['ruth', 'را'], ['1sam', '١صم'], ['2sam', '٢صم'],
  ['1kings', '١مل'], ['2kings', '٢مل'], ['1chron', '١أخ'], ['2chron', '٢أخ'],
  ['ezra', 'عز'], ['neh', 'نح'], ['tob', 'طو'], ['jth', 'يهوديت'], ['est', 'أس'],
  ['job', 'أي'], ['ps', 'مز'], ['prov', 'أم'], ['eccles', 'جا'], ['song', 'نش'],
  ['wis', 'حكمة'], ['sir', 'سيراخ'], ['isa', 'إش'], ['jer', 'إر'], ['lam', 'مرا'],
  ['bar', 'باروخ'], ['ezek', 'حز'], ['dan', 'دا'], ['hos', 'هو'], ['joel', 'يؤ'],
  ['amos', 'عا'], ['obad', 'عو'], ['jonah', 'يون'], ['mic', 'مي'], ['nah', 'نا'],
  ['hab', 'حب'], ['zeph', 'صف'], ['hag', 'حج'], ['zech', 'زك'], ['mal', 'ملا'],
  ['1macc', '١مكا'], ['2macc', '٢مكا'],
  ['matt', 'متى', 'متى', 'Matteus'], ['mark', 'مرقس', 'مرقس', 'Markus'],
  ['luke', 'لوقا', 'لوقا', 'Lukas'], ['john', 'يوحنا', 'يوحنا', 'Johannes'],
  ['acts', 'أعمال الرسل'],
  ['rom', 'رومية', 'إلى أهل رومية', 'Rom'],
  ['1cor', '١ كورنثوس', 'الأولى إلى أهل كورنثوس', 'Korint'],
  ['2cor', '٢ كورنثوس', 'الثانية إلى أهل كورنثوس', 'Korint'],
  ['gal', 'غلاطية', 'إلى أهل غلاطية', 'Galatien'],
  ['eph', 'أفسس', 'إلى أهل أفسس', 'Efesos'],
  ['phil', 'فيلبي', 'إلى أهل فيلبي', 'Filippi'],
  ['col', 'كولوسي', 'إلى أهل كولوسي', 'Kolosse'],
  ['1thess', '١ تسالونيكي', 'الأولى إلى أهل تسالونيكي', 'Tessalonike'],
  ['2thess', '٢ تسالونيكي', 'الثانية إلى أهل تسالونيكي', 'Tessalonike'],
  ['1tim', '١ تيموثاوس', 'الأولى إلى تيموثاوس', 'Timoteus'],
  ['2tim', '٢ تيموثاوس', 'الثانية إلى تيموثاوس', 'Timoteus'],
  ['titus', 'تيطس', 'تيطس', 'Titus'],
  ['philem', 'فليمون', 'فليمون', 'Filemon'],
  ['heb', 'عبرانيين', 'إلى العبرانيين', 'Hebreerna'],
  ['james', 'يعقوب', 'يعقوب الرسول', 'aposteln Jakob'],
  ['1pet', '١ بطرس', 'بطرس الرسول الأولى', 'aposteln Petrus'],
  ['2pet', '٢ بطرس', 'بطرس الرسول الثانية', 'aposteln Petrus'],
  ['1john', '١ يوحنا', 'يوحنا الرسول الأولى', 'aposteln Johannes'],
  ['2john', '٢ يوحنا', 'يوحنا الرسول الثانية', 'aposteln Johannes'],
  ['3john', '٣ يوحنا', 'يوحنا الرسول الثالثة', 'aposteln Johannes'],
  ['jude', 'يهوذا', 'يهوذا الرسول', 'aposteln Judas'],
  ['rev', 'رؤيا'],
];
const INDEX = new Map(BOOKS.map((b, i) => [b[0], i]));

export interface Passage {
  bid: number;
  /** [chapter, first verse, last verse]; last = Infinity runs to the end of the chapter */
  spans: [number, number, number][];
}

/**
 * Parse one reference ("matt 13 : 44 - 52", "2cor 5 : 11 - 6 : 13",
 * "ps 92 : 10 , 14 , 15"). Several references can be joined with " / ".
 */
export function parseRef(ref: string): Passage[] {
  return ref.split('/').map((part) => {
    const m = part.trim().match(/^(\d?[A-Za-z]+)\s*(.*)$/);
    if (!m) throw new Error(`Bad reference: ${ref}`);
    const bid = INDEX.get(m[1].toLowerCase());
    if (bid === undefined) throw new Error(`Unknown book in reference: ${ref}`);
    const tokens = m[2].match(/[,:-]?\s*\d+/g) ?? [];
    const chapters: number[] = [];
    let first: number | null = null;
    let last: number | number[] = [];
    let continuous = false;
    let firstColon = true;
    for (const tok of tokens) {
      const head = tok.trim()[0];
      const num = Number(tok.replace(/\D/g, ''));
      if (head === ':' && firstColon) { first = num; firstColon = false; }
      else if (head === ':') { chapters.push(last as number); last = num; }
      else if (head === '-') { continuous = true; last = num; }
      else if (head === ',') { continuous = false; last = Array.isArray(last) ? [...last, num] : [num]; }
      else chapters.push(num);
    }
    const spans: [number, number, number][] = [];
    if (first === null) {
      spans.push([chapters[0], 1, Infinity]);
    } else if (chapters.length > 1) {
      const [c1, c2] = chapters;
      spans.push([c1, first, Infinity]);
      for (let c = c1 + 1; c < c2; c++) spans.push([c, 1, Infinity]);
      spans.push([c2, 1, last as number]);
    } else if (continuous) {
      spans.push([chapters[0], first, last as number]);
    } else {
      for (const v of [first, ...(Array.isArray(last) ? last : [])]) spans.push([chapters[0], v, v]);
    }
    return { bid, spans };
  });
}

export const bookOfRef = (ref: string) => BOOKS[parseRef(ref)[0].bid];

export function versesOf(book: BookData, p: Passage): { c: number; v: Verse }[] {
  const out: { c: number; v: Verse }[] = [];
  for (const [c, a, b] of p.spans) {
    const chapter = book.find(([n]) => n === c);
    if (!chapter) continue;
    for (const v of chapter[1]) if (v[0] >= a && v[0] <= b) out.push({ c, v });
  }
  return out;
}

const tidy = (nums: string) =>
  nums.trim().replace(/\s*:\s*/g, ':').replace(/\s*-\s*/g, '–').replace(/\s*,\s*/g, ', ').replace(/\s*;\s*/g, '; ');

/** Labels for a reference: short Arabic book name; Swedish evangelist or full book name. */
export function refLabel(ref: string, books: BibleBook[]): { ar: string; sv: string } {
  const parts = ref.split('/').map((part) => {
    const m = part.trim().match(/^(\d?[A-Za-z]+)\s*(.*)$/)!;
    const bid = INDEX.get(m[1].toLowerCase())!;
    const nums = tidy(m[2]);
    const sv = bid >= 46 && bid <= 49 ? BOOKS[bid][3] : books.find((b) => b.bid === bid)?.sv ?? m[1];
    return { ar: `${BOOKS[bid][1]} ${nums}`, sv: `${sv} ${nums}` };
  });
  return { ar: parts.map((p) => p.ar).join(' / '), sv: parts.map((p) => p.sv).join(' / ') };
}

/** Hebrew (Swedish Bible) psalm number → Septuagint number used in Coptic books. */
export function hebrewToLxx(ch: number, verse: number) {
  if (ch <= 8 || ch >= 148) return ch;
  if (ch <= 10) return 9;
  if (ch <= 113) return ch - 1;
  if (ch <= 115) return 113;
  if (ch === 116) return verse <= 9 ? 114 : 115;
  if (ch <= 146) return ch - 1;
  return verse <= 11 ? 146 : 147;
}

/** Normalise "Psalms 65:11;81:1" (from the psalm table) to "ps 65 : 11 ; 81 : 1". */
export function psalmRefFromTable(reference: string) {
  return 'ps ' + reference.replace(/^Psalms?\s*/i, '').replace(/:/g, ' : ').replace(/;/g, ' ; ').replace(/-/g, ' - ');
}

export function psalmLabel(ref: string): { ar: string; sv: string } {
  const body = ref.trim().replace(/^ps\s*/i, '');
  const ar = body.split(';').map((seg) => {
    const m = seg.match(/^\s*(\d+)\s*:\s*(.*)$/);
    if (!m) return tidy(seg);
    const firstVerse = Number((m[2].match(/\d+/) ?? ['1'])[0]);
    return `${hebrewToLxx(Number(m[1]), firstVerse)}:${tidy(m[2])}`;
  }).join(' ؛ ');
  return { ar: `مزمور ${ar}`, sv: `Psaltaren ${tidy(body)}` };
}

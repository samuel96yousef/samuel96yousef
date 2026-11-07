import type { CopticDate, Lang } from './types';

const COPTIC_EPOCH = 1825030; // Julian day number of 1 Tout, year 1 of the Martyrs

export const MONTHS: [sv: string, ar: string, cop: string][] = [
  ['Tout', 'توت', 'Ⲑⲱⲟⲩⲧ'], ['Baba', 'بابه', 'Ⲡⲁⲟⲡⲓ'], ['Hatour', 'هاتور', 'Ⲁⲑⲱⲣ'], ['Kiahk', 'كيهك', 'Ⲭⲟⲓⲁⲕ'],
  ['Touba', 'طوبه', 'Ⲧⲱⲃⲓ'], ['Amshir', 'أمشير', 'Ⲙⲉϣⲓⲣ'], ['Baramhat', 'برمهات', 'Ⲡⲁⲣⲉⲙϩⲁⲧ'], ['Baramouda', 'برموده', 'Ⲫⲁⲣⲙⲟⲩⲑⲓ'],
  ['Bashans', 'بشنس', 'Ⲡⲁϣⲟⲛⲥ'], ['Paona', 'بؤونه', 'Ⲡⲁⲱⲛⲓ'], ['Epep', 'أبيب', 'Ⲉⲡⲏⲡ'], ['Mesra', 'مسرى', 'Ⲙⲉⲥⲱⲣⲓ'],
  ['Nasie', 'النسيء', 'Ⲡⲓⲕⲟⲩϫⲓ ⲛ̀ⲁ̀ⲃⲟⲧ'],
];
const WD_SV = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
const WD_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const GM_SV = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const GM_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const ORD_SV = ['första', 'andra', 'tredje', 'fjärde', 'femte', 'sjätte', 'sjunde', 'åttonde', 'nionde', 'tionde', 'elfte', 'tolfte',
  'trettonde', 'fjortonde', 'femtonde', 'sextonde', 'sjuttonde', 'artonde', 'nittonde', 'tjugonde', 'tjugoförsta', 'tjugoandra',
  'tjugotredje', 'tjugofjärde', 'tjugofemte', 'tjugosjätte', 'tjugosjunde', 'tjugoåttonde', 'tjugonionde', 'trettionde'];
export const ORD_AR = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر',
  'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون',
  'الحادي والعشرون', 'الثاني والعشرون', 'الثالث والعشرون', 'الرابع والعشرون', 'الخامس والعشرون', 'السادس والعشرون',
  'السابع والعشرون', 'الثامن والعشرون', 'التاسع والعشرون', 'الثلاثون'];

export const toArDigits = (s: string | number) => String(s).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Local calendar date at midnight, so day arithmetic ignores time of day and DST. */
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const dayDiff = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 864e5);
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fromIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

function julianDay(d: Date) {
  const a = Math.floor((14 - (d.getMonth() + 1)) / 12);
  const y = d.getFullYear() + 4800 - a;
  const m = d.getMonth() + 1 + 12 * a - 3;
  return d.getDate() + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

export function coptic(d: Date): CopticDate {
  const j = julianDay(d);
  const year = Math.floor((4 * (j - COPTIC_EPOCH) + 1463) / 1461);
  const start = COPTIC_EPOCH - 1 + 365 * (year - 1) + Math.floor(year / 4);
  const doy = j - start;
  const month = Math.floor((doy - 1) / 30) + 1;
  return { year, month, day: doy - 30 * (month - 1) };
}

/** Orthodox (Coptic) Easter in the Gregorian calendar, valid 1900–2099. */
export function easter(year: number): Date {
  const a = year % 4, b = year % 7, c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return addDays(new Date(year, month - 1, day), 13);
}

export const copticText = (c: CopticDate, lang: Lang) =>
  lang === 'ar' ? `${toArDigits(c.day)} ${MONTHS[c.month - 1][1]}` : `${c.day} ${MONTHS[c.month - 1][0]}`;

/** "torsdag" / "الخميس". */
export const weekdayText = (d: Date, lang: Lang) => (lang === 'ar' ? WD_AR[d.getDay()] : WD_SV[d.getDay()]);

/** "7 november", without weekday or year. */
export const dayMonthText = (d: Date, lang: Lang) =>
  lang === 'ar' ? `${toArDigits(d.getDate())} ${GM_AR[d.getMonth()]}` : `${d.getDate()} ${GM_SV[d.getMonth()]}`;

/** "Oktober 2026", for a month of the calendar. */
export const monthText = (d: Date, lang: Lang) =>
  lang === 'ar' ? `${GM_AR[d.getMonth()]} ${toArDigits(d.getFullYear())}` : `${cap(GM_SV[d.getMonth()])} ${d.getFullYear()}`;

/** Short weekday names, Sunday first, for the calendar's heading. */
export const WEEKDAYS_SHORT: Record<Lang, string[]> = {
  sv: ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'],
  ar: ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
};

export function gregorianText(d: Date, lang: Lang, withYear = true) {
  return lang === 'ar'
    ? `${WD_AR[d.getDay()]} ${toArDigits(d.getDate())} ${GM_AR[d.getMonth()]}${withYear ? ` ${toArDigits(d.getFullYear())}` : ''}`
    : `${cap(WD_SV[d.getDay()])} ${d.getDate()} ${GM_SV[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`;
}

export const dayTitle = (c: CopticDate, lang: Lang) =>
  lang === 'ar'
    ? `اليوم ${ORD_AR[c.day - 1]} من شهر ${MONTHS[c.month - 1][1]}`
    : `${cap(ORD_SV[c.day - 1])} dagen i månaden ${MONTHS[c.month - 1][0]}`;

// ---------- Feasts, seasons and fasting ----------

const FEASTS: Record<string, [string, string]> = {
  '1-1': ['Koptiska nyåret (Nayrouz)', 'عيد النيروز'],
  '1-17': ['Korsets fest', 'عيد الصليب'],
  '5-11': ['Herrens dop (Theofania)', 'عيد الغطاس المجيد'],
  '5-13': ['Bröllopet i Kana', 'عرس قانا الجليل'],
  '6-8': ['Herrens frambärande i templet', 'دخول المسيح الهيكل'],
  '7-29': ['Bebådelsen', 'عيد البشارة'],
  '9-24': ['Kristi ankomst till Egypten', 'دخول المسيح أرض مصر'],
  '11-5': ['Apostlarna Petrus och Paulus', 'عيد الرسولين بطرس وبولس'],
  '12-13': ['Kristi förklaring', 'عيد التجلي'],
  '12-16': ['Jungfru Marias upptagning', 'صعود جسد السيدة العذراء'],
};

export interface Observance {
  sv: string;
  ar: string;
  major: boolean;
}

export function observances(d: Date): Observance[] {
  const c = coptic(d);
  const out: Observance[] = [];
  const k = dayDiff(d, easter(d.getFullYear()));
  const moveable: Record<number, [string, string]> = {
    0: ['Påskdagen', 'عيد القيامة المجيد'],
    [-7]: ['Palmsöndagen', 'أحد الشعانين'],
    39: ['Kristi himmelsfärd', 'عيد الصعود'],
    49: ['Pingst', 'عيد العنصرة'],
  };
  if (moveable[k]) out.push({ sv: moveable[k][0], ar: moveable[k][1], major: true });
  // The Nativity is kept on 7 January, which is 28 Kiahk in some years.
  if (d.getMonth() === 0 && d.getDate() === 7) out.push({ sv: 'Kristi födelse', ar: 'عيد الميلاد المجيد', major: true });
  const f = FEASTS[`${c.month}-${c.day}`];
  if (f) out.push({ sv: f[0], ar: f[1], major: true });
  if (nativityRule(d) === 28) out.push({ sv: 'Julens paramoun', ar: 'برامون الميلاد', major: false });
  if (c.month === 5 && (c.day === 10 || theophanyParamoun(c.day, d.getDay()))) out.push({ sv: 'Teofanins paramoun', ar: 'برامون الغطاس', major: false });
  if (c.month !== 13 && c.day === 12) out.push({ sv: 'Ärkeängeln Mikaels minnesdag', ar: 'تذكار رئيس الملائكة ميخائيل', major: false });
  if (c.month !== 13 && c.day === 21) out.push({ sv: 'Jungfru Marias minnesdag', ar: 'تذكار السيدة العذراء', major: false });
  if (c.day === 29 && c.month !== 5 && c.month !== 6 && !f && !(d.getMonth() === 0 && d.getDate() === 7)) {
    out.push({ sv: 'Minnet av bebådelsen, födelsen och uppståndelsen', ar: 'تذكار البشارة والميلاد والقيامة', major: false });
  }
  return out;
}

export interface SeasonInfo {
  sv: string;
  ar: string;
  fasting: boolean;
}

export function season(d: Date): SeasonInfo | null {
  const c = coptic(d);
  const k = dayDiff(d, easter(d.getFullYear()));
  if (k >= -6 && k < 0) return { sv: 'Påskveckan', ar: 'أسبوع الآلام', fasting: true };
  if (k >= -55 && k < -6) return { sv: 'Stora fastan', ar: 'الصوم الكبير', fasting: true };
  if (k >= -69 && k <= -67) return { sv: 'Jonas fasta', ar: 'صوم يونان', fasting: true };
  if (k >= 0 && k <= 49) return { sv: 'De femtio dagarna', ar: 'الخماسين المقدسة', fasting: false };
  // 16 Hatour until the Nativity on 7 January
  if ((c.month === 3 && c.day >= 16) || (c.month === 4 && !(d.getMonth() === 0 && d.getDate() >= 7))) {
    return { sv: 'Julfastan', ar: 'صوم الميلاد', fasting: true };
  }
  if (c.month === 12 && c.day <= 15) return { sv: 'Jungfru Marias fasta', ar: 'صوم السيدة العذراء', fasting: true };
  if (k >= 50 && c.month >= 9 && (c.month < 11 || (c.month === 11 && c.day <= 4))) return { sv: 'Apostlarnas fasta', ar: 'صوم الرسل', fasting: true };
  return null;
}

/** Wednesdays and Fridays are fast days, except in the fifty days after Easter. */
export function isFastDay(d: Date) {
  const s = season(d);
  if (s?.fasting) return true;
  const k = dayDiff(d, easter(d.getFullYear()));
  return (d.getDay() === 3 || d.getDay() === 5) && !(k >= 0 && k <= 49);
}

// ---------- Paramoun rules (shared with the lectionary) ----------

/**
 * Nativity (7 January) and its paramoun. When the feast falls on a Sunday or
 * Monday the paramoun starts on the Friday before. Returns the Kiahk day whose
 * readings apply: 28 (paramoun) or 29 (the feast), or null.
 */
export function nativityRule(d: Date): 28 | 29 | null {
  if (d.getMonth() !== 0) return null;
  const g = d.getDate(), wd = d.getDay();
  if ((g === 4 && wd === 5) || (g === 5 && (wd === 5 || wd === 6)) || g === 6) return 28;
  if (g === 7 && coptic(d).day === 28) return 29;
  return null;
}

/** Theophany (11 Touba) paramoun, extended back to Friday like the Nativity's. 10 Touba is handled as a feast day. */
export function theophanyParamoun(copticDay: number, weekday: number) {
  return (copticDay === 8 && weekday === 5) || (copticDay === 9 && (weekday === 5 || weekday === 6));
}

// ---------- Canonical hours ----------

export const HOURS: Record<string, { from: number; sv: string; ar: string }> = {
  baker: { from: 5, sv: 'Ca kl. 6, vid gryningen', ar: 'الصباح الباكر' },
  talta: { from: 8, sv: 'Ca kl. 9', ar: 'نحو التاسعة صباحاً' },
  sata: { from: 11, sv: 'Ca kl. 12, mitt på dagen', ar: 'وقت الظهر' },
  tas3a: { from: 14, sv: 'Ca kl. 15', ar: 'نحو الثالثة عصراً' },
  ghorob: { from: 16, sv: 'Vid solnedgången', ar: 'عند الغروب' },
  nom: { from: 19, sv: 'Före sänggåendet', ar: 'قبل النوم' },
  setar: { from: 22, sv: 'Sent på kvällen', ar: 'آخر المساء' },
  nos_lil: { from: 0, sv: 'Vid midnatt', ar: 'منتصف الليل' },
};

export function hourNow(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'nos_lil';
  let best = 'baker';
  for (const [id, v] of Object.entries(HOURS)) if (h >= v.from && v.from >= HOURS[best].from) best = id;
  return best;
}

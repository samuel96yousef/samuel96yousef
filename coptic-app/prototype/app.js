/* Koptisk bönbok — prototyp, steg 1. Plain JS, no build step. */
(() => {
  'use strict';

  const DATA = window.COPTIC_DATA || { katameros: {}, agpeya: [], books: [], window: [] };
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toAr = (s) => String(s).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const arRef = (s) => toAr(String(s).replace(/\s*:\s*/g, ' : ').replace(/\s*–\s*/g, ' – '));
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('kbb.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('kbb.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  // ---------- Strings ----------

  const T = {
    sv: {
      today: 'Idag', readings: 'Läsningar', agpeya: 'Agpeya', bible: 'Bibeln', settings: 'Inställningar', back: 'Agpeya',
      todaysReadings: 'Dagens läsningar', word: 'Dagens ord', readAll: 'Läs dagens läsningar', now: 'Nu', prayNow: 'Be nu',
      year: (y) => `Martyrernas år ${y}`, fastDay: 'Fastedag', goToday: 'Idag', prevDay: 'Föregående dag', nextDay: 'Nästa dag',
      showAr: 'العربية', showBoth: 'Båda', showSv: 'Svenska',
      langSwitch: 'Textspråk',
      hintPeek: (p) => `Tryck på en vers för att se den på ${p === 'ar' ? 'svenska' : 'arabiska'}.`,
      hintBoth: 'Håll in knappen för att visa båda språken samtidigt.',
      showTextsHelp: 'I läsningen byter du språk med knappen nere i hörnet eller genom att svepa åt sidan. Tryck på en vers för att se just den på det andra språket.',
      spreadNote: 'Bokuppslag · svenska till vänster, arabiska till höger',
      outside: (a, b) => `Prototypen innehåller läsningar för ${a}–${b}. Du ser närmaste dag.`,
      holyWeek: 'Under påskveckan läses Pascha-boken. Den kommer i ett senare steg.',
      approx: 'Kiahk och Touba har egna regler för läsningarna som inte är inbyggda än. Kontrollera mot kyrkans kalender.',
      agpeyaSub: 'Kyrkans timböner, från morgon till midnatt', hoursLabel: 'Bönetider',
      bibleSoon: 'Hela Bibeln kommer i nästa steg', bibleSoonText: 'Texten finns redan i materialet, på arabiska och svenska. Här ser du vilka böcker som ingår.',
      ot: 'Gamla testamentet', nt: 'Nya testamentet', chapters: (n) => `${n} kap.`, soon: 'Kommer i nästa steg',
      appLang: 'Appens språk', showTexts: 'Visa texter', textSize: 'Textstorlek', readTheme: 'Läsläge',
      themes: { auto: 'Auto', paper: 'Papper', sepia: 'Sepia', night: 'Natt' },
      spread: 'Bokuppslag', spreadOpts: { auto: 'Auto', on: 'På', off: 'Av' },
      spreadHelp: 'Auto visar svenska och arabiska sida vid sida när skärmen är bred nog, till exempel när en vikbar telefon fälls upp eller när du vrider telefonen.',
      about: 'Om prototypen',
      aboutText: ['Steg 1: designspråk, dagens läsningar, Agpeya och uppslagsläget för vikbara skärmar.',
        'Texterna kommer från CopticPrayers-appens material. Rättigheterna till de svenska översättningarna behöver klaras ut innan appen publiceras.'],
      folded: 'Hopvikt', unfolded: 'Uppvikt', stageCaption: 'Förhandsvisning av en vikbar telefon. Fäll upp, så öppnas läsningarna som en kyrkbok.',
      bookOn: 'Visa som bokuppslag', aa: 'Text och visning', close: 'Stäng',
      readingsArch: (m) => `Läsningar för månaden ${m}`, agpeyaArch: 'Timbönerna',
    },
    ar: {
      today: 'اليوم', readings: 'القراءات', agpeya: 'الأجبية', bible: 'الكتاب المقدس', settings: 'الإعدادات', back: 'الأجبية',
      todaysReadings: 'قراءات اليوم', word: 'كلمة اليوم', readAll: 'اقرأ قراءات اليوم', now: 'الآن', prayNow: 'صلِّ الآن',
      year: (y) => `سنة ${toAr(y)} للشهداء`, fastDay: 'يوم صوم', goToday: 'اليوم', prevDay: 'اليوم السابق', nextDay: 'اليوم التالي',
      showAr: 'العربية', showBoth: 'كلاهما', showSv: 'Svenska',
      langSwitch: 'لغة النص',
      hintPeek: (p) => (p === 'ar' ? 'اضغط على أي آية لترى ترجمتها بالسويدية.' : 'اضغط على أي آية لترى نصها العربي.'),
      hintBoth: 'اضغط مطولاً على الزر لعرض اللغتين معاً.',
      showTextsHelp: 'أثناء القراءة بدّل اللغة بالزر في الأسفل أو بالسحب جانباً. اضغط على أي آية لتراها باللغة الأخرى.',
      spreadNote: 'كتاب مفتوح · السويدية يساراً والعربية يميناً',
      outside: (a, b) => `يحتوي النموذج على قراءات من ${a} إلى ${b}. يُعرض أقرب يوم.`,
      holyWeek: 'في أسبوع الآلام تُقرأ قراءات البصخة، وستُضاف في خطوة لاحقة.',
      approx: 'لشهري كيهك وطوبة قواعد خاصة للقراءات لم تُضف بعد. يُرجى المراجعة مع تقويم الكنيسة.',
      agpeyaSub: 'صلوات السواعي من باكر إلى نصف الليل', hoursLabel: 'السواعي',
      bibleSoon: 'الكتاب المقدس كاملاً في الخطوة التالية', bibleSoonText: 'النص موجود بالفعل بالعربية والسويدية. هنا ترى الأسفار المتضمنة.',
      ot: 'العهد القديم', nt: 'العهد الجديد', chapters: (n) => `${toAr(n)} أصحاح`, soon: 'في الخطوة التالية',
      appLang: 'لغة التطبيق', showTexts: 'عرض النصوص', textSize: 'حجم الخط', readTheme: 'مظهر القراءة',
      themes: { auto: 'تلقائي', paper: 'ورق', sepia: 'دافئ', night: 'ليلي' },
      spread: 'الكتاب المفتوح', spreadOpts: { auto: 'تلقائي', on: 'تشغيل', off: 'إيقاف' },
      spreadHelp: 'في الوضع التلقائي تظهر العربية والسويدية جنباً إلى جنب عندما تكون الشاشة عريضة بما يكفي، مثل فتح الهاتف القابل للطي أو تدوير الهاتف.',
      about: 'عن النموذج',
      aboutText: ['الخطوة الأولى: لغة التصميم، قراءات اليوم، الأجبية، وعرض الكتاب المفتوح للشاشات القابلة للطي.',
        'النصوص مأخوذة من مواد تطبيق CopticPrayers. يجب توضيح حقوق الترجمات السويدية قبل نشر التطبيق.'],
      folded: 'مطوي', unfolded: 'مفتوح', stageCaption: 'معاينة لهاتف قابل للطي. افتحه لتظهر القراءات ككتاب كنسي مفتوح.',
      bookOn: 'عرض ككتاب مفتوح', aa: 'النص والعرض', close: 'إغلاق',
      readingsArch: (m) => `Läsningar · ${m}`, agpeyaArch: 'Timbönerna',
    },
  };

  // ---------- Calendar ----------

  const COPTIC_EPOCH = 1825030;
  const MONTHS = [
    ['Tout', 'توت', 'Ⲑⲱⲟⲩⲧ'], ['Baba', 'بابه', 'Ⲡⲁⲟⲡⲓ'], ['Hatour', 'هاتور', 'Ⲁⲑⲱⲣ'], ['Kiahk', 'كيهك', 'Ⲭⲟⲓⲁⲕ'],
    ['Touba', 'طوبه', 'Ⲧⲱⲃⲓ'], ['Amshir', 'أمشير', 'Ⲙⲉϣⲓⲣ'], ['Baramhat', 'برمهات', 'Ⲡⲁⲣⲉⲙϩⲁⲧ'], ['Baramouda', 'برموده', 'Ⲫⲁⲣⲙⲟⲩⲑⲓ'],
    ['Bashans', 'بشنس', 'Ⲡⲁϣⲟⲛⲥ'], ['Paona', 'بؤونه', 'Ⲡⲁⲱⲛⲓ'], ['Epep', 'أبيب', 'Ⲉⲡⲏⲡ'], ['Mesra', 'مسرى', 'Ⲙⲉⲥⲱⲣⲓ'],
    ['Nasie', 'النسيء', 'Ⲡⲓⲕⲟⲩϫⲓ ⲛ̀ⲁ̀ⲃⲟⲧ'],
  ];
  const WD_SV = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
  const WD_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const GM_SV = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  const GM_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const ORD_SV = ['första', 'andra', 'tredje', 'fjärde', 'femte', 'sjätte', 'sjunde', 'åttonde', 'nionde', 'tionde', 'elfte', 'tolfte',
    'trettonde', 'fjortonde', 'femtonde', 'sextonde', 'sjuttonde', 'artonde', 'nittonde', 'tjugonde', 'tjugoförsta', 'tjugoandra',
    'tjugotredje', 'tjugofjärde', 'tjugofemte', 'tjugosjätte', 'tjugosjunde', 'tjugoåttonde', 'tjugonionde', 'trettionde'];
  const ORD_AR = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر',
    'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون',
    'الحادي والعشرون', 'الثاني والعشرون', 'الثالث والعشرون', 'الرابع والعشرون', 'الخامس والعشرون', 'السادس والعشرون',
    'السابع والعشرون', 'الثامن والعشرون', 'التاسع والعشرون', 'الثلاثون'];

  const pad = (n) => String(n).padStart(2, '0');
  const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dateOf = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const dayDiff = (a, b) => Math.round((dateOf(isoOf(a)) - dateOf(isoOf(b))) / 864e5);

  function jdn(d) {
    const a = Math.floor((14 - (d.getMonth() + 1)) / 12);
    const y = d.getFullYear() + 4800 - a;
    const m = d.getMonth() + 1 + 12 * a - 3;
    return d.getDate() + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  }
  function coptic(d) {
    const j = jdn(d);
    const year = Math.floor((4 * (j - COPTIC_EPOCH) + 1463) / 1461);
    const start = COPTIC_EPOCH - 1 + 365 * (year - 1) + Math.floor(year / 4);
    const doy = j - start;
    const month = Math.floor((doy - 1) / 30) + 1;
    return { year, month, day: doy - 30 * (month - 1) };
  }
  function easter(y) {
    const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
    const month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
    return addDays(new Date(y, month - 1, day), 13);
  }

  // Fixed feasts (Coptic month, day) and monthly commemorations.
  const FEASTS = {
    '1-1': ['Koptiska nyåret (Nayrouz)', 'عيد النيروز'],
    '1-17': ['Korsets fest', 'عيد الصليب'],
    '4-29': ['Kristi födelse', 'عيد الميلاد المجيد'],
    '5-11': ['Herrens dop (Theofania)', 'عيد الغطاس المجيد'],
    '5-13': ['Bröllopet i Kana', 'عرس قانا الجليل'],
    '6-8': ['Herrens frambärande i templet', 'دخول المسيح الهيكل'],
    '7-29': ['Bebådelsen', 'عيد البشارة'],
    '9-24': ['Kristi ankomst till Egypten', 'دخول المسيح أرض مصر'],
    '11-5': ['Apostlarna Petrus och Paulus', 'عيد الرسولين بطرس وبولس'],
    '12-13': ['Kristi förklaring', 'عيد التجلي'],
    '12-16': ['Jungfru Marias upptagning', 'صعود جسد السيدة العذراء'],
  };
  function feastsFor(d) {
    const c = coptic(d);
    const out = [];
    const f = FEASTS[`${c.month}-${c.day}`];
    if (f) out.push({ sv: f[0], ar: f[1], kind: 'gold' });
    if (c.day === 12 && c.month !== 13) out.push({ sv: 'Ärkeängeln Mikaels minnesdag', ar: 'تذكار رئيس الملائكة ميخائيل', kind: '' });
    if (c.day === 21 && c.month !== 13) out.push({ sv: 'Jungfru Marias minnesdag', ar: 'تذكار السيدة العذراء', kind: '' });
    if (c.day === 29 && c.month !== 5 && c.month !== 6 && !f) out.push({ sv: 'Minnet av bebådelsen, födelsen och uppståndelsen', ar: 'تذكار البشارة والميلاد والقيامة', kind: '' });
    const e = easter(d.getFullYear());
    const k = dayDiff(d, e);
    const moveable = { 0: ['Påskdagen', 'عيد القيامة المجيد'], [-7]: ['Palmsöndagen', 'أحد الشعانين'], 39: ['Kristi himmelsfärd', 'عيد الصعود'], 49: ['Pingst', 'عيد العنصرة'] };
    if (moveable[k]) out.unshift({ sv: moveable[k][0], ar: moveable[k][1], kind: 'gold' });
    return out;
  }
  function seasonFor(d) {
    const c = coptic(d);
    const k = dayDiff(d, easter(d.getFullYear()));
    if (k >= -6 && k < 0) return ['Påskveckan', 'أسبوع الآلام', true];
    if (k >= -55 && k < -6) return ['Stora fastan', 'الصوم الكبير', true];
    if (k >= -69 && k <= -67) return ['Jonas fasta', 'صوم يونان', true];
    if (k >= 0 && k <= 49) return ['De femtio dagarna', 'الخماسين المقدسة', false];
    if ((c.month === 3 && c.day >= 16) || (c.month === 4 && c.day <= 28)) return ['Julfastan', 'صوم الميلاد', true];
    if (c.month === 12 && c.day <= 15) return ['Jungfru Marias fasta', 'صوم السيدة العذراء', true];
    if (k >= 50 && c.month >= 9 && (c.month < 11 || (c.month === 11 && c.day <= 4))) return ['Apostlarnas fasta', 'صوم الرسل', true];
    return null;
  }
  const isFastDay = (d) => {
    const k = dayDiff(d, easter(d.getFullYear()));
    const s = seasonFor(d);
    if (s && s[2]) return true;
    return (d.getDay() === 3 || d.getDay() === 5) && !(k >= 0 && k <= 49);
  };

  // Canonical hours: id from the Agpeya data, the time span when it is prayed.
  const HOURS = {
    baker: { from: 5, sv: 'Ca kl. 6, vid gryningen', ar: 'الصباح الباكر' },
    talta: { from: 8, sv: 'Ca kl. 9', ar: 'نحو التاسعة صباحاً' },
    sata: { from: 11, sv: 'Ca kl. 12, mitt på dagen', ar: 'وقت الظهر' },
    tas3a: { from: 14, sv: 'Ca kl. 15', ar: 'نحو الثالثة عصراً' },
    ghorob: { from: 16, sv: 'Vid solnedgången', ar: 'عند الغروب' },
    nom: { from: 19, sv: 'Före sänggåendet', ar: 'قبل النوم' },
    setar: { from: 22, sv: 'Sent på kvällen', ar: 'آخر المساء' },
    nos_lil: { from: 0, sv: 'Vid midnatt', ar: 'منتصف الليل' },
  };
  function hourNow(d = new Date()) {
    const h = d.getHours();
    let best = 'nos_lil';
    for (const [id, v] of Object.entries(HOURS)) if (h >= v.from && v.from >= HOURS[best].from) best = id;
    return h < 5 ? 'nos_lil' : best;
  }

  // ---------- State ----------

  const keys = Object.keys(DATA.katameros).sort();
  const todayIso = isoOf(new Date());
  const clampIso = (iso) => (!keys.length ? iso : iso < keys[0] ? keys[0] : iso > keys[keys.length - 1] ? keys[keys.length - 1] : iso);

  // First run follows the phone's language; the text language follows the app language.
  const deviceLang = (navigator.languages || [navigator.language || '']).some((l) => /^ar\b/i.test(l)) ? 'ar' : 'sv';
  const lang0 = store.get('lang', deviceLang);
  const primary0 = store.get('primary', lang0);
  const state = {
    tab: 'today',
    stack: [],
    hour: null,
    date: clampIso(todayIso),
    lang: lang0,
    primary: primary0, // the language a single page is read in: 'ar' | 'sv'
    show: store.get('show', primary0), // 'ar' | 'sv' | 'both'
    scale: store.get('scale', 1),
    read: store.get('read', 'auto'),
    spreadPref: store.get('spreadPref', 'auto'),
    spread: false,
    unfolded: false,
  };
  const t = () => T[state.lang];

  // ---------- Elements ----------

  const app = $('#app');
  const device = $('#device');
  const navbar = $('#navbar');
  const tabbar = $('#tabbar');
  const views = {
    today: $('[data-view="today"]'),
    readings: $('[data-view="readings"]'),
    agpeya: $('[data-view="agpeya"]'),
    hour: $('[data-view="hour"]'),
    bible: $('[data-view="bible"]'),
  };

  // ---------- Icons ----------

  const ICON = {
    today: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
    readings: '<path d="M3 5.6c2.6-1.1 5.6-1 9 .9 3.4-1.9 6.4-2 9-.9v13c-2.6-1.1-5.6-1-9 .9-3.4-1.9-6.4-2-9-.9z"/><path d="M12 6.5v13"/>',
    agpeya: '<path d="M12 2.8c1.3 1.5 1.7 2.8 0 4.3-1.7-1.5-1.3-2.8 0-4.3z"/><path d="M9.6 9.2h4.8v11H9.6zM7.5 20.4h9"/>',
    bible: '<path d="M6.5 3.5h11a1 1 0 0 1 1 1v15.7h-11A1.8 1.8 0 0 1 5.7 18.4V5.3a1.8 1.8 0 0 1 .8-1.8z"/><path d="M5.7 18.4a1.8 1.8 0 0 1 1.8-1.8h11M12 7v6M9.8 9.3h4.4"/>',
    gear: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.1"/><circle cx="9" cy="17" r="2.1"/>',
    book: '<path d="M2.8 5.5h7.4a1.8 1.8 0 0 1 1.8 1.8v12a1.6 1.6 0 0 0-1.6-1.6H2.8zM21.2 5.5h-7.4A1.8 1.8 0 0 0 12 7.3v12a1.6 1.6 0 0 1 1.6-1.6h7.6z"/>',
    phone: '<rect x="7" y="2.8" width="10" height="18.4" rx="2.4"/><path d="M10.5 18.2h3"/>',
    chevL: '<path d="M15 5l-7 7 7 7"/>',
    chevR: '<path d="M9 5l7 7-7 7"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.4"/>',
  };
  const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
  const cross = (cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><use href="#cc"/></svg>`;

  // ---------- Formatting ----------

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function gregText(d, lang) {
    return lang === 'ar'
      ? `${WD_AR[d.getDay()]} ${toAr(d.getDate())} ${GM_AR[d.getMonth()]} ${toAr(d.getFullYear())}`
      : `${cap(WD_SV[d.getDay()])} ${d.getDate()} ${GM_SV[d.getMonth()]} ${d.getFullYear()}`;
  }
  const copSv = (c) => `${c.day} ${MONTHS[c.month - 1][0]}`;
  const copAr = (c) => `${toAr(c.day)} ${MONTHS[c.month - 1][1]}`;
  const shortGreg = (d, lang) => (lang === 'ar' ? `${toAr(d.getDate())} ${GM_AR[d.getMonth()]}` : `${d.getDate()} ${GM_SV[d.getMonth()].slice(0, 3)}`);

  // ---------- Document model (reading pages) ----------

  function dayDoc(iso) {
    const entry = DATA.katameros[iso];
    const d = dateOf(iso);
    const c = coptic(d);
    return {
      runAr: copAr(c),
      runSv: `${copSv(c)} · ${WD_SV[d.getDay()]} ${d.getDate()} ${GM_SV[d.getMonth()]}`,
      titleAr: `اليوم ${ORD_AR[c.day - 1]} من شهر ${MONTHS[c.month - 1][1]}`,
      titleSv: `${cap(ORD_SV[c.day - 1])} dagen i månaden ${MONTHS[c.month - 1][0]}`,
      feasts: feastsFor(d),
      sections: (entry ? entry.sections : []).map((s) => ({ key: s.key, ar: s.ar, sv: s.sv, cap: s.caption, units: s.units })),
    };
  }
  function hourDoc(id) {
    const h = DATA.agpeya.find((x) => x.id === id);
    return {
      runAr: 'الأجبية', runSv: 'Agpeya',
      titleAr: h.ar, titleSv: h.sv, feasts: [],
      sections: [{ key: id, units: h.units }],
    };
  }

  function rowsOf(doc) {
    const rows = [{ k: 'run' }, { k: 'cart' }];
    if (doc.feasts.length) rows.push({ k: 'feast' });
    doc.sections.forEach((s, i) => {
      if (s.ar) { rows.push({ k: 'title', s }); rows.push({ k: 'cap', s }); }
      let prevC = null;
      s.units.forEach((u) => { rows.push({ k: 'u', u, showC: u.t === 'v' && prevC !== null && u.c !== prevC }); if (u.t === 'v') prevC = u.c; });
      if (i < doc.sections.length - 1) rows.push({ k: 'sep' });
    });
    return rows;
  }

  // side: 'ar' | 'sv' | 'both'
  function rowHtml(r, i, doc, side) {
    const A = side !== 'sv', S = side !== 'ar';
    const at = `data-row="${i}"`;
    switch (r.k) {
      case 'run':
        return `<div class="runhead ${side === 'ar' ? 'rtl' : ''}" ${at}>${side === 'sv' ? `<span dir="ltr">${esc(doc.runSv)}</span>`
          : side === 'ar' ? `<span lang="ar" dir="rtl">${esc(doc.runAr)}</span>` : `<span lang="ar" dir="rtl">${esc(doc.runAr)}</span> · <span dir="ltr">${esc(doc.runSv)}</span>`}</div>`;
      case 'cart':
        return `<div ${at}><div class="cartouche">${A ? `<span class="c-ar" lang="ar" dir="rtl">${esc(doc.titleAr)}</span>` : ''}${S ? `<span class="c-sv" dir="ltr">${esc(doc.titleSv)}</span>` : ''}</div></div>`;
      case 'feast':
        return `<div class="subtitle-row" ${at}>${doc.feasts.map((f) => (A ? `<div class="ar" lang="ar" dir="rtl">${esc(f.ar)}</div>` : '') + (S ? `<div class="sv" dir="ltr">${esc(f.sv)}</div>` : '')).join('')}</div>`;
      case 'title':
        return `<h2 class="rs-title" data-sec="${r.s.key}" ${at}>${side === 'sv' ? `<span class="sv big" dir="ltr">${esc(r.s.sv)}</span>`
          : `<span class="ar" lang="ar" dir="rtl">${esc(r.s.ar)}</span>${S ? `<span class="sv" dir="ltr">${esc(r.s.sv)}</span>` : ''}`}</h2>`;
      case 'cap':
        return `<p class="rs-cap" dir="ltr" ${at}>${S ? esc(r.s.cap) : ''}</p>`;
      case 'sep':
        return `<div class="sep" ${at}>${cross()}</div>`;
      case 'u': {
        const u = r.u;
        const vnA = u.t === 'v' ? `<sup class="vn">${toAr(r.showC ? `${u.c}:${u.n}` : u.n)}</sup>` : '';
        const vnS = u.t === 'v' ? `<sup class="vn">${r.showC ? `${u.c}:${u.n}` : u.n}</sup>` : '';
        const ar = u.t === 'ref' ? arRef(u.ar) : u.ar;
        return `<div class="u ${u.t} ${side === 'both' ? 'both' : ''}" ${at}>`
          + (A && ar ? `<p class="ar" lang="ar" dir="rtl">${vnA}${esc(ar)}</p>` : '')
          + (S && u.sv ? `<p class="sv" lang="sv" dir="ltr">${vnS}${esc(u.sv)}</p>` : '')
          + '</div>';
      }
      default: return '';
    }
  }

  // One page, one primary language. Every text unit also carries the other
  // language, folded away; tapping the unit unfolds it ("peek"). In "both"
  // mode the other language is always unfolded, set smaller as a subtitle.
  const PEEKABLE = new Set(['v', 'psalm', 'f', 'p']);
  const other = (l) => (l === 'ar' ? 'sv' : 'ar');
  const para = (l, html, cls = '') => `<p class="${l} ${cls}" lang="${l}" dir="${l === 'ar' ? 'rtl' : 'ltr'}">${html}</p>`;
  const fold = (inner) => `<div class="alt-wrap"><div class="alt-in">${inner}</div></div>`;

  function rowSingle(r, i, doc) {
    const P = state.primary, O = other(P);
    const at = `data-row="${i}"`;
    const pick = (o, l) => (l === 'ar' ? o.ar : o.sv);
    switch (r.k) {
      case 'run':
        return `<div class="runhead ${P === 'ar' ? 'rtl' : ''}" ${at}>${P === 'ar' ? `<span lang="ar" dir="rtl">${esc(doc.runAr)}</span>` : `<span dir="ltr">${esc(doc.runSv)}</span>`}</div>`;
      case 'cart': {
        const c = (l) => `<span class="c-${l} ${l === P ? 'pri' : ''}" lang="${l}" dir="${l === 'ar' ? 'rtl' : 'ltr'}">${esc(l === 'ar' ? doc.titleAr : doc.titleSv)}</span>`;
        return `<div ${at}><div class="cartouche">${c(P)}${c(O)}</div></div>`;
      }
      case 'feast':
        return `<div class="subtitle-row" ${at}>${doc.feasts.map((f) => para(P, esc(pick(f, P)), 'pri') + para(O, esc(pick(f, O)), 'sub')).join('')}</div>`;
      case 'title':
        return `<h2 class="rs-title" data-sec="${r.s.key}" ${at}>${P === 'ar'
          ? `<span class="ar" lang="ar" dir="rtl">${esc(r.s.ar)}</span><span class="sv" dir="ltr">${esc(r.s.sv)}</span>`
          : `<span class="sv big" dir="ltr">${esc(r.s.sv)}</span><span class="ar small" lang="ar" dir="rtl">${esc(r.s.ar)}</span>`}</h2>`;
      case 'cap':
        return `<p class="rs-cap" dir="ltr" ${at}>${esc(r.s.cap)}</p>`;
      case 'sep':
        return `<div class="sep" ${at}>${cross()}</div>`;
      case 'u': {
        const u = r.u;
        const num = r.showC ? `${u.c}:${u.n}` : u.n;
        const html = (l) => {
          let s = pick(u, l);
          if (!s) return '';
          if (u.t === 'ref' && l === 'ar') s = arRef(s);
          const vn = u.t === 'v' ? `<sup class="vn">${l === 'ar' ? toAr(num) : num}</sup>` : '';
          return vn + esc(s);
        };
        let pri = html(P), alt = html(O), pl = P;
        if (!pri) { pri = alt; alt = ''; pl = O; }
        if (!pri) return `<div class="u" ${at}></div>`;
        const tap = alt && PEEKABLE.has(u.t);
        return `<div class="u ${u.t}${tap ? ' tap' : ''}" ${at}${tap ? ' tabindex="0" aria-expanded="false"' : ''}>`
          + para(pl, pri) + (alt ? fold(para(other(pl), alt, 'alt')) : '') + '</div>';
      }
      default: return '';
    }
  }

  const frame = () => `<div class="frame" aria-hidden="true">${['tl', 'tr', 'bl', 'br'].map((p) => `<span class="corner ${p}">${cross()}</span>`).join('')}</div>`;

  function docHtml(doc) {
    const rows = rowsOf(doc);
    if (state.spread) {
      return `<div class="doc" data-mode="spread"><div class="spread" style="--rows:${rows.length}">
        <article class="page page-sv" lang="sv">${frame()}${rows.map((r, i) => rowHtml(r, i, doc, 'sv')).join('')}</article>
        <article class="page page-ar" lang="ar" dir="rtl">${frame()}${rows.map((r, i) => rowHtml(r, i, doc, 'ar')).join('')}</article>
      </div></div>`;
    }
    const mode = state.show === 'both' ? 'both' : 'single';
    return `<div class="doc" data-mode="${mode}" data-pri="${state.primary}">
      <article class="page page-single">${frame()}${rows.map((r, i) => rowSingle(r, i, doc)).join('')}</article></div>`;
  }

  // ---------- Shared pieces ----------

  function arch(ar, sv, cop) {
    return `<div class="arch" aria-hidden="true">
      <svg viewBox="0 0 300 232" fill="none" stroke="currentColor">
        <rect x="3" y="3" width="294" height="226" stroke-width="1.4"/>
        <rect x="7" y="7" width="286" height="218" stroke-width="0.7"/>
        <path d="M7 32H293M43 32V225M257 32V225" stroke-width="0.7"/>
        <text class="banner" x="150" y="24" text-anchor="middle" fill="currentColor" stroke="none" font-size="12.5">Ⲥⲩⲛ Ⲑⲉⲱ̄ Ⲓⲥⲭⲩⲣⲟⲥ · باسم الله القوي</text>
        <rect x="8" y="33" width="35" height="191" fill="url(#pat-med)" stroke="none"/>
        <rect x="257" y="33" width="35" height="191" fill="url(#pat-med)" stroke="none"/>
        <rect x="43.5" y="32.5" width="213" height="192" fill="url(#pat-lat)" stroke="none"/>
        <path d="M66 225V120C66 74 104 50 150 45C196 50 234 74 234 120V225Z" style="fill:var(--page)" stroke-width="1.3"/>
        <path d="M72 225V121C72 79 107 57 150 52C193 57 228 79 228 121V225" stroke-width="0.6"/>
      </svg>
      <div class="arch-text"><span class="a-cop">${esc(cop)}</span><span class="a-ar" lang="ar" dir="rtl">${esc(ar)}</span><span class="a-sv" dir="ltr">${esc(sv)}</span></div>
    </div>`;
  }

  function seg(key, opts, current) {
    return `<div class="seg" role="radiogroup" data-seg="${key}">${opts.map(([v, label]) =>
      `<button type="button" role="radio" aria-checked="${v === current}" data-v="${v}">${label}</button>`).join('')}<span class="seg-thumb" aria-hidden="true"></span></div>`;
  }
  function placeThumbs(root = app) {
    $$('.seg', root).forEach((s) => {
      const on = $('[aria-checked="true"]', s);
      const th = $('.seg-thumb', s);
      if (!on || !th || !s.offsetWidth) return;
      th.style.width = on.offsetWidth + 'px';
      th.style.transform = `translateX(${on.offsetLeft}px)`;
    });
  }

  // ---------- Views ----------

  function renderHome() {
    const L = t(), ar = state.lang === 'ar';
    const now = new Date();
    const c = coptic(now);
    const feasts = feastsFor(now);
    const season = seasonFor(now);
    const entry = DATA.katameros[todayIso];
    const hid = hourNow(now);
    const hour = DATA.agpeya.find((h) => h.id === hid);
    const lit = entry && entry.sections.find((s) => s.key === 'liturgy');
    const firstVerse = lit && lit.units.find((u) => u.t === 'v');
    const chips = [
      ...feasts.map((f) => `<span class="chip ${f.kind}">${esc(ar ? f.ar : f.sv)}</span>`),
      season ? `<span class="chip quiet">${esc(ar ? season[1] : season[0])}</span>` : '',
      isFastDay(now) && !(season && season[2]) ? `<span class="chip quiet">${L.fastDay}</span>` : '',
    ].join('');

    const dateCard = `<div class="datecard">${frame()}
      <div class="cop">${esc(MONTHS[c.month - 1][2])}</div>
      ${ar ? `<p class="big-ar" lang="ar" style="font-size:44px;margin:0">${esc(copAr(c))}</p><p class="big" dir="ltr" style="font-size:28px;margin-top:2px">${esc(copSv(c))}</p>`
        : `<p class="big">${esc(copSv(c))}</p><p class="big-ar" lang="ar" dir="rtl">${esc(copAr(c))} ${toAr(c.year)} ش</p>`}
      <p class="greg">${esc(gregText(now, state.lang))}<br>${esc(L.year(c.year))}</p>
      ${chips ? `<div class="chips">${chips}</div>` : ''}
    </div>`;

    const word = firstVerse ? `<div class="word">
      <div class="section-label">${L.word}</div>
      ${[state.primary, other(state.primary)].map((l, n) => para(l, esc(l === 'ar' ? firstVerse.ar : firstVerse.sv), n ? 'second' : '')).join('')}
      <p class="ref">${esc(ar ? arRef(lit.refs.ar[1]) : lit.refs.sv[1])}</p>
    </div>` : '';

    const hourCard = hour ? `<button class="hourcard" data-hour="${hid}" data-open-hour="${hid}">
      <span class="sun" aria-hidden="true"></span>
      <span class="eyebrow">${L.now} · ${esc(ar ? HOURS[hid].ar : HOURS[hid].sv)}</span>
      <span class="name">${esc(ar ? hour.ar : hour.sv)}</span>
      <span class="name-ar" ${ar ? 'dir="ltr"' : 'lang="ar"'}>${esc(ar ? hour.sv : hour.ar)}</span>
      <span class="go">${L.prayNow}</span>
    </button>` : '';

    const list = entry && entry.sections.length ? `<div>
      <div class="section-label">${L.todaysReadings}</div>
      <div class="list">${entry.sections.map((s) => `<button class="row-btn" data-jump="${s.key}">
        ${cross('ico')}
        <span><span class="t">${esc(ar ? s.ar : s.sv)}</span>${ar ? '' : `<span class="t-ar" lang="ar">${esc(s.ar)}</span>`}
        <span class="s" style="display:block">${esc((ar ? s.refs.ar.map(arRef) : s.refs.sv).join(' · '))}</span></span>
        <span></span>${icon('chevR', 'chev flip')}</button>`).join('')}</div>
    </div>` : '';

    views.today.innerHTML = `<div class="inner">
      <h1 class="large-title">${L.today}</h1>
      <p class="subtitle">${esc(gregText(now, state.lang))}</p>
      <div class="home-grid">
        <div class="home-col">${dateCard}${word}</div>
        <div class="home-col">${hourCard}${list}</div>
      </div>
    </div>`;
  }

  function renderReadings() {
    const L = t(), ar = state.lang === 'ar';
    const d = dateOf(state.date);
    const c = coptic(d);
    const entry = DATA.katameros[state.date];
    const i = keys.indexOf(state.date);
    const notices = [];
    if (state.date !== todayIso && clampIso(todayIso) !== todayIso && i !== -1 && (state.date === keys[0] || state.date === keys[keys.length - 1])) {
      notices.push(L.outside(shortGreg(dateOf(keys[0]), state.lang), shortGreg(dateOf(keys[keys.length - 1]), state.lang)));
    }
    if (entry && entry.season === 'holy_week') notices.push(L.holyWeek);
    if (entry && entry.approx) notices.push(L.approx);
    const doc = dayDoc(state.date);
    const tools = state.spread ? `<p class="spread-note">${icon('book')}${L.spreadNote}</p>` : '';

    views.readings.innerHTML = `<div class="inner">
      <h1 class="large-title">${L.readings}</h1>
      <div class="datebar">
        <button class="step glass" data-step="-1" aria-label="${L.prevDay}" ${i <= 0 ? 'disabled' : ''}>${icon('chevL', 'flip')}</button>
        <div class="when"><b>${esc(ar ? copAr(c) : copSv(c))} ${ar ? '' : `<span lang="ar" style="font-family:var(--f-ar);color:var(--label-2);font-weight:700">· ${esc(copAr(c))}</span>`}</b>
          <small>${esc(gregText(d, state.lang))}</small></div>
        ${state.date !== clampIso(todayIso) ? `<button class="pill-btn" data-go-today>${L.goToday}</button>` : ''}
        <button class="step glass" data-step="1" aria-label="${L.nextDay}" ${i >= keys.length - 1 ? 'disabled' : ''}>${icon('chevR', 'flip')}</button>
      </div>
      ${notices.map((n) => `<p class="notice">${esc(n)}</p>`).join('')}
      <div class="reader-tools">${tools}
        <div class="chips-row">${doc.sections.map((s) => `<button class="jump" data-jump="${s.key}">${esc(ar ? s.ar : s.sv)}</button>`).join('')}</div>
      </div>
    </div>
    <div class="inner">
      ${arch(`قراءات شهر ${MONTHS[c.month - 1][1]}`, L.readingsArch(MONTHS[c.month - 1][0]), MONTHS[c.month - 1][2])}
      ${docHtml(doc)}
    </div>`;
  }

  function renderAgpeya() {
    const L = t(), ar = state.lang === 'ar';
    const nowId = hourNow();
    views.agpeya.innerHTML = `<div class="inner">
      <h1 class="large-title">${L.agpeya}</h1>
      <p class="subtitle">${L.agpeyaSub}</p>
      ${arch('الأجبية', L.agpeyaArch, 'Ⲡⲓϣⲗⲏⲗ')}
      <div class="hours">${DATA.agpeya.map((h) => `<button class="hour-tile ${h.id === nowId ? 'now' : ''}" data-hour="${h.id}" data-open-hour="${h.id}">
        <span class="sun" aria-hidden="true"></span>
        ${h.id === nowId ? `<span class="now-badge">${L.now}</span>` : ''}
        <small>${esc(ar ? HOURS[h.id].ar : HOURS[h.id].sv)}</small>
        <b>${esc(ar ? h.ar : h.sv)}</b>
        <span class="h-ar" ${ar ? 'dir="ltr"' : 'lang="ar"'}>${esc(ar ? h.sv : h.ar)}</span>
      </button>`).join('')}</div>
    </div>`;
  }

  function renderHour() {
    if (!state.hour) { views.hour.innerHTML = ''; return; }
    const L = t(), ar = state.lang === 'ar';
    const h = DATA.agpeya.find((x) => x.id === state.hour);
    const tools = state.spread ? `<p class="spread-note">${icon('book')}${L.spreadNote}</p>` : '';
    views.hour.innerHTML = `<div class="inner">
      <h1 class="large-title">${esc(ar ? h.ar : h.sv)}</h1>
      <p class="subtitle">${esc(ar ? HOURS[h.id].ar : HOURS[h.id].sv)}</p>
      <div class="reader-tools">${tools}</div>
      ${docHtml(hourDoc(state.hour))}
    </div>`;
  }

  function renderBible() {
    const L = t(), ar = state.lang === 'ar';
    const group = (nt) => DATA.books.filter((b) => b.nt === nt).map((b) => `<button class="row-btn book-row" data-soon>
      ${icon('bible', 'ico')}
      <span><span class="t">${esc(ar ? b.ar : b.sv)}</span><span class="t-ar" ${ar ? 'dir="ltr"' : 'lang="ar"'}>${esc(ar ? b.sv : b.ar)}</span></span>
      <span class="meta">${esc(L.chapters(b.chapters))}</span>${icon('chevR', 'chev flip')}</button>`).join('');
    views.bible.innerHTML = `<div class="inner">
      <h1 class="large-title">${L.bible}</h1>
      <div class="banner-soon">${icon('info')}<div><b>${L.bibleSoon}</b>${L.bibleSoonText}</div></div>
      <div class="section-label">${L.nt}</div><div class="list">${group(true)}</div>
      <div class="section-label">${L.ot}</div><div class="list">${group(false)}</div>
    </div>`;
  }

  function renderSheet() {
    const L = t();
    $('#sheet').innerHTML = `<div class="grabber" aria-hidden="true"></div>
      <div class="sheet-head"><h2 id="sheet-title">${L.settings}</h2><button class="close-btn" data-close-sheet aria-label="${L.close}">${icon('x')}</button></div>
      <div class="set-group"><span class="lbl">${L.appLang}</span>${seg('lang', [['sv', 'Svenska'], ['ar', '<span class="ar-lbl">العربية</span>']], state.lang)}</div>
      <div class="set-group"><span class="lbl">${L.showTexts}</span>${seg('show', [['ar', `<span class="ar-lbl">${L.showAr}</span>`], ['both', L.showBoth], ['sv', L.showSv]], state.show)}<p class="help">${L.showTextsHelp}</p></div>
      <div class="set-group"><label for="size">${L.textSize}</label>
        <div class="size-row"><span class="a-small" aria-hidden="true">A</span><input id="size" type="range" min="0.85" max="1.6" step="0.05" value="${state.scale}"><span class="a-big" aria-hidden="true">A</span></div>
        <div class="preview"><p class="ar" lang="ar" dir="rtl">سبحوا الرب تسبيحاً جديداً</p><p class="sv" dir="ltr">Sjung för Herren en ny sång</p></div>
      </div>
      <div class="set-group"><span class="lbl">${L.readTheme}</span>
        <div class="swatches" role="radiogroup">${[['auto', 'linear-gradient(135deg,#fff 50%,#161314 50%)', '#888'], ['paper', '#fff', '#1b1718'], ['sepia', '#f7efe1', '#3a2c22'], ['night', '#161314', '#ebe3e0']].map(([v, bg, fg]) =>
          `<button class="swatch" role="radio" aria-checked="${state.read === v}" data-read="${v}"><i style="background:${bg};color:${fg}">${v === 'auto' ? '' : 'Aa'}</i>${L.themes[v]}</button>`).join('')}</div>
      </div>
      <div class="set-group"><span class="lbl">${L.spread}</span>${seg('spreadPref', Object.entries(L.spreadOpts), state.spreadPref)}<p class="help">${L.spreadHelp}</p></div>
      <div class="set-group about"><span class="lbl">${L.about}</span>${L.aboutText.map((p) => `<p>${esc(p)}</p>`).join('')}</div>`;
    requestAnimationFrame(() => placeThumbs($('#sheet')));
  }

  function renderChrome() {
    const L = t();
    app.lang = state.lang;
    app.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    app.style.setProperty('--scale', state.scale);
    if (state.read === 'auto') app.removeAttribute('data-read'); else app.dataset.read = state.read;
    $$('.tab', tabbar).forEach((b) => { $('span', b).textContent = L[b.dataset.tab]; b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)); });
    $('#fold-seg').outerHTML = seg('fold', [['folded', `${icon('phone')} ${L.folded}`], ['unfolded', `${icon('book')} ${L.unfolded}`]], state.unfolded ? 'unfolded' : 'folded').replace('class="seg"', 'class="seg glass" id="fold-seg"');
    $('#fold-caption').textContent = L.stageCaption;
    renderNav();
    placeLens();
    requestAnimationFrame(() => placeThumbs(document.body));
  }

  function currentView() {
    return state.tab === 'agpeya' && state.hour ? 'hour' : state.tab;
  }

  function renderNav() {
    const L = t(), v = currentView();
    const titles = { today: L.today, readings: L.readings, agpeya: L.agpeya, bible: L.bible, hour: '' };
    if (v === 'hour') { const h = DATA.agpeya.find((x) => x.id === state.hour); titles.hour = state.lang === 'ar' ? h.ar : h.sv; }
    const reader = v === 'readings' || v === 'hour';
    navbar.innerHTML = `<div class="nav-side">${v === 'hour' ? `<button class="nav-btn glass" data-back>${icon('chevL', 'flip')}<span>${L.back}</span></button>` : ''}</div>
      <div class="nav-title">${esc(titles[v])}</div>
      <div class="nav-side end">
        ${reader ? `<button class="nav-btn glass" data-book aria-pressed="${state.spread}" aria-label="${L.bookOn}">${icon('book')}</button>` : ''}
        <button class="nav-btn glass" data-open-sheet aria-label="${reader ? L.aa : L.settings}">${reader ? '<span style="font:600 17px/1 var(--f-sv)">Aa</span>' : icon('gear')}</button>
      </div>`;
    onScroll();
  }

  function renderAll() {
    renderChrome();
    renderHome();
    renderReadings();
    renderAgpeya();
    renderHour();
    renderBible();
    renderSheet();
    activate(false);
    updatePill();
  }
  const renderReaders = () => { renderReadings(); renderHour(); placeThumbs(app); };

  // ---------- Navigation ----------

  function activate() {
    const v = currentView();
    Object.entries(views).forEach(([k, el]) => {
      el.classList.toggle('active', k === v);
      el.classList.toggle('under', k === 'agpeya' && v === 'hour');
      el.dataset.reader = k === 'readings' || k === 'hour' ? '1' : '';
      el.setAttribute('aria-hidden', String(k !== v));
    });
    views.hour.classList.add('pushed');
    renderNav();
    tabbar.classList.remove('min');
    updateReading();
    requestAnimationFrame(() => placeThumbs(views[v]));
    if ((v === 'readings' || v === 'hour') && !state.spread && state.show !== 'both') hintOnce('peek', t().hintPeek(state.primary), 700);
  }

  function goTab(tab) {
    if (tab === state.tab) {
      if (state.hour && tab === 'agpeya') { state.hour = null; activate(); return; }
      views[currentView()].scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
      return;
    }
    state.tab = tab;
    $$('.tab', tabbar).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    placeLens();
    activate();
  }

  function openHour(id) {
    state.tab = 'agpeya';
    state.hour = id;
    renderHour();
    views.hour.scrollTop = 0;
    $$('.tab', tabbar).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === 'agpeya')));
    placeLens();
    activate();
  }

  function jumpTo(key) {
    if (state.tab !== 'readings') {
      if (state.date !== clampIso(todayIso)) { state.date = clampIso(todayIso); renderReadings(); }
      goTab('readings');
    }
    const view = views.readings;
    // offsetTop is immune to the view's scale-in transform, unlike getBoundingClientRect.
    const target = () => {
      const el = $(`[data-sec="${key}"]`, view);
      let top = 0;
      for (let n = el; n && n !== view; n = n.offsetParent) top += n.offsetTop;
      return el ? top - 70 : null;
    };
    const ready = document.fonts ? document.fonts.ready : Promise.resolve();
    ready.then(() => requestAnimationFrame(() => {
      const top = target();
      if (top == null) return;
      view.scrollTo({ top, behavior: reduced() ? 'auto' : 'smooth' });
      // Late font or layout changes can move the heading; correct once the scroll settles.
      view.addEventListener('scrollend', () => {
        const again = target();
        if (again != null && Math.abs(again - view.scrollTop) > 4) view.scrollTo({ top: again });
      }, { once: true });
    }));
  }

  function placeLens() {
    const on = $('.tab[aria-selected="true"]', tabbar);
    const lens = $('.lens', tabbar);
    if (!on || !lens) return;
    lens.style.width = on.offsetWidth + 'px';
    lens.style.transform = `translateX(${on.offsetLeft}px)`;
  }

  // ---------- Scroll behaviour ----------

  let lastY = 0;
  function onScroll() {
    const view = views[currentView()];
    if (!view) return;
    const y = view.scrollTop;
    navbar.classList.toggle('scrolled', y > 34);
    if (view.dataset.reader) {
      if (y > 160 && y - lastY > 6) tabbar.classList.add('min');
      else if (lastY - y > 6 || y < 60) tabbar.classList.remove('min');
    }
    lastY = y;
    requestAnimationFrame(placeLens);
  }
  Object.values(views).forEach((v) => v.addEventListener('scroll', () => { if (v.classList.contains('active')) onScroll(); }, { passive: true }));

  // ---------- Spread (open book) and folding ----------

  const SPREAD_MIN = 720;
  const wantSpread = (w) => state.spreadPref === 'on' || (state.spreadPref === 'auto' && w >= SPREAD_MIN);

  function captureAnchor(view) {
    const top = view.getBoundingClientRect().top + 70;
    for (const r of $$('.doc [data-row]', view)) {
      const b = r.getBoundingClientRect();
      if (b.bottom > top + 4) return { row: r.dataset.row, off: b.top - top };
    }
    return null;
  }
  function restoreAnchor(view, a) {
    if (!a) return;
    const el = $(`.page-ar [data-row="${a.row}"], .page-single [data-row="${a.row}"]`, view);
    if (!el) return;
    view.scrollTop += el.getBoundingClientRect().top - (view.getBoundingClientRect().top + 70) - a.off;
  }
  function setSwingY(view) {
    const p = view && $('.page-sv', view);
    if (!p) return;
    const vr = view.getBoundingClientRect();
    const y = vr.top + Math.min(view.clientHeight, window.innerHeight) / 2 - p.getBoundingClientRect().top;
    document.documentElement.style.setProperty('--swing-y', `${Math.max(0, y)}px`);
  }

  // A view-transition snapshot escapes its ancestors' clipping, so clip the
  // swinging page to the visible reading area by hand.
  function setVtClip(view) {
    const p = view && $('.page-sv', view);
    if (!p) return;
    const P = p.getBoundingClientRect(), C = view.getBoundingClientRect();
    const v = [C.top - P.top, P.right - C.right, P.bottom - C.bottom, C.left - P.left].map((n) => `${Math.max(0, n)}px`);
    document.documentElement.style.setProperty('--vt-clip', `inset(${v.join(' ')})`);
  }

  // The fold control and the resize observer can both ask for the same change;
  // remember the pending target so only one transition runs.
  let spreadTarget = null;
  let spreadPromise = Promise.resolve();
  let vtToken = 0;

  function setSpread(on, animate) {
    if (on === (spreadTarget ?? state.spread)) return spreadPromise;
    spreadTarget = on;
    const view = views[currentView()];
    const isReader = !!view.dataset.reader;
    const anchor = isReader ? captureAnchor(view) : null;
    if (!on) { setSwingY(view); setVtClip(view); }
    const apply = () => {
      state.spread = on;
      if (on) $('#toast').classList.remove('show'); // tap/peek hints don't apply to the spread
      renderReaders();
      renderNav();
      updateReading();
      if (anchor) restoreAnchor(view, anchor);
      if (on) { setSwingY(view); setVtClip(view); }
    };
    if (!animate || !isReader || reduced() || !document.startViewTransition) {
      apply();
      spreadTarget = null;
      const sp = on && animate && isReader && !reduced() && $('.spread', view);
      if (sp) { sp.classList.add('entering'); setTimeout(() => sp.classList.remove('entering'), 950); }
      return (spreadPromise = Promise.resolve());
    }
    const token = ++vtToken;
    document.documentElement.dataset.vt = on ? 'unfold' : 'fold';
    const vt = document.startViewTransition(apply);
    spreadPromise = vt.finished.catch(() => {}).finally(() => {
      if (token !== vtToken) return;
      delete document.documentElement.dataset.vt;
      spreadTarget = null;
    });
    return spreadPromise;
  }

  let foldBusy = false;
  const waitWidth = () => new Promise((res) => {
    const done = () => { device.removeEventListener('transitionend', onEnd); clearTimeout(tm); res(); };
    const onEnd = (e) => { if (e.target === device && e.propertyName === 'width') done(); };
    const tm = setTimeout(done, reduced() ? 30 : 900);
    device.addEventListener('transitionend', onEnd);
  });

  async function setUnfolded(on) {
    if (on === state.unfolded || foldBusy) return;
    state.unfolded = on;
    foldBusy = true;
    updateSeg('fold', on ? 'unfolded' : 'folded');
    if (on) {
      device.classList.add('unfolded');
      await waitWidth();
      foldBusy = false;
      await setSpread(wantSpread(device.clientWidth), true);
    } else {
      await setSpread(wantSpread(402), true);
      device.classList.remove('unfolded');
      await waitWidth();
      foldBusy = false;
    }
    renderHome();
    placeLens();
  }

  function syncSpread(animate) {
    if (foldBusy) return;
    const want = wantSpread(device.clientWidth);
    if (want !== state.spread) setSpread(want, animate);
  }

  function updateStage() {
    const staged = window.innerWidth >= 1000 && window.innerHeight >= 700;
    document.body.classList.toggle('staged', staged);
    if (!staged) { device.classList.remove('unfolded'); state.unfolded = false; }
  }

  new ResizeObserver(() => { syncSpread(true); placeLens(); placeThumbs(app); }).observe(device);
  window.addEventListener('resize', () => { updateStage(); });

  // ---------- Sheet ----------

  const sheet = $('#sheet');
  const backdrop = $('#backdrop');
  let lastFocus = null;
  function openSheet() {
    lastFocus = document.activeElement;
    renderSheet();
    sheet.classList.add('open');
    backdrop.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    setTimeout(() => { const b = $('[data-close-sheet]', sheet); if (b) b.focus({ preventScroll: true }); placeThumbs(sheet); }, 60);
  }
  function closeSheet() {
    sheet.classList.remove('open');
    backdrop.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    sheet.style.transform = '';
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  // Drag the sheet down to dismiss it.
  let drag = null;
  sheet.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.grabber, .sheet-head') || e.target.closest('button')) return;
    drag = { y: e.clientY, dy: 0 };
    sheet.classList.add('dragging');
    sheet.setPointerCapture(e.pointerId);
  });
  sheet.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.dy = Math.max(0, e.clientY - drag.y);
    sheet.style.transform = `translateY(${drag.dy}px)`;
  });
  const endDrag = () => {
    if (!drag) return;
    sheet.classList.remove('dragging');
    if (drag.dy > 110) closeSheet(); else sheet.style.transform = '';
    drag = null;
  };
  sheet.addEventListener('pointerup', endDrag);
  sheet.addEventListener('pointercancel', endDrag);

  // ---------- Toast ----------

  let toastTimer;
  function toast(msg, ms = 2200) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  function hintOnce(key, msg, delay = 0) {
    if (store.get('hint.' + key, false)) return;
    store.set('hint.' + key, true);
    setTimeout(() => toast(msg, 3800), delay);
  }

  // ---------- Text language ----------
  // A floating pill (ع | Sv) next to the tab bar switches the reading
  // language. Holding it shows both languages. Swiping sideways on the text
  // swaps languages, and tapping a verse unfolds it in the other language.

  const pill = $('#langpill');
  const SPRING = getComputedStyle(document.documentElement).getPropertyValue('--spring').trim() || 'ease-out';

  function updateReading() {
    const v = currentView();
    app.classList.toggle('reading', (v === 'readings' || v === 'hour') && !state.spread);
    requestAnimationFrame(() => { placePillLens(); placeLens(); });
  }

  function updatePill() {
    pill.setAttribute('aria-label', t().langSwitch);
    $$('[data-lp]', pill).forEach((b) => b.setAttribute('aria-pressed', String(state.show === 'both' || state.show === b.dataset.lp)));
    pill.classList.toggle('both', state.show === 'both');
    placePillLens();
  }

  function placePillLens() {
    const lens = $('.lp-lens', pill);
    const btns = $$('[data-lp]', pill);
    if (!pill.offsetWidth) return;
    const on = state.show === 'both' ? btns : btns.filter((b) => b.dataset.lp === state.show);
    const left = Math.min(...on.map((b) => b.offsetLeft));
    const right = Math.max(...on.map((b) => b.offsetLeft + b.offsetWidth));
    lens.style.width = `${right - left}px`;
    lens.style.transform = `translateX(${left}px)`;
  }

  function bouncePill() {
    pill.classList.remove('bounce');
    void pill.offsetWidth;
    pill.classList.add('bounce');
  }

  // Keep the reader's current verse in place while translations unfold.
  function holdAnchor(view, a, ms) {
    if (!a) return;
    const end = performance.now() + ms;
    const step = () => { restoreAnchor(view, a); if (performance.now() < end) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  let langBusy = false;
  async function setShow(show, primary = state.primary, dir = 0) {
    if (show === state.show && primary === state.primary) { bouncePill(); return; }
    if (langBusy) return;
    const view = views[currentView()];
    const reader = !!view.dataset.reader && !state.spread;
    const persist = () => { state.show = show; state.primary = primary; store.set('show', show); store.set('primary', primary); updatePill(); updateSeg('show', show); };

    // Only "both" on/off: unfold or fold the translations in place, no re-render.
    if (primary === state.primary && !state.spread) {
      const a = reader ? captureAnchor(view) : null;
      persist();
      $$('.doc[data-mode="single"], .doc[data-mode="both"]', app).forEach((doc) => {
        doc.dataset.mode = show === 'both' ? 'both' : 'single';
        $$('.u.peek', doc).forEach((u) => { u.classList.remove('peek'); u.setAttribute('aria-expanded', 'false'); });
      });
      holdAnchor(view, a, 600);
      return;
    }

    // Primary language changes: slide the page out, re-render, slide the new one in.
    langBusy = true;
    const docEl = reader && $('.doc', view);
    const a = reader ? captureAnchor(view) : null;
    const d = dir || (primary === 'sv' ? 1 : -1);
    const animate = docEl && docEl.animate && !reduced();
    if (animate) {
      await docEl.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${d * 16}px)` }],
        { duration: 120, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
    }
    persist();
    renderReaders();
    renderHome();
    if (a) restoreAnchor(view, a);
    const nd = animate && $('.doc', view);
    if (nd) {
      const frames = [{ opacity: 0, transform: `translateX(${-d * 22}px)` }, { opacity: 1, transform: 'none' }];
      try { nd.animate(frames, { duration: 480, easing: SPRING }); } catch { nd.animate(frames, { duration: 320, easing: 'ease-out' }); }
    }
    langBusy = false;
  }

  function pickLang(l) {
    const was = state.show;
    setShow(l, l);
    if (was !== l && was !== 'both') hintOnce('both', t().hintBoth, 600);
  }

  // Long-press on the pill toggles "both".
  let lpTimer = null;
  let lpFired = false;
  pill.addEventListener('pointerdown', () => {
    lpFired = false;
    clearTimeout(lpTimer);
    lpTimer = setTimeout(() => {
      lpFired = true;
      if (navigator.vibrate) navigator.vibrate(8);
      store.set('hint.both', true);
      setShow(state.show === 'both' ? state.primary : 'both');
    }, 450);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => pill.addEventListener(ev, () => clearTimeout(lpTimer)));
  pill.addEventListener('contextmenu', (e) => e.preventDefault());

  function togglePeek(u) {
    const on = u.classList.toggle('peek');
    u.setAttribute('aria-expanded', String(on));
    store.set('hint.peek', true);
  }

  // Sideways swipe on the text swaps the reading language (touch and pen only).
  let swipe = null;
  let swallowClick = false;
  document.addEventListener('pointerdown', (e) => {
    swipe = null;
    if (e.pointerType === 'mouse' || state.spread || !e.target.closest('.view.active .doc')) return;
    const r = app.getBoundingClientRect();
    if (e.clientX - r.left < 28 || r.right - e.clientX < 28) return;
    swipe = { x: e.clientX, y: e.clientY, t: performance.now() };
  }, { passive: true });
  document.addEventListener('pointercancel', () => { swipe = null; });
  document.addEventListener('pointerup', (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y, dt = performance.now() - swipe.t;
    swipe = null;
    if (Math.abs(dx) < 64 || Math.abs(dx) < 2 * Math.abs(dy) || dt > 700) return;
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 400);
    const np = other(state.primary);
    setShow(state.show === 'both' ? 'both' : np, np, Math.sign(dx));
  });

  // ---------- Settings ----------

  function updateSeg(key, v) {
    $$(`[data-seg="${key}"]`).forEach((s) => $$('button', s).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === v))));
    placeThumbs(document.body);
  }

  function setOption(key, v) {
    if (key === 'fold') { setUnfolded(v === 'unfolded'); return; }
    if (key === 'show') { setShow(v, v === 'both' ? state.primary : v); return; }
    if (state[key] === v) return;
    state[key] = v;
    store.set(key, v);
    updateSeg(key, v);
    if (key === 'lang') {
      // Switching the app language also makes it the reading language.
      state.primary = v;
      if (state.show !== 'both') state.show = v;
      store.set('primary', state.primary);
      store.set('show', state.show);
      renderAll();
      openSheetKeep();
      return;
    }
    if (key === 'spreadPref') {
      const w = device.clientWidth;
      setSpread(wantSpread(w), true);
    }
  }
  function openSheetKeep() {
    renderSheet();
    sheet.classList.add('open');
    backdrop.classList.add('open');
  }

  // ---------- Events ----------

  document.addEventListener('click', (e) => {
    if (swallowClick) { swallowClick = false; return; }
    const el = e.target.closest('button');
    if (!el) {
      const u = e.target.closest('.doc[data-mode="single"] .u.tap');
      if (u && !String(window.getSelection ? window.getSelection() : '').trim()) togglePeek(u);
      return;
    }
    const d = el.dataset;
    if (d.lp) { if (lpFired) { lpFired = false; return; } return pickLang(d.lp); }
    if (d.tab) return goTab(d.tab);
    if (el.closest('.seg') && d.v) return setOption(el.closest('.seg').dataset.seg, d.v);
    if (d.openHour) return openHour(d.openHour);
    if (d.back !== undefined) { state.hour = null; return activate(); }
    if (d.jump) return jumpTo(d.jump);
    if (d.step) {
      const i = keys.indexOf(state.date) + Number(d.step);
      if (i >= 0 && i < keys.length) { state.date = keys[i]; renderReadings(); placeThumbs(views.readings); }
      return;
    }
    if (d.goToday !== undefined) { state.date = clampIso(todayIso); renderReadings(); placeThumbs(views.readings); return; }
    if (d.book !== undefined) {
      const on = !state.spread;
      state.spreadPref = on ? 'on' : 'off';
      store.set('spreadPref', state.spreadPref);
      updateSeg('spreadPref', state.spreadPref);
      return setSpread(on, true);
    }
    if (d.openSheet !== undefined) return openSheet();
    if (d.closeSheet !== undefined) return closeSheet();
    if (d.read) {
      state.read = d.read;
      store.set('read', d.read);
      $$('.swatch', sheet).forEach((s) => s.setAttribute('aria-checked', String(s.dataset.read === d.read)));
      if (d.read === 'auto') app.removeAttribute('data-read'); else app.dataset.read = d.read;
      return;
    }
    if (d.soon !== undefined) return toast(t().soon);
  });
  backdrop.addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('open')) closeSheet();
    const u = (e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('.doc[data-mode="single"] .u.tap');
    if (u) { e.preventDefault(); togglePeek(u); }
  });
  tabbar.addEventListener('transitionend', (e) => { if (e.target.classList.contains('tab') && e.propertyName === 'width') placeLens(); });
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'size') return;
    state.scale = Number(e.target.value);
    store.set('scale', state.scale);
    app.style.setProperty('--scale', state.scale);
  });

  // Refresh the home screen when the canonical hour changes.
  let lastHour = hourNow();
  setInterval(() => { const h = hourNow(); if (h !== lastHour) { lastHour = h; renderHome(); renderAgpeya(); } }, 60000);

  // ---------- Boot ----------

  updateStage();
  state.spread = wantSpread(device.clientWidth);
  renderAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { placeThumbs(document.body); placeLens(); });
})();

/**
 * Picks the Katameros readings for any date and builds them into sections of
 * text. The selection rules follow the CopticPrayers app the texts come from:
 *
 *  1. Holy Week (Monday–Saturday before Easter) uses the Pascha book instead.
 *  2. Fixed feasts in FEAST_DAYS keep their own readings, even in Lent.
 *  3. Jonah's fast (Monday–Wednesday) and Jonah's Passover (Thursday).
 *  4. Great Lent, from the Saturday before it starts until Palm Sunday.
 *  5. The fifty days from Easter to Pentecost.
 *  6. A Sunday on the 29th (outside Kiahk–Amshir) takes the 29 Baramhat readings.
 *  7. Nativity paramoun and feast (see nativityRule).
 *  8. Theophany paramoun on 8–9 Touba when it is extended to Friday.
 *  9. The four Sundays of Kiahk, counted from the Nativity when it falls on a Monday.
 * 10. Other Sundays use the Sunday table for the Coptic month.
 * 11. Other days use the days table via days_relations.
 */
import { coptic, dayDiff, easter, isoDate, nativityRule, theophanyParamoun } from './coptic';
import { bookOfRef, parseRef, psalmLabel, psalmRefFromTable, refLabel, versesOf } from './refs';
import type { BibleBook, BookData, DayReadings, KatamerosData, ReadingRow, Season, Section, SectionKey, Unit } from './types';

/** Fixed feasts that keep their readings whatever the season (Coptic month-day). */
const FEAST_DAYS = new Set(['1-1', '1-17', '1-18', '1-19', '4-29', '4-30', '5-6', '5-10', '5-11', '5-12', '5-13',
  '6-8', '7-10', '7-29', '9-24', '11-5', '12-13', '12-16']);

/** In years when the Nativity falls on a Monday, these Sundays are the four Sundays of Kiahk. */
const KIAHK_SUNDAYS = new Set(['11-9', '11-16', '11-23', '11-30']); // month index-day, December

export interface Selection {
  season: Season;
  source: string;
  row: ReadingRow | null;
  /** Jonah's fast: the prophecy replaces the evening gospel. */
  prophecyReplacesVespers?: boolean;
}

export function selectReadings(d: Date, kat: KatamerosData): Selection {
  const c = coptic(d);
  const k = dayDiff(d, easter(d.getFullYear()));
  const wd = d.getDay();
  const md = `${c.month}-${c.day}`;
  const viaRelation = (key: string): [string, ReadingRow | null] => {
    const target = kat.relations[key] ?? key;
    return [target, kat.days[target] ?? null];
  };

  if (k >= -6 && k < 0) return { season: 'holy_week', source: 'pascha', row: null };
  if (FEAST_DAYS.has(md)) {
    const [target, row] = viaRelation(md);
    return { season: 'feast', source: `days ${target}`, row };
  }
  if (k >= -69 && k < -66) {
    const id = k + 69 + 52;
    return { season: 'jonah', source: `great_lent ${id}`, row: kat.lent[id], prophecyReplacesVespers: true };
  }
  if (k === -66) return { season: 'jonah', source: 'great_lent 55', row: kat.lent[55] };
  if (k >= -57 && k < -6) {
    const id = k + 57 + 1;
    return { season: 'lent', source: `great_lent ${id}`, row: kat.lent[id] };
  }
  // The data's 50th row is Pentecost itself.
  if (k >= 0 && k <= 49) return { season: 'fifty', source: `fifty_feast ${k + 1}`, row: kat.fifty[k + 1] };
  if (wd === 0 && c.day === 29 && (c.month < 4 || c.month > 6)) {
    return { season: 'sunday29', source: 'days 7-29', row: kat.days['7-29'] };
  }
  if (c.month === 4) {
    const nat = nativityRule(d);
    if (nat) return { season: nat === 28 ? 'nativity_paramoun' : 'nativity', source: `days 4-${nat}`, row: kat.days[`4-${nat}`] };
  }
  if (c.month === 5 && theophanyParamoun(c.day, wd)) {
    return { season: 'theophany_paramoun', source: 'days 5-10', row: kat.days['5-10'] };
  }
  if (wd === 0 && (c.month === 3 || c.month === 4) && KIAHK_SUNDAYS.has(`${d.getMonth()}-${d.getDate()}`)) {
    const b = Math.ceil(c.day / 7);
    const n = b === 5 ? 1 : b + 1;
    const row = kat.sundays.find((s) => s.month === 4 && s.n === n) ?? null;
    return { season: 'kiahk_sunday', source: `sundays 4-${n}`, row };
  }
  if (wd === 0) {
    const n = Math.ceil(c.day / 7);
    const row = n === 5 ? kat.sundays.find((s) => s.n === 5) : kat.sundays.find((s) => s.month === c.month && s.n === n);
    if (row) return { season: 'sunday', source: n === 5 ? 'sundays 5' : `sundays ${c.month}-${n}`, row };
  }
  const [target, row] = viaRelation(md);
  return { season: 'weekday', source: `days ${target}`, row };
}

// ---------- Building the text ----------

export interface BookSource {
  /** Resolve a whole book of the Bible (cached by the caller). */
  book(bid: number): Promise<BookData>;
}

const TITLES: Record<SectionKey, [ar: string, sv: string, capAr: string, capSv: string]> = {
  vespers: ['عشية', 'Aftontjänst', 'مزمور وإنجيل العشية', 'Kvällens psalm och evangelium'],
  matins: ['باكر', 'Morgontjänst', 'مزمور وإنجيل باكر', 'Morgonens psalm och evangelium'],
  prophecy: ['نبوات باكر', 'Morgonens profetior', 'قراءات من العهد القديم', 'Läsningar ur Gamla testamentet'],
  pauline: ['البولس', 'Paulus epistel', 'من رسائل بولس الرسول', 'Ur aposteln Paulus brev'],
  catholic: ['الكاثوليكون', 'Katholikon', 'من الرسائل الجامعة', 'Ur de allmänna breven'],
  praxis: ['الإبركسيس', 'Praxis', 'من سفر أعمال الرسل', 'Ur Apostlagärningarna'],
  liturgy: ['إنجيل القداس', 'Evangeliet', 'مزمور وإنجيل القداس', 'Liturgins psalm och evangelium'],
};

const fill = (text: string, value: string) => text.replace(/\s*\.{3,}\s*/g, ` ${value} `).replace(/ \./g, '.').trim();

/** The sections of a day in reading order, as references, before any text is loaded. */
export function plannedSections(sel: Selection): { key: SectionKey; psalmId?: number; psalmRef?: string; ref: string }[] {
  const r = sel.row;
  if (!r) return [];
  const out: { key: SectionKey; psalmId?: number; psalmRef?: string; ref: string }[] = [];
  const hasVespers = !!r.vespers_gospel && !sel.prophecyReplacesVespers;
  if (hasVespers) out.push({ key: 'vespers', psalmId: r.vespers_psalm_id, psalmRef: r.vespers_psalm, ref: r.vespers_gospel! });
  if (r.prophecies) out.push({ key: 'prophecy', ref: r.prophecies });
  if (r.matins_gospel) out.push({ key: 'matins', psalmId: r.matins_psalm_id, psalmRef: r.matins_psalm, ref: r.matins_gospel });
  if (r.pauline) out.push({ key: 'pauline', ref: r.pauline });
  if (r.catholic) out.push({ key: 'catholic', ref: r.catholic });
  if (r.praxis) out.push({ key: 'praxis', ref: r.praxis });
  if (r.gospel) out.push({ key: 'liturgy', psalmId: r.psalm_id, psalmRef: r.psalm, ref: r.gospel });
  return out;
}

export async function readingsFor(d: Date, kat: KatamerosData, books: BibleBook[], source: BookSource): Promise<DayReadings> {
  const sel = selectReadings(d, kat);
  const plan = plannedSections(sel);
  const needed = new Set(plan.flatMap((p) => parseRef(p.ref).map((x) => x.bid)));
  const loaded = new Map<number, BookData>();
  await Promise.all([...needed].map(async (bid) => loaded.set(bid, await source.book(bid))));

  const passageUnits = (ref: string, withRefLines: boolean): Unit[] => {
    const units: Unit[] = [];
    for (const [i, p] of parseRef(ref).entries()) {
      if (withRefLines) {
        const label = refLabel(ref.split('/')[i], books);
        units.push({ t: 'ref', ar: label.ar, sv: label.sv });
      }
      const verses = versesOf(loaded.get(p.bid)!, p);
      for (const { c, v } of verses) units.push({ t: 'v', c, n: v[0], ar: v[1], sv: v[2] });
      // One reference in the source data is impossible ("matt 17 : 29 - 23"); say so instead of showing nothing.
      if (!verses.length) {
        const label = refLabel(ref.split('/')[i], books);
        units.push({ t: 'note', ar: `نص ${label.ar} غير متوفر في المصدر.`, sv: `Texten för ${label.sv} saknas i källmaterialet.` });
      }
    }
    return units;
  };

  const sections: Section[] = plan.map((p) => {
    const [ar, sv, captionAr, captionSv] = TITLES[p.key];
    const label = refLabel(p.ref, books);
    const book = bookOfRef(p.ref);
    const units: Unit[] = [];
    const refs = { ar: [] as string[], sv: [] as string[] };

    if (p.key === 'vespers' || p.key === 'matins' || p.key === 'liturgy') {
      const psalm = p.psalmId != null ? kat.psalms[p.psalmId] : undefined;
      const pRef = p.psalmRef ?? (psalm ? psalmRefFromTable(psalm[0]) : '');
      const pLabel = pRef ? psalmLabel(pRef) : { ar: '', sv: '' };
      for (const [fa, fs] of kat.formulas.gospel) {
        if (fa === 'psalmShahed') { if (pRef) units.push({ t: 'ref', ...pLabel }); }
        else if (fa === 'psalm') { if (psalm) units.push({ t: 'psalm', ar: psalm[1], sv: psalm[2] }); }
        else if (fa === 'gospelShahed') units.push({ t: 'ref', ...label });
        else if (fa === 'gospel') units.push(...passageUnits(p.ref, false));
        else units.push({ t: 'f', ar: fill(fa, book[2] ?? book[1]), sv: fill(fs, book[3] ?? '') });
      }
      if (pRef) { refs.ar.push(pLabel.ar); refs.sv.push(pLabel.sv.replace('Psaltaren', 'Ps')); }
      refs.ar.push(label.ar);
      refs.sv.push(label.sv);
    } else {
      const group = kat.formulas[p.key === 'prophecy' ? 'prophecy' : p.key] ?? [];
      for (const [fa, fs] of group) {
        if (fa === 'shahed') { if (p.key !== 'prophecy') units.push({ t: 'ref', ...label }); }
        else if (fa === 'text') units.push(...passageUnits(p.ref, p.key === 'prophecy'));
        else units.push({ t: 'f', ar: fill(fa, book[2] ?? book[1]), sv: fill(fs ?? '', book[3] ?? '') });
      }
      refs.ar.push(label.ar);
      refs.sv.push(label.sv);
    }
    return { key: p.key, ar, sv, captionAr, captionSv, refs, units };
  });

  return { iso: isoDate(d), coptic: coptic(d), season: sel.season, source: sel.source, sections };
}

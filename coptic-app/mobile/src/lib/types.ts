export type Lang = 'ar' | 'sv';

/** One row of a Katameros table. References look like "matt 13 : 44 - 52". */
export interface ReadingRow {
  vespers_psalm?: string;
  vespers_psalm_id?: number;
  vespers_gospel?: string;
  matins_psalm?: string;
  matins_psalm_id?: number;
  matins_gospel?: string;
  pauline?: string;
  catholic?: string;
  praxis?: string;
  psalm?: string;
  psalm_id?: number;
  gospel?: string;
  prophecies?: string;
}

export interface KatamerosData {
  /** "month-day" → readings */
  days: Record<string, ReadingRow>;
  /** "month-day" → "month-day" of the days row to read instead */
  relations: Record<string, string>;
  sundays: (ReadingRow & { month: number | null; n: number })[];
  /** Great Lent (1–51), Jonah's fast (52–55) */
  lent: Record<string, ReadingRow>;
  /** The fifty days from Easter (1–50) */
  fifty: Record<string, ReadingRow>;
  /** id → [reference, arabic, swedish] */
  psalms: Record<string, [string, string, string]>;
  /** reading group → [arabic, swedish] lines; "shahed", "text", "psalm" etc. are placeholders */
  formulas: Record<string, [string, string][]>;
  /** liturgy gospel reference → its first verse [arabic, swedish], so "Today" needs no Bible book */
  openings?: Record<string, [string, string]>;
}

/** [verse number, arabic with diacritics, swedish] */
export type Verse = [number, string, string];
/** A whole book: [chapter number, verses][] */
export type BookData = [number, Verse[]][];

export interface BibleBook {
  bid: number;
  ar: string;
  sv: string;
  chapters: number;
  nt: boolean;
}

export type Role = 'priest' | 'deacon' | 'people';

/**
 * A unit of liturgical text.
 * p: paragraph · h/H: heading · f: liturgical formula · ref: Bible reference ·
 * psalm · v: verse (c = chapter, n = number) · role: speaker change ·
 * rubric: instruction · secret: prayed silently by the priest · note: about the source text ·
 * st: a stanza of a hymn, in Arabic (`ar`), in Coptic written in Arabic letters as it is sung (`ca`)
 * and in Coptic (`cop`), as far as each is known
 */
export interface Unit {
  t: 'p' | 'h' | 'H' | 'f' | 'ref' | 'psalm' | 'v' | 'role' | 'rubric' | 'secret' | 'note' | 'st';
  ar?: string;
  sv?: string;
  ca?: string;
  cop?: string;
  c?: number;
  n?: number;
  r?: Role;
}

export interface Prayer {
  id: string;
  ar: string;
  sv: string;
  units: Unit[];
}

export type SectionKey = 'vespers' | 'matins' | 'prophecy' | 'pauline' | 'catholic' | 'praxis' | 'synaxarium' | 'liturgy';

export interface Section {
  key: SectionKey;
  ar: string;
  sv: string;
  captionAr: string;
  captionSv: string;
  refs: { ar: string[]; sv: string[] };
  units: Unit[];
}

/** Why a day got the readings it got. */
export type Season =
  | 'holy_week'
  | 'feast'
  | 'jonah'
  | 'lent'
  | 'fifty'
  | 'sunday29'
  | 'nativity_paramoun'
  | 'nativity'
  | 'theophany_paramoun'
  | 'kiahk_sunday'
  | 'sunday'
  | 'weekday';

export interface CopticDate {
  year: number;
  month: number;
  day: number;
}

/** A prayer's name, without its text: what lists show before the text is loaded. */
export type PrayerIndex = Pick<Prayer, 'id' | 'ar' | 'sv'>;

/** A group of hymn texts, for one occasion or service; its hymns are read when it is opened. */
export interface HymnGroup {
  id: string;
  ar: string;
  sv: string;
  count: number;
}

/** A hymn text: the Arabic in paragraphs and, where they are known, the Coptic in Arabic letters and in Coptic. No Swedish. */
export interface Hymn {
  id: string;
  ar: string;
  /** Has the Coptic in Arabic letters and in Coptic (from the Coptish Datastore) */
  ca?: boolean;
  units: Unit[];
}

/** Which forms of a hymn the reader shows: Arabic with the Coptic in Arabic letters under it, or one of the three alone. */
export type HymnMode = 'arca' | 'ar' | 'ca' | 'cop';

/** One commemoration of the Synaxarium: its title and its account, in Arabic. */
export interface SynaxEntry {
  title: string;
  paras: string[];
}

/** A hymn book of the Alhan section: its pages as images (the hazzat are drawings), and its contents. */
export interface AlhanBook {
  id: string;
  ar: string;
  sv: string;
  subAr: string;
  subSv: string;
  /** Who published the book */
  source: string;
  cover: { src: number; w: number; h: number };
  /** Ink masks, in reading order; `no` is the number printed on the page */
  pages: { src: number; w: number; h: number; no: number }[];
  /** The book's parts and what is in them; `page` is an index into `pages` */
  parts: { ar: string; sv: string; page: number; items: { ar: string; sv: string; page: number }[] }[];
}

/** A section's titles and references, before any text is loaded. */
export interface SectionOverview extends Omit<Section, 'units'> {
  ref: string;
}

/** A day's readings as titles and references only: enough for a list, with no Bible books loaded. */
export interface DayOverview extends Omit<DayReadings, 'sections'> {
  sections: SectionOverview[];
}

export interface DayReadings {
  /** The Gregorian date, YYYY-MM-DD */
  iso: string;
  coptic: CopticDate;
  season: Season;
  /** Which table row was used, e.g. "days 4-28" — for checking against the printed Katameros. */
  source: string;
  sections: Section[];
}

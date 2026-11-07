/** Which group of hymn texts belongs to a day: the feast it is, or the season it is in; and how a hymn begins. */
import { coptic, dayDiff, easter } from './lib/coptic';
import type { Hymn } from './lib/types';

/** How a hymn begins: in Coptic (in Arabic letters, by which it is known) where there is, else in Arabic. */
export const incipit = (h: Hymn) =>
  h.units.find((u) => u.ca)?.ca ?? h.units.find((u) => u.ar && (u.t === 'st' || u.t === 'p'))?.ar ?? h.units.find((u) => u.cop)?.cop ?? '';

/** Feasts on a fixed day of the Coptic year: "month-day" → group. */
const FIXED: Record<string, string> = {
  '5-6': '19', // the Circumcision
  '5-11': '16', // Theophany
  '5-13': '23', // the wedding at Cana
  '6-8': '18', // the Entry into the Temple
  '7-29': '10', // the Annunciation
  '9-24': '17', // the Entry into Egypt
  '11-5': '24', // the Apostles
  '12-13': '22', // the Transfiguration
};

/** Feasts and days counted from Easter: days from Easter → group. */
const MOVEABLE: Record<number, string> = {
  [-8]: '09', // Lazarus Saturday
  [-7]: '12', // Palm Sunday
  [-3]: '20', // Covenant Thursday
  7: '21', // Thomas Sunday
  39: '11', // the Ascension
  49: '14', // Pentecost
};

/** The group of hymns for a day, or null on a day with none of its own (the annual ones then apply). */
export function hymnGroupFor(d: Date): string | null {
  const c = coptic(d);
  const k = dayDiff(d, easter(d.getFullYear()));
  if (MOVEABLE[k]) return MOVEABLE[k];
  // The Nativity is kept on 7 January.
  if (d.getMonth() === 0 && d.getDate() === 7) return '13';
  const fixed = FIXED[`${c.month}-${c.day}`];
  if (fixed) return fixed;
  if (k >= -6 && k < 0) return '06'; // Holy Week
  if (k >= -55 && k < -6) return '05'; // Great Lent
  if (k >= -69 && k <= -67) return '08'; // the fast of Nineveh
  if (k >= 0 && k <= 49) return '15'; // the Holy Fifty Days
  if (c.month === 1 && c.day >= 17 && c.day <= 19) return '26'; // the Cross
  if (c.month === 1 && c.day <= 16) return '25'; // Nayrouz, until the Cross
  if (c.month === 4) return '04'; // Kiahk
  // The Apostles' fast: from the day after Pentecost to 5 Abib.
  if (k >= 50 && (c.month === 9 || c.month === 10 || (c.month === 11 && c.day < 5))) return '07';
  return null;
}

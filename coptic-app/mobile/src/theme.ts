/**
 * Design tokens. App chrome follows the system light/dark setting; the
 * reading page has its own themes (paper, sepia, night) like a book app.
 * Crimson and the double rule come from the printed Katameros.
 */
export interface Palette {
  bg: string;
  bg2: string;
  surface: string;
  label: string;
  label2: string;
  label3: string;
  sep: string;
  crimson: string;
  gold: string;
  tint: string;
  lens: string;
  glass: string;
  glassEdge: string;
  shadow: string;
}

export interface PagePalette {
  page: string;
  ink: string;
  ink2: string;
  rule: string;
  rule2: string;
  peek: string;
  /** The deacon's colour in the liturgies */
  gold: string;
  /** Liturgical formulas ("Välsignad är han som kommer …"): a deep wine red, set apart from the crimson rubrics */
  formula: string;
}

export const LIGHT: Palette = {
  bg: '#F3F1F2',
  bg2: '#E8E3E6',
  surface: '#FFFFFF',
  label: '#1D1A1C',
  label2: '#6C6268',
  label3: '#9B9197',
  sep: 'rgba(72,40,56,0.13)',
  crimson: '#AD263D',
  gold: '#976F22',
  tint: 'rgba(173,38,61,0.09)',
  lens: 'rgba(173,38,61,0.11)',
  glass: 'rgba(255,255,255,0.72)',
  glassEdge: 'rgba(255,255,255,0.85)',
  shadow: 'rgba(52,22,36,0.22)',
};

export const DARK: Palette = {
  bg: '#0F0D0E',
  bg2: '#1D191B',
  surface: '#1C181A',
  label: '#F4EFF1',
  label2: '#A99FA4',
  label3: '#786E73',
  sep: 'rgba(255,236,244,0.12)',
  crimson: '#EC6A7F',
  gold: '#D4AB55',
  tint: 'rgba(236,106,127,0.14)',
  lens: 'rgba(236,106,127,0.2)',
  glass: 'rgba(40,34,37,0.7)',
  glassEdge: 'rgba(255,255,255,0.14)',
  shadow: 'rgba(0,0,0,0.6)',
};

export type ReadTheme = 'auto' | 'paper' | 'sepia' | 'night';

export const PAGES: Record<Exclude<ReadTheme, 'auto'>, PagePalette> = {
  paper: { page: '#FFFFFF', ink: '#1B1718', ink2: '#625759', rule: '#C0384E', rule2: '#E09AA5', peek: 'rgba(192,56,78,0.06)', gold: '#94701F', formula: '#7E1D30' },
  sepia: { page: '#F7EFE1', ink: '#3A2C22', ink2: '#7A6553', rule: '#B4424F', rule2: '#D9A59A', peek: 'rgba(180,66,79,0.07)', gold: '#8A651A', formula: '#7A2232' },
  night: { page: '#161314', ink: '#EBE3E0', ink2: '#A3989A', rule: '#D56478', rule2: '#7A3B47', peek: 'rgba(213,100,120,0.1)', gold: '#D9B25E', formula: '#E3A3AE' },
};

export const FONTS = {
  ar: 'Amiri_400Regular',
  arBold: 'Amiri_700Bold',
  sv: 'Literata_400Regular',
  svItalic: 'Literata_400Regular_Italic',
  svSemi: 'Literata_600SemiBold',
  cop: 'NotoSansCoptic_400Regular',
};

/** Sky gradients for the canonical hours, from dawn to midnight. */
export const HOUR_SKY: Record<string, { colors: [string, string, ...string[]]; dark: boolean; moon?: boolean }> = {
  baker: { colors: ['#FBD89C', '#F3A585', '#D895A8'], dark: false },
  talta: { colors: ['#7FC0EF', '#BFE1F6'], dark: false },
  sata: { colors: ['#2F8FDA', '#8DCCF3'], dark: true },
  tas3a: { colors: ['#F0BB5D', '#E07F4C'], dark: false },
  ghorob: { colors: ['#EF8A59', '#B53A5C', '#5F2A6C'], dark: true },
  nom: { colors: ['#424A9A', '#1B1F4D'], dark: true, moon: true },
  setar: { colors: ['#2C255B', '#110E2B'], dark: true, moon: true },
  nos_lil: { colors: ['#0A1027', '#1E2A5C'], dark: true, moon: true },
};

export const SPRING = { damping: 18, stiffness: 220, mass: 1 };
/** Nearly critically damped: settles without a visible bounce. For sheets, bars and page moves. */
export const SPRING_SMOOTH = { damping: 28, stiffness: 240, mass: 1 };
export const SPRING_LIVELY = { damping: 14, stiffness: 240, mass: 0.9 };
export const SPREAD_MIN_WIDTH = 720;
/** Below this the open book's pages hold only a few lines (a phone on its side), so the text scrolls instead. */
export const SPREAD_MIN_HEIGHT = 520;

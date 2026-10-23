/**
 * Drawings of the Lucide icons the app uses (lucide-react-native 1.61.0, ISC
 * licence, https://lucide.dev), copied by scripts/lucide_icons.mjs so that only
 * these icons, not the whole set, end up in the app. Do not edit by hand.
 */
export type LucideNode = [tag: 'path' | 'circle' | 'rect' | 'line' | 'polyline' | 'polygon' | 'ellipse', attrs: Record<string, string>][];

export const LUCIDE: Record<string, LucideNode> = {
  'a-large-small': [
    ["path", { d: "m15 16 2.536-7.328a1.02 1.02 1 0 1 1.928 0L22 16" }],
    ["path", { d: "M15.697 14h5.606" }],
    ["path", { d: "m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16" }],
    ["path", { d: "M3.304 13h6.392" }]
  ],
  'book-open': [
    ["path", { d: "M12 5v16" }],
    [
      "path",
      {
        d: "M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"
      }
    ]
  ],
  'book-open-text': [
    ["path", { d: "M12 5v16" }],
    ["path", { d: "M16 13h2" }],
    ["path", { d: "M16 9h2" }],
    [
      "path",
      {
        d: "M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"
      }
    ],
    ["path", { d: "M6 13h2" }],
    ["path", { d: "M6 9h2" }]
  ],
  'calendar': [
    ["path", { d: "M8 2v3" }],
    ["path", { d: "M16 2v3" }],
    ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }],
    ["path", { d: "M3 9h18" }]
  ],
  'chevron-down': [["path", { d: "m6 9 6 6 6-6" }]],
  'chevron-left': [["path", { d: "m15 18-6-6 6-6" }]],
  'chevron-right': [["path", { d: "m9 18 6-6-6-6" }]],
  'chevron-up': [["path", { d: "m18 15-6-6-6 6" }]],
  'info': [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M12 16v-4" }],
    ["path", { d: "M12 8h.01" }]
  ],
  'list': [
    ["path", { d: "M3 5h.01" }],
    ["path", { d: "M3 12h.01" }],
    ["path", { d: "M3 19h.01" }],
    ["path", { d: "M8 5h13" }],
    ["path", { d: "M8 12h13" }],
    ["path", { d: "M8 19h13" }]
  ],
  'printer': [
    [
      "path",
      {
        d: "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
      }
    ],
    ["path", { d: "M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" }],
    ["rect", { x: "6", y: "14", width: "12", height: "8", rx: "1" }]
  ],
  'search': [
    ["path", { d: "m21 21-4.34-4.34" }],
    ["circle", { cx: "11", cy: "11", r: "8" }]
  ],
  'share': [
    ["path", { d: "M12 2v13" }],
    ["path", { d: "m16 6-4-4-4 4" }],
    ["path", { d: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" }]
  ],
  'sliders-horizontal': [
    ["path", { d: "M10 5H3" }],
    ["path", { d: "M12 19H3" }],
    ["path", { d: "M14 3v4" }],
    ["path", { d: "M16 17v4" }],
    ["path", { d: "M21 12h-9" }],
    ["path", { d: "M21 19h-5" }],
    ["path", { d: "M21 5h-7" }],
    ["path", { d: "M8 10v4" }],
    ["path", { d: "M8 12H3" }]
  ],
  'smartphone': [
    ["rect", { width: "14", height: "20", x: "5", y: "2", rx: "2", ry: "2" }],
    ["path", { d: "M12 18h.01" }]
  ],
  'sun': [
    ["circle", { cx: "12", cy: "12", r: "4" }],
    ["path", { d: "M12 2v2" }],
    ["path", { d: "M12 20v2" }],
    ["path", { d: "m4.93 4.93 1.41 1.41" }],
    ["path", { d: "m17.66 17.66 1.41 1.41" }],
    ["path", { d: "M2 12h2" }],
    ["path", { d: "M20 12h2" }],
    ["path", { d: "m6.34 17.66-1.41 1.41" }],
    ["path", { d: "m19.07 4.93-1.41 1.41" }]
  ],
  'x': [
    ["path", { d: "M18 6 6 18" }],
    ["path", { d: "m6 6 12 12" }]
  ],
};

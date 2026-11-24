---
name: kevin-powell-css
description: Använd när du ska bygga, skriva eller granska HTML och CSS för en webbplats (t.ex. en kundsajt) och vill följa Kevin Powells moderna, responsiva arbetssätt: mobile-first, intrinsiska layouter, tokens, fluid typografi och tillgänglighet.
---

# Bygg HTML & CSS på Kevin Powells sätt

Bygger på Kevin Powells material (YouTube @kevinpowell, kevinpowell.co, Modern CSS Fundamentals, New CSS Toolkit 2026, hans starter-template på GitHub). Han bygger öppet vidare på Andy Bell (reset, flow), Jen Simmons (intrinsic design) och Every Layout (cluster, pile). Hans senare material väger tyngre än äldre artiklar.

## Grundsyn
- Webben är redan responsiv utan CSS. Det är vi som förstör det. Jobba med webbläsarens standardbeteenden, inte emot dem.
- Ingen pixelperfektion: undvik absoluta mått. Ge saker utrymme att krympa (`max-inline-size`), inte låsta `width`/`height`.
- Inga plåster på plåster. När något flödar över, ta reda på varför (kaskaden, layoutläge, box-modell) innan du lägger till en till regel.
- Intrinsiska mönster först. Media- eller container-queries bara där innehållet kräver det.

## Arbetsordning
1. **Analysera designen** (alla sidor och lägen) innan du skriver kod. Leta upprepningar i typografi, färger, layout och komponenter. Namnge saker efter vad de är (inte `.box-7`). Hellre en delad stil plus modifierare än nästan-dubbletter.
2. **Semantisk HTML** för hela sidan först (`header`, `nav`, `main`, `section`, `footer`, rätt rubriknivåer, `alt` på alla bilder, `alt=""` för dekorativa). Ostylad sida ska vara läsbar och staplad.
3. **Reset + tokens** (se nedan).
4. **Typografi först**: body-storlek, sedan rubrikskala, line-height, marginaler på text. Det är ofta större delen av mobilutseendet.
5. **Färger, bakgrunder, padding, wrapper.**
6. **Layout**: flex/grid, intrinsiska mönster, sedan `min-width`-queries för mer komplexitet. Container queries för komponenter som hamnar i smala ytor.
7. **Testa** smalt, brett och allt däremellan. Testa långa texter och zoom.

## Startkod

```css
@layer reset, base, layout, components, utilities;

@layer reset {
  *, *::before, *::after { box-sizing: border-box; }
  * { margin: 0; padding: 0; font: inherit; }
  html { color-scheme: light dark; }
  body { min-height: 100vh; line-height: 1.5; }
  h1, h2, h3, h4 { line-height: 1.1; text-wrap: balance; }
  p { text-wrap: pretty; }
  img, picture, svg, video { display: block; max-inline-size: 100%; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
  }
}

@layer base {
  :root {
    --ff-base: system-ui, sans-serif;
    --ff-accent: Georgia, serif;
    --fs-400: 1rem;
    --fs-500: 1.125rem;
    --fs-600: 1.5rem;
    --fs-700: 2rem;
    --fs-800: clamp(2rem, 4vi + 1rem, 3rem);
    --fs-900: clamp(2.5rem, 5vi + 1rem, 4rem);
    --clr-neutral-100: #fff;
    --clr-neutral-900: #1a1a1a;
    --clr-accent-400: #c2410c;
  }
  @media (width > 45em) {
    :root { --fs-600: 1.75rem; --fs-700: 2.5rem; }
  }
  body { font-family: var(--ff-base); font-size: var(--fs-400); color: var(--clr-neutral-900); }
}
```

Tokens ändras i media queries. Komponenter använder tokens, aldrig hårdkodade värden. Namngivning: `--fs-400…900`, `--clr-<roll>-<nyans>`, `--ff-base/accent`. Fontstorlekar är inte låsta till `h1`/`h2`.

## Layout-primitiver

```css
@layer layout {
  .wrapper {
    max-inline-size: 70rem;
    margin-inline: auto;
    padding-inline: 1rem;
  }
  .wrapper[data-width="narrow"] { max-inline-size: 45rem; }

  .section { padding-block: clamp(3rem, 8vh, 6rem); }

  .cluster { display: flex; flex-wrap: wrap; gap: var(--cluster-gap, 1rem); align-items: center; }

  .auto-grid {
    display: grid;
    gap: var(--grid-gap, 1.5rem);
    grid-template-columns: repeat(auto-fit, minmax(min(var(--min-col, 250px), 100%), 1fr));
  }

  .even-columns { display: grid; gap: var(--grid-gap, 1.5rem); }
  @media (width > 45em) {
    .even-columns { grid-auto-flow: column; grid-auto-columns: 1fr; }
  }

  .flow > * + * { margin-block-start: var(--flow-space, 1em); }
}
```

- Kalla det `.wrapper`, inte `.container` (krockar med container queries).
- `min()` i `minmax()` förhindrar överflöd på små skärmar.
- `auto-fit` kollapsar tomma spår, `auto-fill` behåller dem.
- `gap` mellan flex/grid-barn, `.flow` för vertikal rytm i textinnehåll, `padding-block` för sektioner.
- Fullbredds-band: wrapper inuti en fullbredds-sektion, eller ett sidgrid med namngivna linjer (content / breakout / full-width).

## Regler att följa
- **Mobile-first**: basstilar staplade, lägg till komplexitet med `min-width` / `width >`. Om du återställer till standardvärden i en query är det en varningssignal. Undantag okej (t.ex. något som bara är absolut positionerat på mobil).
- **Brytpunkter från innehållet**, inte från enhetsnamn. Använd modern range-syntax och nästling.
- **Enheter**: `rem` för typografi, aldrig `px` på `font-size`. `em` när något ska skala med elementets egen text (knapp-padding `0.75em 2em`, eyebrow `0.75em`). Enhetslös `line-height` (body 1.5–1.6, rubriker ~1.1).
- **Fluid typografi**: aldrig rå viewport-enhet som `font-size`. Använd `clamp(rem, vi + rem, rem)` så zoom fungerar, främst för stora rubriker. Om fluid text ska sluta växa vid wrapperns maxbredd, gör wrappern till container och använd `cqi`.
- **Logiska egenskaper** överallt: `inline-size`, `margin-inline`, `padding-block`, `max-inline-size`.
- **Inga fasta höjder**. Padding räcker oftast; `min-block-size` bara när det verkligen behövs.
- **Container queries** (`container-type: inline-size` + `@container`) när en komponent beror på sin egen yta, inte viewporten.
- **`:has()`** för relationella stilar (kort med bild, formulär med fel, osv.).
- **Progressiv förbättring**: säkert värde först, nyare värde efter, eller `@supports`.
- **Organisering**: cascade layers (reset, base, layout, components, utilities). Komponenter + varianter via `data-type` eller BEM-modifierare. Nästla max en nivå.
- **Tillgänglighet**: `:focus-visible` (ta aldrig bort outline utan ersättning), `:hover, :focus-visible` tillsammans, `font: inherit` på formulärfält, kontrast, `prefers-reduced-motion`. Lite letter-spacing bara på versaler, aldrig på brödtext. Felsök saknad alt med `img:not([alt]) { outline: 5px solid red; }`.

## Vanliga misstag att undvika
- Desktop-first som sedan nollställs för mobil.
- Fasta bredder/höjder som ger horisontell scroll.
- `px`- eller rena `vw`-fontstorlekar.
- För tät body-line-height eller 1.5 på stora rubriker.
- Media queries för ett komponentproblem som container queries löser.
- Globala regler placerade efter en media query så att de alltid vinner.
- För breda descendant-selektorer, för djup nästling.
- Att hoppa rakt in i kod element för element utan plan.

## Felsökning
DevTools först: kolla överstrukna eller ogiltiga deklarationer och egenskaper som inte gäller i sammanhanget (t.ex. `top` utan `position`). Använd grid/flex-overlays (Firefox är bra). Hitta överflöd genom att markera element. Ändra en egenskap i taget och förstå varför innan du lägger till fler.

## Leverans
Vid ny sajt: lämna semantisk HTML + en CSS-fil i ordningen ovan (layers, tokens, layout, komponenter, utilities), plus en kort lista med vilka brytpunkter som används och varför. Vid granskning: lista avvikelser från reglerna ovan, med föreslagen fix.

## Källor
- https://css-fundamentals.kevinpowell.co/
- https://new-css-toolkit-2026.kevinpowell.co/
- https://github.com/kevin-powell/website-starter-template-v3
- https://www.kevinpowell.co/articles/
- https://www.youtube.com/@kevinpowell

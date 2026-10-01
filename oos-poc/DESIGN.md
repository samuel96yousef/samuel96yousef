# Designfilosofi: Lugn yta, sann bild

OOS ska ge organisationen en gemensam och ärlig bild av verkligheten. Gränssnittet ska därför vara lugnt och ärligt. Det ska kännas som ett verktyg man litar på, inte som en dashboard som vill imponera.

Filosofin kommer från problembeskrivningarna. Där står att ett arbetssätt ska fungera i verkligheten, inte bara vara elegant i teorin. Operativsystemet ska också *obönhörligt synliggöra den faktiska situationen, även när verkligheten är obekväm* (problem 11).

## Fem principer

**1. Innehållet är gränssnittet.**
Struktur skapas med luft, typografi och hårfina linjer. Det finns inga rutor runt allt, inga skuggor och inga ikoner som dekoration. En ikon används bara när den är själva knappen, till exempel stäng, sök eller ändra.

**2. Färg betyder avvikelse.**
Ytan är svartvit. Gult betyder nära gränsen och rött betyder över gränsen. Allt som är som det ska vara är neutralt. Om allt har färg sticker ingenting ut.

**3. Siffror i klartext.**
Timmar är den gemensamma valutan. Varje vy börjar med det viktigaste. Översikten sammanfattar läget i en mening som går att säga högt på ett möte. Siffror står alltid med enhet och period.

**4. Människor och namn, inte symboler.**
Bara personer har initialer. Domäner, team och system visas med sina namn. Det finns inga färgkodade klossar att lära sig.

**5. Stillhet.**
Rörelse förklarar en förändring, aldrig något annat. Inget blinkar, loopar eller animeras för sakens skull. Systemet följer användarens val av ljust eller mörkt läge och av minskad rörelse.

## Grundelement

| Element | Val |
|---|---|
| Typsnitt | Geist, med systemets typsnitt som reserv. Tabellsiffror överallt där siffror står i kolumner. |
| Färger | Bläcksvart på vitt. Grå i tre nivåer för sekundär text. Gult och rött bara för avvikelser. |
| Primär knapp | Svart, en per vy. Övriga knappar är neutrala. |
| Sektioner | Rubrik och luft. Ingen ram. |
| Tabeller | Hårfina linjer, ingen bakgrund i rubrikraden. Texten linjerar med rubrikerna. |
| Staplar | Tunna och mörka. Allokering visas ljusare än belastning, eftersom 100 % allokering är normalt. |
| Sidomeny | Ljusgrå, bara text. Samma ton som operativsystemens egna appar. |
| Rullistor | Egen komponent i stället för webbläsarens. Bock för valt alternativ, grupper med rubrik, undertext i grått och sökfält när listan har fler än åtta alternativ. |

## Rörelse

Rörelsen ska få appen att kännas levande när man gör något, inte när man tittar på den. Den bygger på [anime.js](https://animejs.com) (MIT) i `js/vendor/` och samlas i `js/motion.js`.

| Händelse | Rörelse | Tid |
|---|---|---|
| Ny sida | Sektionerna tonas fram uppifrån och ned. Staplar växer från noll och nyckeltal räknas upp. | 360–650 ms |
| Ny flik | Samma sak, men bara för flikens innehåll. Sidhuvudet står still. | 360–650 ms |
| Ny post i en lista | Bara detaljvyn tonas fram. Listan står still. | 300 ms |
| Ändrad data | Staplar, ringar och siffror glider från det gamla värdet till det nya. Tabellrader som byter plats glider dit. | 420–600 ms |
| Kopplingskartan | Rutorna glider till sina nya platser med en lätt fjäder. Linjerna ritas ut från den valda rutan och utåt. Streckade linjer tonas in. | cirka 500 ms |
| Dialog och notis | Tonas in och glider upp några pixlar. | 240–260 ms |
| Sökning och bläddring | Ingen rörelse. Man skriver och läser samtidigt. | – |

Regler:

- Inget längre än 0,8 sekunder. Inga loopar. Ingen studs utöver fjädern i kartan.
- Rörelse visar varifrån något kommer: ett tal räknas från sitt gamla värde, en ruta glider från sin gamla plats.
- Den som valt minskad rörelse i operativsystemet får inga animationer alls.
- Animationen städar efter sig. När den är klar finns inga kvarvarande stilar i sidan.
- Om biblioteket inte laddas fungerar allt som förut, utan rörelse.

## Tillgänglighet

Lugn får inte betyda svårläst. Kraven är:

- All text klarar WCAG 2.1 AA, det vill säga minst 4,5:1 i kontrast, i både ljust och mörkt läge. Det gäller även den gråa hjälptexten.
- Allt går att nå med tangentbordet. Tabellrader, flikar och sorterbara kolumner tar emot fokus. Piltangenterna flyttar mellan flikar.
- Dialoger håller kvar fokus medan de är öppna och lämnar tillbaka det när de stängs. Esc stänger dem.
- Vid sidbyte flyttas fokus till sidans rubrik och webbläsarens bakåtknapp fungerar.
- Färg är aldrig enda bäraren av information. Avvikelser har också text, till exempel "118 %" eller "minskad".
- Inställningen för minskad rörelse respekteras helt.

Kontrollera med axe eller webbläsarens tillgänglighetsverktyg innan något nytt läggs till.

## Så använder du principerna

Ställ tre frågor innan något nytt läggs till:

1. Behöver det en ruta, eller räcker luft och en rubrik?
2. Betyder färgen en avvikelse? Om inte, gör det neutralt.
3. Kan det sägas med ord och siffror i stället för med en symbol?

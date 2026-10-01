# Designfilosofi: Lugn yta, sann bild

OOS ska ge organisationen en gemensam och ärlig bild av verkligheten. Gränssnittet ska därför vara lugnt och ärligt. Det ska kännas som ett verktyg man litar på, inte som en dashboard som vill imponera.

Filosofin kommer från problembeskrivningarna. Där står att ett arbetssätt ska fungera i verkligheten, inte bara vara elegant i teorin. Operativsystemet ska också *obönhörligt synliggöra den faktiska situationen, även när verkligheten är obekväm* (problem 11).

## Fem principer

**1. Varje block har en tydlig yta.**
Innehållet ligger i vita kort med hårfin kant på en ljusgrå botten. Då syns det var ett block börjar och var det slutar. Inuti korten skapas struktur med luft, typografi och hårfina linjer. Det finns inga skuggor och inga ikoner som dekoration. En ikon används bara när den är själva knappen, till exempel stäng, sök eller ändra.

*Ändrat efter användartest:* den första versionen hade inga rutor alls. Det blev svårt att se var informationen började och slutade, särskilt på detaljsidorna.

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
| Typsnitt | Geist, med systemets typsnitt som reserv. Brödtext 15 px med radavstånd 1,55, tabeller 14,5 px, etiketter minst 13 px. Tabellsiffror överallt där siffror står i kolumner. |
| Datum | Alltid skrivna som "1 sep 2026", aldrig som 2026-09-01. Perioder som "oktober 2026". |
| Uppgifter | Etikett och värde på en rad med hårfin linje emellan. I smala spalter står etiketten ovanför värdet. |
| Avvikelser | Ljust tonad ruta med gul eller röd kant, överst på sidan. Texten säger vad som är fel och vad man kan göra. |
| Färger | Bläcksvart på vitt. Grå i tre nivåer för sekundär text. Gult och rött bara för avvikelser. |
| Primär knapp | Svart, en per vy. Övriga knappar är neutrala. |
| Ytor | Ljusgrå botten. Varje sektion är ett vitt kort med 1 px kant och rundade hörn, 24 px luft inuti. I mörkt läge är botten mörkare än korten. |
| Nyckeltal | Egna små kort i ett rutnät som bryts efter bredden. Etikett, tal och förklaring hör synligt ihop. |
| Högerspalt | Ett eget kort. Grupperna i den skiljs av en linje. |
| Tabeller | Går kant i kant i kortet. Hårfina linjer mellan raderna, ingen bakgrund i rubrikraden. Texten linjerar med kortets rubrik. |
| Staplar | Tunna och mörka. Allokering visas ljusare än belastning, eftersom 100 % allokering är normalt. |
| Sidomeny | Ljusgrå, bara text. Samma ton som operativsystemens egna appar. |
| Rullistor | Egen komponent i stället för webbläsarens. Bock för valt alternativ, grupper med rubrik, undertext i grått och sökfält när listan har fler än åtta alternativ. |

## Text

Texten ska få plats och läsas lätt, oavsett hur lång den är eller hur smal ytan är.

| Regel | Hur |
|---|---|
| Storlek efter yta | Sidrubrik, inledning och stora tal skalar med den yta de står i (container-enheter), inte med fönstret. Ett nyckeltal i en smal ruta blir mindre än samma tal i en bred. |
| Tal som inte får plats | Tal med hårt mellanslag, som "152 380 kr", krymps tills de får plats, ned till 60 % av normal storlek. |
| Långa sammansatta ord | Etiketter och rubriker får mjuka bindestreck vid vanliga leder: "verksamhets-domän-ansvarig". Bindestrecket syns bara om ordet behöver brytas. Knappar, flikar och data (namn i tabeller) avstavas inte. |
| Radbrytning | Rubriker bryts jämnt (text-wrap: balance). Stycken undviker ett ensamt ord på sista raden (text-wrap: pretty). Kolumnrubriker får bryta mellan ord. |
| Metaraden | Punkterna mellan delarna syns aldrig först på en rad. |
| Ord efter antal | "1 medlem", "3 medlemmar". Använd `OOSUtil.plural`. |
| Perioder | "oktober 2026" och "Q4 2026". Inte "2026-Q4". |

Kontroll: inget element med text får bli bredare än sin ruta, på någon sida, i någon bredd från 320 till 1920 px, även med mycket långa namn.

## Detaljsidor

Alla detaljsidor har samma ordning, så att man vet var man ska titta:

1. **Rubrik.** Namnet, och under det en rad om vad det är och var det hör hemma, till exempel "Tech Lead · Anställd · Kundportal Team".
2. **Avvikelse.** Bara om något är fel, till exempel överallokering eller saknad teamledare. Texten säger vad man kan göra åt det.
3. **Faktarad.** De tre eller fyra viktigaste talen för just den här saken, med en kort förklaring under varje tal. Rött eller gult bara om talet avviker.
4. **Huvudinnehåll** till vänster: det man arbetar med, till exempel var tiden går, medlemmar eller kompetenser.
5. **Uppgifter** i en smalare spalt till höger: egenskaper, kopplingar och ägare. Under 900 px hamnar spalten under huvudinnehållet.

Uträkningar visas inte hela tiden. De ligger bakom en rad som "Så räknas den tillgängliga tiden" och fälls ut när någon vill veta.

Varje uppgift visas en gång. Det finns ingen sammanfattning som upprepar det som redan står på sidan.

För en arbetare visar en **tidsbudget** hur den tillgängliga tiden fördelas på team och domänroller. Ett streck markerar den tid som finns. Det som går utöver är randigt rött. Under stapeln står varje åtagande med timmar och en knapp för att ändra det.

## Layout

Appen ska fungera i alla fönster, från en mobil till en bred skärm och från helskärm till ett halvt fönster bredvid något annat. Därför följer layouten ytan som finns, inte vilken sorts enhet det är.

| Del | Hur den anpassar sig |
|---|---|
| Mått | Marginaler, rubriker och avstånd växer flytande mellan ett golv och ett tak. Innehållet blir högst 1 360 px brett. Löptext hålls till cirka 70 tecken per rad. |
| Meny | Fast till vänster från 960 px. Smalare fönster får ett toppfält och en meny som dras ut. |
| Komponenter | Följer innehållsytans bredd (container queries), inte fönstrets. Nyckeltal, kolumner och sidopaneler bryts om när ytan blir smal, oavsett om menyn syns. |
| Tabeller | Mäts efter varje omritning. Får tabellen inte plats döljs först mindre viktiga kolumner, som också finns i detaljvyn. Under 600 px blir varje rad ett kort med etikett och värde, med en sorteringslista ovanför. Matrisen rullar i sidled med första kolumnen fast. |
| Kopplingskartan | Räknar ut rutornas bredd ur ytan och får alltid plats. Smala rutor får två rader text. Under 640 px visas samma kolumner som nivåer uppifrån och ned. |
| Dialoger | Centrerade på stora skärmar. Under 560 px blir de ett ark som glider upp nerifrån. |
| Pekskärm | Knappar, flikar och sidnummer får minst 40 px träffyta. |

Regel: sidan rullar aldrig i sidled. Bara en tabell som inte kan bli smalare, som matrisen, får rulla inom sin egen yta.

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

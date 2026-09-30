# Fabriken – POC av Organisationens operativsystem (OOS)

Klickbar POC av **Prototyp 1: bottenplattan** i OOS. Den hanterar leveransdomäner, verksamhetsdomäner, IT-domäner, team, arbetare, kompetenser, system och kapacitet. Underlaget är *Prototyp bilder OOS* (2026-09-04) och *Framtidens arbetssätt – problembeskrivningar* (2026-06-03).

All data är påhittad demodata för organisationen "Nordpension".

Utseendet följer designfilosofin *Lugn yta, sann bild*. Se [DESIGN.md](DESIGN.md).

## Kom igång

Öppna `index.html` i en webbläsare. Ingen installation eller byggsteg behövs.

```bash
npm start          # valfritt: lokal webbserver på http://localhost:5173
npm test           # tester för kapacitetsmotorn (Node 18+)
npm run bundle     # en fristående HTML-fil i dist/ att dela via e-post eller Teams
```

Ändringar sparas i webbläsarens `localStorage`. Varje användare har alltså sin egen sandlåda. Under **Inställningar** kan du återställa demodatan, kopiera all data som JSON och importera den igen.

## Vad POC:n visar

| Vy | Innehåll |
|---|---|
| Översikt | Nyckeltal, signaler, kapacitet per leveransdomän, fabrikskarta och senaste ändringar |
| Rapporter | Kapacitet, belastning och ledig tid per team, domän eller leveransdomän och kompetens. Jämför denna period med nästa. Tabell eller diagram. Kan kopieras som CSV. |
| Leveransdomäner, verksamhetsdomäner, IT-domäner | Lista och detaljvy med flikarna Översikt, Domänkopplingar, Team, System, Domänmoln/Nyckelroller och Kapacitet |
| Team | Lista och detaljvy med syfte, teamledare, domäner, system, medlemmar, kapacitet per kompetensområde och avdrag |
| Arbetare | Lista med filter och detaljvy med kompetenser, team, domänroller och kapacitetsberäkning |
| Kompetenser | Lista, kategorier, nivåer och vilka som bär kunskapen |
| System | Ansvarigt team och IT-domän per system |
| Kapacitet | Standardarbetstid, rapporteringsperiod, grundavdrag och särskilda avdrag per team |
| Inställningar | Data och ändringslogg |

Allt går att skapa, ändra och ta bort. Alla ändringar loggas.

### Koppling till problembeskrivningarna

| Problem | Hur POC:n svarar |
|---|---|
| 3, 8: olika versioner av verkligheten, för stor komplexitet | En datamodell. Alla siffror räknas fram ur den, inget skrivs in två gånger. |
| 5: förenklad bild av kapacitet | Verklig kapacitet = grundkapacitet − grundavdrag − teamavdrag, fördelad på allokering, kompetens och domän. |
| 9, 11: transparens och spårbarhet | Signaler visar överallokering, hög beläggning, saknade ägare och system utan ansvarigt team. Ändringsloggen visar vad som ändrats och när. |
| 14: kritisk kunskap i huvuden | Signal när bara en person har en kompetens på nivå 3–4. |
| 16, 17: gemensam valuta | Allt räknas i timmar. |
| 20: flera dimensioner | Team kopplas till verksamhetsdomän, IT-domän, system och kompetens samtidigt. |
| 24: domänmoln | Experter i verksamhets- och IT-domäner bidrar med h/månad utan att vara teammedlemmar och räknas in i domänens kapacitet. |
| 19: projektledning | Nyckelroller på leveransdomännivå, till exempel projektledare. |

## Datamodell

Följer ER-skissen för Prototyp 1. Tabellerna finns i `js/seed.js` och relationerna i `js/engine.js`.

| ER-skiss | I koden |
|---|---|
| DeliveryDomain | `deliveryDomains` |
| Domain (IT Domain, Business Domain) | `domains` med `type: 'it' \| 'business'` |
| DomainCluster | `domainClusters` |
| Team, Team_Domain, Team_Worker, Team_System | `teams`, `teamDomains`, `teamWorkers`, `teamSystems` |
| Worker, WorkerCompetence, Worker_Competence | `workers`, `competences`, `workerCompetences` |
| ExtendedDomain_Competence, ExtendedDeliveryCompetence | `extendedDomainCompetences`, `extendedDeliveryCompetences` |
| Systems, ITDomain_System | `systems`, `itDomainSystems` |
| OverheadReduction | `overheadReductions` (grundavdrag) och `teamReductions` (särskilda avdrag) |
| CapacitySummary | Räknas fram i `engine.allFacts()`, lagras inte |

## Beräkningsregler

1. **Tillgänglig kapacitet per arbetare** = grundkapacitet − grundavdrag. Grundavdragen skalas mot standardarbetstiden, så att deltid får proportionellt avdrag. Grundavdrag gäller inte AI-arbetare om inget annat anges.
2. **Periodens timmar** = timmar per vecka / 5 × arbetsdagar i perioden. Helgdagar räknas inte bort.
3. **Teamkapacitet** = Σ tillgänglig kapacitet × allokering × (1 − teamavdrag). Teamavdrag viktas på de arbetsdagar som överlappar perioden.
4. **Kompetens**: en medlems kapacitet fördelas jämnt på medlemmens primära kompetenser.
5. **Leveransdomän** för ett team härleds: primär verksamhetsdomän → dess primära leveransdomän. Saknas verksamhetsdomän används primär IT-domän.
6. **Domänkapacitet** = team med domänen som *primär* + domänmolnets timmar. Stödjande kopplingar visas men räknas inte, för att undvika dubbelräkning.
7. **Belastning** anges manuellt per teammedlem. Domänmolnets timmar räknas som belastade.

## Avvikelser och öppna frågor

Det här behöver beslutas innan en riktig Prototyp 1 byggs:

1. **Kompetensnivåer.** ER-skissen säger 0–3, GUI-skissen visar 1–4. POC:n använder 1–4 (Grundläggande, Erfaren, Avancerad, Expert).
2. **Allokering.** ER-skissen har `Team_Worker.AllocatedCapacity [month]` i timmar, GUI:t visar procent. POC:n använder procent för team och h/månad för domänroller.
3. **Belastning saknar källa.** Datamodellen för Prototyp 1 har inget arbete att belasta med. Den manuella belastningen bör ersättas av arbetsblock från modulen Utvecklingsprocess.
4. **Siffrorna i GUI-skisserna går inte ihop** (till exempel 142 respektive 42 arbetare). I POC:n räknas alla siffror fram.
5. **Stödjande team** hamnar med hela sin kapacitet i en leveransdomän. Om de ska fördelas över flera krävs en fördelningsnyckel på `Team_Domain`.
6. **Individuell frånvaro** (föräldraledighet, sjukdom) ligger i skissen som teamavdrag. Det hör hemma på arbetaren och bör hämtas från HR-systemet.
7. **AI-arbetare i timmar.** En AI-agent på "40 h/vecka" säger lite om vad den levererar. Behöver en egen modell.

## Utanför scope

Styrcentral (rapporter med AI och statistik), Utvecklingsprocess (utvecklingsmål, leveransobjekt, arbetsblock), inloggning och behörigheter, integrationer mot HR, Jira och ekonomisystem.

## Filer

```
index.html            appskal
css/app.css           design och layout (se DESIGN.md)
js/util.js            hjälpfunktioner
js/seed.js            demodata
js/engine.js          relationer, kapacitet, rapport och signaler (testbar i Node)
js/store.js           lagring, CRUD och ändringslogg
js/ui.js              komponenter: tabeller, formulär, dialoger, staplar
js/views/*.js         vyerna
js/app.js             navigation och händelser
tests/engine.test.js  tester för beräkningarna
tools/bundle.js       bygger en fristående HTML-fil
```

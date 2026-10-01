# Fabriken – POC av Organisationens operativsystem (OOS)

Klickbar POC av **Prototyp 1: bottenplattan** i OOS. Den hanterar leveransdomäner, verksamhetsdomäner, IT-domäner, team, arbetare, kompetenser, system och kapacitet. Underlaget är *Prototyp bilder OOS* (2026-09-04) och *Framtidens arbetssätt – problembeskrivningar* (2026-06-03).

All data är påhittad demodata för organisationen "Nordpension".

Utseendet följer designfilosofin *Lugn yta, sann bild*. Se [DESIGN.md](DESIGN.md). Rörelsen bygger på [anime.js](https://animejs.com) (MIT), som ligger med i `js/vendor/` så att POC:n fungerar utan nätverk.

Tryck Ctrl+K (⌘K på Mac) eller / för att söka efter vad som helst i appen. Tabellernas sökfält söker i alla kolumner.

Layouten anpassar sig efter fönstret, från mobil till bred skärm. Tabeller visas som kort på smala skärmar och kopplingskartan som nivåer. Se avsnittet om layout i [DESIGN.md](DESIGN.md).

## Kom igång

Öppna `index.html` i en webbläsare. Ingen installation eller byggsteg behövs.

```bash
npm start          # valfritt: lokal webbserver på http://localhost:5173
npm test           # tester för kapacitetsmotorn och lagringen (Node 18+)
npm run bundle     # en fristående HTML-fil i dist/ att dela via e-post eller Teams
```

Ändringar sparas i webbläsarens `localStorage`. Varje användare har alltså sin egen sandlåda. Under **Inställningar** kan du återställa demodatan, kopiera all data som JSON och importera den igen.

## Vad POC:n visar

| Vy | Innehåll |
|---|---|
| Översikt | Nyckeltal, signaler, kapacitet per leveransdomän, fabrikskarta och senaste ändringar |
| Insikter | Tre flikar. **KPI:er** visar åtta nyckeltal med målnivåer och status; målen kan ändras. **Mätvärden** visar kapacitet över tid, kompetensmatris, beläggning per team, kapacitetens sammansättning och kompetensdjup. **Kopplingar** är en karta från leveransdomän via verksamhetsdomän, team och system till IT-domän. När man väljer en ruta samlas det som hör till den överst och resten tonas ned. Primära kopplingar följs hela vägen; stödjande visas men följs inte vidare. Luckor markeras. |
| Rapporter | Kapacitet, belastning och ledig tid. Gruppera efter team, domän, leveransdomän eller kompetens och avgränsa urvalet med filter. Tabellen visar grupperna först och kompetenserna när man fäller ut dem. Diagrammet visar en stapel per grupp med talen i egna kolumner. Domänmoln och nyckelroller är en grupp var. Jämför med nästa period. Kan kopieras som CSV. |
| Leveransdomäner, verksamhetsdomäner, IT-domäner | Lista och detaljvy med flikarna Översikt, Domänkopplingar, Team, System, Domänmoln/Nyckelroller och Kapacitet |
| Initiativ | Satsningar som leveransdomänerna har beslutat. Detaljvyn visar vilka team som bär initiativet, deras beläggning och initiativets epiker. Ramen är summan av epikerna. |
| Epiker | Teamens arbete: utveckling, förvaltning och utredning. Varje team har en förvaltningsepik med löpande ram per månad. Den rymmer drift, rättningar, utbildning och kompetensspridning. Listan visar var tiden går per arbetstyp. Detaljvyn visar vem som gör jobbet (epikens timmar per kompetensområde, teamets läge i varje område och personerna med kompetensen), beroenden åt båda hållen med risker, och epiken period för period. |
| Flaskhalsar | Helhetsbilden: kompetensområden som är fulla i ett team och var samma kompetens finns ledig, luckor där teamet saknar kompetens, alla kompetensområden i organisationen, en matris team × område och beroenden med risk. |
| Team | Lista och detaljvy med teamets arbete i perioden (epiker mot kapacitet), syfte, teamledare, domäner, system, medlemmar, kapacitet per kompetensområde och avdrag |
| Arbetare | Lista med filter och detaljvy med kompetenser, team, domänroller och kapacitetsberäkning |
| Kompetenser | Lista, kategorier, nivåer och vilka som bär kunskapen |
| System | Ansvarigt team och IT-domän per system |
| Kapacitet | Standardarbetstid, rapporteringsperiod, grundavdrag och särskilda avdrag per team |
| Inställningar | Belastningens källa (epiker eller manuellt), data och ändringslogg |

Allt går att skapa, ändra och ta bort. Alla ändringar loggas.

### Koppling till problembeskrivningarna

| Problem | Hur POC:n svarar |
|---|---|
| 3, 8: olika versioner av verkligheten, för stor komplexitet | En datamodell. Alla siffror räknas fram ur den, inget skrivs in två gånger. |
| 5: förenklad bild av kapacitet | Verklig kapacitet = grundkapacitet − grundavdrag − teamavdrag, fördelad på allokering, kompetens och domän. |
| 9, 11: transparens och spårbarhet | Signaler visar överallokering, hög och för hög beläggning, saknade ägare, system utan ansvarigt team och utvecklingsarbete utan initiativ. Ändringsloggen visar vad som ändrats och när. Varje timme i en epik går att följa från team till initiativ och leveransdomän. |
| 14: kritisk kunskap i huvuden | Signal när bara en person har en kompetens på nivå 3–4. Kompetensspridningen planeras i teamets förvaltning. |
| 16, 17: gemensam valuta, konsekvenser direkt | Allt räknas i timmar. Epikens ram är den tid som är beslutad, inte ett estimat (omvänd estimering). Formuläret visar teamets beläggning före och efter, period för period, innan epiken sparas. |
| 15: förhandling om tid | Förslag syns med sin konsekvens men belastar inte teamet förrän de beslutas. Ett överplanerat team ger en kritisk signal. |
| 5, 20: kapacitet i flera dimensioner | Epikens kompetensbehov fördelar arbetet på kompetensområden. Då syns det när utvecklarna har tid men inte testarna eller kravanalytikerna, och var samma kompetens finns ledig i andra team. |
| 9, 17: beroenden och konsekvenser | Epiker kan bero på varandra. Risker syns direkt: beroendet blir klart för sent, är bara ett förslag eller ligger hos ett team med flaskhals. |
| 20: flera dimensioner | Team kopplas till verksamhetsdomän, IT-domän, system och kompetens samtidigt. |
| 15, 17, 23: prioritering och styrning | KPI:er med målnivåer som ledningen beslutar om. Kompetensmatrisen visar var timmarna faktiskt finns. |
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
| Finns inte i skissen | `initiatives`: leveransdomän, ägare, status, period och mål |
| Finns inte i skissen | `epics`: team, arbetstyp, initiativ (valfritt), status, ram (`monthly` h/mån eller `total` h), från, till, kompetensbehov (`needs`: kompetensområde och andel i procent) och beroenden (`dependsOn`: andra epiker) |
| CapacitySummary | Räknas fram i `engine.allFacts()`, lagras inte |

## Beräkningsregler

1. **Tillgänglig kapacitet per arbetare** = grundkapacitet − grundavdrag. Grundavdragen skalas mot standardarbetstiden, så att deltid får proportionellt avdrag. Grundavdrag gäller inte AI-arbetare om inget annat anges.
2. **Periodens timmar** = timmar per vecka / 5 × arbetsdagar i perioden. Helgdagar räknas inte bort.
3. **Teamkapacitet** = Σ tillgänglig kapacitet × allokering × (1 − teamavdrag). Teamavdrag viktas på de arbetsdagar som överlappar perioden.
4. **Kompetens**: en medlems kapacitet fördelas jämnt på medlemmens primära kompetenser.
5. **Leveransdomän** för ett team härleds: primär verksamhetsdomän → dess primära leveransdomän. Saknas verksamhetsdomän används primär IT-domän.
6. **Domänkapacitet** = team med domänen som *primär* + domänmolnets timmar. Stödjande kopplingar visas men räknas inte, för att undvika dubbelräkning.
7. **Belastning** räknas ur teamets epiker. En epik med ram per månad ger timmar som en löpande insats. En epik med total ram fördelas jämnt över sina arbetsdagar. Förslag räknas inte. Klara epiker räknas för den tid de pågick, så att historiken står kvar; blir en epik klar i förtid flyttas slutdatum till i dag. Teamets beläggning = epikernas timmar / teamets kapacitet, och kan bli mer än 100 %. Varje medlem får beläggningen för sina kompetensområden (regel 10). Under Inställningar går det att byta till manuell belastning per teammedlem, som förut. Domänmolnets timmar räknas som belastade.
8. **Överallokering** räknas ned. Om en arbetares team och domänroller kräver mer än den tillgängliga tiden, skalas alla åtaganden ned i samma proportion. Kapaciteten blir alltså aldrig större än de timmar som finns. Överallokeringen visas som en kritisk signal.
9. **Inget räknas två gånger.**
   - Teamavdrag är tid som inte finns, till exempel föräldraledighet eller långtidsfrånvaro. Arbete är epiker: utbildning, underhåll och införanden i teamets förvaltning, systembyten och annat i egna epiker. Formuläret stoppar avdrag som är arbete. Äldre sådana avdrag ger en signal och kan flyttas till förvaltningen eller göras om till en epik med ett klick.
   - Utbildning är ingen egen epik. Den ingår i teamets förvaltning, som det finns en av per team. Grundavdraget för kompetensutveckling är personlig utveckling; förvaltningsramen ska inte innehålla samma tid.
   - Domänroller och team delar på samma tillgängliga tid (regel 8), och en medlems kapacitet fördelas på kompetenserna utan överlapp (regel 4).
10. **Kompetensbehov.** En epiks timmar fördelas på kompetensområden enligt dess behov. Utan behov fördelas de som teamets sammansättning. Ett områdes beläggning = arbetet i området / teamets kapacitet i området, där kapaciteten är medlemmarnas tid på sina primära kompetenser. En medlem får beläggningen för sina områden, så en testare kan vara fullbelagd medan utvecklarna har tid. Arbete i ett område som teamet saknar är en lucka: det belastar teamet men ingen medlem. Summan över områdena är alltid teamets arbete.
11. **Beroenden.** En epik kan bero på andra epiker. Risk: beroendet slutar efter epiken, är ett förslag när epiken är beslutad, eller ligger hos ett team som är överplanerat eller saknar kompetens i de områden beroendet behöver. Cirkulära beroenden går inte att välja.

## Avvikelser och öppna frågor

Det här behöver beslutas innan en riktig Prototyp 1 byggs:

1. **Kompetensnivåer.** ER-skissen säger 0–3, GUI-skissen visar 1–4. POC:n använder 1–4 (Grundläggande, Erfaren, Avancerad, Expert).
2. **Allokering.** ER-skissen har `Team_Worker.AllocatedCapacity [month]` i timmar, GUI:t visar procent. POC:n använder procent för team och h/månad för domänroller.
3. **Belastningens källa** är nu teamens epiker. Kvar att besluta:
   - Ska epiker på sikt hämtas från Jira i stället för att skrivas in här? Då behöver Jira en ram i timmar per epik.
   - En epik tillhör ett team. Arbete som flera team gör delas upp i en epik per team under samma initiativ.
   - Beläggningen per person räknas per kompetensområde, inte per epik. Att namnge vem som gör vilken epik (bemanning) ger en skarpare bild men kräver mer inmatning och blir snabbt inaktuellt.
   - Kompetensbehovet anges per område och i procent. Det är grovt med avsikt. Finare nivå (enskild kompetens, timmar per person) är möjlig men kostar i inmatning.
4. **Siffrorna i GUI-skisserna går inte ihop** (till exempel 142 respektive 42 arbetare). I POC:n räknas alla siffror fram.
5. **Stödjande team** hamnar med hela sin kapacitet i en leveransdomän. Om de ska fördelas över flera krävs en fördelningsnyckel på `Team_Domain`.
6. **Individuell frånvaro** (föräldraledighet, sjukdom) ligger i skissen som teamavdrag. Det hör hemma på arbetaren och bör hämtas från HR-systemet.
7. **AI-arbetare i timmar.** En AI-agent på "40 h/vecka" säger lite om vad den levererar. Behöver en egen modell.

## Utanför scope

Styrcentral (rapporter med AI och statistik), Utvecklingsprocess utöver initiativ och epiker (utvecklingsmål, leveransobjekt), inloggning och behörigheter, integrationer mot HR, Jira och ekonomisystem.

## Filer

```
index.html            appskal
css/app.css           design och layout (se DESIGN.md)
js/util.js            hjälpfunktioner
js/seed.js            demodata
js/engine.js          relationer, kapacitet, rapport och signaler (testbar i Node)
js/store.js           lagring, CRUD och ändringslogg
js/ui.js              komponenter: tabeller, formulär, dialoger, staplar
js/select.js          rullistor och förslagslistor som ersätter webbläsarens
js/motion.js          rörelse vid sidbyte, ändrad data och i kopplingskartan
js/layout.js          anpassar tabeller, flikar och text efter den yta som finns, markerar sökträffar
js/views/work.js      initiativ, epiker, flaskhalsar och teamets arbetskort
js/views/search.js    global sökning (Ctrl+K) över arbetare, team, domäner, system, initiativ, epiker och kompetenser
js/vendor/            anime.js 4.5.0 (MIT), animationsbiblioteket som motion.js bygger på
js/views/*.js         vyerna (insights.js: KPI:er, mätvärden och kopplingar)
js/app.js             navigation och händelser
tests/core.test.js    tester för beräkningar och lagring
tools/bundle.js       bygger en fristående HTML-fil
```

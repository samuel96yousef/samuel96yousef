# Designfilosofi: Lugn yta, sann bild

OOS ska ge organisationen en gemensam och ärlig bild av verkligheten. Gränssnittet ska därför vara lugnt och ärligt. Det ska kännas som ett verktyg man litar på, inte som en dashboard som vill imponera.

Filosofin kommer från problembeskrivningarna. Där står att ett arbetssätt ska fungera i verkligheten, inte bara vara elegant i teorin. Operativsystemet ska också *obönhörligt synliggöra den faktiska situationen, även när verkligheten är obekväm* (problem 11).

## Fem principer

**1. Varje block har en tydlig yta.**
Innehållet ligger i vita kort med hårfin kant på en ljus, sval botten. Då syns det var ett block börjar och var det slutar. Inuti korten skapas struktur med luft, typografi och hårfina linjer. Den enda skuggan är en svag under en utfälld ram, och det finns inga ikoner som dekoration. En ikon används bara när den är själva knappen, till exempel stäng, sök eller ändra.

*Ändrat efter användartest:* den första versionen hade inga rutor alls. Det blev svårt att se var informationen började och slutade, särskilt på detaljsidorna.

**2. Färg betyder avvikelse.**
Ytan är vit med svala skiffergrå toner och en blå accentfärg för det man har valt, det som är aktivt och staplar som visar mängd. Gult betyder nära gränsen och rött betyder över gränsen. Allt som är som det ska vara är lugnt. Om allt har varningsfärg sticker ingenting ut.

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
| Färger | Nästan svart text på vitt, svala skiffergrå toner i tre nivåer för sekundär text och linjer. Blått (`--accent`) för val, aktiv flik, vald sida, fokus och staplar. Ljusblått (`--accent-soft`, `--accent-line`) för ytor och ramar som hör till ett val. Gult och rött bara för avvikelser. All text klarar 4,5:1 i båda lägena. |
| Primär knapp | Blå, en per vy. Övriga knappar är neutrala. |
| Ytor | Ljusgrå botten. Varje sektion är ett vitt kort med 1 px kant och rundade hörn, 24 px luft inuti. I mörkt läge är botten mörkare än korten. |
| Nyckeltal | Egna små kort i ett rutnät som bryts efter bredden. Etikett, tal och förklaring hör synligt ihop. |
| Högerspalt | Ett eget kort. Grupperna i den skiljs av en linje. |
| Tabeller | Går kant i kant i kortet. Hårfina linjer mellan raderna, ingen bakgrund i rubrikraden. Texten linjerar med kortets rubrik. |
| Staplar | Tunna och blå. Allokering visas ljusare än belastning, eftersom 100 % allokering är normalt. |
| Kapacitetsstaplar | Stapelns längd är kapaciteten. Mörk del är belastat, ljus del ledigt och randig röd del det som är planerat utöver kapaciteten. Talen står i klartext med rubrik bredvid stapeln. Det finns inga markeringar som man måste gissa betydelsen av. |
| Sidomeny | Vit yta mot den grå sidan. Fyra namngivna grupper: Uppföljning, Arbete, Organisation och Resurser. Grupprubriker i små versaler med en linje mellan grupperna, så att de inte förväxlas med menyval. Varje menyval har en enkel linjeikon för igenkänning, det enda stället med ikoner utan egen funktion. Vald sida har ljusblå bakgrund, fet text och ett blått streck vid kanten. Inställningar och perioden ligger i foten, och perioden går att byta med pilarna. Menyn får plats utan att rulla ned till 680 px skärmhöjd: på låga skärmar blir raderna tätare och undertexten vid logotypen döljs. Är skärmen ännu lägre rullar bara grupperna, med en skugga i kanten, medan sök, inställningar och period står kvar. |
| Arbetstyper | Utveckling, förvaltning och utredning skiljs åt med tre toner av blått, från mörkt till ljust, och står alltid med förklaring. Förvaltningen står först på teamets arbetskort. Saknas den visas en streckad rad med en knapp för att lägga till den. Färgen är reserverad för det som är över kapaciteten. |
| Tidslinje | Rader i html med tunna staplar på en tolv månaders axel. Standard är att gruppera efter beroendekedja: det som hänger ihop står under varandra, det som måste bli klart först överst, och kedjan med störst risk först. Epiker utan beroenden är hopfällda sist. Ett beroende är en romb på den väntande epikens rad, där det den väntar på blir klart, med en lodrät linje upp till stapeln. Grå romb är i fas, gul har risk, röd blir klar för sent och då ritas glappet som en röd streckad linje. En röd prick efter namnet betyder att teamet är fullt i ett område som epiken behöver. Ett klick fäller ut epikens beroenden, risker och kompetensläge direkt under raden. Grupperat per team eller initiativ står det som hänger ihop långt isär, så där syns linjerna bara för den epik man pekar på eller har fällt ut. I en smal ruta står namnet ovanför stapeln. |
| Kopplingar | Tre listor i stället för ett flödesdiagram: varifrån arbetet kommer (störst först), team och kompetensområden (mest belagt först, så att flaskhalsarna står överst). Varje rad har tal i klartext och en stapel mot kapaciteten. Ett val filtrerar de andra listorna till det som hänger ihop med valet och sorterar dem efter det de visar. Staplarna glider till valets del: blå del hör till valet, ljusblå del är annat arbete. Väljer man ett team visas dess kompetensområden med ledigt och för mycket, väljer man ett område visas varje teams läge i det, också team som har ledig tid där. Linjer ritas bara för valet, med tjocklek efter timmar och rött till ett område som är fullt. I en smal ruta staplas listorna och bara valet står kvar i sin lista. |
| Beroendekedja | Det epiken väntar på, epiken och det som väntar på den, som rutor med pilar emellan. Risken står i klartext i rutan, med gul eller röd kant. I en smal ruta staplas kolumnerna och pilarna pekar nedåt. |
| Investering | Initiativets investering är en stapel där varje team har en blå del för sina beslutade epiker, förslagen står streckade efter och ett lodrätt streck markerar investeringen. Det som går över är randigt rött efter strecket. Talen står i nyckeltalen ovanför, stapeln visar proportionerna. Under står vad förslagen betyder och, när epikerna går över, vilka val som finns. Över visas gult, eftersom det är ett beslut som ska fattas och inte ett fel. Utan investering står en uppmaning att sätta en. |
| Period för period | En tabell med en stapel per period: längden är teamets kapacitet, blå del epiken, ljusblå del annat arbete och randig röd del det som går över. Ett förslag ritas streckat, som beläggningen skulle bli om det beslutas. |
| Flaskhalsmatris | Team × kompetensområde med beläggning i procent. Neutral som standard, gul ruta från 90 % och röd över 100 % eller där teamet saknar kompetensen. Matrisen är till för att hitta avvikelser, inte för att läsa varje tal. |
| Datumväljare | Egen komponent i stället för webbläsarens. Fältet visar datumet som "1 okt 2026" och går att skriva i: 2026-10-01, 1 okt, 1/10 och 1.10.2026 fungerar, och ett datum som inte finns markeras rött. Kalendern är lika bred som fältet (248–268 px) och visar bara de veckor månaden har, så att den står i proportion till formuläret. Den har månaden som rubrik med pilar, veckonummer, en prick under i dag och vald dag i blått. Ett klick på rubriken visar årets månader. För Från och Till syns perioden som ett svagt blått band, och i Till går dagar före startdatumet inte att välja. Snabbval efter vad fältet gäller: I dag och Nästa månad för start, Månadens slut och Ett år för slut. Pilar, PageUp/PageDown och Enter fungerar, Esc stänger. |
| Rullistor | Egen komponent i stället för webbläsarens. Bock för valt alternativ, grupper med rubrik, undertext i grått och sökfält när listan har fler än åtta alternativ. |

## Samma ord för samma sak

| Ord | Betyder | Används som |
|---|---|---|
| Kapacitet | Timmar som finns, efter avdrag | "Kapacitet i oktober 2026" |
| Belastat | Timmar som går till beslutat arbete | Kolumn och not: "556 h belastat" |
| Ledigt | Kapacitet minus belastat | "136 h ledigt", negativt i rött |
| Beläggning | Belastat delat med kapacitet, i procent | Alltid "Beläggning", aldrig beläggningsgrad eller belastning |
| Allokering | Hur stor del av sin tid en person ger ett team | Procent per medlemskap, "Allokerat" i timmar |
| Arbete | Epikerna, det som belastar | Rubriker som "Arbete i oktober 2026" |

## Sidmönster

| Del | Regel |
|---|---|
| Sidhuvud | Namnet på sidan, en mening om vad den visar och högst en blå knapp till höger. |
| Nyckeltal | Fyra rutor. Etiketten är ett substantiv ("Team", "Beläggning"), aldrig "Totalt antal …". Varje ruta har en förklaring under talet. |
| Listor | Kortet heter "Alla …" och upprepar inte sidrubriken. Sökfältet står till höger i kortets huvud. |
| Tabeller | Sifferkolumner har rubriken till höger, ovanför talen. Sorteringspilen följer sista ordet och hamnar aldrig ensam på en rad. Namn står i halvfet stil med en grå undertext. |
| Korthuvud | Rubrik och förklaring till vänster, knappar och val till höger. De bryts bara ned under rubriken när ytan är för smal. |
| Kategorier | Typ och kategori är vanlig text. Märken används bara för det som avviker, till exempel Förslag, Saknas eller Flaskhals. |

## Sökning

Samma sökregler gäller överallt: i tabellerna, i den globala sökningen och i rullistorna (`OOSUtil.matcher`).

| Regel | Exempel |
|---|---|
| Alla ord måste finnas, i valfri ordning och i vilket fält som helst | "konsult kundportal" hittar konsulter i Kundportal Team |
| Versaler, å, ä och ö spelar ingen roll | "doman" hittar "Verksamhetsdomän" |
| Tal hittas med och utan mellanslag | "2594" hittar "2 594 h" |
| Tabeller söker i allt som står i raden | Även kolumner som är dolda på smal skärm, och det vyn lägger till, till exempel alla kompetenser för en arbetare |
| Träffarna markeras | Gul markering i tabellen och i sökresultatet, det enda stället där gult inte betyder avvikelse |
| Antal träffar visas, och sökningen går att rensa | "3 träffar bland 20 system · Rensa". Esc tömmer sökfältet. |

**Global sökning** öppnas med Ctrl+K (⌘K på Mac), med / när man inte skriver i ett fält, med Sök i menyn eller med förstoringsglaset i toppfältet på mobil. Den hittar sidor, arbetare, team, leveransdomäner, verksamhets- och IT-domäner, system, initiativ, epiker och kompetenser. Träffar i namnet rankas före träffar i beskrivningar och kopplingar, och gruppen med den bästa träffen visas först. Piltangenterna väljer och Enter öppnar.

## Text

Texten ska få plats och läsas lätt, oavsett hur lång den är eller hur smal ytan är.

| Regel | Hur |
|---|---|
| Storlek efter yta | Sidrubrik, inledning och stora tal skalar med den yta de står i (container-enheter), inte med fönstret. Ett nyckeltal i en smal ruta blir mindre än samma tal i en bred. |
| Tal som inte får plats | Tal med hårt mellanslag, som "152 380 kr", krymps tills de får plats, ned till 60 % av normal storlek. |
| Långa sammansatta ord | Etiketter och rubriker får mjuka bindestreck vid vanliga leder: "verksamhets-domän-ansvarig". Bindestrecket syns bara om ordet behöver brytas. Knappar, flikar och data (namn i tabeller) avstavas inte. |
| Radbrytning | Rubriker bryts jämnt (text-wrap: balance). Stycken undviker ett ensamt ord på sista raden (text-wrap: pretty). Kolumnrubriker får bryta mellan ord, utom över sifferkolumner. |
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

**Listor med detaljer** (domäner, system och kompetenser) fäller ut detaljerna direkt under raden man klickar på. Raden rullas upp överst, så att detaljerna syns utan att man letar längre ned på sidan. Ett klick till fäller ihop raden, och bara en rad är öppen åt gången. En pil framför namnet visar att raden går att fälla ut. En länk från en annan sida öppnar rätt rad, på rätt sida i listan.

Den utfällda raden och detaljerna under den (lådan, `C.drawer`) har samma mall överallt:

- **En vit ram inom kortet.** Raden står kvar på vitt, med pil och namn i blått. Detaljerna ligger i en vit ram med tunn blå kant och rundade hörn, inom kortets marginaler, så att inget går ut kant i kant. Ramens huvud är ljusblått och håller flikarna och handlingarna. Tabeller i ramen går kant i kant i ramen, inte utanför den. Ingen grå yta, och raden blir inte grå när pekaren står kvar efter klicket.
- **Raden är rubriken.** Lådan upprepar inte namnet synligt, bara för skärmläsare. Det som redan står i en synlig kolumn, som beskrivningen eller kapaciteten, står inte en gång till. Döljs kolumnen på en smal skärm visas det i lådan i stället.
- **Överst** flikar eller en ingress till vänster och handlingarna till höger. Redigera är en vanlig knapp. Ta bort är röd text utan ram och frågar alltid först.
- **Kopplingar** står som listor med en etikett för rollen: mörk för den viktigaste (Ansvarar, Primär), ljus för resten (Bidrar, Stödjande). Knappen för att koppla bort syns när man pekar på raden eller ger den fokus, och alltid på pekskärm. Att lägga till är en knapp med text, till exempel "Koppla team", aldrig ett ensamt plustecken.
- **Uppgifter** som etikett och värde, i en egen spalt. Lådan delas i tre spalter när det finns plats och staplas i en smal ruta. Team, arbetare, epiker och initiativ har egna detaljsidor, eftersom de innehåller mer.

Uträkningar visas inte hela tiden. De ligger bakom en rad som "Så räknas den tillgängliga tiden" och fälls ut när någon vill veta.

Varje uppgift visas en gång. Det finns ingen sammanfattning som upprepar det som redan står på sidan.

För en arbetare visar en **tidsbudget** hur den tillgängliga tiden fördelas på team och domänroller. Ett streck markerar den tid som finns. Det som går utöver är randigt rött. Under stapeln står varje åtagande med timmar och en knapp för att ändra det.

Ett team har samma tidsbudget, men för arbete: teamets epiker mot teamets kapacitet. Förslag står inom parentes och räknas inte.

## Konsekvens innan beslut

Den som lägger till eller ändrar en epik ser konsekvensen innan den sparas (problem 17). Formuläret visar teamets beläggning före och efter, period för period, och säger med en mening om teamet har plats. Går det över kapaciteten blir rutan röd och texten säger vad som behöver hända: flytta, minska eller skaffa mer kapacitet.

Ett förslag belastar inte teamet. Dess detaljsida visar ändå vad beläggningen blir om det beslutas, så att beslutet kan fattas med siffrorna framför sig.

Konsekvensen visas också per kompetensområde. Har teamet plats totalt men inte i test eller krav, säger rutan det: "Teamet har plats totalt, men Test & QA blir en flaskhals". En flaskhals ska synas där beslutet fattas, inte först när arbetet har kört fast.

## Skrollning och formulär

Man ska skrolla på ett ställe i taget och aldrig för att hitta det viktigaste. Reglerna gäller hela appen:

| Var | Regel |
|---|---|
| Sidan | Sidan skrollar lodrätt. Inget annat skrollar i onödan. |
| Korta formulär | Dialog på 540 px. Den ska rymmas utan att skrolla på en skärm från 1280 × 720. Ett formulär som inte ryms har för många fält och ska delas eller bli brett. |
| Långa formulär | Bred dialog, i dag bara epiken. På breda skärmar tre spalter: fälten, det som påverkar kapaciteten (kompetensbehov och beroenden) och konsekvensen. Mellanbrett två spalter med konsekvensen överst till höger, smalt en spalt med konsekvensen sist. Utan team står en uppmaning där konsekvensen kommer. |
| När en dialog ändå skrollar | Bara innehållet skrollar. Rubrik och knappar står kvar, fälten till vänster står still, och en skugga i kanten visar att det finns mer. |
| Sidan bakom | Står still när en dialog är öppen, så att man inte skrollar två saker. |
| Hjälptexter | En rad, och bara när de gäller. Till exempel syns förklaringen av förvaltning först när man väljer Förvaltning, och att förslag inte belastar först när man väljer Förslag. |
| Mobil | Dialogen är ett ark som fyller skärmen. Där är skrollning i arket naturlig. |
| I sidled | Bara breda matriser, till exempel flaskhalsmatrisen och mätvärdena. Första kolumnen står kvar och kanten skuggas. Flikar som inte ryms rullar i sidled och tonas ut i kanten. |
| Skrollister | Tunna och i appens toner, överallt. |

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
| Tidslinjen | Staplarna växer ut från sitt startdatum, en i taget. Sedan dyker romberna upp och linjerna ritas. Pekar man på en epik lyser hela dess kedja upp, i flera led, och resten tonas ned. En utfälld rad tonas fram under raden. | 560 ms, romber efter 0,5 s |
| Kopplingarna | Staplarna växer fram första gången. Vid ett val glider varje del av staplarna till sitt nya värde, nya rader tonas in och linjerna ritas från vänster till höger. | cirka 500 ms per steg |
| Beroendekedjan | Epiken först, sedan rutorna på var sida, sist pilarna mellan dem. | cirka 900 ms |
| Dialog och notis | Tonas in och glider upp några pixlar. | 240–260 ms |
| Sökning och bläddring | Ingen rörelse. Man skriver och läser samtidigt. | – |

Regler:

- Inget enskilt längre än 0,8 sekunder. En bild får byggas upp i steg, i den ordning man läser den. Inga loopar. Ingen studs utöver fjädern i kartan.
- Rörelse visar varifrån något kommer: ett tal räknas från sitt gamla värde, en ruta glider från sin gamla plats.
- Den som valt minskad rörelse i operativsystemet får inga animationer alls.
- Animationen städar efter sig. När den är klar finns inga kvarvarande stilar i sidan.
- Om biblioteket inte laddas fungerar allt som förut, utan rörelse.

## Tillgänglighet

Lugn får inte betyda svårläst. Kraven är:

- All text klarar WCAG 2.1 AA, det vill säga minst 4,5:1 i kontrast, i både ljust och mörkt läge. Det gäller även den grå hjälptexten och blå text på ljusblå yta.
- Fokusramen är blå och visas när man använder tangentbordet. Efter ett klick visas ingen ram, även om appen flyttar fokus i koden (`data-input` på `html`).
- Allt går att nå med tangentbordet. Tabellrader, flikar och sorterbara kolumner tar emot fokus. Piltangenterna flyttar mellan flikar.
- Dialoger håller kvar fokus medan de är öppna och lämnar tillbaka det när de stängs. Esc stänger dem.
- Vid sidbyte flyttas fokus till sidans rubrik och webbläsarens bakåtknapp fungerar.
- Färg är aldrig enda bäraren av information. Avvikelser har också text, till exempel "118 %" eller "minskad".
- Det som visas i en bild finns också i text: tidslinjens beroenden och risker i den utfällda raden, kopplingarnas värden på varje rad, kedjans risker i rutorna och periodernas tal i tabellen. Rutan som visas när man pekar visas också när man ger elementet fokus med tangentbordet.
- Inställningen för minskad rörelse respekteras helt.

Kontrollera med axe eller webbläsarens tillgänglighetsverktyg innan något nytt läggs till.

## Så använder du principerna

Ställ tre frågor innan något nytt läggs till:

1. Behöver det en ruta, eller räcker luft och en rubrik?
2. Betyder färgen en avvikelse? Om inte, gör det neutralt.
3. Kan det sägas med ord och siffror i stället för med en symbol?

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
Övergångarna är korta och diskreta. Inget blinkar, studsar eller animeras för sakens skull. Systemet följer användarens val av ljust eller mörkt läge.

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

## Tillgänglighet

Lugn får inte betyda svårläst. Kraven är:

- All text klarar WCAG 2.1 AA, det vill säga minst 4,5:1 i kontrast, i både ljust och mörkt läge. Det gäller även den gråa hjälptexten.
- Allt går att nå med tangentbordet. Tabellrader, flikar och sorterbara kolumner tar emot fokus. Piltangenterna flyttar mellan flikar.
- Dialoger håller kvar fokus medan de är öppna och lämnar tillbaka det när de stängs. Esc stänger dem.
- Vid sidbyte flyttas fokus till sidans rubrik och webbläsarens bakåtknapp fungerar.
- Färg är aldrig enda bäraren av information. Avvikelser har också text, till exempel "118 %" eller "minskad".

Kontrollera med axe eller webbläsarens tillgänglighetsverktyg innan något nytt läggs till.

## Så använder du principerna

Ställ tre frågor innan något nytt läggs till:

1. Behöver det en ruta, eller räcker luft och en rubrik?
2. Betyder färgen en avvikelse? Om inte, gör det neutralt.
3. Kan det sägas med ord och siffror i stället för med en symbol?

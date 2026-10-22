# Koptisk bönbok – appen (Expo)

Arabisk-svensk app för en koptisk församling i Sverige, byggd med Expo
(React Native) för iPhone och Android. Arbetsnamnet är en platshållare.

## Vad som finns

| Flik | Innehåll |
| --- | --- |
| Idag | Koptiskt datum, högtider, fasta, dagens ord, timbönen som gäller nu och dagens läsningar. |
| Läsningar | Katameros för vilket datum som helst, med alla regler för fastor, påsktiden, söndagar och paramoun i Kiahk och Touba. |
| Böner | Agpeya (åtta timböner) och Kholagy (åtta liturgier) där präst, diakon och folk har olika stil. |
| Bibeln | Alla 74 böcker kapitel för kapitel, med sökning på svenska och arabiska. Varje bok har en innehållssida som i Katameros: namnet i en kartusch, kapitlen med medaljong, början av första versen och antal verser, och "Fortsätt läsa" till kapitlet du senast öppnade. |

Språk i läsningen: en sida i taget på huvudspråket. Språkknappen (ع | Sv)
byter språk, håll in för båda språken, tryck på en vers för att se den på
det andra språket och svep åt sidan för att byta. På bred skärm (uppfälld
vikbar telefon, vriden telefon, surfplatta) visas ett uppslag med svenska
till vänster och arabiska till höger.

Var i texten och hur du rör dig, inspirerat av iPhone Duo: det som visar
sitter överst, det du trycker på sitter på sidan där tummen når.

- **Brickan överst.** När rubriken har rullat bort tar en bricka mitten av
  toppraden (tillbakaknappen krymper till en pil) och visar avsnittet du
  läser, vem som talar i liturgin och hur långt du har kommit, till exempel
  "Katholikon · 1 Petr 1:3–12 · 4/6". Tryck på den så fälls alla avsnitt ut
  under den.
- **Dockan på sidan.** ▲ föregående avsnitt, avsnittets nummer, ▼ nästa.
  ▲ går först till början av avsnittet du är i, som på en musikspelare.
  **Håll in numret** så kommer ett hjul med avsnitten fram bredvid dockan,
  som tidshjulet i iOS. Håll kvar fingret och dra för att snurra det:
  texten följer med, det tickar för varje avsnitt, och varje avsnitt
  snäpper in i mitten så att det valda alltid står centrerat. Vid första
  och sista avsnittet ger hjulet efter lite och stannar med en stöt. Ett
  snabbt svep rullar vidare innan hjulet stannar och fälls in. Dra numret åt sidan för
  att flytta dockan till andra handen eller en annan höjd; appen kommer ihåg
  var den sitter. Ett kort tryck på numret fäller ut listan bredvid dockan.
- **Listan öppnas där du tryckte**, med avsnittet du läser markerat. Tryck
  på ett avsnitt för att hoppa dit, eller på brickan, dockan eller utanför
  för att stänga.
- **Uppfälld (bokuppslag).** Inget du trycker på ligger på vecket: brickan
  och flikraden flyttar till ena sidan.

I Bibeln visar brickan versen ("Vers 21 av 48"), pilarna hoppar fem verser
och listan är ett rutnät med verserna. Texten tonar ut under toppraden och
flikraden, så att knapparna aldrig ligger direkt på en textrad.

Kholagy: prästens delar har röd etikett, diakonens guldfärgad etikett och
guldlinje, folkets svar fetstil med röd linje så att församlingen hittar
sina delar. Instruktioner (rubriker) står i rött och kursivt, tysta böner
i grått.

## Kom igång

```sh
npm install
npm run data -- /sökväg/till/Coptic.apk   # skapar assets/data (committas inte)
npx expo start                              # skanna QR-koden med Expo Go
```

Kontroller:

```sh
npm test          # kalendern, alla läsningsregler och en kontroll av 2026–2030
npm run typecheck
npm run lint
```

Bygga för App Store och Google Play görs med EAS: `npx eas-cli@latest build`.
Byt först `bundleIdentifier` och `package` i `app.json` (nu `se.example.koptiskbonbok`).

## Struktur

```
src/app/            skärmar (Expo Router)
src/components/     läsaren, sidramen, valvet, flikraden, språkknappen,
                    Wayfinder (brickan, dockan och listan över avsnitt)
src/lib/coptic.ts   koptisk kalender, påsk, högtider, fastor, timböner
src/lib/lectionary.ts  reglerna för dagens läsningar
src/data.ts         laddar texterna, bibelsök
scripts/            export från APK:n och webbförhandsvisning
```

Bibelns böcker ligger som filer (`.bible`) som läses in först när de behövs.
Katameros, Agpeya och Kholagy ligger i appen direkt.

## Läsningsreglerna

Reglerna är desamma som i CopticPrayers-appen som texterna kommer ifrån, i
denna ordning: påskveckan, fasta högtider, Jonas fasta, stora fastan, de
femtio dagarna, söndag den 29:e, julens paramoun och julen, teofanins
paramoun, Kiahks söndagar räknade från julen, övriga söndagar, vardagar.
`__tests__/lectionary.test.ts` visar varje regel med riktiga datum.

Prästen bör bekräfta fyra punkter:

1. **Pingst.** Originalappen gav pingstdagen vanliga söndagsläsningar. Här
   används pingstraden i datan (Joh 7:37–44, Apg 2:1–21).
2. **8 januari under skottår.** När julen infaller den 28 Kiahk (7 januari)
   upprepar originalappen julens läsningar dagen efter. Det är kvar här.
3. **Kvällsbyte.** Originalappen bytte till morgondagens läsningar kl. 18,
   eftersom aftonbönen hör till nästa dag. Här byter dagen vid midnatt.
4. **Fel i källdatan.** Femtio dagarnas dag 10 har hänvisningen
   "Matt 17:29–23", som inte finns. Appen visar en notis i stället för text.

Påskveckans läsningar (Pascha-boken) finns i APK:n men är inte inbyggda än.

## Rättigheter

Den svenska bibeltexten ser ut att vara Svenska Folkbibeln, och de svenska
översättningarna av Agpeya, Kholagy och de liturgiska fraserna har någon
upphovsman. Därför ligger inga texter i repot. Tillstånd behövs innan
appen publiceras.

## Webbförhandsvisning

```sh
npx expo export --platform web
python3 scripts/build_preview.py ../preview
```

Skriptet gör sökvägarna relativa så att förhandsvisningen fungerar från
vilken mapp som helst. Därför är `asyncRoutes` avstängt för webben i
`app.json`; telefonapparna påverkas inte.

## Testat och inte testat

Testat: enhetstester, typkontroll, lint, `expo-doctor` (två kontroller
kräver nätverk till Expos servrar och gick inte att köra här) och hela
webbversionen i Chromium i telefon- och surfplattestorlek, ljust och mörkt,
svenska och arabiska, inklusive hopp till varje avsnitt, dockans pilar,
hjulet och flytt av dockan. Inte testat: på riktiga iPhone- och
Android-telefoner, där haptiken och glaset bara finns. Hur fällningen
(halvöppen, bokläge) på en Duo påverkar layouten är inte gjort: Expo har
inget färdigt sätt att läsa av gångjärnets läge. Glaseffekten (Liquid Glass) syns bara på
iOS 26.

Scrollning: mätt i Chromium med fyra gånger långsammare processor under
snabba svep i en lång liturgi. Läsaren använder en vanlig `FlatList`
(Reanimateds animerade lista lade en animerad vy runt varje rad), raderna
har ingen layoutanimation, och på webben ritas knapparna utan bakgrundsoskärpa
eftersom oskärpa över text som rör sig ritas om varje bildruta.

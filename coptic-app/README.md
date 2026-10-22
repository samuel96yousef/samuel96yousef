# Koptisk bönbok – prototyp, steg 1

En tvåspråkig app (arabiska och svenska) för en koptisk församling i Sverige.
Steg 1 lägger grunden: designspråket, dagens läsningar ur Katameros, hela
Agpeya och ett uppslagsläge för vikbara skärmar.

Arbetsnamnet "Koptisk bönbok" är en platshållare.

## Köra prototypen

Texterna finns inte i repot (se *Rättigheter* nedan). Generera dem från
CopticPrayers-APK:n och öppna sedan `index.html` direkt i webbläsaren:

```sh
python3 tools/export_data.py /sökväg/till/Coptic.apk --start 2026-10-15 --days 36
open index.html
```

`--start` och `--days` styr vilka datum som får läsningar. Agpeya och
bokregistret exporteras alltid i sin helhet.

`tools/build_artifact.py <ut.html>` bygger en fristående fil med allt inbakat.

## Vad som finns

| Flik | Innehåll |
| --- | --- |
| Idag | Koptiskt datum (med månadens namn på koptiska), gregorianskt datum, högtider och minnesdagar, fasteperiod, dagens ord, aktuell timbön och dagens läsningar. |
| Läsningar | Dagens Katameros-läsningar: Aftontjänst, Morgontjänst, Paulus epistel, Katholikon, Praxis och Evangeliet, med psalm och de liturgiska fraserna. Bläddra dag för dag. |
| Agpeya | Alla åtta timbönerna. Den som gäller just nu är markerad. |
| Bibeln | Bokregistret. Läsning av hela Bibeln kommer i steg 2; texten finns redan i materialet. |

Inställningar: appens språk (svenska eller arabiska med spegelvänd layout),
vilka texter som visas (arabiska, båda, svenska), textstorlek, läsläge
(papper, sepia, natt) och bokuppslag.

## Designspråk

**Från kyrkboken.** Sidorna är byggda som Katameros-sidorna i bilderna: vitt
papper, dubbel karmosinröd ram med koptiska kors i hörnen, dagens titel i en
kartusch med gallerornament, rubriker centrerade, prickad linje under
bibelhänvisningen och ett kors mellan läsningarna. Rubriken på månadssidan
är valvet från bokens titelsida, med medaljongpelare och korsgaller.
Arabiska hänvisningar skrivs med arabiska siffror och psalmerna numreras
som i Septuaginta (٢١ i stället för 22), precis som i boken.

**Typografi.** Amiri (klassisk naskh som klarar tashkeel) för arabiska,
Literata (gjord för långläsning på skärm) för svenska, Noto Sans Coptic för
koptisk skrift och systemets typsnitt (SF på Apple) för gränssnittet.
Arabiskan sätts större och med mer radavstånd än svenskan så att
vokaltecknen får plats.

**Från Apple.** Svävande glasflikar som krymper när man läser, stora rubriker
som glider upp i navigationsfältet, ark som dras ned för att stängas,
fjäderanimationer och segmentväljare med glidande markering.

**Vikbar skärm.** Hopvikt visar appen en sida i taget. När skärmen är bred
nog (en vikbar telefon fälls upp, telefonen vrids, surfplatta) blir
läsningen ett uppslaget bokuppslag: svenska till vänster, arabiska till
höger, vers för vers på samma höjd. Den svenska sidan svänger ut från
bokryggen och läsaren hamnar på samma ställe i texten. På dator visar
prototypen en telefonram med knappen *Hopvikt/Uppvikt* för att demonstrera.

## Textmaterialet

APK:n innehåller fem SQLite-databaser: Agpeya, Katamars, Bible, Kholagy och
Dlal (påskveckan). Exportskriptet använder samma regler som originalappen
för att välja dagens läsningar: påskveckan, Jonas fasta, stora fastan, de
femtio dagarna, söndagar och tabellen `days_relations` för vardagar.

Inte inbyggt än:

- Särreglerna i Kiahk och Touba (paramoun, julen under skottår). Dagar i de
  månaderna markeras med en varning.
- Fasta högtider som går före säsongsläsningarna.
- Kholagy (liturgierna), Pascha-boken och Bibeln som läsbok.

## Beslut som behövs

1. **Rättigheter till texterna.** Den svenska bibeltexten ser ut att vara
   Svenska Folkbibeln och de svenska översättningarna av Agpeya och
   liturgiska fraser har någon upphovsman. Tillstånd behövs från
   rättighetsinnehavarna (troligen Stiftelsen Svenska Folkbibeln och
   utvecklaren av CopticPrayers) innan appen publiceras. Därför ligger
   texterna inte i detta publika repo.
2. **Plattform.** Rekommendation: Expo (React Native). En kodbas för iOS och
   Android, databaserna kan användas som de är via `expo-sqlite`, och det
   finns stöd för iOS 26:s glaseffekt. Alternativet PWA är billigast men
   ger ingen plats i App Store och sämre push-notiser på iPhone.
   Kostnad: Apple Developer Program 99 USD/år, Google Play 25 USD en gång.
3. **Terminologi.** Svenska rubriker (Aftontjänst, Morgontjänst, Katholikon,
   Praxis) är tagna från materialet. Prästen bör godkänna dem.
4. **Korrläsning.** Materialet har stavfel ("väsignelse", "Förhärligad är
   Gud i alltid"). Exporten rättar bara saknade mellanslag efter punkt.

## Nästa steg

- Bibeln som läsbok med sök.
- Kholagy (liturgierna) med präst/diakon/folk-roller och koptiska.
- Komplett läsningskalender inklusive Kiahk, Touba och Pascha.
- Församlingens egna uppgifter: gudstjänsttider och kalender.
- Välja plattform och flytta designen dit.

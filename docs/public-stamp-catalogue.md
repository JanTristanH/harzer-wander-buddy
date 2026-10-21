# Echte Expo-App als statische Website

Die Website `JanTristanH/harzer-wander-buddy-website` baut **diese App** in GitHub
Actions. Es gibt keine zweite Implementierung von Liste, Karte, Navigation oder
Styling. Das Profil ersetzt nur Authentifizierung, öffentliche Datenzugriffe
und den Einstieg in kanonische Website-Artikel.

```sh
npm ci --prefix app
node scripts/build-static-website.mjs /tmp/expo-website
python3 scripts/export-public-stamps.py --as-of 2026-10-20 --output /tmp/public-catalogue.json
```

Der Build verwendet `EXPO_PUBLIC_DATA_MODE=static`, `EXPO_PUBLIC_AUTH_MODE=sso`
und `EXPO_PUBLIC_STATIC_BASE_PATH=/preview/overview/app`. Er exportiert denselben
Expo-Router-Baum wie der normale Web-Build. `app-build.json` hält Quell-Commit,
Buildprofil und Mount-Pfad fest. Der normale SSO- und native Build bleibt bei
seiner bisherigen Konfiguration. `npm run build:web:static-website --prefix app`
verwendet standardmäßig `app/dist-static-website` als Ausgabe.

## Datenadapter

`app/lib/static-website.ts` lädt einmalig `public-catalogue.json` unter dem
Mount-Pfad. Die vorhandenen `fetchPublic*`-Funktionen verwenden in diesem
Buildprofil diesen Katalog statt OData. Besuche und Gruppenzustände sind leer.
Der reine Gast-AuthProvider lädt keine Auth0-Discovery und stellt keine Sitzung
wieder her. Backend-Lese-/Schreibfunktionen weisen versehentliche Aufrufe im
statischen Profil ab. Der Query-Cache wird pro App-Quellrevision invalidiert.

Der Python-Exporter wählt die am expliziten UTC-Stichtag gültigen HWN 1–222 und
exportiert ausschließlich öffentliche Stammdaten. Öffentliche Parkplätze
kommen ebenfalls aus CAP-Demodaten; keine Nutzer, Besuche, Freunde, Touren oder
Gruppendaten. Quellrevision und Prüfsummen beider CSVs dokumentieren die
Herkunft. Uncommittierte CSV-Dateien, unplausible Koordinaten sowie fehlende oder
doppelte aktive Stempelnummern brechen den Export ab.

Jekyll ergänzt Bilder, Bildnachweise und `articleUrl` aus den vorhandenen
Beiträgen. Liste und Karten-Details öffnen diese Artikel im übergeordneten
Browserfenster, ohne Slugs aus CAP-Namen zu erzeugen. Der Anmeldeeinstieg
verlässt die statische Website und führt zur laufenden App unter
`https://app.harzer-wander-buddy.de/app/rnweb/login`. Auch die Grundkarte bleibt
die echte App-Komponente mit OpenFreeMap.

## GitHub CI und Aktualisierung

Der Workflow **Static website Expo build** prüft das statische Profil bei
App-PRs und Änderungen auf `develop`/`main`. Die Website-CI checkt den aktuellen
freigegebenen App-Stand aus, erzeugt den öffentlichen Katalog, baut Jekyll und
die echte Expo-App und veröffentlicht beides zusammen als Pages-Artefakt.
Die Website rahmt den Export als vollflächige, gleichursprüngliche App ein;
darunter stehen alle 222 Artikelverweise als sichtbarer HTML-Index.

Der Website-Workflow prüft alle 12 Stunden auf einen neuen App-/Website-Stand und
überspringt unveränderte Builds am selben UTC-Tag. Nach UI-Änderungen ist kein
Kopieren von Komponenten nötig. Die Details der einmaligen Umstellung von
GitHub Pages auf die Quelle **GitHub Actions** stehen im Website-PR.

## Validierung

```sh
python3 -B -m unittest discover -s scripts/tests -v
npm test --prefix app -- --runInBand --config jest.config.js
```

Zusätzlich prüft die Website-CI die erzeugten HTML-/Expo-Dateien und den
Browserbetrieb mit blockiertem Backend: Liste, Karte, Artikelnavigation,
Anmeldeübergang und den HTML-Index ohne JavaScript.

## JavaScript-Ladegewicht

Das statische Profil aktiviert Expos asynchrone Produktionsrouten für Web.
Zusätzlich lädt die Webkarte Leaflet und MapLibre erst beim Einhängen ihrer
Kartenkomponente. Diese eigene Importgrenze ist nötig, weil Expo Bibliotheken,
die mehrere Routen verwenden, sonst in das sofort geladene gemeinsame Paket
verschiebt. Marker, Linien, Karten-Refs und OpenFreeMap bleiben erhalten.
Während des Downloads erscheint eine Ladeanzeige; nach einem Ladefehler kann
der Nutzer erneut versuchen. Die native Kartenimplementierung bleibt unverändert.

Stempelbilder ohne Besuch werden im Browser per CSS entsättigt. Dadurch entfällt
der bisher dafür ausgelieferte SVG-Filter samt `react-native-svg` im Webexport.
Native Builds verwenden weiter ihren authentifizierten Bildcache und SVG-Filter.

Vergleich mit PR #90 (`6ce12a9`), gleicher Lockfile-Stand, Produktions-Webexport:

| JavaScript | Vorher | Nachher |
| --- | ---: | ---: |
| Initialer Listenaufruf im Browser | 4,91 MB | ca. 3,20 MB |
| Einstieg inklusive Listen-Abhängigkeiten, gzip-Schätzung | 1,26 MB | ca. 0,81 MB |
| Einstieg inklusive Listen-Abhängigkeiten, Brotli-Schätzung | 1,12 MB | ca. 0,72 MB |
| Gesamter Export, unkomprimiert | 4,91 MB | ca. 4,83 MB |

Die Einsparung betrifft vor allem den Einstieg: etwa 35 % weniger JavaScript.
Beim Öffnen der Karte kommen etwa 1,25 MB für die Kartenbibliotheken hinzu.
Die Summe aller komprimierten Dateien bleibt durch zusätzlichen Chunk-Overhead
etwa auf dem bisherigen Niveau; Code-Aufteilung allein entfernt keinen Code.
Komprimierte Werte sind pro Datei berechnet (gzip Level 6, Brotli Qualität 5),
keine Behauptung über die tatsächlich aktivierte GitHub-Pages-Kompression.

Der Build schreibt `bundle-size.json` mit Gesamtgröße, einzelnen
HTML-Einstiegspunkten und der deduplizierten Vereinigung von Root- und
Listen-Abhängigkeiten. Script-Tags und JavaScript-Preloads werden mitgezählt.
Über 3,5 MB unkomprimiert für diesen Listeneinstieg schlägt der Build fehl.
Das Budget ist eine Regressionserkennung; der Browsercheck bestätigt zusätzlich,
dass die Kartenbibliotheken tatsächlich erst beim Öffnen der Karte geladen werden.

```sh
node scripts/measure-web-bundle.mjs /tmp/expo-website --check
node --test scripts/tests/measure-web-bundle.test.mjs
```

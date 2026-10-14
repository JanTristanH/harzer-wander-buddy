# RN-Web lokal über CAP starten und testen

Stand: 2026-08-07

## Warum über CAP testen?

Die lokale Auth0-Konfiguration und die produktionsnahe statische Auslieferung sind
für `http://localhost:4004/app/rnweb` eingerichtet. Der Expo-Web-Devserver auf Port
8081 ist deshalb kein gleichwertiger Test für Login, Routing oder die endgültigen
Webassets.

## Sauberer Start

1. Aus dem Repository-Root den Expo-Webbuild erzeugen und in die CAP-App kopieren:

   ```bash
   ./scripts/build-and-copy-rnweb.sh
   ```

   Das Skript exportiert `app/dist`, löscht anschließend
   `backend/hwb/app/rnweb` und ersetzt es vollständig. Änderungen im Zielordner
   gehen beim nächsten Build verloren.

2. CAP in einem dauerhaft geöffneten Terminal starten:

   ```bash
   cd backend/hwb
   npm run watch
   ```

   `npm start` ist ebenfalls möglich, startet aber `cds-serve` ohne Watch-Modus.
   Das Development-Profil verwendet standardmäßig die persistente SQLite-Datenbank.

3. Vor einem Browsertest prüfen, dass Port 4004 wirklich lauscht:

   ```bash
   lsof -nP -iTCP:4004 -sTCP:LISTEN
   ```

4. Im Browser öffnen:

   - Einstieg: `http://localhost:4004/app/rnweb/`
   - Karte direkt: `http://localhost:4004/app/rnweb/map`

   Der lokale Testzugang ist im `AGENTS.md` des Repository-Roots dokumentiert und
   sollte nicht zusätzlich an mehreren Stellen kopiert werden.

## Iterationsschleife nach Frontendänderungen

1. `./scripts/build-and-copy-rnweb.sh` erneut ausführen.
2. Auf die Abschlussmeldung `[3/3] Done` und Exitcode 0 achten.
3. Noch einmal prüfen, dass CAP auf Port 4004 läuft.
4. Erst danach Chrome vollständig neu laden. Die exportierten JavaScript-Dateien
   haben Hashnamen; ein offener Tab kann sonst noch den vorherigen Bundle-Hash
   verwenden.

Die Expo-Meldung `Something prevented Expo from exiting, forcefully exiting now.`
trat bei erfolgreichen Builds auf. Entscheidend sind Exitcode 0 und die
abschließende Kopiermeldung, nicht diese Meldung allein.

Ein `ERR_CONNECTION_REFUSED` nach dem Reload bedeutet nicht, dass der Webbuild
defekt ist. Zuerst Port 4004 prüfen und CAP gegebenenfalls neu starten. Ein in einer
kurzlebigen Shell gestarteter Server kann mit dieser Shell beendet worden sein.

## Automatisierte Kartenprüfungen

Aus `app/`:

```bash
./node_modules/.bin/jest --config jest.config.js \
  __tests__/map-primitives-web.test.tsx \
  __tests__/map-viewport.test.ts \
  __tests__/web-map-marker.test.ts \
  __tests__/group-marker.test.ts \
  __tests__/map-selection-sheet.test.tsx \
  --runInBand --watchman=false
```

Gezieltes Linting der Kartenänderungen:

```bash
./node_modules/.bin/eslint \
  'app/(tabs)/map.tsx' \
  components/maps/map-primitives.web.tsx \
  lib/map-viewport.ts \
  lib/web-map-marker.ts \
  __tests__/map-primitives-web.test.tsx \
  __tests__/map-viewport.test.ts \
  __tests__/web-map-marker.test.ts
```

Zusätzlich aus dem Repository-Root:

```bash
git diff --check
./scripts/build-and-copy-rnweb.sh
```

Der Exportbuild ist ein wichtiger Integrationstest, weil er auch statisches Expo-
Routing und den Basis-Pfad `/app/rnweb` abdeckt. Ein vollständiger TypeScript-Lauf
kann vorhandene, themenfremde Baseline-Fehler enthalten; neue Fehler immer gegen
den vorherigen Stand abgrenzen.

## Manueller Karten-Smoke-Test

Mit gleichbleibender Fenster- und Kartengröße prüfen:

1. Karte laden und auf vollständig geladene Kacheln warten.
2. Einen zwei- und einen dreistelligen Stempelmarker ansehen: Zahl und weißes Badge
   müssen mittig im Pin stehen.
3. Karte verschieben; danach müssen Marker erscheinen, die in den neuen gepufferten
   Viewport fallen.
4. Mindestens fünfmal mit den Plus-/Minus-Tasten hinein- und herauszoomen.
5. Dasselbe mit Trackpad oder Mausrad wiederholen.
6. Während des Zooms auf Ruckler, verschobene Marker und unnatürliche Sprünge achten.
7. Nach dem Zoom einen Marker anklicken und prüfen, dass genau einmal das richtige
   Auswahl-Sheet erscheint.
8. Optional Standortfreigabe testen und prüfen, dass identische Koordinaten keine
   sichtbaren Wiederholungsupdates verursachen.

Panning und Zoom getrennt beurteilen. Leaflet verschiebt beim Panning überwiegend
eine gemeinsame Pane; Zoom kann dagegen deutlich mehr Markerarbeit auslösen.

## Eingebaute Performance-Diagnostik

Auf `localhost` und `127.0.0.1` schreibt die Karte automatisch alle vier Sekunden
Diagnosen in die Chrome-Konsole:

- `[map perf]`: Heap, gerenderte/sichtbare/gesamte Stempel und Parkplätze,
  Marker-Buildzeit, Long Tasks und React-Query-Anzahl.
- `[map perf][leaflet]`: Icon-Cache, Marker-Renders, Mounts/Unmounts, Move-Events
  und maximale Move-Dauer.
- `[map perf][warn]`: Markeraufbau ab 14 ms oder Long Tasks ab 100 ms.

Für belastbare Vergleiche:

- immer dieselbe Region, Zoomstufe und Fenstergröße verwenden;
- Markeranzahl und maximale Long-Task-Dauer mitnotieren;
- erst einen Funktions-Smoke-Test, danach ein Performance-Profil durchführen;
- keinen Heap- oder Allocation-Profiler parallel zur eigentlichen Zeitmessung
  laufen lassen;
- DevTools nach Möglichkeit undocken oder schließen, weil ein angedocktes Panel die
  Viewportgröße und damit die Anzahl gerenderter Marker verändert.

Wenn Chrome während einer Computer-Use-Prüfung parallel vom Benutzer bedient wird,
vor jeder weiteren Aktion den UI-Zustand neu einlesen. Alte Accessibility-Element-
IDs sind nach Nutzerinteraktionen oder Zoomschritten nicht mehr zuverlässig.

## Weiterführend

Die Ursachen, Schalter und Performance-Fallbacks für den Leaflet-Zoom stehen in
[`web-map-zoom-performance.md`](./web-map-zoom-performance.md).


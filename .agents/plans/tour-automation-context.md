# Tourenautomatik – aktueller Kontext

Stand: 20.10.2026. Implementierung und Abschlussprüfungen sind abgeschlossen.
Branch: `feat/tour-automation`; Ziel des PR: `develop`.
Der aktuelle Stand von `origin/develop` (`e1737a5`) wurde integriert.

## Freigegebene Entscheidungen

- Design B1 mit Apple-Design-Skill von https://github.com/dickwu/apple-design-skill.
- Separater runder Funkel-Button über dem manuellen Touren-Plus.
- Drei beschriftete Fortschrittspunkte: Zeit & Start → Für wen → Vorschläge.
  Erledigt: Haken; aktuell: Ring mit Punkt; zukünftig: leerer Kreis.
- Solo und Gruppe sind gleichwertig. Bereits ausgewählte Gruppe wird beim ersten
  Betreten von Schritt 2 übernommen. Bewusste Soloauswahl bleibt bestehen.
- Gruppenmodi „Fehlt allen“ / „Fehlt mindestens einer Person“ beeinflussen die
  Berechnung, nicht erst die Anzeige. Der aktuelle Nutzer ist immer dabei.
- Bis zu fünf Vorschläge; jeder kann in der Detailansicht angesehen und einzeln
  gespeichert werden. Die Vorschläge bleiben dabei erhalten.
- Speichern bleibt ausdrücklich im aktuellen Screen. Danach heißt die Aktion
  „Gespeichert · Bearbeiten“. Erst ein weiterer Tipp öffnet den Bearbeitungsmodus.
- Unterpunkte: Meine Touren, Buddy-Empfehlungen (letzte Berechnung), Entdecken.
- Große Vorschau mit echter Karte und kurzer Routenanimation. Reduzierte Bewegung
  wird berücksichtigt. Kleine Routenbilder werden aus echter Geometrie erzeugt
  und in `Tours.previewSvg` gecacht; keine künstlich generierten Landschaften.
- Auftrag endet mit PR inklusive echter App-Screenshots; kein Merge oder
  Produktionsdeployment beauftragt.

## Implementierung

- Backend: `srv/tour-automation.js`, `srv/tour-preview.js`, Änderungen in
  `hwb-service.js`, `hwb-service.cds`, `db/schema.cds` und API-Dokumentation.
- Backend optimiert innerhalb des vorhandenen Wegegraphen, zweier Startparkplätze
  und der gewählten Segmenttiefe. Grenze: 100.000 Suchzustände pro Startparkplatz;
  `searchLimited` wird angezeigt. App verwendet maximal 16 Segmente.
- Rückgabe entspricht Touren: sortierte `travelTime_ID`-/`rank`-Links mit
  eingebettetem `travelTime`, Geometrie und Metriken. Das ist eine Änderung des
  bisherigen Rückgabevertrags von `calculateHikingRoute`.
- Neue App-Routen: `app/tours/automatic.tsx` und `app/tours/proposal.tsx`.
- Gemeinsame UI: `components/tour-planner-ui.tsx`.
- Parser/Formatierung: `lib/tour-automation.ts`.
- Nutzerspezifischer persistierter Vorschlags-Cache: `lib/tour-suggestions.ts`.
  Er hält die letzte Berechnung, Session-ID und gespeicherte Tour-ID pro Vorschlag.
- Tourenliste, API-Client, Queries und Router sind integriert. Gruppenwechsel
  behalten bestehende Listendaten, damit die Gruppenauswahl nicht verschwindet.
- Screenreader-Zustände sind auch im Web explizit verfügbar.
- Der Backend-Lockdatei fehlen auf dem aktuellen develop zwei transitive Einträge
  für `encoding`/`iconv-lite`. Diese wurden minimal ergänzt (23 Zeilen), damit
  ein sauberer npm-ci-Lauf mit der hier verwendeten npm-Version möglich ist.

## Abschlussprüfungen

- Gesamte App-Testsuite: **41 Suiten, 199 Tests grün**.
- Gesamte Backend-Testsuite: **29 Tests grün**.
- TypeScript-Gesamtprüfung: **fehlerfrei**, nach Integration des aktuellen develop.
- Gezieltes ESLint: fehlerfrei.
- Expo-Webexport über `scripts/build-and-copy-rnweb.sh`: erfolgreich.
- Release-Skripte: 31 Tests grün; Expo-Runtime-Fingerprint-Test: grün.
- Browser: Gruppe als Standard, Solo, fünf Vorschläge, alle fünf einzeln
  speichern ohne Navigation, explizites Bearbeiten, Empfehlungen und gespeicherte
  IDs nach Reload, schmaler Viewport, Desktop, dunkler Modus, reduzierte Bewegung
  und ungültige Vorschlags-Session geprüft.
- Browser nutzt separate SQLite-Testdatenbank und lokale Testauthentifizierung;
  kein End-to-End-Test von Auth0 und kein nativer Gerätetest.
- Beim Einstieg in den statischen Webexport ist ein React-Hydrationhinweis (#418)
  protokolliert. Die getesteten Abläufe bleiben funktionsfähig; Screenshots wurden
  nach vollständigem Rendern und Laden der Karten aufgenommen.

## Screenshots und Betrieb

Screenshots und Beschreibung: `docs/screenshots/tour-automation/README.md`.
Keine Designboards als echte Screenshots ausgeben.

Vor Auslieferung der App das aktualisierte Backend-Schema mit
`Tours.previewSvg` deployen. PostgreSQL: `npm run deploy:postgres` in
`backend/hwb`. App und Backend gemeinsam aktualisieren; Rückgabevertrag ist geändert.
Keine manuellen Versionsbumps vornehmen (Release Please / AGENTS.md).

Die getrackte `backend/hwb/db.sqlite` wurde nicht als Featureänderung modifiziert.
Temporärer Testserver: `/tmp/run-tour-ui.cjs`, explizites Ziel
`sqlite:/tmp/tour-ui.sqlite`. Nicht `.to('sqlite')` verwenden, das würde hier
stattdessen die normale db.sqlite neu anlegen. Server auf Port 4004.
Temporärer Browserlauf: `/tmp/tour-browser-smoke.py` (Playwright,
`/usr/bin/chromium`, Testauthentifizierung, Proxy für Kartenressourcen).
Diese temporären Dateien sind keine Produktänderung und können später fehlen.

Testbefehle: `npm test` in `backend/hwb`; in `app`
`npm test -- --runInBand --config jest.config.js`, `npx tsc --noEmit`.
Bauen: `./scripts/build-and-copy-rnweb.sh` aus dem Repository-Root.
PR muss nach `develop` gehen, Conventional-Commit-Titel und Screenshots enthalten.

# Tourenautomatik – Kontext zur Fortsetzung

Stand: 20.10.2026. Die Arbeit wurde auf ausdrücklichen Wunsch des Nutzers pausiert.
Repository: `/workspace/harzer-wander-buddy`. Branch: `feat/tour-automation`.

## Auftrag und verbindliche Entscheidungen

- Premium-Highlight: automatische Touren mit Zeitbudget, fehlenden Stempeln und
  Gruppenmodi „Fehlt allen“ / „Fehlt mindestens einer Person“.
- Zuerst Backend absichern und Rückgabe an vorhandene Touren anpassen, danach App.
- Apple-Design-Skill nutzen: https://github.com/dickwu/apple-design-skill.
  Er wurde gelesen und unter `/tmp/apple-design-skill` geklont. Bei fehlendem
  temporärem Verzeichnis erneut laden, insbesondere `SKILL.md` und passende
  HIG-Referenzen. Keine Agentendelegation wurde beauftragt.
- Zwei Designrunden wurden als Bilder gezeigt. Freigegeben ist **B1**:
  dezenter runder Funkel-Button direkt über dem bestehenden Touren-Plus;
  geführter Vollbildablauf mit drei beschrifteten Fortschrittspunkten:
  „Zeit & Start“, „Für wen“, „Vorschläge“.
- Fortschritt: erledigt = gefüllter Kreis mit Haken; aktuell = Ring mit Punkt;
  zukünftig = offener Kreis. Auf Schritt 1 darf noch kein Haken erscheinen.
- Solo ist gleichwertig: „Nur ich“ / „Mit Gruppe“. Eine bereits global gewählte
  Wandergruppe wird beim ersten Betreten von Schritt 2 als Standard übernommen.
  Eine bewusste Soloauswahl darf danach nicht von Gruppenänderungen überschrieben
  werden. Bei Solo keine Freundes-IDs an die Berechnung schicken.
- Gruppenoptionen nur im Gruppenmodus. Aktueller Nutzer ist immer dabei.
- Vorschlagsansicht mit großer echter Karte und darunter Metriken sowie Pager,
  entsprechend dem dritten Bildschirm des ursprünglichen B-Entwurfs.
- **Wichtige letzte Nutzervorgabe:** Speichern bleibt auf demselben Screen.
  Schaltfläche wird „Gespeichert · Bearbeiten“. Erst ein weiterer Tipp öffnet die
  gespeicherte Tour im Bearbeitungsmodus. Alle Vorschläge müssen nacheinander
  in der Detailansicht angesehen und einzeln gespeichert werden können.
- Aktuelles Maximum: **5** Vorschläge insgesamt; Nutzer darüber informiert.
  Keine Erhöhung verlangt. Pager muss die tatsächliche Anzahl verwenden.
- Vorgesehene Unterpunkte: „Meine Touren“, „Buddy-Empfehlungen“, „Entdecken“.
  Buddy zeigt die zuletzt erzeugten persönlichen Vorschläge; Entdecken die
  bestehenden zugänglichen Touren. Keine erfundenen Empfehlungen.
- Tourenvorschauen ebenfalls anpassen; Nutzer schlug optional vorgenerierte Bilder
  in der DB vor. Aktuelle Implementierung erzeugt kleine SVGs aus echten
  Routenkoordinaten und speichert sie in `Tours.previewSvg`; große Ansicht nutzt
  eine interaktive Karte. SVG ist ein Routenbild, kein Kartenkachel-Screenshot.
- Dezenter Premium-Moment: Route zeichnet sich einmal kurz ein (650 ms), mit
  Unterstützung für „Bewegung reduzieren“; keine künstliche Wartezeit.
- Am Ende **PR mit echten App-Screenshots**. Noch kein PR erstellt/gepusht.

## Git und Implementierungsstand

Backend-Grundlage ist bereits committed:
`b1ed134 Secure automatic tour planning with group-aware scoring and Tour-compatible results`.

Die weiterführende App-Implementierung und SVG-Erweiterungen sind **noch nicht
committed**. Nicht verwerfen; `git status` zeigt den vollständigen Arbeitsstand.
Es existiert noch keine visuelle Endabnahme der implementierten Oberfläche.

### Bereits committed: Berechnung

- `backend/hwb/srv/tour-automation.js`: reine, testbare Graphsuche;
  gruppenabhängige Bewertung während der Suche, eindeutige Stempel statt
  wiederholter Besuche, Rückweg und Zeitbudget, Rückwege über bekannte Stationen,
  Fahrten nur am aktuellen Auto, Fahrstrecke nicht zur Gehstrecke addiert.
- Sortierung: passende Stempel absteigend, dann Dauer und Gehstrecke aufsteigend;
  global über beide Startparkplätze dedupliziert und auf fünf begrenzt.
- Suche an zwei nächsten Parkplätzen; höchstens 100.000 Suchzustände je Parkplatz,
  `searchLimited` wird an die App zurückgegeben. Keine globale Optimalität
  versprechen. `maxDepth` begrenzt Segmente; die App verwendet derzeit 16.
- `hwb-service.js`: Parameter- und Freundschaftsprüfung, Nutzer immer dabei,
  kein veralteter globaler Wegegraph-Cache; temporäre Parkplatzabfrage wird
  aufgeräumt.
- Rückgabe: `id`, `idListTravelTimes`, Gesamtmetriken, `matchingStampCount`,
  `newStampCountForUser`, Gruppendaten und `path` wie Touren: `travelTime_ID`,
  `rank` in 512er-Schritten, eingebettetes `travelTime` inklusive Geometrie.
- `backend/hwb/README.md` beschreibt den API-Vertrag und die Suchgrenzen.

### Noch uncommitted: Backend-Ergänzungen

- `db/schema.cds`: neues schreibgeschütztes Feld `Tours.previewSvg`.
- `srv/tour-preview.js`: kompakte SVG-Erzeugung aus validierter Geometrie.
- `srv/tour-automation.js` / `hwb-service.cds`: Vorschläge liefern ebenfalls SVG.
- `hwb-service.js`:
  - vor `CREATE Tours`: Wegsegmente prüfen, Metriken aus tatsächlichen Segmenten
    ableiten und SVG erzeugen; leere manuelle Touren bleiben möglich;
  - vorhandene Touren bekommen beim Lesen fehlende SVGs nachgetragen und gecacht;
  - POI-Änderungen regenerieren die Vorschau; hierfür Geometrie aus `TravelTimes`
    laden, da die `typedTravelTimes`-View kein `positionString` enthält;
  - leere Segmentlisten erzeugen keine leeren Tour-Verknüpfungen.
- Deployment muss das neue DB-Feld berücksichtigen. Kein Produktionsdeployment
  vorgenommen. SQLite-Seed-Dateien sind unverändert.

### Noch uncommitted: App

- `app/app/tours/automatic.tsx`: dreistufiger B1-Planer mit Zeitvorgaben und eigener
  Dauer, Standortfreigabe auf Aktion oder Parkplatzsuche, weiteren Optionen
  (Gehstrecke, Mindeststempel, Fahrten), Gruppenstandard, Solo, Fehlermeldungen,
  Ergebnis-Pager, Speichern ohne Navigation, explizitem Bearbeiten.
- `app/app/tours/proposal.tsx`: eigene Detailansicht für **jeden** Vorschlag,
  Karte, Metriken, Name vor Speichern editierbar, Stationen mit Links zu
  Stempeln/Parkplätzen, Pager, Speichern ohne Verlassen, danach Bearbeiten.
- `app/components/tour-planner-ui.tsx`: Stepper, Buttons, Themes, SVG-Thumbnails,
  echte Karte über vorhandene Map-Primitives und kurze Routenanimation.
- `app/lib/tour-automation.ts`: Koordinatenparser, Routennamen/Stationen,
  Formatierung und Zeitbudgetprüfung.
- `app/lib/tour-suggestions.ts`: nutzerspezifischer React-Query-Cache mit letzter
  Berechnung, Session-ID und gespeicherten Tour-IDs je Vorschlag. Bestehender
  Query-Persister speichert ihn mit. Vorschläge bleiben nach Detailnavigation
  und Speichern erhalten. Wiederholtes Speichern desselben Vorschlags wird über
  dessen gespeicherte ID abgefangen. Nur explizite Berechnung ersetzt die Session.
- `app/lib/api.ts`: aktualisierter Typvertrag und normalisierte verschachtelte
  Geometrie/SVGs; korrekt typisierter OData-Funktionsaufruf mit escaped und
  URL-kodierten Parametern.
- `app/lib/queries.ts`: `useAuthorizedRequest` exportiert zur Wiederverwendung
  der bestehenden Token-/401-Behandlung.
- `app/app/(tabs)/tours.tsx`: drei Bereiche, SVGs in Tourenkarten,
  Buddy-Vorschläge mit Links auf Detailansichten und separater Funkel-FAB über
  manuellem Plus. Vorschlagsreihenfolge folgt der Berechnung, nicht Sortierung.
- `app/app/_layout.tsx`: neue Routen registriert.

## Prüfungen beim Pausieren

### Erfolgreich

- Backend: **23 Tests grün**, zuletzt `npm test` in `backend/hwb`.
  Deckt Modi, Zeit-/Streckengrenzen, Rückwege, Fahrten, Parameter, Berechtigungen,
  Datenaktualisierung, Suchbegrenzung, tatsächliche HTTP-Rückgabe, Tour-Speichern,
  SVG-Cache sowie Regenerierung beim Bearbeiten ab.
- App: fünf gezielte Testsuiten mit **8 Tests grün**. Anschließend drei neue
  Suiten mit **5 Tests erneut grün**, nach Behebung eines offenen Mutation-GC-
  Timers im Test. Neu:
  `tour-automation-api.test.ts`, `tour-automation-flow.test.tsx`,
  `tour-suggestions.test.tsx`. Bestehende Tourkarten-/Header-Tests angepasst.
- App-Flowtest prüft explizit: Gruppe als Standard, bewusste Soloauswahl ohne
  Freunde im Request, Gruppenmodus, beide Vorschläge speichern ohne Navigation,
  erst weiterer Tipp auf Bearbeiten navigiert.
- API-Test prüft Kodierung von Sonderzeichen, vollständige Geometrie und Metriken.
- Cachetest prüft wiederholtes Speichern, erhaltene Vorschläge, Hydrierung und
  Trennung verschiedener Nutzerkonten.
- `./scripts/build-and-copy-rnweb.sh`: Expo-Webexport erfolgreich, neue Routen
  exportiert. `backend/hwb/app/rnweb` ist generiertes, ignoriertes Buildziel und
  wird nicht direkt bearbeitet.
- TypeScript: keine gemeldeten Fehler in neuen/geänderten Feature-Dateien.
  Der Gesamtlauf hat weiterhin drei bestehende Fehler in unveränderten Stellen:
  `.tsx`-Import in `app/(tabs)/map.web.tsx`, `.tsx`-Import in
  `app/tours/[id]/index.web.tsx`, nullable `TokenResponse` in `lib/auth.tsx:481`.

### Noch offen / nicht abschließend geprüft

1. **Visueller Browser-Smoke-Test und Screenshots fehlen vollständig.** Bislang
   nur Entwurfsbilder gezeigt, keine Screenshots der implementierten App.
2. Letztes gezieltes Linting hatte nur vier doppelte Import-Warnungen in
   `tours.tsx`; Imports wurden danach zusammengeführt. Linting erneut ausführen.
3. `git diff --check` abschließend erneut ausführen.
4. Echte Integration von App-Cache, API und Navigation im Browser testen:
   alle fünf Vorschläge ansehen, einzeln speichern, Pager unverändert verfügbar,
   „Gespeichert · Bearbeiten“, Zurück und Empfehlungen nach Reload.
5. Mobile Darstellung (z. B. 390×844 und kleiner), Desktop, große Schrift und
   reduzierte Bewegung visuell prüfen. Aktueller Code ist noch nicht optisch
   mit B1 verglichen; Abstände, Scrollverhalten und Karte ggf. nacharbeiten.
6. In Buddy-Empfehlungen ist aktuell noch das allgemeine Suchfeld sichtbar,
   aber die Vorschläge werden dort nicht nach der Eingabe gefiltert. Entweder
   Suchfeld in diesem Bereich weglassen oder sinnvoll filtern.
7. Prüfen, ob die Routenbild-Thumbnails in Größe/Lesbarkeit ausreichend nah an
   der gewünschten Tourenvorschau liegen. Sie zeigen echte Geometrie auf einer
   ruhigen Rasterfläche, keine gerenderten geografischen Kartenkacheln.
8. Optional prüfen: vorhandene Normalisierung rundet `averageGroupStampings`
   weiterhin wie bisher auf ganze Zahlen; Test erfasst noch keinen Bruchwert.
9. Fehler-/Leerzustand, Standortverweigerung, Gruppenladen, Offlineverhalten und
   abgelaufene Vorschlags-Session im Browser prüfen.
10. Backend-README um DB-Vorschaubild-Feld und Deploymenthinweis ergänzen.
11. Nach Fixes angemessene Tests und letzten Webbuild ausführen; anschließend
    tatsächliche App-Screenshots im PR hinterlegen, Feature committen, pushen,
    PR erstellen. `gh` ist installiert und als `JanTristanH` angemeldet.

## Befehle zur Fortsetzung

Backend:

```sh
cd /workspace/harzer-wander-buddy/backend/hwb
npm test
```

App (explizite Konfiguration nötig, da sowohl `jest.config.js` als auch
`package.json` eine Jest-Konfiguration haben):

```sh
cd /workspace/harzer-wander-buddy/app
./node_modules/.bin/jest --config jest.config.js --runTestsByPath \
  __tests__/tour-automation-api.test.ts \
  __tests__/tour-automation-flow.test.tsx \
  __tests__/tour-suggestions.test.tsx \
  __tests__/tours-group-progress.test.tsx \
  'app/(tabs)/__tests__/tours-header.test.tsx' \
  --runInBand --watchman=false
./node_modules/.bin/eslint 'app/tours/automatic.tsx' 'app/tours/proposal.tsx' \
  'app/(tabs)/tours.tsx' components/tour-planner-ui.tsx \
  lib/tour-automation.ts lib/tour-suggestions.ts lib/api.ts lib/queries.ts
```

Build aus dem Repository-Root:

```sh
git diff --check
./scripts/build-and-copy-rnweb.sh
```

## Lokaler Browsertest und wichtige Umgebungsdetails

- `.agents/knowledge/local-rnweb-development.md` beachten: Webexport über CAP
  unter `http://localhost:4004/app/rnweb` testen. Quellen liegen in `app`.
- Testzugang für echten Auth0-Login steht in `AGENTS.md`; keine Kennwörter in
  Kontextdateien oder Screenshots übernehmen. In der Umgebung fehlen die
  OIDC-Servervariablen `SECRET`, `BASE_URL`, `CLIENT_ID`, `ISSUER_BASE_URL`,
  `AUDIENCE`. Produktiven Login daher nicht als bereits geprüft darstellen.
- Python Playwright ist vorhanden, Chromium unter `/usr/bin/chromium`.
  Standard-Playwright-Browserdownload ist nicht vorhanden; `executable_path`
  explizit setzen. Netzwerk nur mit vorgegebenem Proxy/CA behandeln.
- Es wurde eine **separate lokale Testumgebung** vorbereitet:
  `/tmp/run-tour-ui.cjs` startet CAP mit gemockter Authentifizierung auf Port 4004
  und `/tmp/tour-ui.sqlite` (echte mitgelieferte Stempel, Parkplätze, Wege; eigene
  fiktive Testnutzer `tour-test-alice` / `tour-test-bob`). Der Server wurde beim
  Pausieren beendet. Diese temporären Dateien können bei einem Umgebungswechsel
  fehlen und sind keine Produktänderung.
- Start: `node /tmp/run-tour-ui.cjs`. Das Skript initialisiert die separate DB
  neu. **Wichtig:** `cds.deploy(model).to('sqlite:/tmp/tour-ui.sqlite')` mit
  explizitem Ziel verwenden; `.to('sqlite')` verwendet hier sonst `db.sqlite`!
  Für den Dienststart lautet der Aufruf `cds.exec('all', '--port', '4004')`;
  `cds.exec('serve', ...)` ist falsch, da `exec` bereits der Serve-Einstieg ist.
- Ein versehentliches lokales Neuaufsetzen der ursprünglichen SQLite-Test-DB
  wurde dem Nutzer mitgeteilt. Seed-Daten wurden wiederhergestellt und danach
  die **getrackte `backend/hwb/db.sqlite` per Git auf den ursprünglichen Stand
  zurückgesetzt**. Diese Datei nicht als Featureänderung committen.
- Für den separaten Browser-Smoke-Test war folgender Ansatz geplant, aber noch
  **nicht implementiert**: Playwright mit isolierter lokaler Testsession;
  API-Requests im Browser auf Basic-Auth des gemockten lokalen CAP-Testnutzers
  umstellen. Das ist ein Testaufbau und darf nicht in Produktcode übernommen
  oder als echter Auth0-Integrationstest beschrieben werden.
- Web-Auth verwendet die localStorage-Keys
  `hwb-auth-token-response-metadata` (storageVersion 2, issuedAt/expiresIn),
  `hwb-auth-token-response-access-token`,
  `hwb-auth-token-response-id-token` und
  `hwb-auth-onboarding-complete-user:<URL-kodierte Nutzer-ID>`.
  Auth-Restore decodiert JWT-Subjekte, eine frische lokale Testsession braucht
  passende IDs. Browser-Discovery kann im Test separat gestubbt werden.
- Die Webkarte lädt OpenFreeMap (`https://tiles.openfreemap.org/styles/liberty`).
  Netz und WebGL im Headless-Chromium prüfen, Attribution erhalten; keine
  TLS-Prüfung deaktivieren. Noch keine Kartenkacheln visuell geprüft.

## Entwurfsbilder und Logs (temporär)

Finales B1-Board:
`/workspace/generated_images/exec-052d87dc-46ce-4507-90cc-1605a647e08e.png`.
Finales alternatives B2-Board:
`/workspace/generated_images/exec-8c5ec064-38ab-4951-8a7b-12017f3e128b.png`.

Die Boards wurden dem Nutzer angezeigt. Keine dieser Dateien als echte
App-Screenshots ausgeben.

Logs der letzten Läufe liegen, sofern die Umgebung erhalten bleibt, unter:
`/tmp/tour-backend-tests.log`, `/tmp/tour-app-tests.log`,
`/tmp/tour-app-tests-final.log`, `/tmp/tour-tsc.log`,
`/tmp/tour-web-build.log`, `/tmp/tour-lint.log`, `/tmp/tour-ui-server.log`.

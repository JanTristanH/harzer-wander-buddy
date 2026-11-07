# API- und Docker-Performance

Stand: 2026-11-06, Basis `develop` (`7513b1b`). Ziel: mindestens 50 % weniger
Laufzeit und Speicherbedarf an belegten Engpässen. Eine pauschale Halbierung aller
Endpunkte ist ohne Produktionslast, Datenbankpläne und externe API-Messungen nicht belegt.

## Messmethode

`cd backend/hwb && node --expose-gc --test benchmark/endpoints.js`

Der Benchmark startet CAP mit Mock-Authentifizierung und einer isolierten
SQLite-Datenbank im Speicher. Er verwendet 100 Touren, 1.000 Routensegmente mit
je 32 KiB Geometrie, 500 Stempelboxen und 10.000 Besuche. Drei Aufwärmanfragen,
danach zehn gemessene HTTP-Anfragen; JSON-Parsing eingeschlossen.
`medianHeapGrowthMiB` misst den Heap-Zuwachs vom GC vor der Anfrage bis nach dem
Lesen der Antwort. Das ist weder der Spitzenverbrauch noch der gesamte Prozess-RSS.
Der gemeinsame Testprozess enthält auch den HTTP-Client. Für den Ausgangscode
kann `HWB_BENCH_SERVICE` auf eine unveränderte Kopie von `srv/hwb-service.js` zeigen.
Produktionsauthentifizierung, Netzwerklatenz und PostgreSQL werden dabei nicht simuliert.

## Änderungen und verbleibende Engpässe

| Endpunkte | Befund / Änderung |
| --- | --- |
| `api/Stampboxes` | Pro Seite nur eindeutige Nutzer/Stempel-Paare für angefragte Boxen laden; einmaliger Map-Aufbau statt vollständiger Besuchssuche je Box. OData-Zählung bleibt erhalten. |
| `api/Tours` | Alle Tour-Verknüpfungen und kleine Routen-Metadaten gesammelt laden. Sieben statt 205 READs bei 100 Touren. Geometrie und Höhenprofile werden für Gruppenwerte nicht geladen. Wiederholte Besuche bleiben erhalten. |
| `getUsersProgress` | COUNT und COUNT DISTINCT in der Datenbank; kein vollständiger Transfer der Besuchshistorie oder aller Stempel-IDs. |
| `calculateHikingRoute` | Pfadmitgliedschaft über Sets; Pfad per Push/Pop, Kopie nur für verwertbare Rundwege. Kein Array-Aufbau an jeder Suchkante. Die Graphsuche wächst weiterhin kombinatorisch mit Tiefe und Nachbarzahl. Große Suchräume benötigen einen separat abgestimmten Zeit-/Ergebnisrahmen. |
| `getTourByIdListTravelTimes` | Stempel nur als IDs und eindeutige Nutzerbesuche laden. Geometrieabfrage lädt nur ID und `positionString`. |
| `updateTourByPOIList` | Bereits auf benötigte Routenpaare eingeschränkt. POI-Tabellen werden noch vollständig geladen; fehlende Segmente erfordern Google-Aufrufe. |
| `Users`, `MyFriends`, `Friendships`, `PendingFriendshipRequests` | Reguläre OData-Filter/Paginierung und vorhandene Sammelabfragen. Große `contains`-Suchen brauchen PostgreSQL-Pläne und gegebenenfalls Trigramm-Indizes. |
| `getCurrentUser`, `getCurrentUserID`, `getVersion` | Kleine Einzelantworten. Version funktioniert auch beim direkten Node-Start ohne npm-Wrapper. |
| `Stampings`, `StampNotes`, `stampForGroup`, `getStampFriendVisits`, Freundschaftsaktionen | Bestehende Transaktionen/Berechtigungen beibehalten. Besuchshistorien können weiter wachsen; Indizes für Nutzer/Stempel anhand realer Pläne prüfen. |
| `Attachments`, `compressExistingImages` | Aktuelles develop hat bereits einen auf 32 MiB begrenzten Bildcache und verarbeitet bestehende Bilder einzeln. Kein zusätzliches unbegrenztes Bild-Caching eingeführt. |
| `searchPlacesByName`, `getRouteToStampFromPosition` | Places-Datenbankcache bereits vorhanden; Google Routes/Elevation-Latenz bleibt extern bestimmt. Keine unbelegten Beschleunigungsangaben. |
| `calculateTravelTimesNNearestNeighbors`, `getMissingTravelTimesCount`, `addElevationToAllTravelTimes`, `updateOrderBy`, `backfillMissingVisitedAt`, `DeleteSpotWithRoutes` | Administrative Batch-Arbeit: weitere Datenbankabfragen je POI beziehungsweise parallele Elevation-Aufrufe. Künftiger Hebel: kleine Projektionen, begrenzte Batches, gezielte SQL-Updates. Nicht als normale Listenlatenz werten. |
| `TravelTimes`, `typedTravelTimes`, `ParkingSpots`, `AllPointsOfInterest`, Nachbar-/Baumansichten, `RouteCalculationRequest`, öffentliche Kataloge | Generische CAP-Abfragen; große Geometrien gezielt über `$select` vermeiden. Geografische Kreuzprodukte in Nachbaransichten bleiben ein Kandidat für `EXPLAIN (ANALYZE, BUFFERS)` auf realen Daten. |
| `/export/csv/:entity` | Weiterhin vollständiges Lesen und CSV-Aufbau im Speicher. Bei großen Tabellen oder Anhängen bleibt dies ein hoher RAM-Kandidat. Streaming braucht einen gesonderten, konsistenten Export-/Cursorpfad mit Abbruchbehandlung. |
| Bearer/OIDC | Profil- und Sync-Caches auf jeweils 1.000 Einträge begrenzt. JWT-Prüfung und Berechtigungsprüfung bleiben je Anfrage aktiv. |

Für PostgreSQL sind insbesondere kombinierte Indizes auf
`Stampings(createdBy, stamp_ID)`, `StampNotes(createdBy, stamp_ID)` und
`Friendships(toUser_ID, status)` zu prüfen. `Tour2TravelTime` hat bereits einen
zusammengesetzten Primärschlüssel beginnend mit `tour_ID`. Zusätzliche Indizes
nicht blind in Produktion anlegen: Selektivität, Schreiblast und vorhandene
Indizes zuerst messen. In dieser Änderung wurde keine externe Datenbank verändert.

## Docker-Betrieb und Schema

Das Schema wird weiterhin automatisch aktualisiert. Standardmäßig gilt
`DEPLOY_ON_START=true`: `util/startProduction.js` lädt die CAP-Plugins, führt
`cds.deploy('*').to('db')` aus und startet den HTTP-Server erst nach Erfolg.
Deployment und Server verwenden denselben Node-Prozess und Datenbank-Pool.
Ein Deploymentfehler verhindert den Serverstart. CAPs bisherige automatische
PostgreSQL-Schema-Evolution bleibt aktiv; es gibt keinen neuen Schema-Hash oder
selbst entwickelten Mechanismus zum Überspringen von Änderungen.

Beim Build entsteht `srv/csn.json` aus den CDS-Quelldateien. Diese Datei enthält
das vollständige Modell samt Service-Handler-Verweisen. Sie ersetzt die
CDS-Quelldateien im Image und spart Quellcode-Kompilation beim Start. Der Build
selbst ändert keine Datenbank. Sowohl das Start-Deployment als auch der separate
Migrationsjob laden anschließend dieses Modell. SQL-DDL aus Quellmodell und
vorkompiliertem Modell wird für PostgreSQL und SQLite im Test verglichen.

Nur bei `DEPLOY_ON_START=false` wird die Start-Migration ausgelassen. Dann muss
der Release-Prozess das Schema **vor jedem App-Update** erfolgreich deployen:

```sh
docker run --rm --env-file deployment.env IMAGE node util/deployProduction.js
docker run --env-file deployment.env -e DEPLOY_ON_START=false IMAGE
```

Compose bietet dafür den optionalen Job `hwb-migrate` im Profil `migration` mit
PostgreSQL-Healthcheck. Aus `backend/hwb`:

```sh
docker compose --profile migration run --rm hwb-migrate
DEPLOY_ON_START=false docker compose up -d hwb
```

Für bestehende Watchtower-Updates bleibt der Standard `true` erhalten. Auch bei
Cloud Run darf `false` erst gesetzt werden, wenn ein vorgeschalteter Release-Job
jedes Schema-Update zuverlässig übernimmt. Ein externes Schema-Deployment
verschiebt die Arbeit innerhalb des Releases; es entfernt sie nicht.

## Inhalt und Build des Produktionsimages

Beide Dockerfiles trennen Dependency-Installation, Modell-Kompilation,
UI5-/Expo-Build und Runtime. Die Runtime basiert auf
`gcr.io/distroless/nodejs22-debian12:nonroot` und läuft als UID 65532.
Sie enthält Node, die notwendigen Runtime-Bibliotheken, produktive
Node-Abhängigkeiten, JS-Service-Handler, das CSN-Modell und Web-Assets.

Entfernt sind:

- CAP-Entwicklungs-SDK samt verschachtelten HANA-/ESLint-Werkzeugen. Es blieb
  zuvor trotz `--omit=dev` über den optionalen Peer von `@cap-js/postgres` im
  Image. Deshalb wird es nach der gelockten Installation gezielt entfernt.
- SQLite: nur noch Entwicklungsabhängigkeit für lokale Arbeit und Tests;
  das Produktionsimage verwendet PostgreSQL.
- npm, Yarn, Corepack, Shell, Node-Header und native Build-Compiler.
- CDS-Quellen, UI5-Test-/Mock-Dateien und UI5-Build-Konfiguration.
- Die ungenutzte Selbst-Abhängigkeit `hwb: file:`.

Der CAP-Runtime-Compiler bleibt vorhanden: Er wird unter anderem für
Schema-Evolution und OData-Metadaten benötigt. Lizenzdateien und unbekannte
Paketbestandteile werden nicht pauschal gelöscht. Beide alten UI5-Pfade
`/app/frontendhwb/webapp` und `/app/frontendhwb/dist` bleiben bedienbar.

Diagnose erfolgt über `docker logs` und `docker exec CONTAINER node ...`;
`docker exec ... sh` und Paketinstallationen im laufenden Image sind nicht
verfügbar. Der Migrationsbefehl `node util/deployProduction.js` funktioniert
weiterhin. `start.sh` bleibt als Wrapper im Repository, das Produktionsimage
startet Node direkt und benötigt die Shell-Datei nicht.

`npm ci --omit=dev --omit=peer` verwendet die Lockdatei. Build-Prüfungen stellen
sicher, dass weder SDK noch SQLite im Runtime-Dependency-Verzeichnis verbleiben.
Die Build-Stufe benötigt durch den Wegfall von SQLite keine C++-Toolchain mehr.
Modellquellen und Build-Abhängigkeiten werden temporär gemountet, um zusätzliche
Kopien zu sparen. Backend-Codeänderungen bauen weder UI5 noch Expo neu; die
kleine Modell-Kompilation wird bei Änderungen ihrer Eingaben erneut ausgeführt.
Expo exportiert mit maximal zwei Workern.

`.dockerignore` hält lokale `node_modules`, native Android-/iOS-Builds, Git-Daten,
Datenbankkopien und lokale Konfiguration aus dem Kontext. Der Backend-URL-Default
des bestehenden Google-Buildtriggers bleibt erhalten; kein neuer Publish-Workflow.
Die Proxy-CA der verwalteten Umgebung wird nur bei Bedarf temporär eingebunden:

```sh
docker build --secret id=proxy_ca,src="$CODEX_PROXY_CERT" -t hwb-perf .
```

Normale Builds benötigen das Secret nicht. BuildKit ist erforderlich. Wie viel
Cache zwischen Google-Buildläufen erhalten bleibt, hängt vom bestehenden Trigger ab.

## Ergebnisse

Lokale Messungen; Rohwerte: [results.json](results.json).

| HTTP-Anfrage | Median vorher → nachher | Laufzeit reduziert | Heap-Zuwachs vorher → nachher | Heap-Zuwachs reduziert |
| --- | --- | --- | --- | --- |
| 100 Touren | 270,03 → 30,03 ms | 88,9 % | 45,17 → 2,65 MiB | 94,1 % |
| 500 Stempelboxen | 138,17 → 22,59 ms | 83,7 % | 15,35 → 6,00 MiB | 60,9 % |

Diese Prozentsätze gelten für den beschriebenen Testfall, nicht für alle
Endpunkte oder den gesamten Server-RAM. Die Besuchsdatenmenge und die Größe der
vorher unnötig geladenen Geometrien beeinflussen die Ergebnisse wesentlich.

Die folgende zusätzliche Runde vergleicht das erste optimierte PR-Image mit dem
jetzigen Runtime-Image, jeweils mit lokalem PostgreSQL 16 und Mock-Authentifizierung.
Fünf frische Node-Prozesse pro Variante; nach jedem Lauf wird der Container
gestoppt und neu gestartet. Gemessen vom Prozessstart bis „server listening“,
ohne Image-Pull und VFS-Containerkopie. Zusätzlich wird die erste öffentliche
Stempelboxen-Abfrage vollständig gelesen.

| Messung | Erstes PR-Image | Jetzt |
| --- | ---: | ---: |
| Imagegröße, unkomprimiert | 623,86 MB | 281,15 MB (**−54,9 %**) |
| Start mit Schema-Deployment | 1.579,51 ms | 1.105,54 ms (**−30,0 %**) |
| Erste API-Abfrage nach diesem Start | 82,36 ms | 61,88 ms |
| Start bei bereits separat deploytem Schema | 920,61 ms | 791,18 ms (**−14,1 %**) |

Der gemeinsame Deployment-/Serverprozess hält Compiler-Arbeit im Speicher.
Nach der ersten Anfrage zeigt `docker stats` bei aktivem Start-Deployment etwa
**114 MiB statt 104 MiB**. Mit vorgelagertem Deployment benötigt die neue Runtime
etwa **96 MiB**. Das ist ein gemessener Zielkonflikt zwischen Standard-Startzeit
und RAM, keine Halbierung des gesamten Serververbrauchs. Reproduktion:

```sh
python3 backend/hwb/benchmark/startup.py IMAGE --compare-image BASELINE --runs 5
```

Historische Build-Messungen der ersten Runde stehen separat in `results.json`:
97,10 s für den Backend-Build einschließlich Installation, 104,50 s für den
Root-Build mit vorhandenem Dependency-Cache und neuem Expo-Export, 18,38 s für
eine Backend-Codeänderung und 2,44 s für unveränderte Quellen. Die zweite Runde
baut keine SQLite-Bibliothek mehr und liefert das kleinere Runtime-Image.
Diese Buildzeiten sind keine kontrollierten Kaltbuild-Vergleiche.

## Validierung und Grenzen

44 Backend-Tests erfolgreich, inklusive Deployment-Reihenfolge/Fehlerabbruch
und Modell-DDL-Vergleich. Beide finalen Dockerfiles bauen erfolgreich.
PostgreSQL 16 wurde frisch initialisiert: Deployment, Tour-Gruppenwerte,
Stempelboxen und Fortschritt funktionieren mit dem kompilierten Modell.
Ein weiteres Deployment erhält beide zuvor angelegten Stempelbesuche.
Native WebP-Kompression mit `sharp` funktioniert im distroless-Image als UID 65532.

CI prüft nach dem Image-Build zusätzlich Runtime-Inhalt, Web-Artifact, native
Bildverarbeitung und beide Startup-Varianten mit einer isolierten PostgreSQL-Datenbank.
Kein Zugriff auf Produktionsdaten. Die lokale Umgebung nutzt Docker mit `vfs`;
fehlgeschlagene Vergleichsbuilds füllten zeitweise das 32-GiB-Dateisystem. Nur
Artefakte eigener verworfener Testimages wurden entfernt; vorhandene
Android-/Build-Caches bleiben erhalten. Das ursprüngliche Dockerfile konnte
hier nicht vollständig gebaut werden. Die neue Größen-/Startzeit-Angabe
vergleicht deshalb ausdrücklich mit dem bereits optimierten ersten PR-Image.
Produktionsauthentifizierung, reale Netzwerklatenz und Registry-Transferzeiten
sind in den lokalen Startwerten nicht enthalten.

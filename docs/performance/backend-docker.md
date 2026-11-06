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

## Docker-Betrieb

Beide Dockerfiles trennen Backend-Abhängigkeiten, UI5-Build und Laufzeitimage.
Die Laufzeit enthält keine Compiler, global installierte CAP-CLI oder
UI5-Entwicklungsabhängigkeiten. `npm ci --omit=dev` verwendet die Lockdatei.
Eine reine Backend-Codeänderung installiert keine Abhängigkeiten neu und baut
UI5 nicht neu. Expo-Export nutzt maximal zwei Worker und mountet seine
Build-Abhängigkeiten, um zusätzliche Kopien zu vermeiden.

Die neue Root-`.dockerignore` verhindert die Übertragung lokaler `node_modules`,
nativer Android-/iOS-Builds, Git-Daten, Datenbankkopien und lokaler Konfiguration.
Der öffentliche Backend-URL-Default des bestehenden Google-Buildtriggers bleibt
erhalten. Es wird kein neuer Docker-Publish-Workflow eingeführt.

Compose enthält einen optionalen `hwb-migrate`-Job im Profil `migration`, der
auf einen erfolgreichen PostgreSQL-Healthcheck wartet. Das bisherige
CAP-Schema-Deployment-Verhalten bleibt erhalten; es wird nicht durch eine neue
Migrationsstrategie ersetzt. Standardmäßig bleibt `DEPLOY_ON_START=true`, damit
auch bestehende Watchtower-Updates weiterhin ihr Schema deployen. Erst wenn die
Release-Orchestrierung Migrationen zuverlässig vor **jedem** Update ausführt,
kann `DEPLOY_ON_START=false` gesetzt werden. Beispiel für kontrollierte Deployments:

```sh
docker compose --profile migration run --rm hwb-migrate
DEPLOY_ON_START=false docker compose up -d hwb
```

Bei manuellem Betrieb:

```sh
docker run --rm --env-file deployment.env IMAGE node util/deployProduction.js
docker run --env-file deployment.env -e DEPLOY_ON_START=false IMAGE
```

Ohne `DEPLOY_ON_START=false` deployt das Standalone-Image aus Kompatibilitätsgründen
weiter beim Start. Bei Cloud Run oder anderer Orchestrierung muss der einmalige
Migrationsschritt dort eingerichtet werden, bevor diese Option aktiviert wird.
Der eigentliche Server startet über `exec node` und erhält Stoppsignale direkt.

Für die verwaltete Testumgebung wird die Proxy-CA nur temporär eingebunden:

```sh
docker build --secret id=proxy_ca,src="$CODEX_PROXY_CERT" -t hwb-perf .
```

Die CA ist optional; normale Builds benötigen dieses Secret nicht. Der Build
benötigt BuildKit. Docker-Layer- und npm-Cache werden genutzt; wie viel davon
zwischen Google-Buildläufen erhalten bleibt, hängt vom bestehenden Trigger ab.

## Grenzen

Die Umgebung verwendet Docker mit `vfs`. Vollständige Vergleichsbuilds haben
zunächst das 32-GiB-Dateisystem gefüllt; nur Artefakte des eigenen überholten
Testimages wurden entfernt. Vorhandene Android-/Build-Caches bleiben erhalten.
Kaltbuild-Werte mit Downloads und SQLite-Kompilation sind nicht auf die
Produktions-Buildmaschine übertragbar. Die vollständigen alten Images konnten hier nicht fertig gebaut werden; daraus
wird keine prozentuale Verbesserung von Kaltbuild-Zeit oder Imagegröße abgeleitet.


## Ergebnisse

Lokale Messungen; Rohwerte: [results.json](results.json).

| HTTP-Anfrage | Median vorher → nachher | Laufzeit reduziert | Heap-Zuwachs vorher → nachher | Heap-Zuwachs reduziert |
| --- | --- | --- | --- | --- |
| 100 Touren | 270,03 → 30,03 ms | 88,9 % | 45,17 → 2,65 MiB | 94,1 % |
| 500 Stempelboxen | 138,17 → 22,59 ms | 83,7 % | 15,35 → 6,00 MiB | 60,9 % |

Diese Prozentsätze gelten für den beschriebenen Testfall, nicht für alle
Endpunkte oder den gesamten Server-RAM. Die Besuchsdatenmenge und die Größe der
vorher unnötig geladenen Geometrien beeinflussen die Ergebnisse wesentlich.

Docker-Startvergleich mit demselben optimierten Backend-Image und einer bereits
angelegten SQLite-Datenbank: fünf Starts mit `DEPLOY_ON_START=true`, fünf mit
`false`. Gemessen vom Docker-Prozessstart bis zum Log „server listening“, ohne
VFS-Containerkopie vor dem Prozessstart. Median 1.728,96 → 899,68 ms, **48,0 %**
weniger Startzeit. Das ist der Effekt des ausgelagerten Deployments, kein
Vergleich zwischen vollständigen alten/neuen Produktions-Deployments. Das
Deployment selbst entfällt nicht aus dem Release. Leerlauf-Containerverbrauch
laut `docker stats` in beiden Varianten etwa **101 MiB**; hier ist keine
RAM-Halbierung belegt. Reproduktion:

```sh
cd backend/hwb
python3 benchmark/startup.py IMAGE
```

Der Backend-Build benötigte 97,10 s einschließlich Abhängigkeitsinstallation.
Der vollständige Root-Build mit vorhandenem Dependency-Cache und neuem Expo-Export
benötigte 104,50 s. Eine anschließende reine Backend-Quellcodeänderung benötigte
18,38 s; `npm ci`, UI5-Build und Expo-Export waren dabei vollständig gecacht.
Ein weiterer Build unveränderter Quellen benötigte 2,44 s. Das fertige Root-Image
misst rund **624 MB / 595 MiB**. Es gibt keinen fertiggestellten alten
Vergleichsbuild für eine belastbare prozentuale Kaltbuild- oder Größenangabe.

Validierung: 40 Backend-Tests erfolgreich, beide Dockerfiles erfolgreich gebaut,
vollständiger Expo-Web- und UI5-Build erfolgreich, öffentliche API und Expo-Web
im fertigen Container liefern HTTP 200, Compose-Konfiguration validiert.

Zusätzlich mit einem frischen, lokalen PostgreSQL-16-Container geprüft:
Schema-Deployment und Pool-Abbau beenden sich erfolgreich; die optimierten
Abfragen für Tour-Gruppenwerte, Stempelboxen und Nutzerfortschritt liefern auch
unter PostgreSQL die erwarteten Ergebnisse. Kein Zugriff auf Produktionsdaten.

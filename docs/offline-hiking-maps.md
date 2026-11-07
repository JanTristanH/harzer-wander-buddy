# Native Offline-Wanderkarten

Dieser Feature-PR ist unabhängig von Offline-Stempelerfassung (#85) und GPX-Export (#86). Er ergänzt native Android-/iOS-Apps um einen eigenen Kartenbildschirm. Einstieg: „Offline-Karten“ in der Kartenansicht oder „Offline-Wanderkarten“ im Profil. Die bisherigen Online-Karten bleiben die Standardansicht.

## Verhalten und Umfang

- Etwa 10 × 10 km um den Mittelpunkt der gerade geöffneten Karte herunterladen oder einen der fünf Harzbereiche auswählen.
- OpenFreeMap-Vektorkacheln für Zoom 10–14 dauerhaft im Dokumentenverzeichnis speichern, nicht nur im flüchtigen Karten-Cache. Bis Zoom 18 vergrößerbar, dann ohne zusätzliche Details.
- Ein mitgelieferter OpenMapTiles-Kartenstil zeigt Wege/Pfade, Straßen, Wälder, Parks, Gebäude, Gewässer, Orte und benannte Gipfel. Schriftdateien für die verwendete Schrift werden mitgeladen; der Stil braucht keine Sprites oder externen Style-Dateien.
- Die Offline-Ansicht referenziert ausschließlich lokale `file://`-Ressourcen. Kein HTTP-Kartenfallback. Der Bildschirm begrenzt den Kartenmittelpunkt auf den gespeicherten Bereich; außerhalb der abgedeckten Kacheln gibt es keine Karte.
- App-Stempel aus verfügbaren Abfragedaten einblenden (grün besucht, orange offen), Detailansicht per Antippen. Die Kartenpakete selbst enthalten keine personenbezogenen Besuchsdaten. Ohne verfügbare App-Daten kann die Basiskarte trotzdem geöffnet werden.
- „Mein Standort“ nutzt die vorhandene Standortberechtigungslogik und GPS; außerhalb des gespeicherten Bereichs erscheint ein Hinweis.
- Fortschritt, Abbruch, erneuter Versuch nach Fehlern, lokale Paketliste mit Größe/Datum und Löschen. Ein Paket gilt erst nach dem letzten erfolgreichen Schreibvorgang als vollständig. Fehler/Abbruch löschen das Teilpaket; nach Prozessabbruch werden unvollständige Ordner beim nächsten Öffnen entfernt.

Dies ist eine lokale Basiskarte mit Wanderwegen. Höhenlinien, Offline-Routenberechnung, gesprochene Navigation, automatische Kartenaktualisierung und eine vollständige Harzregion sind nicht enthalten. Der OpenStreetMap-Datenstand und die Wegklassifizierung bestimmen, welche Pfade enthalten sind.

## Quelle und Downloadgrenzen

OpenFreeMap ist ohne API-Schlüssel nutzbar. Grundlage sind die [Terms of Service](https://openfreemap.org/tos/), Abschnitt „Offline Downloads“, geprüft am 20.10.2026: höchstens 3.000 Kacheln oder 50 MB, höchstens vier parallele Requests, eindeutiger User-Agent. Die Implementierung begrenzt konservativ **sowohl 3.000 Kacheln als auch 50.000.000 Bytes**, einschließlich TileJSON und Schriften. Sie lädt **seriell** und sendet `HarzerWanderBuddy/OfflineMaps (+https://www.harzer-wander-buddy.de)`. Nur HTTPS-Ressourcen von `tiles.openfreemap.org` werden akzeptiert. Große Antworten werden anhand Content-Length bzw. während des Stream-Lesens abgebrochen. Ein laufender Download pro App-Prozess.

TileJSON `https://tiles.openfreemap.org/planet` liefert die aktuellen XYZ-Kachelpfade. Schriften: `https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/{range}.pbf` für lateinische und erweiterte lateinische Namen sowie allgemeine Interpunktion. Keine großflächigen Testdownloads gegen den öffentlichen Dienst ausführen. Attribution bleibt im lokalen Stil und sichtbar unter der Karte erhalten; Quellen: OpenStreetMap, OpenMapTiles und OpenFreeMap.

## Native Builds

`@maplibre/maplibre-react-native` 11.5.0, Expo-Konfigurationsplugin und `expo-file-system` sind eingetragen. Expo 54 verwendet bereits die benötigte neue Architektur. Android/iOS benötigen einen **neuen nativen Build**; ein OTA-Update auf alte Builds oder Expo Go genügt nicht. Web lädt die native Kartenbibliothek nicht und weist bei direktem Aufruf auf die nativen Apps hin. Der bestehende Fingerprint-Mechanismus berücksichtigt die neue native Abhängigkeit.

## Validierung und offene Freigabeprüfungen

Automatisiert geprüft: XYZ-Bereichsberechnung/Kachelgrenze, sequenzielle Requests, Bytebudget, Quellprüfung, Geometrie-/Stilressourcen, Fortschritt, Abbruch und Wiederholung, Persistenz/Manifest, Aufräumen nach Prozessabbruch, Löschen sowie UI-Aktionen. Der lokale Stil wurde zusätzlich mit dem MapLibre-Style-Spec-Validator geprüft. TypeScript, ESLint, Expo-Prebuild-Konfigurationsauflösung und Runtime-Fingerprint-Test geprüft. Screenshots zeigen die tatsächliche Kartenverwaltungs-Komponente mit Fixtures auf React Native Web, keine native Kartenaufnahme.

**Der PR bleibt Entwurf, bis diese Prüfungen abgeschlossen sind:**

1. Frischen Android- und iOS-Build erzeugen, einen kleinen Bereich vom echten OpenFreeMap-Endpunkt herunterladen. Der frühere HTTP-403-Blocker ist in der aktuellen Umgebung aufgehoben. Der gemeinsame Downloader wurde mit echten Antworten und lokalem Dateisystem geprüft (siehe unten); native Expo-Dateisystem-/HTTP- und Flugmodus-Abnahme bleiben offen.
2. Empfangsseitig bestätigen, dass der app-spezifische User-Agent auf beiden Plattformen ankommt; aktuelle TileJSON- und Font-Endpunkte prüfen.
3. Flugmodus aktivieren, App vollständig beenden und neu starten. Gespeichertes Paket öffnen und Wege, Ortsnamen inkl. Umlauten und Gipfel bei mehreren Zoomstufen prüfen. Insbesondere `file://`-Templates für Vektorkacheln und Schriften im nativen Renderer verifizieren. Kein Netzwerk-Fallback darf erforderlich sein.
4. Standort, Verlassen des Bereichs, Stempel aus zuvor geladenen Daten, Downloadabbruch, Prozessabbruch, wenig Speicher und Löschen prüfen. Native Screenshots ergänzen.

Der lokale Android-Emulator konnte booten, der Paketmanager/APK-Installationspfad reagierte jedoch nicht zuverlässig; iOS steht hier nicht bereit. Der Entwurf beansprucht keine bereits nachgewiesene native Flugmodus-Funktion.

## Erneuter Live-Nachweis am 7. November 2026

Aktuelles develop `7513b1b` integriert. TileJSON und Schriften sind erreichbar (HTTP 200). Der unveränderte gemeinsame Downloader wurde seriell mit echten OpenFreeMap-Antworten über einen lokalen Curl-Dateisystemadapter ausgeführt: Ausschnitt Brocken/Schierke, 78 Kacheln, fünf Glyphdateien, 1.586.626 Bytes inklusive TileJSON; sämtliche 83 Binärressourcen gespeichert, Fortschritt vollständig und Manifest erst nach Abschluss geschrieben. Dieser Test ersetzt nicht den Expo-HTTP-/Dateisystemadapter auf einem Gerät.

Dieselben Kacheln und derselbe lokale Stil wurden in MapLibre WebGL gerendert: 33 sichtbare Wege/Pfade und vier Gipfelfeatures, lesbare Umlaute, keine Kartenfehler. Sämtliche externen Browserrequests waren blockiert; es gab keinen Remote-Fallback. Nur der Browser-Prüfaufbau ersetzt die nativen file-URLs durch lokale Loopback-URLs. [Aufnahme](screenshots/offline-maps/live-map-web-validation.png) ist ausdrücklich eine Webvalidierung echter Offline-Daten, keine native Kartenaufnahme.

Reproduktion (ein begrenzter Download, nicht in regulärer CI):

```sh
node scripts/check-offline-map-download.cjs --confirm-provider-download
python scripts/check-offline-map-render.py /tmp/<ausgegebener-ordner>/pack --screenshot /tmp/offline-map-check.png
```

Der native Ressourcenabruf lehnt Redirects sowie HTML-Fehlerseiten ab, damit solche Antworten nicht als vollständiges Kartenpaket erscheinen. Regressionstest ergänzt. Die Abnahme des tatsächlichen nativen User-Agents, der file-Templates, App-Neustart und Flugmodus auf Android/iOS bleibt erforderlich.

Aktueller Integrationsstand: 384 App-Tests in 68 Suites, TypeScript, gezieltes ESLint und vollständiger Basic-Webexport erfolgreich.

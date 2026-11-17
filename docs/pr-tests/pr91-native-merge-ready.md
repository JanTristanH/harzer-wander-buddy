# PR91 – native merge readiness

Stand: 17. November 2026. Geprüfter Checkout-Head: `dd33758966359caa24ad377f135b1d9d03fe99d8` (`develop` mit #65 integriert). PR #91 zeigt weiterhin auf diesen Head.

## Release-Build und Testumgebung

- Echter iOS-Simulator-Releasebuild erfolgreich: `/private/tmp/hwb-pr91-followup-derived/Build/Products/Release-iphonesimulator/HWBPR91.app`, erstellt mit Expo SDK 54 / React Native 0.81.5 und regulärem iOS-Prebuild, Autolinking und CocoaPods.
- Im aufgelösten Expo-Config: `HWB PR 91`, Bundle-ID `de.kuestenbit.harzer-wander-buddy.pr91`, Backend `http://localhost:41091`, `updates.enabled=false`.
- Im fertigen Binary geprüft: `CFBundleIdentifier=de.kuestenbit.harzer-wander-buddy.pr91`; `Expo.plist` hat `EXUpdatesEnabled=false`, Runtime `1.8.0`.
- `app/app.config.ts` enthält keine Änderung. Für die lokale Testisolation habe ich während Config-Auflösung und Prebuild nur lokal `ios.bundleIdentifier=de.kuestenbit.harzer-wander-buddy.pr91` ergänzt und direkt danach aus der unveränderten Kopie wiederhergestellt. Grund: der vorhandene PR-Preview-Code setzt die Android-Paket-ID, aber keine iOS-Bundle-ID. Das erzeugte lokale Xcode-Projekt und Binary tragen deshalb die isolierte ID. Es wurde keine Produktruntime angepasst.
- SQLite frisch deployed aus `backend/hwb/db/schema.cds` und den vorhandenen `doNotDeploy-data` CSV-Fixtures. Backendantwort auf Port 41091: HTTP 200. Prozess PID 48450, Datenbank `/private/tmp/hwb-pr91-followup.sqlite`.

## Native UI-Abnahme

Auf dem iPhone 18 Pro Simulator (iOS 27.2) wurde genau dieses Releasebinary installiert und gestartet. Nach dem Schließen der fremden Device-Session war die eigene PR91-Session frei. Login mit dem lokalen `dev-basic`-Testkonto und das fünfschrittige Onboarding gelangen; Name `HWB PR91 Review` gespeichert, Avatar und optionale Standort-/Freunde-Schritte übersprungen.

**Bestanden:**

- Tourenautomatik vom authentifizierten Tourenbildschirm öffnen; Presets 1, 2 und 3 Stunden anwählen. Das Drehrad reagiert auf native Pan-Gesten: vom 3-Stunden-Preset ergab eine 30°-Drehung 3 Std. 5 Min.; Drehung in Gegenrichtung stellte 3 Std. wieder her. Die äußere Seite blieb stehen. Die native untere und obere Grenze habe ich nicht angefahren.
- Lokale Parkplatzsuche nach `57` findet `Parkplatz für 57`; als Startpunkt ausgewählt. Suche mit 180 Minuten lieferte fünf echte lokale Vorschläge aus den vorhandenen Wegegraphdaten. Vorschlag 1 zeigte 2 Std. 58 Min., 11,6 km und vier Stempel; Vorschlag 2 zeigte 2 Std. 6 Min., 7,8 km und drei Stempel. Die Kartenansicht lud Apple Maps, Route und Stempelmarker. Eine Station öffnete ihre bestehende Detailseite; zurück zur Vorschlagskarte funktionierte.
- Den Bottom Sheet per Ziehen nach oben geöffnet; Stationen und Start-/Ziel-Aktionen waren sichtbar. „Als Tour speichern“ ließ den Vorschlag offen und wechselte zu „Gespeichert · Bearbeiten“. Ein weiterer Tipp öffnete den bestehenden Editor mit 7,8 km, 2:06 h, 386 m Aufstieg, 367 m Abstieg sowie drei Tourstationen.
- Den manuellen Editor auch direkt über „Neue Tour planen“ geöffnet; dessen Kartenmarker und Bearbeitungsansicht wurden angezeigt. Dieser separate Test legte lokal eine leere synthetische Tour `Neue Tour` an.

**Offen / unterbrochen:**

- Im Editor nach dem Vorschlags-Editieren habe ich den Namen lokal auf `PR91 Native 57` geändert. Beim Fertig-Tap hing der iOS-Automationsrunner an der großen Karte mit hunderten Markern. Die Toolantwort lautete `The iOS runner is still finishing a previous command that exceeded its execution watchdog`. Nach der empfohlenen Wartezeit trat derselbe Fehler beim Koordinaten-Tap erneut auf. Ich habe keine weiteren UI-Eingaben ausgeführt; die Umbenennung ist daher nicht als gespeichert bestätigt.
- App-Neustart und erneutes Öffnen der gespeicherten Tour, GPX-Export und ein Gruppenplan wurden nicht geprüft. Der isolierte Testdatensatz enthielt keinen bereits ausgewählten Freund. Offline-/Flugmodus wurde nicht geprüft.

Screenshots dieses Builds liegen unter `docs/pr-tests/evidence/pr91-review-*.png`. `docs/pr-tests/evidence/pr91-manual-tour-native.png` ist frühere Evidenz und gehört nicht zu diesem Lauf.

## GitHub

- PR `https://github.com/JanTristanH/harzer-wander-buddy/pull/91`, offen, Base `develop`, Head `dd33758966359caa24ad377f135b1d9d03fe99d8`, Mergeability `MERGEABLE`.
- Reviewentscheidung leer, Reviews 0, Inline-Reviewkommentare 0.
- Schlussabfrage: alle Checks erfolgreich, einschließlich Android-Preview und `report-web`.

## Ergebnis

**Noch nicht vollständig merge-ready aus nativer Sicht.** Der echte Build, Login/Onboarding, Presets, Fünf-Minuten-Geste, lokale Wegesuche, Vorschlagskarte/Sheet, Speichern und Editor-Einstieg bestanden. Gespeichertes Umbenennen/„Fertig“ wurde wegen des iOS-Runner-Watchdogs nicht abgeschlossen; Neustart-/GPX-/Gruppenfälle bleiben offen. Alle GitHub-Checks sind erfolgreich und es gibt keine Reviews. Es wurde nichts an PR, Git-Historie, normalem Checkout oder der fremden Device-Session verändert. Die eigene PR91-Device-Session wurde geschlossen. Backend PID 48450, Port 41091, SQLite und Binary bleiben für Root verfügbar.


## Abschließende eigene Nachprüfung

Root hat dasselbe isolierte Binary am unveränderten Runtimehead dd33758966359caa24ad377f135b1d9d03fe99d8 mit eigener Gerätesession geöffnet. Der zuvor gemeldete Runner-Watchdog trat nicht erneut auf. Eine frische Accessibility-Aufnahme lieferte die aktive Fertig-Schaltfläche; Antippen öffnete die gespeicherte Leseansicht mit Name PR91 Native57,7,8km,2:06h und3Stempeln. Die Umbenennung war bereits in der lokalen SQLite gespeichert; kein Datenverlust und kein reproduzierter Produktfehler.

Nach vollständigem App-Neustart blieb die Sitzung erhalten. Meine Touren enthält PR91 Native57 mit identischen Werten; erneutes Öffnen erfolgreich. Über Touraktionen > Tour alsGPX exportieren > Verbundene Route öffnet iOS das Share-Sheet PR91-Native-57 mit37KB. Das tatsächlich erzeugte GPX wurde read-only aus dem isolierten App-Verzeichnis als XML geprüft:37.254Bytes,708Trackpunkte,1Track. Kein bloßer Share-Sheet-Nachweis.

Aktuelle eigene Evidenz: evidence/pr91-review-root-saved.png und evidence/pr91-review-root-gpx.png. Keine Produktänderung für diese Nachprüfung erforderlich. Der vorherige Abschnitt Noch nicht vollständig merge-ready beschreibt den unterbrochenen Luna-Lauf und ist durch diese ergänzten Speicher-/Neustart-/GPX-Ergebnisse überholt. Technische Kernabnahme für den integrierten Stand bestanden; Gruppen-/Zeitgrenzen sind automatisiert geprüft, zusätzliche native Grenz-/Gruppen-/echte Offlinefälle nicht ausgeführt und nicht als Produktfehler oder neue zwingende Gates eingeordnet.

Vor Merge abschließendes Review; für den späteren Release reguläre Migration Tours.previewSvg vor gemeinsamem Backend-/App-Rollout (Breaking API) einplanen. Keine Produktentscheidung offen, keine Produktionsmigration ausgeführt. Simulator freigegeben; eigener lokaler Server41091 vor nächstem PR regulär beenden.

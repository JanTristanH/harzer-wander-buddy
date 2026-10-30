# Tourenautomatik: Review und Rollout

Stand: 2026-10-30, PR #91, `develop` e1aea82d6c1f9601ae021eef8f8f0e6fbdf35b45 integriert. Die Konflikte in Tourenliste, API-Typen und Berechnung sind aufgelöst. Die Auswahlmarker-Fixes #106 und #107 sind im bestehenden Editor enthalten. Die Kartenstil-Auswahl aus #108 liegt jetzt in den erweiterten Profileinstellungen; die gespeicherte Einstellung gilt auch für die Tourenkarten. Der Merge-Konflikt im Web-Kartenrenderer wurde entsprechend gelöst, die Quellenangabe bleibt über dem Bottom Sheet unterhalb der Routenlegende sichtbar.

## Verhalten

- Zeitwahl: 1/2/3 Stunden oder Drehrad; eine Umdrehung = 60 Minuten, Schritte à 5 Minuten, 15–720 Minuten. Drehen aktiviert „Eigene“. Native Gesten laufen mit Gesture Handler/Reanimated auf dem UI-Thread; Screenreader können schrittweise erhöhen/verringern. Web unterstützt Touch, Maus und Tastatur. Kein zweites Minuten-Eingabefeld.
- „Wanderzeit ab Startpunkt“; Anreise und Pausen bleiben zusätzlich einzuplanen. Tourenautomatik und Routendarstellung verwenden das helle App-Design auch bei dunklem Systemdesign.
- „Touren finden“ zeigt Funkel-Icon, Busy-Zustand und den lokalen Buddy-Loop nur während der echten Berechnung. Reduzierte Bewegung verwendet das Poster. Reproduzierbare Remotion-Quellen: [media/buddy-loading](../media/buddy-loading/README.md).
- Vorschläge liegen in einem ziehbaren Bottom Sheet über der Karte. Stationen sind direkt erreichbar und öffnen ihre bestehenden Detailseiten zum Stempeln bzw. Navigieren; die zusätzliche Detail-Aktion entfällt. Die Route baut sich weiterhin animiert auf. Geometrieparser, Modi/Farben, Richtungspfeile und der aktuelle produktive Web-Kartenrenderer stammen aus `develop`.
- Gespeicherte Touren verwenden dieselbe Kartenansicht. Manuelles Erstellen, Namen ändern und Stationen bearbeiten bleiben im vorhandenen Editor erhalten. Der bestehende Editor bleibt in seiner bisherigen Routendatei; die neue Leseansicht ist eine separate Komponente. „Fertig“ merkt sich den ersten Tipp während der Namensspeicherung und wartet auf deren Abschluss. Teilen verwendet unverändert die öffentliche `/share/tour/`-Seite; die Navigationslogik bleibt erhalten. Löschen erfordert Bestätigung und eigene Tourrechte; offline sind Schreibaktionen gesperrt.
- Speichern bleibt beim Vorschlag. „Gespeichert · Bearbeiten“ öffnet erst auf einen weiteren Tipp den Editor. Alle weiteren Vorschläge bleiben verfügbar.
- „Buddy-Empfehlungen“ sind die letzte nutzerspezifisch persistierte Berechnung, kein redaktioneller Feed. „Entdecken“ zeigt die vom Backend lesbaren Touren; bestehende Schreibrechte bleiben erhalten.

## Abgrenzung zur separaten Demo

Keine Demo-API, kein Demo-Login, keine Offline-Kartenfixtures, kein Demo-Reset, keine künstliche Wartezeit und keine erzwungenen zusätzlichen Touren werden übernommen. Die produktive Automatik zeigt ausschließlich echte Backend-Ergebnisse (auch 0 oder 1). `searchLimited` wird sichtbar erklärt. Auth0/Basic-Testprofil und das bestehende Backend bleiben unverändert aktiv.

## Prüfungen auf diesem Stand

- App: 53 Jest-Suiten, 265 Tests erfolgreich; darunter Gruppen-/Solo-Planung, Speichern mehrerer Vorschläge, expliziter Editorwechsel, Drehradgrenzen, leere Ergebnisse, Session-Persistenz, Rechte, Offline-Sperren und Löschbestätigung.
- Backend: 48 Tests erfolgreich, einschließlich HTTP-Vertrag, Gruppenrechten, Budgetgrenzen, Rückweg, neuen/gelöschten/geänderten Wegedaten und Tour-Vorschaubildern. Der neue Freshness-Test aus `develop` prüft jetzt `path[].travelTime_ID` entsprechend dem neuen Vertrag.
- TypeScript ohne Fehler; ESLint der geänderten Laufzeitkomponenten ohne Befund; `git diff --check` erfolgreich.
- Release-Automation: 31 Tests erfolgreich; Expo-Fingerprint-Test erfolgreich.
- Aktueller Expo-Webexport erfolgreich. Der native Android-/Hermes-Export wurde am vorherigen PR-Stand erfolgreich geprüft; dieser Web-Merge führt keinen neuen nativen Gerätetest ein. Keine neuen nativen Bibliotheken nötig.
- Browser: separate lokale CAP-/SQLite-Datenbank, echtes Basic-Testprofil und bestehende Stempel-/Parkplatz-/Wegedaten. Fünf echte Vorschläge; zwei einzeln gespeichert, ohne den Screen zu verlassen; zweiter Vorschlag explizit im vorhandenen Editor geöffnet, umbenannt und mit einem Tipp auf „Fertig“ in die gemeinsame Ansicht zurückgekehrt. Bottom Sheet per Tastatur, Löschdialog/Abbrechen sowie 320/390/1440 Pixel und dunkles Systemdesign geprüft. Keine JavaScript-Laufzeitfehler. Kein Auth0-End-to-End-Test.

## Offene native Prüfung

**Kein bestätigter Sicht-/Gestentest der PR-App auf einem nativen Gerät.** Die bereitgestellte lokale Android-Umgebung wurde gestartet; Android bootete, aber Paketmanager/APK-Installation reagierten nicht zuverlässig. Der Versuch wurde beendet; Emulator und Browser-Controller sind gestoppt, Laufzeit-Token entfernt. Build-Caches und die drei vorhandenen lokalen Login-/SecureStore-Änderungen im ursprünglichen Checkout sind unverändert erhalten. Der erfolgreiche Android-Export ersetzt keinen APK-/Gerätetest.

Vor der Merge-Freigabe auf einem funktionierenden eigenen Development Client oder Release-Testbuild prüfen:

- Drehrad mehrfach über zwölf Uhr drehen, Richtung wechseln, Presets und Screenreader-Aktionen testen; dabei darf die äußere Seite nicht mitscrollen.
- Bottom Sheet ziehen, unterbrechen, zwischen den Positionen schnappen lassen; Stationen scrollen, Vorschläge wechseln und alle erreichbaren Aktionen prüfen.
- Buddy-Loop und Standbild bei reduzierter Bewegung sowie helle Karte bei dunklem Systemdesign prüfen.
- Touren manuell erstellen/ändern, zurück zur neuen Ansicht wechseln, speichern und neu öffnen. Kein Expo Go oder EAS-Simulator erforderlich.

## Backend vor App ausrollen

1. Backup und normales Datenbank-Deploymentverfahren des Betriebs verwenden. Das neue Feld `hwb.db.Tours.previewSvg` mit dem Backend-Schema ausrollen (`npm run deploy:postgres` in `backend/hwb`).
2. Backend-Service auf denselben Stand aktualisieren; API-/Tour-Speicher-Smokecheck durchführen.
3. Erst danach die dazugehörige App ausrollen. Kein produktives Deployment wurde im Rahmen dieser PR-Aufbereitung ausgeführt.

**Breaking API:** `calculateHikingRoute.results[].path` enthält sortierte Tour-Verknüpfungen (`travelTime_ID`, `rank`, eingebettetes `travelTime`) anstelle flacher Pfadeinträge. Backend und App gehören beim Rollout zusammen. Die Suche bleibt begrenzt (Wegegraph, Startparkplätze, Segmenttiefe, Suchzustände); sie garantiert keine global optimale Route.

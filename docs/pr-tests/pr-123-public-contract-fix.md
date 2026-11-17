# PR #123: öffentlicher Katalogvertrag und native Nachprüfung

17. November 2026. Ausgangshead `713366fee0242ef8897053cd0f7e8ec9d56db47c`, normaler Projektcheckout. Die vorangegangene Luna-Nachprüfung fand einen reproduzierbaren HTTP-400 beim anonymen Listenstart.

## Bestätigter Fehler und Korrektur

Die App fragt `sourceCheckedAt`, `availability` und `identityStatus` ab. Diese vorhandenen Katalogmetadaten fehlten in der öffentlichen `Stampboxes`-Projektion. Die private Projektion enthielt sie bereits. Anonyme Listen-/Detailanfragen scheiterten damit schon vor der Datenverarbeitung. Schwere: P1 für den Gast-/Erststart.

Die drei Metadaten werden nun auch im öffentlichen schreibgeschützten Katalog projiziert. Neue Integrationstests stellen echte anonyme OData-Listen- und Detailanfragen und prüfen die zurückgegebenen Werte. Beide Fälle schlugen vor dem Fix mit dem bestätigten HTTP-400 fehl; nach dem Fix bestehen **83 Backend-Tests in 16 Suites**.

Nach der regulären CAP-Migration der ausschließlich lokalen Testdatei `/private/tmp/hwb-pr123.sqlite` enthält auch deren SQL-View die neuen Felder. Ein bloßer Serverneustart genügte für die zuvor erzeugte alte SQL-View nicht. Die Migration des integrierten Release-Stands ist vor Backendstart erforderlich; keine produktive Migration wurde ausgeführt.

## Tatsächlicher lokaler Import

- 222 reguläre Stellen aus der öffentlichen Entwicklungs-CSV lokal als minimale Fixtures angelegt. Beschreibungen/Bilder wurden dabei nicht mitübernommen; deren Fehlen in diesen regulären Testkarten ist kein Produktbefund.
- Echte lokale Admin-Vorschau: 151 fehlende Sonderstempel, keine Erzeugung.
- Initialisierung: 151 neu; Wiederholung: 0 neu, 151 vorhanden.
- Themenimport über echte lokale CAP-Endpunkte: 12 Ausgaben, 7 vollständig/veröffentlicht, 5 redaktionelle Entwürfe, 46 Sonderstempel-Zuordnungen.
- Anonymer Metadatenabruf nach Fix/Migration: HTTP 200 und 373 Katalogstellen.

## Eigene native Abnahme nach Fix

Unverändertes vorhandenes PR123-Appbinary mit den dokumentierten lokalen UIScene-/Basic-Baselines, isolierter Bundle-ID `de.kuestenbit.harzer-wander-buddy.pr123test`, deaktiviertem OTA und korrigiertem lokalen Backend. Der Fix betrifft nur den Service und benötigt keine Änderung am Appbinary.

- Liste startet ohne OData-Fehler und zeigt 0 von 222 regulären Stellen.
- Lila Sonderstempel-Chip an dritter Position; Aktivierung öffnet die Themenreihe und zeigt importierte Sonderstellen.
- Native Anmeldung mit dem dokumentierten lokalen Testkonto erfolgreich. Der zunächst gemeldete Loginfehler lag an der automatisierten Eingabe: Ersetzen des geschützten Felds über `fill` führte zu abweichendem gesendetem Inhalt, während derselbe Zugang per API akzeptiert wurde. Leeren, Feld fokussieren und direkte Eingabe über `agent-device type` funktionierte. Nur Vergleichsergebnisse/Längen wurden vorübergehend lokal diagnostiziert, keine Kennwörter/Token protokolliert; der Diagnose-Hook wurde danach deaktiviert.
- iOS-Dialog zum Speichern des Passworts übersprungen; alle fünf Onboarding-Schritte regulär abgeschlossen, Foto/Standort/Freundesuche optional übersprungen.
- App-Neustart erhält Anmeldung und abgeschlossenes Onboarding; Profil öffnet sich direkt.

Die zuvor beobachtete deaktivierte Onboarding-Aktion vor Anmeldung ist damit kein zusätzlicher bestätigter Produktfehler. Simulator-Steuersitzung nach eigener Prüfung freigegeben.

## Nachweise und offene Abnahme

- [Listenfehler vor Fix](evidence/pr123-initial-load-error.png)
- [Öffentliche Liste nach Fix](evidence/pr123-public-list-fixed.png)
- [Sonderstempel nach erfolgreicher Anmeldung](evidence/pr123-special-list-authenticated-fixed.png)

Ein frischer Luna-Nachtest muss die verbleibenden nativen Karten-/Zoom-/Filter-, Besuchs-/Wiederholungs- und Themenheftfälle mit diesem korrigierten, befüllten Stand abschließen. Keine vollständige native Merge-Freigabe aus dieser Teilprüfung ableiten. Die auf develop vorhandenen Simulator-Baselines sind weiterhin lokale Testintegration und gehören nicht zum Vertragsfix.

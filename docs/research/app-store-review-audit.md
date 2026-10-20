# Wettbewerber-Rezensionen und Funktionsabgleich

Stand: 20.10.2026. Codebasis: `develop`, Commit `e1737a5f25c204dd9a7f6be5f7a107d908de5422`, App 1.8.0. Untersuchung umfasst die aktuelle Expo-App, CAP-Backend und dokumentierte Planung. Ältere UI5-Funktionen werden nicht als fertige Expo-Funktionen gezählt.

## Ergebnis

Die wichtigsten Risiken sind Zuverlässigkeit im Wald und vollständiger, dauerhaft verfügbarer Sammelfortschritt. Der Buddy hat gute Grundlagen für manuelles Sammeln und gemeinsame Planung. **Alle gelobten Eigenschaften der Konkurrenz haben wir noch nicht:** Offline-Stempeln, persönliche Sicherung/Übernahme, Themenhefte/Abzeichen, vollständige Wanderkarten und GPX-Austausch sind offen oder nur teilweise vorhanden.

Grundlage sind **33 ausgewählte Rezensionen aus fünf Apps**. [Belegregister mit Quellen, Autoren, Daten und Einordnung](app-store-review-evidence.md). Kritische Inhalte wurden gezielt berücksichtigt; keine Vollerhebung oder verlässlich nach Sternen sortierte Stichprobe. Historische Nutzerberichte sind Anforderungen an uns, keine Behauptung aktueller Konkurrenzfehler. Funktionsstatus beruht auf Codeprüfung und ausgewählten Tests, nicht auf einem iPhone-Feldtest.

## Was an den Konkurrenz-Apps schmerzt

| Muster | Belege im Register | Konsequenz für den Buddy |
| --- | --- | --- |
| Sammlung oder Tour verschwindet nach Update, Synchronisierung oder Verbindungsverlust | T1, T3, T7; K2, K4; O10 | Sammlung dauerhaft speichern; Wiederherstellung und Migration prüfen. Ein Cache allein ist keine Sicherung. |
| Kein Netz am Stempelkasten, Download hilft trotzdem nicht | T2; K2; O3, O5, O10 | Offline lesen, offline schreiben und echte Offline-Karte getrennt behandeln. |
| Alte Papierstempel lassen sich nicht vollständig nachpflegen | T5, T8 | Erfassen ohne Standortpflicht, Datum ändern und Altbestände übernehmen können. |
| Karte zeigt zu wenig Unterschiede oder ist überladen | H1; P1; O6 | Offen/besucht/Gruppe klar trennen; Status zusätzlich beschriften. Wege müssen erkennbar bleiben. |
| Hefte, Abzeichen und nächste Ziele fehlen oder sind versteckt | H2; P2; T2, T8 | Ein fachlich korrektes, sichtbares Fortschrittsmodell statt bloßer Gesamtsumme. |
| Zu viele Klicks oder notwendige Wechsel zwischen Apps | H1, H2; O1 | Häufige Aufgaben direkt anbieten; Übergabe an andere Wander-Apps verlustarm machen. |
| Kauf enthält nicht den erwarteten Nutzen | K3; O7 | Leistungsumfang vor Kauf zeigen; leere Suche erklären; eine nutzbare Probe anbieten. |
| Navigation stockt, Ortung/Watch/Akku unverständlich | K1, K2; O3, O4, O6 | Keine ungeprüften Navigationsversprechen. Standortberechtigung verweigern darf das Sammeln nicht blockieren. |
| Wegdaten oder Beschreibung passen nicht zur Realität | O8, O10 | Quelle, Aktualität und Sperrungen ernst nehmen; kuratierte und generierte Touren kennzeichnen. |

Diese Muster sind unsere qualitative Zusammenfassung, keine nach Häufigkeit statistisch geordnete Liste. Beispielsweise erläutern Entwickler bei H2, P1 und O1 bereits Lösungen; Auffindbarkeit bleibt trotzdem eine Produktanforderung.

## Haben wir die gelobten Eigenschaften?

Legende: **vorhanden** = konkreter aktueller Codepfad, **teilweise** = wesentliche Lücke, **geplant** = dokumentiert, **offen** = nicht als Nutzerfunktion nachgewiesen. Vorhanden bedeutet keine geprüfte Fehlerfreiheit im Gelände.

| Gewünschte Stärke | Beleg für Nutzen | Buddy-Status und konkreter Nachweis |
| --- | --- | --- |
| Schnell erfassen, auch alte Besuche | H7, T5 | **Vorhanden:** `app/app/stamps/[id].tsx`, `handleStampVisit`, Datumsbearbeitung; `app/app/(tabs)/index.tsx` für Mehrfachauswahl. Online erforderlich. |
| Offen/besucht sehen und Fortschritt zählen | H4 | **Vorhanden:** Karten-/Listenfilter, Profilzählung in `app/lib/api.ts`. Abzeichenfortschritt ist damit noch nicht abgedeckt. |
| Gemeinsam vergleichen und stempeln | Bezug zu gemeinsamen Touren aus Gründerziel; nicht separat durch diese Reviews validiert | **Vorhanden:** `group-selector.tsx`, `group-marker.ts`, `stampForGroup` und berechtigungsgebundener Gruppendialog. |
| Informationen, Fotos, Anreise | H4, H5 | **Vorhanden:** Beschreibungs-/Bildansicht, Parkplatzdaten und externe Navigation. Vollständigkeit aller Ortsdaten ungeprüft. |
| Nachvollziehbare eigene Touren auf dem Handy | K1, O2 | **Vorhanden:** `app/app/tours/[id]/edit.tsx`, Tourendetails mit Strecke, Dauer und Höhenmetern. Höhenmetersummen sind keine vollständige Topokarte. |
| Touren leicht teilen | O2 | **Vorhanden:** `handleShareTour` erzeugt Link. Externe Navigation über Google Maps. GPX ist damit nicht erledigt. |
| Offline auf die eigene Planung zugreifen | T4, O4 | **Teilweise:** `core-offline-sync.ts` lädt Daten und Touren vor; `query-persistence.ts` hält Cache maximal 14 Tage. `auth.tsx` besitzt `offline_grace`. Kein Beleg für gezielt herunterladbare Karten. |
| Unterwegs auch ohne Netz stempeln | Aus kritischen T2/O3 abgeleitet | **Offen:** `offline-write.ts` und `requireOnlineForWrite` blockieren Schreibaktionen. Auch Gruppendialog und Mehrfachauswahl verlangen Onlinezugriff. Keine dauerhafte Schreibwarteschlange nachgewiesen. |
| Sammlung auf neuem Handy wiederherstellen | H6, H7 | **Teilweise:** Konto/Serverdaten sind vorhanden. Persönliche Export-, Import- und Wiederherstellungsoberfläche fehlt. `/export/csv` ist ein technischer Serverexport, kein fertiger Nutzerflow. |
| Abzeichen, Heftfortschritt, nächstes Ziel | H4 | **Geplant:** [Abzeichenalbum](../todos/premium-gamification/02-abzeichenalbum.md) und [nächstes Sammelziel](../todos/premium-gamification/01-naechstes-sammelziel.md). Expo-Profil verwendet einfache Zähler; das aktuelle Viewmodel übergibt kein vollwertiges Abzeichenalbum. |
| Themenhefte und Sonderstempel vollständig abbilden | H4, P2 | **Teilweise:** Schema erlaubt Sondernummern und Gültigkeitszeiträume. Mehrbuchverwaltung steht in `backend/hwb/README.md`; vollständige Themenzuordnung und Datenabdeckung nicht nachgewiesen. |
| Gute Wanderkarte mit nutzbaren Wegen | O2, O5 | **Teilweise:** Web verwendet OpenFreeMap/Liberty; native Karten verwenden eigene Plattformkomponenten. Keine nachgewiesene plattformgleiche Topokarte mit Höhenlinien und Offlinepaket. |
| Sperrungen und aktuelle Stempelstellen | T5 | **Teilweise:** Adminpflege, Gültigkeit und Notizen vorhanden. `app/xTODO.md` führt aktuelle Defektmeldungen/Meldeflow offen. Notizen ersetzen keinen geprüften Sperrungsfeed. |
| GPS-Dateien weiterverwenden | O1, O9 | **Offen:** Kein GPX-Import-/Export-Nutzerflow in aktueller App nachgewiesen. Share-Link und Google-Maps-Übergabe ersetzen ihn nicht. |
| Passende kurze und familiengeeignete Ausflüge finden | P3, P4 | **Teilweise:** Manuelle Planung und Ortsinfos vorhanden. Zeitbudget-Automatik existiert im Backend/älterer UI; keine eingebundene aktuelle Automatikoberfläche gefunden. Für kuratierte Einstiegsrouten fehlt ein belegter Katalog. |
| Gruppe bei automatischer Suche berücksichtigen | Gründerziel, kein Nachweis der Zahlungsbereitschaft aus Reviews | **Teilweise:** `calculateHikingRoute` zählt zunächst persönliche fehlende Stempel; Gruppenwerte erst danach. Echte Optimierung für alle ist auszubauen. |
| Schnelle verständliche Hilfe | H3, H5, H6 | **Nicht abgesichert:** Technische Informationen im Profil vorhanden; auffindbarer vollständiger Hilfe-/Supportflow und Reaktionszeit nicht nachgewiesen. |
| Watch, Sprachnavigation, kontinuierliche Aufzeichnung | K1, O2 | **Offen, vorerst außerhalb des Kernumfangs:** Keine entsprechende fertige Eigenlösung nachgewiesen. Zunächst gute Übergabe an spezialisierte Apps statt eigene Vollnavigation versprechen. |

Weitere gelobte Extras wie Tourensammlungen, konfigurierbare Ortungsgenauigkeit oder professionelle Tourenanbieter werden nicht durch ein einfaches Tourenlisting beziehungsweise eine Standortabfrage abgedeckt. Ob sie für das regionale Stempelprodukt nötig sind, ist separat zu entscheiden.

## Priorisierte Folgeaufgaben

Prioritäten sind Empfehlungen dieser Untersuchung, keine bereits beschlossenen Roadmapänderungen. P0 = Vertrauen und Nutzbarkeit im Kern sichern; P1 = nächste funktionale Lücken; P2 = anschließend erproben.

### P0: Offline-Stempeln und zuverlässige Synchronisierung

- [ ] Besuch mit Zeitpunkt und lokaler Kennung dauerhaft speichern, auch ohne Netz; ausstehende Synchronisierung verständlich anzeigen.
- [ ] Wiederholtes Senden derselben Operation idempotent behandeln; Wiederholungsbesuche fachlich davon trennen.
- [ ] Server bestätigt Speicherung; Ablehnung bleibt sichtbar und lösbar. Einladungs-/Stempelrechte serverseitig prüfen, einschließlich zwischenzeitlich widerrufener Gruppenrechte.
- [ ] Flugmodus, App-Abbruch und Neustart vor erfolgreicher Synchronisierung dürfen den Besuch nicht verlieren.

Codeansatz: `offline-write.ts`, `core-offline-sync.ts`, Stempel-Mutationen und `stampForGroup`. Keine erfundene Offlinegarantie aus dem bisherigen Lesecache ableiten.

### P0: Eigene Sammlung sichern und Änderungen überstehen

- [ ] Persönlichen Export mit stabilen Stempelkennungen, Besuchen und Zeitpunkten anbieten; Importformat versionieren.
- [ ] Import mit Vorschau, Dublettenerkennung und klarer Konfliktbehandlung. Fremdformate erst nach belegter Feldzuordnung versprechen.
- [ ] Konto-/Gerätewechsel, Cacheverwerfung und Migration mit bestehender Sammlung prüfen; serverseitige Backups einschließlich Restore nachweisen.
- [ ] Explizites Löschen, Logout-Cache und Datenverlust klar unterscheiden. Technischen CSV-Export nicht als Produkt-Backup vermarkten.

### P1: Album, Themen und Datenqualität schließen

- [ ] Bestehende [Albumplanung](../todos/premium-gamification/02-abzeichenalbum.md) um Themenfilter und nachvollziehbare Sonderstempelabdeckung verbinden.
- [ ] Regeln fachlich prüfen; vorhandene Grenzweg-Differenz aus der Albumplanung vor Freischaltung klären.
- [ ] Verlegte/ehemalige Stellen dürfen historische Besuche nicht löschen; Zählregeln erklären.
- [ ] Defekt-/Sperrungsdaten mit Quelle, Zeitpunkt und Ablauf modellieren; bestehende Notizen weiter kostenlos lassen.

### P1: Karte und Touren unterwegs brauchbar halten

- [ ] Dichte Stempelbereiche auf kleinem iPhone und Android prüfen: Nummer, eigener Status und Gruppenstatus ohne reines Farbsehen erkennbar.
- [ ] Wanderwege, Lesbarkeit und Datenumfang je Plattform abnehmen; echter Offline-Download braucht Fortschritt, Speichergröße, Aktualität und Erfolgskontrolle.
- [ ] GPX-Export zuerst für bestehende Touren; Import anschließend mit Vorschau und nachvollziehbaren Wegpunkten.
- [ ] Im Wald mit schlechtem Netz, Bildschirmsperre und verweigerter Ortung testen; Akku und Kartenreaktion messen, keine Werte erfinden.

### P1: Premium erst nach erlebbarem Nutzen

- [ ] Automatik in aktueller App erreichbar machen; Gruppenmodi „fehlt allen“ / „fehlt mindestens einer Person“ implementieren.
- [ ] Bei leerem Ergebnis erklären, welcher Filter einschränkt, und Alternativen anbieten. Kein leeres Ergebnis als erfolgreiche Probe zählen.
- [ ] Kostenlose manuelle Kernfunktionen erhalten. Passlaufzeit, Erneuerung, Gruppenzugang und Wiederherstellung von Käufen verständlich machen.

Der bestehende [Preisstrategie-PR #76](https://github.com/JanTristanH/harzer-wander-buddy/pull/76) beschreibt die separate Produktentscheidung. Die Reviews bestätigen keine konkrete Zahlungsbereitschaft für 7,99 € oder die geplante Gruppenfreigabe.

### P2: Urlaubseinstieg und Hilfe

- [ ] Drei bis fünf geprüfte regionale Einstiegstouren testen, mit Startpunkt, Dauer, Stempeln und nachvollziehbarer Eignung.
- [ ] Redaktionell geprüft, von Nutzern erstellt und automatisch berechnet deutlich unterscheiden.
- [ ] Hilfe direkt bei Offlinefehlern, Datenübernahme und Gruppenfreigaben anbieten. Diagnosedaten nur bewusst und ohne Token/Passwörter weitergeben.

## Abnahme vor Aussagen wie „alles Wichtige abgedeckt“

| Szenario | Erwartung | Stand dieser Prüfung |
| --- | --- | --- |
| Papierheft nachtragen, Datum korrigieren, neu anmelden | Bestand und Datum bleiben erhalten | Codepfad vorhanden; kein Ende-zu-Ende-Nachweis |
| Flugmodus, neuen Besuch erfassen, App beenden, Netz zurück | Besuch bleibt lokal, landet einmal auf Server | Noch nicht erfüllt: Schreibzugriff gesperrt |
| Neue Installation / zweites Gerät | Eigene Sammlung und Rechte wiederherstellbar | Konto vorhanden; Export/Import-/Kaufwiederherstellung offen |
| Unterschiedliche Gruppenbestände | Karte und Tour zeigen korrekten Personenstatus | Ausgewählte Unit-/Komponententests erfolgreich |
| Kleines Display, große Schrift, dichtes Stempelgebiet | Nummern und Status lesbar | Darstellung vorhanden; Geräteabnahme offen |
| Stempel verlegt oder Themenregel geändert | Historie bleibt, Fortschritt erklärt Änderung | Datenmodell vorhanden; Migration/Regeltest offen |
| Offlinekarte heruntergeladen, App kalt gestartet | Gewählter Bereich ohne Netz vollständig verfügbar | Kein nachgewiesener Downloadflow |
| Thema/Abzeichen auswählen | Pflichtstellen und fehlende Ziele korrekt sichtbar | Geplant, nicht fertig |
| Fremde Navigations-App verwenden | Route/GPX bleibt nachvollziehbar und übertragbar | Share-Link vorhanden, GPX offen |

## Tatsächlich ausgeführte Prüfung

- Aktuelles `origin/develop` abgerufen und Code-/Roadmapstellen oben gelesen. Keine Produktionsdaten geändert.
- Acht bestehende Jest-Suites gezielt gestartet: Gruppenmarker, Gruppen-API, Gruppenstempeln, Mehrfachauswahl, Offlinebanner, Standortrechte, Touren-Gruppenfortschritt und Gastliste.
- Mit expliziter Konfiguration `jest.config.js`: **6 Suites / 31 Tests bestanden**. Zwei Suites (Mehrfachauswahl und Gastliste) konnten wegen nicht auflösbarem `react-native-svg/filter-image` nicht starten. Das ist ein offener Prüfblocker, kein bewiesener Laufzeitfehler der App.
- Der allgemeine `npm test`-Aufruf scheitert außerdem an zwei gefundenen Jest-Konfigurationen; explizite Konfiguration löst diesen Startkonflikt.
- Keine Tests ergänzt und keine Implementierung geändert. Offlineverhalten im Gelände, Datenwiederherstellung, Akku, vollständige Stempeldaten und echte Kaufabläufe sind nicht praktisch abgenommen.

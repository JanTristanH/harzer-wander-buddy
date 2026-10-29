# Digitales Abzeichenalbum

Die am 14. Oktober 2026 bestätigte Gestaltung verbindet ein Album mit frei
wählbaren Profilabzeichen, Titeln sowie Metall- und thematischen Materialrahmen.

## Auswahl und Freischaltung

Bis zu drei freigeschaltete Abzeichen können im Profil über drei Plus-/Stiftplätze hervorgehoben werden. Ein belegter Platz
öffnet die Auswahl zum Ersetzen oder Entfernen; bereits verwendete Abzeichen
wechseln beim Auswählen ihren Platz. Separate Sortierpfeile entfallen. Titel und Avatarrahmen sind unabhängig davon
wählbar. Eine leere Auswahl und „Kein Titel“ sind erlaubt; es wird nichts
automatisch durch den höchsten Rang ersetzt. „Wanderer“ ist ein frei wählbarer
Basistitel. Fremde Profile zeigen ausschließlich die aktive Auswahl ihres Besitzers.

| Abzeichen | Voraussetzung | Rahmen | Personentitel |
| --- | --- | --- | --- |
| Bronze / Silber / Gold | 8 / 16 / 24 reguläre Nummern | Bronze / Silber / Gold | – |
| Wanderkönig | 50 reguläre Nummern | König mit Krone und Eichenlaub | Wanderkönig / Wanderkönigin |
| Kaiserrucksack | 100 reguläre Nummern | Silber mit Rucksackrelief | – |
| Harzer Steiger | 111 reguläre Nummern und alle 23 Bergbaustellen | Stein/Silber mit Bergbaurelief | Harzer Steiger |
| Kaiserschuh | 150 reguläre Nummern | Kupfer mit Schuhrelief | – |
| Wanderkaiser | alle 222 regulären Nummern | Gold/Grün mit Krone und Bergrelief | Wanderkaiser / Wanderkaiserin |
| Goethe im Harz | alle 28 Pflichtstellen | Holz und Pergament mit Buchmotiv | – |
| Hexen-Stieg | 9 aus der Auswahl sowie 69 und 140 | Waldzweige und Moos mit Mondmotiv | – |
| Grenzweg | 20 reguläre Pflichtstellen und 3 Sonderstempel | Wanderseil und Wegweiser mit Kompass | – |
| Wanderprinzessin / Wanderprinz | 11 reguläre Nummern, digital für jedes Alter | Mattes Terrakotta/Türkis mit Sternen und kleiner Krone | Wanderprinzessin / Wanderprinz |

Die digitalen Erfolge basieren auf den persönlichen Besuchen. Sie bestätigen
keine offizielle Ausgabe eines physischen Abzeichens. Der Hinweis beim Prinzenabzeichen folgt der am 29.10.2026 geprüften offiziellen
Angabe „für Jung und Alt“.

Die Grenzweg-Regel wurde ausdrücklich auf **20 + 3** festgelegt. Die offiziellen
[Themenhefte](https://www.harzer-wandernadel.de/die-wandernadel/themenhefte/)
nennen 20 + 3, während die Seite
[Leistungsabzeichen](https://www.harzer-wandernadel.de/die-wandernadel/leistungsabzeichen/)
22 + 3 nennt. Die 20 Pflichtnummern stammen aus dem bestehenden UI5-Katalog;
Sonderstempel sind Zwei-Länder-Eiche, Jungborn und Drei-Länder-Stein. Reguläre
Nummern werden normalisiert; gleichnamige Sonderstempelnummern werden auf stabile
interne IDs abgebildet. Nicht im Stempelkatalog vorhandene Sonderstellen werden
im Detail explizit als nicht verfügbar gezeigt und zählen nicht als besucht.

## Daten und Korrekturen

`backend/hwb/srv/badge-catalog.js` ist die zentrale Regelquelle für API und UI.
Der Server berücksichtigt die vollständige Besuchshistorie und zählt jede
reguläre Nummer 1–222 einmal, auch bei Wiederholungen oder umgezogenen Stellen.
Gesamtstempel und Bergbau-Pflichtstellen werden beim Steiger getrennt angezeigt.

`BadgeProfiles` speichert die Reihenfolge, Titel-ID und Rahmen-ID. Die Aktion
`saveBadgeProfile` validiert sämtliche Freischaltungen serverseitig und schreibt
ausschließlich die Auswahl des angemeldeten Nutzers. Ein gelöschter/korrigierter
Besuch entzieht nicht mehr berechtigte aktive Auswahlen sofort. Auch nach einer
erneuten Freischaltung kommen sie nicht automatisch zurück. Der Hinweis bleibt
bis zum nächsten Speichern sichtbar.

Das Erwerbsdatum ist der erste historisch belegte Besuch, der sämtliche
Voraussetzungen erfüllt. Enthält die verfügbare Historie undatierte Besuche,
wird kein vermeintlich genaues Datum aus Import-/Erstellungsdaten erfunden.

React Query speichert das Album kontobezogen im vorhandenen Offlinecache.
Offline und bei Aktualisierungsfehlern bleibt ein vorhandener Stand sichtbar;
Schreiben ist offline gesperrt. Ladefehler werden nicht als leeres Album dargestellt.

## Grafikassets

Die Rahmen liegen als **einzelne transparente PNG-Dateien** unter
`app/assets/images/badges/<rahmen>.png`; `<rahmen>-locked.png` enthält die
entsprechende graue Variante. `BadgeArtwork` lädt das ausgewählte Bild direkt,
ohne Atlas-Koordinaten oder benachbarte Zellen. Die acht Metallrahmen wurden
aus den bestehenden Assets ausgeschnitten und auf eine gemeinsame
quadratische Zeichenfläche gesetzt. Die zentrale Öffnung bleibt transparent.

Prinzessin/Prinz erhält einen verspielten, matten Material-Look in Terrakotta
und Türkis mit Sternen und kleiner Krone. Die drei bestehenden Themenabzeichen
haben eigene Rahmen: Goethe aus Holz/Pergament mit Buch, Hexen-Stieg aus
Waldzweigen/Moos mit Mond und Grenzweg aus Wanderseil mit Kompass. Alle drei
Rahmen sind nach den bestehenden fachlichen Regeln auch am Avatar auswählbar;
Besuchskorrekturen entziehen sie nach derselben Regel wie Metallrahmen.

Die neuen Motive wurden mit dem Image-Generator erstellt. Produktionsdateien
sind einzeln ausgeschnitten und in farbiger sowie grauer Version exportiert.
Verwendeter Prompt:

> Four empty circular avatar frame rings on transparent background, equal cells
> and transparent centers. Playful prince/princess: modern Material Design,
> matte terracotta and teal, friendly yellow crown and stars, no precious metal.
> Goethe: warm wood and parchment, carved leaves and open book.
> Hexen-Stieg: forest twigs and moss, violet accents and crescent moon.
> Grenzweg: green hiking cord, weathered trail marker and compass.
> Cohesive tactile illustrated mobile assets, no labels, no background.

## Profilansicht und Anpassung

Der Einstieg **Profil anpassen** öffnet die Bearbeitung mit der Vorschau oben.
Name und drei Abzeichenplätze werden direkt dort bearbeitet. Avatarrahmen stehen
als erster Auswahlbereich darunter und sind zunächst eingeklappt. Titel bleiben
unabhängig wählbar. Auswahlzustände sind neutral; Speichern ist die Primäraktion.
Das eigene Profil zeigt die drei Plätze mit Stift oder Plus, fremde Profile zeigen
weiterhin nur die ausgewählten Abzeichen. Die vorhandenen übrigen Profilbereiche
und der Footer bleiben erhalten.

Der bisherige Editor [`app/app/profile/edit.tsx`](../app/app/profile/edit.tsx)
wird nicht ersetzt oder entfernt. Sowohl der Avatar als auch **Name und Profilbild
bearbeiten** öffnen ihn unter `/profile/edit`, mit den bestehenden Bildrechten,
der 1:1-Auswahl, dem echten Upload, Fehlerbehandlung und Schutz ungespeicherter
Änderungen. `/profile/customize` bleibt als alternativer Einstieg vorhanden.
Inline-Namen verwenden `updateCurrentUserProfile`, die Abzeichenauswahl verwendet
`saveBadgeProfile`. Falls nach dem Namen die zweite Anfrage scheitert, weist die
Oberfläche ausdrücklich auf diesen Teilstand hin und bleibt zur Wiederholung offen.

„Dein nächstes Ziel“ zeigt alle Fortschrittsbedingungen. Allgemeine
Leistungsabzeichen verlinken zur Stempelstellenliste, statt alle 222 Stellen zu
laden. Pflichtstellen nutzen `StampListItem`; ihre Bild-/Beschreibungsmaterialien
werden nur für die benötigten IDs nachgeladen. Fehlende Metadaten verbergen die
Pflichtstellen und Navigationsmöglichkeiten nicht.

„Deine Belohnung“ zeigt auch für offene Abzeichen ein Beispielprofil mit Rahmen
und gegebenenfalls Titel. Hinweise zu physischen Wandernadeln nennen offiziellen
Nachweis, Schutzgebühr, Begleithefte und Vertriebsstellen. Sie bestätigen keine
Ausgabeberechtigung allein aus digitalen Besuchen. Die widersprüchlichen offiziellen
Grenzweg-Angaben 20 + 3 / 22 + 3 werden vor einem Erwerb ausdrücklich zur Klärung
mit dem Servicebüro verwiesen.

Die veröffentlichten Sites sind getrennte Mock-Demos, keine vollständige
Installation dieser App. Der [Abgleich](abzeichen-demo-abgleich.md) hält die
Unterschiede und den Prüfumfang fest.


## Screenshots und Prüfung

Die tatsächlichen mobilen Webansichten sind in
[screenshots/abzeichenalbum](screenshots/abzeichenalbum/) dokumentiert. Die
Aufnahmen verwenden ein lokales Testkonto und bewusst erzeugte Demo-Besuche;
sie zeigen keine Produktionsstatistik. Zu prüfen sind leeres/gemischtes Album,
offene und erreichte Details, Altersregel-Hinweis, Auswahl, Profil und Zielfilter.

Die Backend-Tests decken Regeln, Persistenz, gesperrte Auswahlen, fremde Profile
und Entzug bei Besuchskorrekturen ab. Listen-Tests prüfen Zielauswahl und Reset.
Der Browser-Smoke-Test prüft die echte Anmeldung, Auswahl, Speicherung und
erneute Anmeldung. Physische native Geräte sind zusätzlich vor einer Veröffentlichung
zu prüfen; der Web-Smoke-Test ersetzt keinen iOS-/Android-Gerätetest.

## Prüfung der PR-Aktualisierung

- 24 fokussierte App-Tests: Inline-Name, Plus-Auswahl, alter Editor-Einstieg,
  Erhalt ungespeicherter Namen bei Hintergrundänderungen, Teilfehler beim Speichern,
  Offline-Sperre, begrenzte Pflichtstellenabfrage und vorhandene Profil-/Listenverträge.
- 8 bestehende Katalogtests: Freischaltung, Pflichtstellen, unabhängige Auswahl,
  Entzug und digitale Prinzenregel.
- TypeScript ohne Fehler. Vollständiger Basic-Webexport einschließlich
  `/profile/edit`, `/profile/customize` und Abzeichenrouten erfolgreich.
- Die bestehenden lokalen Abhängigkeiten waren älter als der PR-Lockfilestand;
  `react-native-svg` 15.12.1 wurde nur in einem isolierten Prüfverzeichnis ergänzt.
  Der Export nutzte dafür eine lokale, nicht übernommene Resolver-Konfiguration.
  Originale Quelländerungen, Android-Caches und Abhängigkeiten blieben unangetastet.
- Kein Produktionslogin oder Live-Upload und keine neue native Geräteprüfung.
  Frühere Screenshots weiter unten bzw. im Screenshotverzeichnis dokumentieren den
  vorherigen UI-Stand, nicht die neue Inline-Bearbeitung.

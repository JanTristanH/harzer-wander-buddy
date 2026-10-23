# Digitales Abzeichenalbum

Die am 14. Oktober 2026 bestätigte Gestaltung verbindet ein Album mit frei
wählbaren Profilabzeichen, Titeln sowie Metall- und thematischen Materialrahmen.

## Auswahl und Freischaltung

Bis zu drei freigeschaltete Abzeichen können im Profil hervorgehoben und über
die Pfeiltasten angeordnet werden. Titel und Avatarrahmen sind unabhängig davon
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
keine offizielle Ausgabe eines physischen Abzeichens. Beim Prinzenabzeichen
steht der Hinweis, dass die offizielle Auszeichnung für Kinder bis 11 Jahre gilt.

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

Eigene und fremde Profile zeigen dieselbe Präsentation von Avatar, Titel-Badge
und ausgewählten Abzeichen. Das eigene Profil hat genau einen Einstieg
**Profil anpassen**. Dort führen zwei Bereiche zur bestehenden Bearbeitung von
Name/Bild und zur Auswahl von Abzeichen, Titel und Rahmen sowie ins Album.
Der eigene Footer mit Einstellungen, technischen Details und Abmeldung bleibt
bestehen. Im Abzeichenbereich des Profils stehen keine zusätzlichen
Bearbeitungsbuttons. Titel-Badges werden auch in der Auswahlvorschau verwendet.

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

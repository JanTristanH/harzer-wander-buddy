# Digitales Abzeichenalbum

Die am 14. Oktober 2026 bestätigte Gestaltung verbindet ein Album mit frei
wählbaren Profilabzeichen, Titeln und realistischen Metallrahmen.

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
| Goethe im Harz | alle 28 Pflichtstellen | Gold mit Buchmotiv im Album | – |
| Hexen-Stieg | 9 aus der Auswahl sowie 69 und 140 | Silber mit Mondmotiv im Album | – |
| Grenzweg | 20 reguläre Pflichtstellen und 3 Sonderstempel | Bronze mit Kartenmotiv im Album | – |
| Wanderprinzessin / Wanderprinz | 11 reguläre Nummern, digital für jedes Alter | Silber/Kupfer mit kleiner Krone | Wanderprinzessin / Wanderprinz |

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

Die Metallrahmen wurden mit dem eingebauten Image-Skill erstellt. Die transparenten
Atlanten liegen unter `app/assets/images/badges/metal-frames.png` und
`metal-frames-locked.png`. `BadgeArtwork` rendert abgegrenzte Ausschnitte aus dem
Atlas; die zentrale Öffnung enthält Avatar, Initialen oder das Abzeichenmotiv.
Eine eigene graue Variante erhält die Metalltextur auch unter iOS und Android.

Prompt für den farbigen Atlas (Referenz: bestätigte Materialstudie):

> Create production raster UI assets for the approved hiking badge frames. Input is material style reference only. OUTPUT: a perfectly square PNG sprite atlas on truly transparent background with EXACTLY 9 empty circular metal frame rings arranged in a strict 3 columns by 3 rows equal square cell grid. No labels, no text, no emblem, no backdrop, no device. Every ring centered exactly on its cell center (x: 1/6, 1/2, 5/6 width; y: 1/6, 1/2, 5/6 height); equal outer ring diameter 76% of cell width; central hole diameter 54% cell width. Empty central holes are FULLY TRANSPARENT so avatar photos can show through. No shadow outside frame, no overlapping cells, no decorative element outside each 86%-wide cell safe bounds. Metallic rings realistic brushed microtexture and gleaming bevels, restrained mobile scale ornament, front view no perspective. Row 1 left bronze plain brushed copper; middle silver plain brushed silver; right gold plain brushed gold. Row 2 left KING silver-gold with small gold crown at top and oak leaf relief at bottom; middle BACKPACK silver metal with tiny backpack relief at bottom and rope border; right STEIGER dark stone/silver frame with crossed mining tools relief at bottom. Row 3 left SHOE copper metal ring with tiny hiking boot relief at bottom; middle EMPEROR regal gold and forest green enamel ring with fine mountain relief at bottom and crown at top; right PRINCE silver/copper ring with smaller delicate crown at top. Maintain circular opening unobstructed in every frame, all centers transparent, metallic material distinct from gray locked styling which is applied separately in app. Exact 3x3 grid is critical. Square entire canvas. NO letters or captions. High quality raster asset sprite sheet.

Prompt für den grauen Atlas:

> Edit target is this transparent 3x3 metal ring sprite atlas. Change ONLY all colored metal and green enamel pixels to neutral grayscale to represent locked badges. Preserve exact entire canvas dimensions, 3x3 cell positions, each ring's geometry, detailed metal microtextures, alpha transparency outside rings and in all central holes. Do not move or resize any frame. No additional graphics, no text. Identical atlas but desaturated silver/gray throughout, fully transparent background and holes.

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

# Gruppen-Reel: Du, Lena, Tom und Buddy

Freigegebener Stand vom 26.10.2026: genau 20 Sekunden, 1080×1920, 30 fps. Eine kleine Geschichte mit Problem, Lösung und Erfolg trägt die Funktion. Der frühere schnelle Wechsel vieler Stempel wirkte hektisch. Gruppenauswahl und ein konkretes gemeinsames Ziel erhalten deshalb mehr Zeit. Ein reduziertes Cover mit den Figuren ersetzt die detailreiche App-Ansicht.

## Figuren und Texte

- **Du:** grünes Oberteil, braune Hose, grüner Rucksack; steht für die betrachtende Person.
- **Lena:** brauner Dutt, cremefarbenes Oberteil, grüne Hose, gelber Rucksack. „Ich bin dabei!“
- **Tom:** Bart, grüne Kappe, orangefarbener Hoodie, Shorts; fragt mit einer Karte in der Hand „Aber wohin?“ und sagt am Schluss „Geschafft!“
- **Buddy:** originales Bären-Artwork der App, unverändert und durchgehend neben dem Gerät.

Die Figuren sind eine fiktive redaktionelle Rahmenhandlung. Ihre Dialoge und das High-five behaupten keine gefilmte reale Wanderung. Die App beantwortet Toms Frage mit einem für alle offenen Ziel. Nur die Illustrationen dürfen generiert sein; funktionale App-Ansichten stammen aus der echten lokalen angemeldeten Web-App.

## Schnittplan der Vorlage

| Zeit | Text | Bild / Handlung |
|---|---|---|
| 0–3,5 s | Ein Tag / im Harz. | Große Planungsillustration; Lena und Tom sprechen nacheinander über lesbare Sprechblasen. |
| 3,5–4,5 s | Deine Gruppe. / Euer nächstes Ziel. | Echte Gruppenauswahl vor der Auswahl. |
| 4,5–6,5 s | gleiche Überschrift | Lena und Tom ausgewählt. |
| 6,5–9,5 s | gleiche Überschrift | Echte Karte mit ausgewähltem Ziel, für alle noch offen (0/3). |
| 9,5–11 s | Zusammen / festhalten. | Tatsächlicher persönlicher Holzstempel, volle 1,5 Sekunden sichtbar. |
| 11–14 s | gleiche Überschrift | Echter separater Gruppendialog: freigegebene Freunde gewählt, Selbstbesuch nicht wiederholen. |
| 14–17 s | Alle drei / waren hier. | Dasselbe Ziel zeigt den tatsächlich gespeicherten Stand 3/3. |
| 17–20 s | Harzer / Wander Buddy | Passende High-five-Illustration, „Geschafft!“ und „Zusammen losziehen.“; Buddy neben Gerät. |

Ruhige kurze Einblendungen, kein dauerndes Pumpen, keine Klick- oder Stempelserie. Namensschilder mindestens 28 px, Sprechblasen mindestens 32 px in der 1080er-Komposition. Das Cover stammt aus 18,5 s: App-Name genau einmal, wenig Details, keine zusätzliche Kopfzeile oder Footer.

## Tatsächliche Gruppenfunktion

Vor einer neuen Aufnahme erneut den aktuellen Code und die echte Web-App prüfen. Diese Erkenntnisse gelten für den aufgenommenen `develop`-Commit `b8a663c3a94e59737805f533b924b8a5473b668b`:

- Eine Wandergruppe ist eine Auswahl akzeptierter Freunde in der Sitzung, keine dauerhaft benannte Gruppe. Nicht mit einer erfundenen Gruppenverwaltung werben.
- Die eigene Person zählt zum Gruppenfortschritt. Lena und Tom plus eigene Person ergeben drei.
- Für andere stempeln setzt eine eingehende akzeptierte Freundschaft mit entsprechender Erlaubnis voraus. Der Gruppendialog zeigt die tatsächlichen verfügbaren Personen.
- Der sichtbare Holzstempel gehört zum persönlichen Stempelknopf. Der Gruppendialog besitzt diese Animation nicht. Deshalb zuerst den echten eigenen Besuch aufnehmen, anschließend für Freunde stempeln und die eigene Person im Gruppendialog abwählen. Keine Montage, die eine erfundene Gruppenanimation suggeriert.
- Vorher, Aktion und Ergebnis müssen dieselbe Stempelstelle zeigen. Erfolg anhand neu geöffneter Ansicht und gespeicherter lokaler Besuche prüfen; ein Toast allein reicht nicht.
- Bestehende erfolgreiche Aufnahmen wiederverwenden, falls Quellstand und Geschichte passen. Keine Doppelbesuche erzeugen, um einen weiteren Schnitt zu erhalten.

Code-Einstiegspunkte: `app/lib/hiking-group.tsx`, `app/components/group-selector.tsx`, `app/components/group-stamp-dialog.tsx`, `app/app/stamps/[id].tsx`, `app/lib/group-marker.ts`, `app/app/(tabs)/map.tsx` und `backend/hwb/srv/hwb-service.js` (`stampForGroup`). Pfade am aktuellen Quellstand überprüfen.

## Statusbelege: Tom fehlt und alle / einige / niemand

Zusätzlich zum Reel echte Screenshots der Liste, Karte und eines Details aufnehmen:

| Lokales Beispiel | Vor der gezeigten Aktion | Aussage |
|---|---|---|
| 1 · Eckertalsperre – Staumauer | 3/3, grün | Alle haben den Stempel. |
| 2 · Scharfenstein – Rangerstation | 2/3, gelb; Tom offen | Einige haben ihn, Tom fehlt. |
| 3 · Am Kruzifix | 0/3, rot | Niemand aus der gewählten Gruppe hat ihn. |

Danach zeigt Ziel 3 tatsächlich 3/3. Der frühere 0/3-Screenshot ist ein **Vorher-Beleg**, kein aktueller Live-Zustand. Die Beispieldaten sind keine globale Voraussetzung. Falls sie fehlen, eine passende getrennte lokale Demo vorbereiten; vorhandene Besuche niemals löschen, um diese Tabelle nachzustellen. Keine echten Einladungen oder Produktionsschreibzugriffe.

Empfohlene lokale Belege: `gruppenstatus-liste.png`, `gruppenstatus-karte-uebersicht.png`, `gruppenstatus-karte-tom-fehlt.png`, `tom-fehlt-detail.png` sowie bereinigte Vorher-/Nachher-Prüfnotizen. Karte so zoomen, dass alle drei Statusfarben sichtbar auseinanderliegen. Farbe zusammen mit zugänglichem Markerlabel und tatsächlichem Fortschritt prüfen. „Alle haben“ (3/3), „einige haben“ (2/3) und „niemand hat“ (0/3) ausdrücklich unterscheiden.

## Wiederverwendbare Komposition erzeugen

Die Vorlage `templates-groups/` enthält HTML/GSAP, feste Zeitmarken und beide generierten Figurenbilder. Sie ist unabhängig von alten lokalen Ausgabeordnern. Benötigte frische, bereinigte Dateien im Aufnahmeordner:

| Datei | Inhalt |
|---|---|
| `group-choose.png` | Gruppenauswahl vor Auswahl |
| `group-chosen.png` | Lena und Tom ausgewählt |
| `chosen-goal-map.png` | Gemeinsames offenes Ziel mit 0/3 auf echter Karte |
| `stamp-moment.png` | Echter persönlicher Holzstempel sichtbar |
| `group-confirm.png` | Tatsächlicher Gruppendialog, Freunde gewählt, eigene Wiederholung aus |
| `together-saved.png` | Dieselbe Stempelstelle nach gespeichertem Gruppenbesuch mit 3/3 |
| `buddy.png` | Original `app/assets/images/onboarding-bear.png` |
| `music.mp3`, `click.ogg`, `gsap.min.js` | Freigegebene lokale Medien und GSAP 3.14.2 |

```bash
python3 .agents/skills/hwb-video/scripts/create_composition.py \
  --variant groups --assets-dir <aufnahmeordner> \
  --output <neuer-ausgabeordner>/composition
cd <neuer-ausgabeordner>/composition
npm run check
npm run dev
npx --yes hyperframes@0.8.188 snapshot \
  --at 1.5,4.2,5.5,8,10.2,12.5,15.5,18.5 --output ../snapshots
npm run render
```

Der Generator kopiert nur die erlaubten Medien. Fehlende Dateien und existierende Ausgaben werden vor dem Kopieren abgewiesen. Figurenherkunft: [Illustrationen](../templates-groups/assets/README.md). Neue Charakterbilder bei Bedarf mit diesen Bildern als Referenz generieren; Gesichter, Kleidung und Farbwelt erhalten. Keinen Screenshot in eine generierte App-Oberfläche umwandeln.

## Aufnahme-Learnings

- Nach Login innerhalb der SPA navigieren: Reload oder `page.goto` verliert den lokalen Basic-Login im Speicher.
- Freundauswahl kann den Dialog nach dem Query-Reload schließen. Nach jeder Auswahl auf die Aktualisierung warten, Auswahl erneut öffnen und Endzustand visuell prüfen.
- React-Native-Web-Checkboxen nicht allein anhand von `aria-checked` beurteilen. Sichtbaren Zustand, Label und gespeichertes Ergebnis zusammen prüfen.
- Auf Leaflet echte Ziehgesten und Zoomknöpfe verwenden. Marker nach jedem Schritt neu zentrieren; geladene Kartenkacheln abwarten. Ein Text mit `pointer-events: none` lässt sich gegebenenfalls über seine gemessene Position am realen Sheet anklicken.
- Bei langsamen WebGL-Karten längere Screenshot-Timeouts nutzen. Keine leeren Karten oder nachgebauten Marker als Ersatz liefern.
- Statischer Web-Export vermeidet Entwicklungs-Overlays. Fehlende lokale Pakete ohne Lockfile-Änderung installieren; vorhandene Caches erhalten.

## Abnahme und Caption

Jede Szene visuell prüfen, anschließend auch das **dekodierte MP4**: Figuren bei 1,5 s, Holzstempel bei 10,2 s, gespeichertes Ergebnis bei 15,5 s, Cover bei 18,5 s und eingebranntes Frame 0. `ffprobe`: 1080×1920, 30 fps, 600 Frames, exakt 20 s und Audiospur. Hyperframes-Fehler beheben, Textkontrast und Warnungen prüfen. Tonpegel messen; nur nach tatsächlichem Anhören behaupten, dass der Ton angehört wurde.

Caption-Vorlage:

> Lena ist dabei. Tom fragt: Wohin? 🥾🌲 Mit Harzer Wander Buddy findet ihr ein gemeinsames Ziel – und haltet euren Erfolg fest.
>
> #HarzerWanderBuddy #Harz #Wandern #HarzerWandernadel

Bei denselben Medien zusätzlich: „Musik: Sascha Ende, ende.app (CC BY 4.0)“, „Karte: OpenFreeMap / © OpenMapTiles / © OpenStreetMap-Mitwirkende“, „Foto ‚Am Kruzifix‘: Thomas Binder (CC BY-SA 4.0)“. Quellen bei Medienwechsel aktualisieren. Die Referenzfassung nutzte Happy Beats / Business Moves Vol. 10, Musiklautstärke 0,16, Fade-in 0,6 s / Fade-out 1,5 s und einen leisen CC0-Klick bei 14 s.

Im neuen Ausgabeordner Plan, Brief, tatsächlichen App-Commit, Medienquellen und Prüfbericht festhalten. Keine alten Freigaben als Prüfung einer neuen Aufnahme ausgeben. MP4, Cover und Caption lokal liefern; keine Zugangsdaten, Basic-Tokens, Browserprofile, angemeldeten Sitzungsdateien oder SQLite-Dateien versionieren.

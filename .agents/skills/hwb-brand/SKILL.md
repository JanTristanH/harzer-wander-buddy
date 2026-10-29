---
name: hwb-brand
description: Bewahre Marke, Tonalität, Charaktere, Avatare, Stimmen und Produktwahrheit von Harzer Wander Buddy in Reels, Storyboards, Captions, Covern und anderen Markenmaterialien. Für Videoproduktion zusammen mit hwb-video verwenden.
---

# Harzer Wander Buddy: Marke und Charaktere

Diese Regeln sichern Wiedererkennbarkeit über verschiedene Geschichten. Für Aufnahme, verpflichtendes **develop pullen**, Motion und Qualitätsprüfung zusätzlich [hwb-video](../hwb-video/SKILL.md) lesen. Neuere ausdrückliche Nutzerentscheidungen gehen vor; sie anschließend konsistent hier einarbeiten, statt widersprüchliche Versionsregeln anzuhängen.

## Identität und Gefühl

- Name: **Harzer Wander Buddy**, unverändert geschrieben. Leitgedanke: **Zusammen losziehen.** Im Reel keine redundanten großen Markenüberschriften.
- Zielgruppe: deutschsprachige Wanderer auf Instagram, Harz-Interessierte und Menschen, die einen Ausflug planen.
- Gewünschtes Gefühl: Wanderlust, beeindruckende Landschaft, Vorfreude und Verbundenheit. Der Impuls entspricht „geh raus und mach einen Ausflug“ oder „wann gehst du wieder los?“, ohne diese Worte ständig zu wiederholen.
- Das gemeinsame Erlebnis ist wichtiger als die Jagd nach ausschließlich neuen Stempeln. Jemand kann einen Ort schon kennen und trotzdem gern mitkommen.
- Natürlich, freundlich, warm und konkret schreiben. Alltagssprache der Figuren statt Werbesprech, Feature-Liste oder erklärendem Karten-Vortrag. Kleine Spannungsbögen und reale Anlässe verwenden.
- Neue Geschichten können Region, Abzeichen oder Freundestouren behandeln. Markenidentität und Casting bleiben gleich; konkrete Handlungen und Daten wechseln.

## Verbindliches Casting

| Figur | Originalavatar | Datei ab Repositorywurzel | Stimme | Chatseite |
|---|---|---|---|---|
| Lena | Fuchs | `app/assets/images/avatars/fox.png` | Pocket TTS **Anna** (`anna`, deutsches `german_24l`) | links |
| Tom | Luchs | `app/assets/images/avatars/lynx.png` | Pocket TTS **Giovanni** (`giovanni`, deutsches `german_24l`) | rechts |
| Ben | Bär | `app/assets/images/avatars/bear.png` | Pocket TTS **Jean** (`jean`, deutsches `german_24l`) | links |

- Figuren bleiben Lena, Tom und **Ben**. Ben nicht unbemerkt in „Du“ umbenennen. Jean ist bestätigt; weder Dean noch Daan verwenden.
- Originaldateien und identische Namens-/Avatar-/Stimmenzuordnung in Chat, echter Demo-App und Hörproben verwenden. Tiere nicht neu erfinden, vertauschen oder durch generierte Menschen ersetzen.
- Quelle der512×512-Default-Avatare: [Avatar-README](../../../app/assets/images/avatars/README.md). Runde Darstellung ohne Verzerrung oder seitlichen Anschnitt; Charakter auch klein erkennbar.
- **Kein Erzähler** im Standardreel. Jürgen (`juergen`) war die frühere Pocket-TTS-Erzählstimme und bleibt bei Bedarf als Hörprobe verfügbar; nicht automatisch wieder einführen. Keine separaten Sprecherblasen/HUDs.
- Hörproben behalten denselben Vergleichssatz: „Den einen Stempel habe ich schon. Ich komme trotzdem mit. Wann geht’s los?“ Lautheit angleichen; Zuordnung auf der Begleitseite speichern und als JSON exportieren. Dies ändert die Vertonung eines bereits gerenderten Films nicht.
- Frühere Lena-Stimme Azelma und die V3-Stimmen Seraphina/Conrad/Killian/Florian sind historische Vergleiche, keine Defaults für neue Produktionen.
- Keine unbestätigten Biografien, Beziehungen oder starren Persönlichkeitsrollen erfinden. Insbesondere hat Lena nicht in jeder neuen Story automatisch alle Stempel. Besuchsstände sind Story-Daten, keine Charaktereigenschaft.
- Wenn eine eigene Figurenillustration ausdrücklich angefordert ist, vorhandene Referenzen benutzen. Die älteren Menschenillustrationen sind kein Ersatz für die aktuellen Profilbilder der Chatreihe.

## Buddy, Bilder und Farben

- Buddy ist das originale App-Maskottchen, z.B. `app/assets/images/onboarding-bear.png`; Logo/App-Icon z.B. `app/assets/images/icon.png`. Am aktuellen Quellstand prüfen, welche Datei verwendet wird. Kein ähnliches Fantasie-Logo zeichnen.
- Ben ist eine fiktive Figur mit Bärenavatar; Buddy ist das Markenmaskottchen. Beides nicht als austauschbare Sprecher behandeln.
- Reale, passend lizenzierte Harz-Landschaften bevorzugen. Vorhandene Landschaft samt ruhiger Kamerafahrt ist Stilreferenz; keine starren Illustrationsposter als Standard.
- Einen konkreten Ort nur mit zutreffendem Foto benennen. Das Aussichtsfoto aus der Gruppenstory zeigt die **Taubenklippe**; Am Kruzifix ist dort ein Raststopp. Ein allgemeiner Wald oder Bodetal-Bild ist kein Beleg für Taubenklippe.
- Editorielle Palette der freigegebenen Reihe: Dunkelgrün `#183d2b`, Markengrün `#2e6b4b`, hellgrüne Tom-Nachrichten `#dfe9cc`, weiße linke Nachrichten. Landschaftshintergrund sanft abdunkeln; warme Naturfarben erhalten.
- Creme `#f4efe4` / `#f4f1e9` ist die etablierte ruhige Fläche für Begleitseite oder separates Cover, kein Anlass für einen Szenenwechsel im durchgehenden Chat.
- Chat und Kopfzeile: klare Sans-Serif wie in V6 (Arial/System-Sans), hohe Lesbarkeit und konsistente Größen/Gewichte. Für separate große Displaytypografie ist Georgia wie in den frühen Landschaftstiteln möglich. Maximal eine UI- und eine Displayfamilie; keine beliebige neue Schriftwelt pro Story.
- Echte App-UI behält ihre aktuellen eigenen Farben und Fonts. Editorielle Videofarben nicht pauschal in die App-Screens übertragen. Theme-Tokens und Assets nach dem develop-Pull prüfen; auch der reale Screen hat Vorrang vor veralteten generischen Theme-Defaults.

## Produktwahrheit und Gruppenstatus

| Kartenfarbe in der Gruppenansicht | Bedeutung | Dreierbeispiel |
|---|---|---|
| Grün | Alle ausgewählten Gruppenmitglieder haben den Stempel besucht |3/3 |
| Gelb | Einige, aber nicht alle, haben ihn besucht |1/3 oder2/3 |
| Rot | Noch niemand in der ausgewählten Gruppe hat ihn besucht |0/3 |

- Gruppenstatus nicht mit persönlichem „besucht/unbesucht“ verwechseln. Gegen echte Karte, Gruppen-Auswahl und gespeicherte Demo-Daten prüfen. Gelb heißt **nicht** „keiner“.
- Aktuelle Logik unter `app/lib/group-marker.ts`, `app/app/(tabs)/map.tsx` und `app/lib/hiking-group.tsx` prüfen. Eine Gruppe enthält in der bisherigen Umsetzung die eigene Person plus ausgewählte akzeptierte Freunde; keine dauerhaft benannte Gruppenverwaltung erfinden.
- Bilder zeigen die echte aktuelle Web-App. Fiktive Lena-/Tom-/Ben-Daten nur lokal und getrennt von Produktion anlegen; als Demo dokumentieren. Keine echten privaten Profile oder Kennzahlen erfinden.
- Die inszenierte Chat-Rahmenhandlung ist keine behauptete App-Chatfunktion. Ebenso keine automatische Gruppen-Routenoptimierung, Fantasie-UI oder nicht belegte Funktionen verkaufen.
- Bei Touren immer Nummer **und** Ortsname sichtbar machen; Kartenbuchstaben brauchen eine Zuordnung. Wege, Entfernung, Gehzeit und Lage plausibilisieren. Maßgeblich ist die aktuelle reale App nach dem develop-Pull.
- Wenn eine Story den Stempelvorgang zeigt: echte Aktion, derselbe Ort vor/nachher und gespeichertem Ergebnis. Kein Erfolg nur aus einem Toast ableiten. Kein obligatorischer Stempelvorgang für jede andere Story.

## Rechte und Veröffentlichung

- Medienquelle, Autor, Lizenz, Zuschnitt und erforderliche Attribution im Assetmanifest dokumentieren. Mitgelieferte oder recherchierte Landschaften nur mit passenden Rechten verwenden; keine fremden Instagram-Clips/-Musik übernehmen.
- Stimmen sind synthetisch. Anna: Quellstimme VCTK p228, CC BY4.0. **Jean: EARS p010, CC BY-NC4.0**; die bisherige Fassung ist eine private Vorschau. Für kommerzielle Instagram-Verwendung Freigabe oder Ersatzstimme klären. Giovanni/Jürgen und das tatsächlich eingesetzte Modell gemäß aktuellem [Pocket-TTS-Stimmenkatalog](https://huggingface.co/kyutai/tts-voices) und zugehöriger Modelllizenz prüfen; keinen Presetnamen als pauschale Rechtefreigabe verstehen.
- [Pocket TTS](https://kyutai.org/blog/2026-01-13-pocket-tts/) ist das bestätigte Projekt für neue Stimmen; deutsches Modell benutzen. Edge-TTS nicht unter Pocket-TTS-Label anbieten.
- Originalmusik oder lizenzierte Tracks, [Earshot](https://github.com/Leonxlnx/earshot)-SFX mit dessen Lizenz-/Attributionsangaben. Schlüssel nur über lokale Umgebungsvariablen/`.env`, nie in Prompt, Skill, ZIP oder PR.
- Bestehende private Site-Zugriffsrechte erhalten. Bereitstellung dort ist keine Freigabe zum kommerziellen Instagram-Post. Keine unaufgeforderte öffentliche oder soziale Veröffentlichung.

## Ein neuer Auftrag reicht als Einstieg

Beispiel: „Erstelle ein Reel, in dem Lena, Tom und Ben eine Tour für ein gemeinsames Abzeichen planen. Gleicher Stil wie die korrigierte V6.“

Dann beide Skills laden, develop aktualisieren, tatsächliche Funktion/Demo-Daten prüfen und ein neues Board entwickeln. Die Namen, Stimmen, Avatare und visuellen Regeln übernehmen; Ziel, Orte, Fortschritte, Dialoge und Caption passend neu schreiben. Nur bei fehlender Kerninformation oder einer gewünschten Abweichung nachfragen.

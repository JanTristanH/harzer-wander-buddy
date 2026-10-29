---
name: hwb-video
description: Erstelle oder überarbeite deutsche Instagram-Reels für Harzer Wander Buddy mit dem konsistenten Chat-, Landschafts- und Motion-Stil, echten aktuellen Web-App-Aufnahmen und geprüfter Vertonung. Für neue Geschichten zuerst diesen Skill und hwb-brand lesen.
---

# Harzer Wander Buddy: Video und Stil

Für jedes HWB-Reel zusätzlich [hwb-brand](../hwb-brand/SKILL.md) lesen: Dort stehen Marke, Charaktere, Stimmen, Assets und Produktwahrheit. Dieser Skill beschreibt Erzählweise, Aufnahmen, Animation und Prüfung. Der aktuelle Standard ist die korrigierte V6-Chatfassung. Ältere Vorlagen sind ausdrücklich keine verbindlichen Vorgaben mehr.

## Vor jeder Produktion: develop pullen

1. Repository-`AGENTS.md` sowie die aktuellen Startanleitungen in `app/README.md` und `backend/hwb/README.md` lesen. In der vorbereiteten Cloud-Umgebung bei Shell-Aufrufen `/workspace/android-flow/env.sh` sourcen, falls vorhanden. Andere Umgebungen brauchen diesen Pfad nicht.
2. **Vor neuen Screenshots und vor Wiederverwendung alter App-Aufnahmen den aktuellen `develop`-Stand holen.** In einem sauberen, dafür vorgesehenen develop-Checkout `git pull --ff-only origin develop` ausführen. Nicht standardmäßig `main`, einen alten Work-Branch oder einen fest hinterlegten Commit aufnehmen.
3. Lokale Änderungen, Demo-Besuche und Caches erhalten. Ist der vorhandene Checkout belegt oder verändert, einen isolierten Checkout verwenden, statt zu resetten oder Änderungen automatisch zu stashen:

   ```bash
   git fetch origin develop
   git worktree add --detach <neuer-aufnahme-checkout> origin/develop
   git -C <neuer-aufnahme-checkout> pull --ff-only origin develop
   git -C <neuer-aufnahme-checkout> rev-parse HEAD
   ```

4. Tatsächlichen App-Commit, Datum, verwendete Ansichten und Demo-Daten im Produktionsordner dokumentieren. Auch Renderer/Export neu aus diesem Quellstand bauen. Alte Screens nur wiederverwenden, wenn sie die betreffende aktuelle UI unverändert zeigen. Eine explizite andere Branch-Anweisung des Nutzers geht vor; Abweichung festhalten.
5. Web statt Android verwenden. Keine Emulatoren, Expo Go oder EAS für diese Aufnahmen starten. [Aufnahmeablauf](references/capture.md) beachten.

## Konstanten und variable Geschichte

- Instagram, Deutsch, **1080×1920 / 9:16**, **15–70 Sekunden**: so kurz wie möglich, so lang wie für die Geschichte nötig. Kein fixes 20-Sekunden-Schema.
- Wanderlust, Landschaft und Vorfreude auf einen gemeinsamen Ausflug tragen die Geschichte. Konkreter Dialog statt Feature-Aufzählung oder gesprochener Farblegende.
- Neue Stories dürfen andere Funktionen zeigen: eine Region vervollständigen, eine Wanderung für ein Abzeichen planen oder eine Tour mit Freunden. Nur tatsächlich vorhandene Funktionen zeigen.
- Die Charaktere und ihre Stimmen bleiben konstant; Ziele, Stempelstände, Orte, Konflikt und Verabredung ändern sich. Nicht jedes Reel muss dieselben drei Stempel oder alle Figuren enthalten.
- Nur fehlende relevante Inputs erfragen: Story/Ziel, gewünschte Funktion, notwendige Demo-Daten, besondere Referenz oder CTA. Bestätigte Defaults nicht erneut abfragen. Bei unklarer Kernidee erst einen konkreten Vorschlag machen.

## Erzählweise: eine Unterhaltung bleibt eine Unterhaltung

- Standard für diese Reihe ist **ein durchgehender, natürlich scrollender Gruppenchat** vor bewegter Harz-Landschaft. Kopfzeile, Hintergrund und Senderseiten bleiben konsistent.
- Tom rechts; Lena und Ben links. Jede Nachricht hat den richtigen Namen und Originalavatar. Zwei Nachrichten von Lena kommen beide von links. Vergangene Nachrichten bleiben Teil desselben Verlaufs und scrollen aus dem Sichtfenster.
- Produkt-Screens, Tourkarte, Statusdetails und Landschaftsfotos sind **gesendete Bildanhänge im Chat**. Insbesondere das Taubenklippe-Foto verlässt den Chat nicht. Kein plötzlicher Wechsel zu einer freistehenden Karte, Vollbildlandschaft oder Schlusskarte.
- Keine separaten Discord-Sprecherblasen, Aktivitätsringe oder Sprecher-HUDs. Kein Erzähler im Standardformat; die Figuren tragen die Geschichte.
- Die Unterhaltung soll einen kleinen Spannungsbogen haben: Einladung/Frage → konkreter Vorschlag → unterschiedliche Wünsche oder Fortschritte → gemeinsamer Grund mitzukommen → konkrete Verabredung. Ein neuer Bild- oder Informationsimpuls etwa alle 2–4 Sekunden; komplexe Karten dürfen länger lesbar stehen.
- Aussicht wird als emotionales Versprechen im Chat gezeigt. Der Landschaftshintergrund behält die ruhige Kamerafahrt der bevorzugten frühen Fassung; keine statischen Illustrationstafeln als Ersatz.
- Der Chat ist eine inszenierte Rahmenhandlung außerhalb der App. Keine vorhandene In-App-Chatfunktion behaupten.

## Storyboard vor Animation

`docs/style_guide.md` und `docs/shotlist.md` schreiben. Jede Zeile enthält Zeitpunkt, Figur, exakten gesprochenen Text, sichtbare Nachricht/Medium, Stempelnummer und Ort, Sprachdauer, Lesezeit und Soundereignis. Zuerst ein aktualisiertes Board zeigen; bei ausdrücklicher Bitte um Board-Freigabe vor Umsetzung auf diese warten. Sonst innerhalb des autorisierten Auftrags fortfahren.

Eine wiederverwendbare V6-Beispielgeschichte mit variablen Slots steht in [Gruppenstory](references/groups-story.md). Die dortigen Samstagsdialoge und Stempel sind Beispiele, keine Pflichttexte für neue Reels.

## Referenzen und Gestaltung

- Stilreferenzen: [Reel 1](https://www.instagram.com/reel/DeZRVmkvhiR/) und [Reel 2](https://www.instagram.com/reel/De1g_WXsVJC/). Wenn verfügbar herunterladen, Frames und Timing analysieren; sonst den Zugriffsmangel benennen. Nur visuelle Grammatik übernehmen, keine fremden Filmframes oder Tonspuren kopieren.
- Echte Landschaft, klare große Nachrichten, sanfte Kamerafahrt und gewichtete, zurückhaltende Bewegung. Kein Gradiententitel als Hook, wahllose Fades, UI-Glow, Partikelbursts, permanente Ecklabels, Rahmen oder starkes Bouncing.
- Oberste **220 px** im 1080×1920-Frame frei von wichtigem Text. Untere und rechte Instagram-Bedienelemente ebenfalls berücksichtigen. Safe Areas zusätzlich am Telefon beurteilen.
- Falls zusätzliche Captions außerhalb eines Chattextes nötig sind: fette weiße Schrift mit weichem dunklem Schatten, **ohne Hintergrundbox**. Kein Screenshotinhalt verdecken. Gesprochener Chattext erhält keine doppelte Caption.
- Medien **niemals strecken**: ein gemeinsamer Skalierungsfaktor, gegebenenfalls proportionaler Cover-Ausschnitt. Wesentliche UI und Marker nicht wegschneiden; sonst die Fläche anpassen oder `contain` verwenden. Kartenpins, Ziffern, Avatare und Fotos müssen ihre Originalproportionen behalten.
- Avatare gegen die tatsächliche Chat-Clip-Fläche prüfen, nicht nur gegen die Canvasbreite. Historischer V6-Fehler: Avatar endete bei996, Clip bei980. Korrigiert: Tom914–972 innerhalb40–980. Das ist ein geprüftes Beispiel, keine Pflichtgeometrie für neue Layouts.

## Karten brauchen Kontext

- Echte aktuelle Web-App und echte gespeicherte Wege zeigen. Keine Route oder UI aus Fantasie nachzeichnen. Buchstaben allein verlieren den Kontext: Route und späterer Detailanhang zeigen **konkrete Stempelnummern und Namen**.
- Bei A/B/C-Markern eine sichtbare Zuordnung im selben Bildanhang ergänzen. Beispiel: B · #4 Taubenklippe, C · #3 Am Kruzifix, D · #6 Bremer Hütte; A/E bezeichnet Start/Ziel. Nicht den Screenshot als vermeintliche App-Funktion übermalen.
- Für einen solchen Tourvorschlag zunächst **mindestens fünf Sekunden** Lesezeit einplanen. In 360px prüfen und bei Bedarf mehr Zeit geben.
- Ortsnähe, Reihenfolge, Start/Ziel, Entfernungen und Gehzeit anhand realer Koordinaten und vorhandener Fußwegdaten prüfen. Keine Karte mit geraden Verbindungen als Wanderweg ausgeben. Einen geografisch plausiblen Tourvorschlag dokumentieren; keine erfundene Routenoptimierung versprechen.

## Rendervertrag und Ton

- Bevorzugt eine HTML-Seite mit Canvas `#c` und reinem `window.seek(t)`: beliebiger Zeitpunkt ohne vorheriges Abspielen reproduzierbar. Keine CSS-Transitions, Timer oder `requestAnimationFrame` im Renderpfad, kein Framezustand, kein ungesetztes `Math.random`; nur deterministisches Noise.
- Geschlossene Springs mit höchstens kleinem Overshoot, auf Typografie kein sichtbares Nachfedern. Mehrere Ziele über gestapelte Sprungantworten; nicht bei jedem Ziel die Bewegung neu starten.
- **60 fps, vier zeitliche Subframes pro Frame**, gemischt für Motion Blur; Master H.264, yuv420p, CRF16. Ein kleinerer Web-Export behält Framerate und Timeline. Zuerst Stills und günstigen Rohschnitt rendern.
- Casting aus dem Brand-Skill. Sprachclips vor Timing-Festlegung erzeugen, tatsächliche Dauer messen und Wörter prüfen. Natürliche Pausen lassen. Keine Effekte über wichtige Wörter legen.
- Originalmusik synthetisieren oder passend lizenzierte Musik verwenden. Startpunkt, Beatgrid, BPM und Cue-Liste dokumentieren;120 BPM ist ein bewährter Ausgangspunkt, kein Zwang bei anderer Geschichte. Gemessene Downbeats nicht ungeprüft aus jedem vierten erkannten Beat ableiten.
- Mehr unterscheidbares, gezieltes Sounddesign mit [Earshot](https://github.com/Leonxlnx/earshot): Nachrichten, Bildversand, Klicks, Reaktionen und Akzente. Onsets/Peaks mit Handlung und Sprache synchronisieren; Musik unter Dialog ducken.
- Mix etwa **−14 LUFS**, True Peak höchstens **−1 dBTP**, vorzugsweise um−1,5 dBTP. Am fertigen MP4 messen. Earshot-Modus und übersprungene Modelle ausdrücklich protokollieren.

## Prüfen, korrigieren und liefern

1. Mindestens drei echte Prüfrunden: Script/Storyboard, Stills/Rohschnitt bei360px, finaler Film. Pro Runde Befunde, Zeitpunkte und Korrekturen in `docs/review_log.md` festhalten. Bei Fehlern weiterarbeiten.
2. Hook, Spannungsbogen, Telefonlesbarkeit, Motion, Abwechslung, Komposition, Sprecherklarheit, Produkt-/Markentreue, Sprachverständlichkeit und Sound-Sync jeweils1–10 bewerten. Ziel **alle mindestens8/10**; eigene redaktionelle Einschätzung, keine unabhängige Garantie. Keine Scores ohne tatsächliche Verbesserungen hochsetzen.
3. Finalen Web-/Liefer-MP4 vollständig dekodieren, alle Frames auf nummerierten fortlaufenden Bögen öffnen. Zusätzlich große codierte Karten-/Fotostills und schnelle Übergänge prüfen. Miniaturen allein reichen nicht für Proportionen oder feine Anschnitte; Grenzen der Sichtung ehrlich benennen.
4. Für alle Zeitpunkte Text-/Safe-Area-Grenzen, aktive Nachrichten, proportionale Bildskalierung (`scaleX = scaleY`) und horizontale Avatar-Clip-Grenzen prüfen. Auch Seek-Reihenfolge wechseln und identische Frames nachweisen.
5. Sprachclips und fertigen Mix automatisch transkribieren, Auffälligkeiten korrigieren. ASR-Artefakte als solche protokollieren. Audio-/Videoprüfung nicht als menschliches Anhören ausgeben. Bei unverändertem Ton bzw. reinem Remux kann dekodierte Track-Identität per Hash die vorige Prüfung belegen.
6. MP4, Poster/Cover, vollständige Kontaktbögen, Untertitel, Asset-/Lizenzmanifest, App-Commit, Prüfbericht und reproduzierbare saubere Quellen liefern. Bei beabsichtigtem Loop die Naht prüfen; ein Story-Reel darf einen klaren Schluss haben.
7. Caption: kurzer natürlicher Bezug zur Geschichte, gemeinsames Erlebnis, leichte Einladung zum Teilen/Verabreden und wenige passende Hashtags. Cover: wenige große Wörter, auch im Profilraster lesbar. Konkrete Cover-Entscheidung an die Geschichte anpassen.
8. Wenn eine Site angefordert oder als Ziel etabliert ist, den Sites-Skill verwenden, bestehende Seite und Zugriffsrechte erhalten. Alte Fassungen auswählbar lassen, Korrektur unter ihrer Versionsnummer ersetzen, neue Assets mit frischen URLs ausliefern. Wiedergabe, Seeking, Download, Telefonansicht und Einzelbildansicht prüfen. Hörproben mit gleichem Satz/vergleichbarer Lautheit, Rollenwahl und JSON-Export erhalten; eine Auswahl vertont ein vorhandenes MP4 nicht automatisch neu.

Keine Video- oder App-Veröffentlichung allein durch Aufruf dieses Skills ableiten. Im bestehenden Veröffentlichungsauftrag die freigegebene Site aktualisieren; andernfalls lokale Lieferdateien bereitstellen. Keine Tokens, Browserprofile, Sitzungsarchive, angemeldeten Emulator-Daten, Datenbanken, SDKs oder Build-Caches committen.

## Vorhandene ältere Vorlagen

`templates/`, `templates-groups/` und `scripts/create_composition.py` bleiben für ausdrücklich gewünschte alte20s-/30fps-Illustrationsfassungen verfügbar. Ihr Hyperframes-Layout, Stempelzwang, Cover-Frame0 und „Du“-Casting gelten **nicht** für die aktuelle Chatreihe. Sie erfordern weder eine obligatorische Brag-Installation noch einen Wechsel des aktuellen Rendervertrags. Bei expliziter Nutzung die dortigen paketgebundenen Checks ausführen und Asset-Anforderungen aus der Referenz beachten.

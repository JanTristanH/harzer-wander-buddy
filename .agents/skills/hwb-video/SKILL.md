---
name: hwb-video
description: Erstelle oder überarbeite ein Harzer-Wander-Buddy-Launchvideo mit dem projektspezifischen Brag-Ablauf, echter angemeldeter Web-App, sichtbarem Stempelmoment und der freigegebenen Hochkant-Vorlage. Verwenden bei HWB-Video, Instagram-Reel, Hochkant-Version oder Änderungen an diesem Produktvideo.
---

# Harzer Wander Buddy — Produktvideo

Dieser Skill ergänzt den allgemeinen **brag**-Skill um die freigegebenen HWB-Anpassungen. Er erstellt lokale Videos; er veröffentlicht weder Videos noch App-Änderungen.

## Vor dem Aufnehmen

1. Repository-`AGENTS.md` und `app/README.md` / `backend/hwb/README.md` lesen. Vorhandene Änderungen und Caches erhalten. In der vorbereiteten Cloud-Umgebung bei Shell-Aufrufen `/workspace/android-flow/env.sh` sourcen, falls vorhanden; außerhalb dieser Umgebung sind keine `/workspace`-Pfade vorausgesetzt.
2. Den gewünschten **App-Quellstand** prüfen. Standard für Aufnahmen ist der aktuelle Remote-`main`, nicht ein alter `work`- oder `develop`-Checkout. Eine ausdrückliche Nutzeranweisung wie „vorher develop pullen“ hat Vorrang. Den gewünschten Remote-Branch fetchen, tatsächlichen `HEAD` damit vergleichen und den verwendeten Commit im Ausgabeordner dokumentieren. Nicht mit „aktueller main“ werben, wenn ein anderer Stand aufgenommen wird. Bestehende lokale Änderungen niemals dafür verwerfen.
3. Fehlt der allgemeine Brag-Skill: im Repository `npx skills add https://github.com/latent-spaces/brag --skill brag --yes`. Seine Anleitung und die zur installierten Hyperframes-Version gehörenden Format-/Motion-/CLI-Regeln lesen. Die Vorlage hier ersetzt nicht den Brag-Plan und die Sichtprüfung.
4. Node.js ≥22, FFmpeg und einen funktionierenden Chromium-Browser prüfen. Hyperframes ist in der Vorlage auf `0.8.188` fixiert. `HYPERFRAMES_BROWSER_PATH` kann auf einen vorhandenen kompatiblen Browser zeigen. Keine Pfade aus einem früheren npm-Cache erraten oder als Voraussetzung speichern.

## Echte App-Aufnahmen

Siehe [Aufnahmeablauf](references/capture.md). Die Web-App im Handy-Viewport **390×844, DPR 2** aufnehmen. Den unterstützten lokalen `dev-basic`-Login und ausschließlich das Testkonto aus der Repository-`AGENTS.md` verwenden. Zugangsdaten nicht in Skripte, Skill, Plan, Bild oder Logs kopieren.

- Angemeldet aufnehmen; kein als Gast getarntes UI und keine nachgebauten Screenshots.
- Vorhandene Demo-Besuche wiederverwenden. Für eine gewünschte Demo fehlen gegebenenfalls Besuche der Stempel **1–5**: nur diese über die echte Schaltfläche im lokalen Test-Backend erfassen, keine unnötigen Doppelbesuche und keine Produktionsschreibzugriffe.
- Liste muss den gespeicherten Fortschritt zeigen; Karte muss grüne besuchte und offene Marker gemeinsam zeigen. Nah genug zoomen, damit nicht alle Marker übereinanderliegen. Aktuelle Kartenmarker und Listenabstände aus dem tatsächlichen Quellstand beibehalten.
- **Holzstempel aufnehmen:** Auf dem echten Stempelknopf etwa eine Sekunde gedrückt halten; dann ist der Actor gut sichtbar. Für eine zusätzliche reine Animationsaufnahme den Zeiger vor dem Loslassen aus dem Knopf bewegen, damit kein weiterer Besuch abgeschickt wird. Den sichtbaren Stempel im Film etwa 1,5 Sekunden halten, danach Erfolg zeigen. Eine reine Erfolgs-Toast-Aufnahme reicht nicht.
- Eingabefokus vor der endgültigen Listenaufnahme entfernen. Keine Fehlerüberlagerungen, Zugangsdaten, privaten Profildaten oder Browser-Sitzungsdateien ausliefern.

## Freigegebenes Hochkant-Layout

Die konkrete Vorlage liegt unter `templates/`. Den Inhalt für ein neues Video aktualisieren, die bewussten Layoutentscheidungen erhalten:

- **1080×1920, 30 fps, 20 Sekunden** als Standard für Instagram. Eine Querformatfassung bleibt erhalten.
- Das Handy nutzt die Höhe: **620×1360 bei x=200, y=400**, statt einen großen leeren Bereich unten als „Footer“ zu reservieren. Der Nutzer hat diese große Darstellung ausdrücklich der früheren reservierten unteren Fläche vorgezogen.
- Durchgehend `#f4efe4` als Hintergrund; Text `#183d2b`, Akzent `#2e6b4b`, Inter. Kein andersfarbiger unterer Balken, kein zusätzlicher Footer, kein grauer Home-Indikator am Videorahmen. Die echte Navigation innerhalb der App bleibt Bestandteil der UI, sofern nicht ausdrücklich anders gewünscht.
- Das Buddy-Icon steht **in allen Szenen neben** dem Gerät bei **x=850, y=1540, 170×170**. Nicht wieder darunter in einen Footer setzen.
- Auf Cover/Schlussbild den Namen **nur einmal** als große Überschrift anzeigen. Keine zusätzliche kleine Zeile „HARZER WANDER BUDDY“ darüber.
- App-Screenshots nicht verzerren. Der sichtbare Stempelmoment und die besuchten Kartenmarker müssen auch im Hochkant-Export erhalten bleiben.

Storyboard: Hook `0–3.02`, Entdecken `3.02–7.02`, Besuche `7.02–12.02` mit Holzstempel `8.02–9.52`, Karte `12.02–17.02`, Outro `17.02–20`. Musik und dezente Klicks; keine Stimme, sofern nicht angefordert.

Für Gruppen gilt die ebenfalls freigegebene [20-Sekunden-Charaktergeschichte](references/groups-story.md): Problem → Gruppenauswahl → gemeinsames Ziel → echte Aktion → gespeicherter Erfolg. Diese Variante hat andere Zeitmarken, insbesondere Holzstempel `9.5–11`. Sie enthält wiederverwendbare Figurenillustrationen und eine eigene Kompositionsvorlage; keine funktionalen App-Ansichten generieren.

## Vorlage verwenden

Die in [Aufnahmeablauf](references/capture.md) genannten elf Mediendateien in einem neuen Aufnahmeordner bereitstellen. Musik, SFX und GSAP lokal aus einer freigegebenen Quelle beziehen; nicht als fremde Binärsammlung ins Repository aufnehmen.

```bash
python3 .agents/skills/hwb-video/scripts/create_composition.py \
  --assets-dir <aufnahmeordner> \
  --output <neuer-ausgabeordner>/composition
cd <neuer-ausgabeordner>/composition
npm run check
npm run dev
```

Der Generator kopiert ausschließlich die genannten Mediendateien. Er überschreibt keinen vorhandenen Ausgabeordner und übernimmt keine Profile, Datenbanken oder Sitzungsarchive. Für eine andere Geschichte Texte, Bilder und Timing gezielt in der neuen Komposition ändern.

Die Gruppenfassung wird mit `--variant groups` erzeugt. Aufnahme-Dateinamen, Figuren, Caption, Cover und Prüfpunkte stehen in [Gruppenstory und Learnings](references/groups-story.md). Renderdateien und angemeldete Aufnahmen bleiben lokal; die neue Vorlage benötigt keinen alten Ausgabeordner.

## Prüfen und liefern

1. `brag-plan.md` und `composition-brief.md` im neuen Ausgabeordner schreiben; verwendeten App-Commit festhalten.
2. `npm run check` muss fehlerfrei sein. Warnungen prüfen und beheben, wenn sie die Lesbarkeit betreffen.
3. `npx hyperframes@0.8.188 snapshot --at 1.5,8.7,14.7,18.5`: Bilder tatsächlich ansehen; für die Gruppenfassung die Zeitmarken aus ihrer Referenz verwenden. Prüfen: richtige UI/Abstände, tatsächlicher Fortschritt, grüne/offene Marker, Holzstempel, kein unnötiger Footer, Name auf dem Cover nur einmal, Buddy neben dem Gerät.
4. Lokale Vorschau erreichbar halten. Wenn der Nutzer eine Datei angefordert hat, direkt nach bestandener Prüfung rendern: `npm run render`.
5. `ffprobe` muss 1080×1920, 600 Frames / 30 fps, 20 Sekunden und eine Audiospur bestätigen. Dekodiertes Stempelbild bei ca. 8.7 Sekunden ansehen.
6. Das gesetzte Schlussbild bei ca. **18.5 Sekunden** als Cover wählen: Titel einmal, Gerät und Buddy nebeneinander. Poster mit FFmpeg als Frame 0 einbacken, Audio durchkopieren; Details im allgemeinen Brag-Skill. Aktuellen Dateinamen verwenden, damit alte Cover nicht versehentlich erneut ausgeliefert werden.
7. MP4, Cover und kurzen Share-Text lokal bereitstellen. Alte Fassungen erhalten. `REVIEW.md` mit geprüften Punkten und Grenzen schreiben; gemessenen Ton nicht als angehört beschreiben.

## Was gespeichert wird

Versioniert werden dieser Skill, Textvorlagen, Generator und die eigens generierten Figurenillustrationen mit Herkunftshinweis. Laufzeitdaten bleiben im ignorierten `brag-output*/`: angemeldete Aufnahmen, Videos, generierte Kompositionen und Prüfberichte. Browser-Tokens/-Profile, Zugangsdaten, angemeldete Emulator-Daten, SQLite-Datenbanken, SDKs, Build-Caches und heruntergeladene Musik nicht committen. Die generische Brag-Installation bleibt lokal installierbar; `skills-lock.json` dokumentiert ihre Herkunft.

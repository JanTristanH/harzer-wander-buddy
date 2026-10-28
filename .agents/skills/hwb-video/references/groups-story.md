# Beispielgeschichte: eine Runde mit drei Freunden

Aktuelle Referenz ist die **korrigierte V6**: durchgehender Chat, echte aktuelle Tourwege, klare Nummern/Namen, Anna/Giovanni/Jean und unverzerrte Medien. [Video-Skill](../SKILL.md) und [Brand-Skill](../../hwb-brand/SKILL.md) sind die verbindlichen Regeln. Dieses Beispiel zeigt ein Erzählmuster und darf für neue Geschichten geändert werden.

## Storybogen statt fester Funktionsliste

| Schritt | Beispiel | Sichtbares Medium / Zweck |
|---|---|---|
| Einladung | Tom: „Habt ihr Samstag Zeit für eine Runde Wandern?“ | Tom rechts, echte Luchs-Profilgrafik; Landschaft bleibt Hintergrund |
| Interesse | Ben: „Kommt drauf an. Wohin?“ | Antwort links; Verlauf bleibt erhalten |
| Vorschlag | Tom: „Wie wär’s mit der Runde hier?“ | Neu aufgenommene echte App-Tour als Bild rechts; mindestens fünf Sekunden lesbar |
| Kleiner Konflikt | Lena: „Den Stempel hab ich schon.“ / Ben: „Ich noch nicht.“ | Gelbe Gruppenansicht #4 Taubenklippe,1/3; Nummer und Name explizit |
| Gemeinsamer Grund | Lena: „Ich komme trotzdem mit.“ | Zweite Lena-Nachricht ebenfalls links |
| Emotionales Versprechen | Tom: „Mit Aussicht, bitte.“ / Lena: „Versprochen.“ | Echtes Taubenklippe-Foto als Lenas Bildanhang, nicht als neue Szene |
| Nächste Stopps | Lena: „Und hier machen wir Pause.“ / Tom: „Und die Hütte nehmen wir auch mit.“ | Grüne #3 Am Kruzifix3/3 und rote #6 Bremer Hütte0/3 als Chatbilder |
| Vorfreude | Ben: „Die wollte ich eh mal sehen.“ | Kleine persönliche Motivation statt Kartenerklärung |
| Konkrete Verabredung | Tom: „Samstag um 9 Uhr bei mir los?“ | Danach nur zwei visuelle Daumen-Reaktionen; Chat bleibt sichtbar |

Die Referenz dauert30,5s. Zeiten aus tatsächlichen Sprachlängen ableiten, nicht starr kopieren. Für neue Storys Einladung, Konflikt, Orte und Abschluss ändern. Eine Abzeichen-Story muss weder diese Stempel noch Samstag um9Uhr wiederholen.

## Geografische Referenz, keine feste Tour für alle Videos

Ilsenburg-Parkplatz → **#4 Taubenklippe** → **#3 Am Kruzifix** → **#6 Bremer Hütte (Obere Ilsefälle)** → derselbe Parkplatz. Vier gespeicherte walking-Segmente ergeben in der Demo17.080m und15.607s (rund4:20h), mit identischem Start-/Endpunkt. Bei neuer Produktion erneut anhand aktueller Daten prüfen.

Die echte Touransicht verwendet A/E für Start/Ziel, B für#4, C für#3 und D für#6. Diese Zuordnung steht sichtbar unter der Karte im selben Chat-Bildanhang; nicht nur A/B/C/D zeigen. Nachfolgende Medien behalten Nummer und Namen.

Die Wegdarstellung wurde in `9e4544e` auf gespeicherte OData-Routenverläufe korrigiert (`app/lib/tour-route.ts`, `app/app/tours/[id]/index.tsx`). Das ist ein historischer Referenzcommit: **vor Aufnahmen aktuellen develop pullen**, keinen alten Commit fest als „aktuell“ verwenden. Keine alte geradlinige Tourvorschau wieder einsetzen.

## Produktprüfung

- Originalavatare: Lena Fuchs, Tom Luchs, Ben Bär. Casting siehe Brand-Skill.
- Demo-Stände lokal gespeichert und mit Karte/Gruppe abgeglichen; persönliche Besuchsanzeige und Gruppenfortschritt unterscheiden.
- Die eigene Person zählt bisher zum Gruppenfortschritt. Eine Sitzungsauswahl akzeptierter Freunde nicht als neue dauerhafte Gruppenverwaltung darstellen.
- Für andere stempeln setzt die tatsächlichen Berechtigungen voraus. Nur falls die neue Geschichte diese Aktion braucht: persönlichen Holzstempel tatsächlich aufnehmen, danach den echten Gruppendialog und gespeicherten Erfolg prüfen. Der Gruppendialog besitzt nicht automatisch die persönliche Holzstempelanimation. Doppelbesuche vermeiden.
- Code-Einstiege am aktuellen Stand prüfen: `app/lib/hiking-group.tsx`, `app/components/group-selector.tsx`, `app/components/group-stamp-dialog.tsx`, `app/app/stamps/[id].tsx`, `app/lib/group-marker.ts`, `app/app/(tabs)/map.tsx`, `backend/hwb/srv/hwb-service.js`.

## Bekannte Darstellungsfehler ausdrücklich prüfen

V6 hatte anfangs zwei übersehene Fehler:480×500-Kartenausschnitte wurden auf672×500 gestreckt; Toms Avatar ragte16px über die Chat-Clip-Grenze. Die korrigierte Fassung skaliert Medien einheitlich, beschneidet gegebenenfalls proportional und hält den Avatar vollständig innerhalb der Clip-Fläche. **Miniaturbögen allein fanden diese Fehler nicht.** Zusätzlich große codierte Kartenstills, Telefonbilder und Geometrie über die ganze Timeline prüfen.

## Caption und Cover als variable Begleittexte

Caption-Beispiel für diese Story:

> „Den Stempel hab ich schon.“
> „Ich komme trotzdem mit.“ 🥾
>
> Manche Orte besucht man eben gern zweimal – mit den richtigen Leuten.
> Wer wäre bei deiner nächsten Harzrunde dabei? Schick’s in eure Wandergruppe. 🌲
>
> #Harz #WandernImHarz #HarzerWandernadel #HarzerWanderBuddy

Cover-Idee: **„Drei Freunde. Eine Runde.“**, echte Tourkarte plus drei Avatare. Wenige große Wörter und sicheren Beschnitt fürs Profilraster verwenden; keine kleinteilige Chatnachricht als einzige Coveraussage. Neue Story braucht einen passenden eigenen Aufhänger, keine immer gleiche Caption.

## Erhaltene historische Vorlagen

Die20s-/30fps-Menschenillustrationen unter `templates-groups/` und die klassische Vorlage unter `templates/` bleiben erhalten. Nur bei ausdrücklich gewünschtem altem Stil verwenden; ihre Namen „Du“, Figurenkleidung, starren Zeitmarken, Schlusskarte und Holzstempelpflicht sind kein aktueller Standard.

Der historische Generator benötigt für `--variant groups`: `group-choose.png`, `group-chosen.png`, `chosen-goal-map.png`, `stamp-moment.png`, `group-confirm.png`, `together-saved.png`, `buddy.png`, `music.mp3`, `click.ogg`, `gsap.min.js`. Aufruf mit `--assets-dir <lokale-medien>` und `--output <neuer-ordner>`. Nur explizit gelieferte Medien werden kopiert, bestehende Ausgaben nicht überschrieben. Herkunft der alten Illustrationen: [README](../templates-groups/assets/README.md). Vorlagenspezifische Hyperframes-Checks weiter beachten.

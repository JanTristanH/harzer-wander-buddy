# Unabhängiger Web-Review: spürbare Änderungen

Geprüft am 6. November 2026 durch den Review-Subagenten. Grundlage: Branch `design/ux-ui-review`, Commit `6ab4576` plus die lokalen Hero-/Tourhinweis-Korrekturen und die anschließende Korrektur des Web-Kartenwechsels. Live-App: `http://localhost:4004/app/rnweb/`, synthetischer lokaler Memory-Backend-Datensatz. Echter Test-SSO, keine Produktionsschreibzugriffe. Geprüft wurden die gerenderten Ansichten und echte Klicks; die Implementierung wurde vom Reviewer nicht geändert.

## Ergebnis der angeforderten Korrekturen

- **Hero wieder mit sichtbarem Verlauf:** Waldgrün geht deutlich in warmes Oliv über. Das wirkt näher am ursprünglichen Landschaftscharakter als der vorherige, fast einfarbig wirkende dunkle Grünverlauf. Die helle Beschriftung ist in den geprüften Ansichten gut erkennbar. Gastansicht bei 320×568, 390×844, 768×1024 und 1440×900 geprüft, dazu persönlicher Fortschritt bei 390×844. Kein horizontaler Seitenüberlauf.
- **Tourhinweis verschwindet im passenden Moment:** Beim leeren Editor ist „Stempel auswählen und …“ sichtbar. Nach Auswahl des Brocken auf der Karte ist der Hinweis weg, während „Zur Tour hinzufügen“ weiterhin die konkrete Aktion erklärt. Auch nach dem Hinzufügen und bei der Suche des nächsten Ziels bleibt der Hinweis weg. Die Zählung im Browser ergab jeweils 0 Hinweis-Elemente für aktive Auswahl und vorhandenen Routenpunkt.
- **Nächsten Stempel suchen:** Die Vollbildsuche zeigt den vorhandenen Brocken und das neue Ziel Froschfelsen im nutzbaren Kartenbereich. Die vorherige Detailkarte verdeckt die Karte nicht mehr. Der entfallene Hinweis schafft zusätzliche Fläche unter Suche und Ergebnisliste. Der externe-Orte-Hinweis ist laut Quellcode separat erhalten; dieser Sonderfall wurde nicht live ausgelöst.

Für die angeforderten Korrekturen wurde keine neue Regression nachgewiesen. Der zusätzlich gefundene Fehler beim Schließen und erneuten Öffnen der Webkarte ist nach Korrektur im finalen unabhängigen Lauf nicht mehr aufgetreten; die historische Evidenz bleibt unten erhalten. Die anfängliche Blockade nach dem Onboarding-Namen war ein lokaler Fixture-Konfigurationsfehler (fehlender Bearer-Issuer/Audience), keine nachgewiesene UI-Regression. Nach Korrektur derselben Testumgebung liefen SSO, Namensschritt, Avatar und Abschluss durch.

## Abschließender unabhängiger Browserlauf nach Kartenkorrektur

**Bestanden, keine JavaScript-Seitenfehler.** Der neue Webaufbau behält dieselbe Karte und dasselbe Suchfeld beim Wechsel zwischen eingebetteter Karte und Vollbild. Der Subagent hat den zuvor problematischen Ablauf selbst erneut ausgeführt: Brocken wählen und hinzufügen → Escape → zur Reihenfolge scrollen → eingebettetes Suchfeld anklicken → gesamten Text markieren → `Froschfelsen` mit einzelnen, verzögerten Tastatureingaben eingeben. Suchfeld und Karte blieben dieselben verbundenen DOM-Elemente; das Feld enthielt exakt `Froschfelsen`, und der passende Treffer erschien. Keine Verkettung mit dem alten Namen, kein `_leaflet_pos`- oder `getZoom`-Fehler im abschließenden Lauf.

Zusätzlich unabhängig geprüft:

- „Zur Tour hinzufügen“ ließ sich tatsächlich anklicken und fügte den ersten Punkt hinzu; kein Footer und keine andere Karte fing den Klick ab.
- Der Hinweis war im leeren Editor sichtbar, nach Auswahl und Hinzufügen verborgen und nach Entfernen des letzten Routenpunkts plus Antippen der freien Karte wieder sichtbar.
- 20 Tab- und 20 Shift+Tab-Schritte hielten den Fokus innerhalb der Vollbildkarte. Escape schloss die Karte vor der Folgesuche und nach der Tastaturprüfung erneut.
- Vollbildkarte und Leaflet-Fläche nahmen nach Änderungen auf 320×568, 390×844, 768×1024 und 1440×900 jeweils den gesamten Viewport ein. Kein horizontaler Seitenüberlauf. Gastliste ebenfalls in allen vier Größen erneut geprüft.

Nachweis: [finale unabhängige Browser-Ergebnisse](hero-tour-independent-final-browser-checks.json), [erneute Suche mit einzelnen Tastatureingaben](screenshots/hero-tour-followup/independent-map-fix/reopen-search-individual-typing.png), [Vollbild 320](screenshots/hero-tour-followup/independent-map-fix/fullscreen-320.png), [Vollbild 1440](screenshots/hero-tour-followup/independent-map-fix/fullscreen-1440.png), [Hinweis nach letztem Entfernen](screenshots/hero-tour-followup/independent-map-fix/last-stamp-removed-and-deselected.png). Die Bilder wurden unabhängig visuell betrachtet. Die Viewport-Aufnahmen entstanden nach der Tastaturprüfung; durch den dann veränderten Fokus ist die Ergebnisliste dort geschlossen.

Ein Zwischenlauf vor diesem Abschluss erreichte die Interaktionsprüfungen, scheiterte jedoch an einem verbleibenden `getZoom`-Seitenfehler. Die Hauptinstanz stellte fest, dass die lokale Installation mit `--ignore-scripts` die bereits im Repository vorhandenen MapLibre-Lebenszyklusguards nicht angewandt hatte. Nach `patch-package` und erneutem Webexport wurde der vollständige unabhängige Ablauf wiederholt; erst dieser Lauf wird hier als bestanden gewertet. Die historische Beobachtung wird dadurch nicht nachträglich zu einem erfolgreichen Lauf umgedeutet.

## Historischer Befund: Kartenwechsel und erneute Suche (P2, im geprüften Ablauf behoben)

Der ergänzende fokussierte Browserlauf der Hauptinstanz reproduzierte vor der Kartenkorrektur einen Fehler bei **ersten Punkt hinzufügen → Escape aus Vollbild → zur Reihenfolge scrollen → Suche mit Froschfelsen erneut fokussieren/befüllen**. [damaliges Nachher-Prüfprotokoll](screenshots/hero-tour-followup/reopen-defect-before-fix/checks.json) enthält `Cannot read properties of undefined (reading '_leaflet_pos')`. Der [Vorher-Lauf](screenshots/hero-tour-followup/before/checks.json) meldet ebenfalls einen Seitenfehler, dort nur als `Error` protokolliert. Der Ablauf scheitert somit bereits vor den beiden aktuellen Änderungen; er ist ein **damals offener reproduzierter Defekt, keine nachgewiesene neue Regression durch Hero oder Hinweis**. Dass beide Meldungen exakt dieselbe interne Ursache haben, lässt sich aus dem verkürzten Vorher-Protokoll allein nicht beweisen.

Im [damaligen Nachher-Suchbild](screenshots/hero-tour-followup/reopen-defect-before-fix/tour-search-next.png) und im Vorher-Suchbild steht `Brocken – GipfelblickFroschfelsen` im Feld. Der neue Zielpin fehlt. Diese Bilder sind Belege für den fehlerhaften Wechsel-/Suchzustand, **kein Nachweis einer erfolgreichen Suche nach Froschfelsen**. Die Hinweiszählung bleibt für diesen Zustand aussagekräftig, der fachliche Sucherfolg nicht. Im separaten unabhängigen Lauf, der während Auswahl und Folgesuche im Vollbild blieb, standen dagegen Brocken und Froschfelsen sichtbar auf der Karte und es gab keinen Seitenfehler.

**Historische Einordnung vor der Kartenkorrektur:** P2, inzwischen im geprüften Ablauf behoben. Der Planungswechsel löste einen ungefangenen Kartenfehler im automatisierten Browserablauf aus. Ein vollständiger App-Absturz, Datenverlust oder eine für Menschen generell blockierte Suche ist damit nicht belegt. Im damaligen Quellcode öffnete der Fokus des eingebetteten Suchfelds das Vollbild und ersetzte dabei Karten-/Eingabeelemente. Ein laufendes Playwright-`fill` konnte mit diesem Austausch konkurrieren. Der damalige Lauf allein belegte daher noch keinen allgemeinen Tippfehler bei normalen einzelnen Tastatureingaben; diese Eingabe wurde im abschließenden Lauf zusätzlich geprüft.

**Damals formulierte Quellcode-Hypothese, keine bewiesene Ursache:** `renderTourMap` band Karte und Suchfeld sowohl inline als auch im Modal ein; beide verwendeten denselben `mapRef`. Der Fokus wechselt die Darstellung. Gleichzeitig verwenden Kartenbewegung, Viewport-Anpassung und Leaflet-Animationen die Karteninstanz. Leaflets `getPosition` liest `_leaflet_pos` eines DOM-Elements; die Meldung passt zu einer nicht mehr verfügbaren Kartenfläche bei einem verzögerten Zugriff. Für eine sichere Zuordnung fehlt ein erhaltener Stacktrace. Der Lebenszyklus von Karteninstanz/Animation beim Schließen und erneuten Öffnen war daher der nächste Prüfpunkt. Die anschließende Korrektur und ihr erfolgreicher Regressionstest stehen oben.

## Direkter Vorher-/Nachher-Vergleich

Die folgenden Paare vergleichen den ursprünglichen Branchstand mit dem abschließenden Build nach Hero-, Hinweis- und Webkartenkorrektur. Die damalige fehlerhafte Zwischenaufnahme bleibt im historischen Abschnitt verlinkt.

| Zustand | Vorher | Nachher | Was sichtbar geändert ist |
| --- | --- | --- | --- |
| Persönlicher Hero, 390 px | [Vorher](screenshots/hero-tour-followup/before/hero-signed-390.png) | [Nachher](screenshots/hero-tour-followup/after-map-fix/hero-signed-390.png) | Fast durchgehend dunkles Grün wird zu erkennbarem Waldgrün–Oliv-Verlauf. |
| Erster Stempel auf Karte ausgewählt | [Vorher](screenshots/hero-tour-followup/before/tour-selected.png) | [Nachher](screenshots/hero-tour-followup/after-map-fix/tour-selected.png) | Allgemeiner Hinweis verschwindet; konkrete Hinzufügen-Aktion bleibt. |
| Folgesuche nach Verlassen und erneutem Öffnen des Vollbilds | [Vorher](screenshots/hero-tour-followup/before/tour-search-next.png) | [Nachher](screenshots/hero-tour-followup/after-map-fix/tour-search-next.png) | Vorher verketteter Text ohne neues Ziel; nachher exakter Suchtext Froschfelsen mit Zieltreffer. Hinweis bleibt nach vorhandenem Routenpunkt verborgen. |

## Was Nutzer gegenüber dem bisherigen Design tatsächlich merken

Vergleichsbasis für die folgende Einordnung ist der in den Designbranch gemergte Develop-Stand `b5f299f^2`. Das alte lokale `origin/develop` lag deutlich weiter zurück und wäre für einen reinen Designvergleich irreführend. Die Tabelle verbindet sichtbare Live-Befunde mit klar benannten Quellcodeänderungen; sie behauptet keine vollständige Vergleichsprüfung aller alten Flows.

| Änderung | Spürbarer Nutzen | Preis oder Gewöhnung |
| --- | --- | --- |
| Dunklerer, jetzt wieder deutlich abgestufter Hero | Die persönliche Zahl und Anmeldung bleiben gut erkennbar; der warme Verlauf bringt den vertrauten Charakter zurück. | Das frühere sehr helle Gold wurde zugunsten lesbarer Beschriftung abgedunkelt. |
| Ortsnamen bis zu zwei Zeilen statt einer | Lange Ziele lassen sich in der Liste besser unterscheiden. Live bei „Langenberg mit Aussicht auf das Ilsetal“ sichtbar. | Beschreibung schrumpft von zwei Zeilen auf eine. Wer über Beschreibungstexte auswählt, muss häufiger Details öffnen. |
| Höhere Listeneinträge, besonders bei Gruppen | Name, Besuchsstatus und Gruppeninformationen stehen weniger gedrängt. | Weniger Ziele passen gleichzeitig auf den Bildschirm; mehr Scrollen. Der Höhenwechsel ist im Quellvergleich belegt, die Gruppenansicht wurde in diesem Folgereview nicht erneut live geprüft. |
| Gast-Hero „Harz entdecken“ statt persönlichem Null-Fortschritt | Ohne Konto wirkt der Einstieg wie Entdecken; die Anmeldung hat einen erkennbaren Zweck. | Gäste sehen keinen persönlichen Fortschrittsbalken mehr. Live geprüft. |
| Tab „Liste“ heißt „Stempel“, Desktop-Inhalt ist begrenzt | Ziel des Tabs ist konkreter; Lesebreite und Navigation bleiben auf großen Bildschirmen zusammen. | Bestehende Nutzer müssen den umbenannten Tab wiedererkennen. Live bei 1440 px geprüft. |
| Gruppenänderungen werden erst mit „Fertig“ übernommen | Ein versehentliches Antippen ändert die aktive Wandergruppe noch nicht; Schließen kann Änderungen verwerfen. | Ein zusätzlicher Bestätigungsschritt gegenüber unmittelbarer Übernahme. Quellvergleich; hier nicht erneut live geprüft. |
| Scrollrad über eingebetteter Tourkarte scrollt die Seite; Suche öffnet Vollbild | Die Tourseite lässt sich erreichen, ohne versehentlich die Kartenkamera zu verschieben. Die Suche hat Platz für Route und Ziel. | Für bewusstes Zoomen sind die Kartenknöpfe oder Vollbild nötig; der Suchfokus wechselt stärker den Kontext. Vollbildsuche live geprüft; Scrollradverhalten in diesem Folgereview aus Quellcode und vorhandener Audit-Evidenz übernommen. |

## Nachweise und Grenzen

[Erster unabhängiger Lauf](hero-tour-independent-browser-checks.json): vier Viewports ohne Überlauf, Hinweiszustände und Suche bei durchgehend geöffnetem Vollbild. [Abschließender unabhängiger Lauf](hero-tour-independent-final-browser-checks.json): zusätzlich Kartenwechsel, einzelne Tastatureingaben, Hinweisrückkehr, Tastaturfokus und veränderte Vollbildgrößen; keine JavaScript-Seitenfehler.

| Neu unabhängig betrachtete Ansicht | Bild |
| --- | --- |
| Schmale Gastliste mit Verlauf | [320 px](screenshots/hero-tour-followup/independent/guest-list-320.png) |
| Breite Gastliste | [1440 px](screenshots/hero-tour-followup/independent/guest-list-1440.png) |
| Stempel gewählt, konkreter Hinzufügen-Button ohne Hinweis | [Auswahl](screenshots/hero-tour-followup/independent/tour-active-stamp.png) |
| Bestehende Route und neues Suchziel | [Suche](screenshots/hero-tour-followup/independent/tour-search-route-context.png) |

Die externe Ortssuche war beim Suchbild noch in Arbeit; Karten- und Stempeltreffer waren sichtbar. Der Bericht bewertet keinen erfolgreichen externen Suchabschluss. Keine erneute Zertifizierung für native Android-Ansichten, Screenreader, Offline-/Fehlerfälle, mehrteilige Routenberechnung oder Reihenfolgeänderungen. Das Entfernen des letzten Routenpunkts mit anschließendem Abwählen wurde im abschließenden Lauf auch vom unabhängigen Reviewer selbst erfolgreich geprüft; der Hinweis kehrt zurück.

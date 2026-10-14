# TODOs: Premium-Gefühl und Gamification

Stand: 14. Oktober 2026. Status: alle fünf Aufgaben offen, noch keine UI umgesetzt.

Ziel ist ein hochwertiges, motivierendes Sammelerlebnis: nächstes Ziel erkennen,
Stempel sammeln, Fortschritt erleben und die eigene Sammlung präsentieren.
Die Naturfarben, der Buddy und die bestehende Stempelanimation bilden die Basis.
Die lange Fortschrittsanimation von 3,9 Sekunden bleibt ausdrücklich erhalten.
Abzeichen bauen auf der vorhandenen UI5-App im CAP-Ordner auf; Profilabzeichen
und freigeschalteter Titel werden vom Nutzer ausgewählt. Das Erfolgsfeedback
gilt für Liste, Details und Karte.
Der angekündigte vollständige Touren-Refactor ist ausdrücklich außerhalb dieses Pakets.

| TODO | Priorität | Aufwand | Voraussetzung |
| --- | --- | --- | --- |
| [01 – Nächstes Sammelziel](01-naechstes-sammelziel.md) | P1 | M | Zielmodell aus 02 |
| [02 – Abzeichenalbum](02-abzeichenalbum.md) | P1 | M | Regeln und Abzeichenmotive |
| [03 – Stempelerfolg](03-stempelerfolg.md) | P1 | S–M | Bestehender Speicherflow; Ziele optional aus 02 |
| [04 – Stempel entdecken](04-stempel-entdecken.md) | P2 | S–M | Vorhandene Ortsdaten und Bilder |
| [05 – Konsistente Oberflächen](05-konsistente-oberflaechen.md) | P1 | S–M | Keine fachliche Voraussetzung |

S/M sind relative Aufwandsklassen, keine Zeitzusagen. Sinnvolle Reihenfolge:
zuerst 05 als visuelle Grundlage und das Zielmodell von 02, anschließend 01 und
03, dann der restliche Album-Ausbau und 04. Keine neue Tourenplanung erforderlich.

## Herkunft und Einordnung der Bilder

Jedes TODO enthält mindestens einen eingebetteten Screenshot des Ist-Zustands.
Die Bilder dienen als konkrete Referenzen, nicht als fertige Soll-Entwürfe.
Dateien mit `ist` wurden am 14. Oktober 2026 lokal aufgenommen; ältere Referenzen
sind ausdrücklich als solche bezeichnet. Demo-Daten aus älteren Screenshots
dürfen nicht als Fehlerbeleg oder reale Nutzerstatistik interpretiert werden.

Die lokale App wurde mit CAP Basic Auth und Expo Web gestartet. Es wurden keine
Produktionsdaten geändert. Die Bildbeschreibung im jeweiligen TODO dokumentiert
den Zustand und die Grenzen der Aufnahme.

## Gemeinsame Leitlinien

- Eindeutige Stempelstellen und wiederholte Besuche getrennt zählen.
- App-interne Meilensteine als solche kennzeichnen. Offizielle Wanderabzeichen
  erst mit geprüften Voraussetzungen und einer fachlich korrekten Zuordnung nutzen.
- Gast-, Lade-, Fehler-, Offline- und abgeschlossene Zustände berücksichtigen.
- Lesbare Kontraste, ausreichend große Touchflächen, Screenreader-Texte,
  vergrößerte Schrift und reduzierte Bewegung berücksichtigen.
- Wanderziele auf den persönlichen Ausflugsrhythmus ausrichten; regelmäßige
  Wanderungen sollen motivieren, ohne tägliche Aktivität vorauszusetzen.
- Bei der Umsetzung gemäß AGENTS.md von `develop` abzweigen, PR nach `develop`
  richten und Screenshots der betroffenen Ansichten in die PR-Beschreibung aufnehmen.

## Recherche

Die verlinkten offiziellen Duolingo- und Komoot-Beiträge wurden für die Analyse
online geprüft. Es handelt sich um dokumentierte Patterns, nicht um einen
vollständigen Live-Test der aktuellen Konkurrenz-Apps. Die Übertragung auf den
Harzer Wanderbuddy ist ein Gestaltungsvorschlag; ein Retention-Effekt ist noch
nicht gemessen.

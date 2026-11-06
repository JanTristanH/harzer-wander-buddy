# Hero und Tourenhinweis: Validierung

6. November 2026, Branch `design/ux-ui-review`.

## Vergleichsbasis und finale Änderungen

Die frischen Vorherbilder unter `screenshots/hero-tour-followup/before/` stammen
von einem Web-Export des Commits `6ab457621ff6bec4776129fe34c3145ed87cbbde`.
Der danach übernommene Branchstand `dbe4ec4` ergänzt ausschließlich Audit-Evidenz
und Browserchecks. Die finalen Nachherbilder liegen unter
`screenshots/hero-tour-followup/after-map-fix/`.

Der finale Stand enthält den wieder sichtbaren Hero-Verlauf, den zustandsabhängigen
Tourenhinweis und eine dauerhaft gemountete Webkarte samt Suchfeld. Der
Vollbildwechsel verändert deren Größe, statt Karte und Eingabe auszutauschen.
Ein ResizeObserver aktualisiert die Leaflet-Fläche. Escape schließt das Vollbild,
Tab/Shift+Tab bleiben innerhalb der Kartenbedienung. Der native Modalweg bleibt
bestehen. Die Typdeklaration für Webstyles in der Stempelliste wurde korrigiert.

Vorhandene lokale Auth-/SecureStore-Änderungen blieben erhalten und werden nicht
in den PR aufgenommen. Beide Builds liefen auf Port 4004 mit einem lokalen
Memory-Backend und dem genehmigten Testkonto. Keine Produktionsdaten.

## Durchgeführte Checks

- 376 App-Tests in 68 Suites erfolgreich (`jest --config jest.config.js --runInBand`).
- Vollständiger TypeScript-Check erfolgreich; der frühere ViewStyle-Fehler ist behoben.
- ESLint für alle fünf geänderten UI-Dateien erfolgreich; `git diff --check` sauber.
- Web-Export einschließlich statischem Rendering erfolgreich.
- Helle Hero-Schrift `#f5f3ee` gegen die drei Verlaufsfarben: 8,52:1, 4,87:1,
  5,26:1. Der Ladezustand verwendet denselben Verlauf.
- Fokussierter Browserlauf mit echten SSO- und Touraktionen:
  leerer Editor → Hinweis sichtbar; Kartenpunkt gewählt → 0 Hinweise;
  hinzugefügt → 0 Hinweise; Vollbild schließen, Reihenfolge ansehen und erneut
  suchen → exakt „Froschfelsen“, richtiger Treffer und bestehender Routenpunkt.
  Dieselben Karten- und Eingabeknoten bleiben verbunden. Letzten Punkt entfernen
  und abwählen → Hinweis wieder sichtbar. Keine JavaScript-Seitenfehler.

Ergebnisse: [ursprünglicher Vergleich vorher](screenshots/hero-tour-followup/before/checks.json),
[erster Hero-/Hinweisstand mit offenem Kartenfehler](screenshots/hero-tour-followup/after/checks.json),
[finaler fokussierter Lauf](screenshots/hero-tour-followup/after-map-fix/checks.json).
Der [Reviewbericht](ux-ui-review-followup.md) dokumentiert zusätzlich den
unabhängigen Browserreview und seine tatsächliche Abdeckung.

## Historische Fehler und Umgebungsdiagnosen

Der erste fokussierte Lauf erfasste beim Vollbildwechsel
`Cannot read properties of undefined (reading '_leaflet_pos')` und eine
zusammengesetzte Suchanfrage. Diese Evidenz bleibt erhalten. Der finale Lauf
prüft denselben Übergang und die vollständige Anfrage ausdrücklich und ist
fehlerfrei. Die Karten- und Eingabeelemente werden dabei nicht mehr entfernt.

Die anfänglichen angemeldeten Captures scheiterten an fehlendem Issuer/Audience
im lokalen Memory-Launcher. Der Launcher verwendet jetzt dieselbe öffentliche
Auth-Konfiguration wie der Webclient; danach liefen die lokalen Schreibaktionen.
Kein Auth-Bypass und keine Änderung an der Produktionskonfiguration.

Ein zusätzlicher Browserlauf fand einen verzögerten MapLibre-`getZoom`-Zugriff.
Die lokale Installation hatte nach einem `npm install --ignore-scripts` die bereits
im PR vorhandenen Vendor-Patches noch nicht angewendet. `npx patch-package`
hat beide vorhandenen Patches erfolgreich angewendet; der Webexport wurde danach
neu gebaut. Reguläre Installationen erledigen dies über das bestehende
`postinstall`-Skript. Diese Diagnose wird nicht als bestandener Lauf gewertet.

Native Android-Darstellung, Screenreader, externe Ortssuche und Offline-Verhalten
wurden in diesem Folgelauf nicht getestet. Die Webprüfung ist keine native Freigabe.

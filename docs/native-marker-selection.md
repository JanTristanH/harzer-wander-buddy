# Native Marker-Auswahl

Die Hauptkarte und die Tourenkarte verwenden nun denselben nativen Marker-Adapter.
Ein ausgewählter Stempel oder Parkplatz ersetzt seine normale Darstellung durch
den roten GPS-Pin mit dunklem Mittelpunkt. Touren-Halos und Besuchs-Badges werden
für den ausgewählten Punkt ausgeblendet. Beim Abwählen erscheinen wieder das
ursprüngliche Bild beziehungsweise die Gruppenansicht und das Touren-Badge.

Die Bitmaps mit 1×, 2× und 3× teilen ihre Geometrie und Farben mit Web-SVG und
Canvas über `app/lib/selected-map-pin.json`. Nach einer Änderung regeneriert
`node app/scripts/generate-selected-map-pin.mjs` die nativen Assets. Ausgewählte
Pins liegen auch bei Treffern über normalen Pins. `accessibilityState.selected`
kommuniziert die native Auswahl.

Ein Auswahlwechsel ersetzt nur die betroffenen nativen Marker-Instanzen. Damit
bleiben keine alten Snapshots von Gruppennummern oder Touren-Badges auf dem Pin,
auch wenn `tracksViewChanges` ausgeschaltet ist. Statische Auswahl-Pins benötigen
keine dauerhaft laufende View-Aufzeichnung.

## Prüfung

- 41 Tests in sechs Karten-/Touren-Suites erfolgreich, einschließlich Austausch
  und Wiederherstellung von Bild und Kindansichten, Press-Handler und Touren-Badge.
- TypeScript, gezieltes ESLint und `git diff --check` erfolgreich.
- Beide neuen PRs lassen sich konfliktfrei kombinieren.
- iOS-Laufzeitprüfung ist in der Linux-Umgebung nicht verfügbar.

Native Asset-Vorschau (kein Geräte-Screenshot):

![Roter nativer Auswahl-Pin](../app/assets/images/map/selected-pin@3x.png)

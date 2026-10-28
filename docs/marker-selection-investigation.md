# Marker-Auswahl: fehlende Hervorhebung

Verglichen am 26.10.2026: `develop` bei `b8a663c3a94e59737805f533b924b8a5473b668b` und der mit diesem Stand integrierte Performance-Branch bei `e77687c67b22a1c1275ff81e08beaff12a889664`.

**Befund:** Eine dauerhafte visuelle Hervorhebung des ausgewählten Stempels fehlt bereits auf `develop`. Der Performance-Umbau hat diesen Zustand nicht eingeführt. Gemäß Aufgabenabgrenzung wird die Auswahlgestaltung separat behoben.

## Reproduktion und Ursache

1. Echte statische Expo-App mit dem öffentlichen Katalog öffnen, mobile Ansicht 390 × 844 / DPR 3.
2. Stempel 9 auswählen. Das Detailblatt „9 • Brockenhaus“ öffnet sich und die Karte zentriert/zoomt auf den Stempel.
3. Der Pin behält seine Darstellung. Das gilt vor und nach dem Canvas-Umbau; erneutes Antippen des nun zentrierten Touch-Ziels funktioniert auf beiden Ständen.

In `app/app/(tabs)/map.tsx` setzt `handleMarkerPress` die `selectedItemId`. Die memoisierten `stampMarkerElements` hängen jedoch nicht von dieser ID ab. Ihre Farbe, Größe und Ebene werden ausschließlich aus dem fachlichen Markerzustand bestimmt. Auch `Marker` in `app/components/maps/map-primitives.web.tsx` erhält keinen Auswahlzustand. Im bisherigen DOM-Renderer gibt es keine CSS-Regel für einen ausgewählten Pin. Der neue Canvas-Renderer erhält dieselben unveränderten visuellen Angaben.

Der Browservergleich prüfte vor/nach Auswahl jeweils unveränderte Icon-Kindelemente, Klassen und Markerfarbe; Detailblatt und Touch-Auswahl funktionierten auf beiden Builds ohne JavaScript-Fehler. Im Performance-Build zusätzlich: 222 Stempel nach jedem Stilwechsel sowie Auswahl eines anderen Stempels per Enter. Das ist eine Prüfung des Web-Auswahlzustands; native Android-/iOS-Auswahl wurde nicht getestet.

![Auswahl auf develop vor Performance-Umbau](screenshots/mobile-web-map-performance/selection-before.png)

![Auswahl nach Performance-Umbau](screenshots/mobile-web-map-performance/selection-after.png)

## Ansatz für die separate Behebung

Den Auswahlzustand explizit vom Bildschirm an beide Marker-Renderer übergeben und bei Auswahlwechsel ausschließlich den vorherigen und den neuen Pin aktualisieren. Hervorhebung und höhere Zeichen-/Trefferebene gemeinsam behandeln. Beim Schließen des Detailblatts muss die Hervorhebung entfallen. Browserfokus und dauerhaft ausgewählter Stempel sind dabei verschiedene Zustände.

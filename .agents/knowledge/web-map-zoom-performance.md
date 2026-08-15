# Web-Karte: Zoomdarstellung und Performance-Fallback

Stand: 2026-08-07

## Aktueller, optisch schöner Zustand

In `app/components/maps/map-primitives.web.tsx` sind am `MapContainer`
`zoomAnimation` und `markerZoomAnimation` aktiviert. Die Marker bleiben dadurch
während des 250-ms-Zoomübergangs sichtbar und bewegen sich mit der Karte.
`TileLayer.updateWhenZooming` ist ebenfalls aktiviert.

Das frühere `flyTo` bleibt durch den effizienteren `setView`-Pfad ersetzt. Dadurch
entsteht bei einem programmierten Zoom nicht mehr der vorherige JavaScript-Update-
Sturm pro Animationsframe. Viewport-Culling bleibt aktiv; Clustering wird nicht
verwendet.

## Performance-Fallback bei Bedarf wieder einschalten

Falls Zoomen mit vielen Einzelmarkern später erneut ruckelt, zuerst nur folgende
Option ändern:

```tsx
<MapContainer
  markerZoomAnimation={false}
  zoomAnimation
  // ...
>
```

Leaflet versieht die Marker-Pane dann mit `leaflet-zoom-hide`. Die bereits im
Runtime-CSS vorhandene Regel blendet alle Marker für die circa 250 ms dauernde
Zoomanimation aus und zeigt sie anschließend neu positioniert wieder an. Das spart
die Markeranimation, lässt aber die Kartenkacheln weich zoomen.

Wenn zusätzlich die Kachelaktualisierung während des Übergangs Arbeit verursacht,
kann am `TileLayer` gesetzt werden:

```tsx
updateWhenZooming={false}
```

Dann skaliert Leaflet während des Übergangs zunächst die vorhandenen Kacheln und
lädt die neue Zoomstufe erst am Ende. Diese Einstellung verursacht nicht das
Ausblenden der Marker.

`zoomAnimation={false}` sollte nicht als erste Performance-Maßnahme verwendet
werden: Das beseitigt zwar die Animation, führt aber zu dem als unnatürlich
empfundenen Springen zwischen Zoomstufen.

## Was aus der Analyse gelernt wurde

- Das frühere Hauptproblem war `flyTo`: Der Flugzoom bewegte die Karte über viele
  JavaScript-Frames. Jeder Leaflet-Marker berechnete dabei Position und `zIndex`
  erneut und schrieb einen neuen CSS-Transform. Panning war gleichzeitig flüssig,
  weil dabei hauptsächlich eine gemeinsame Map-Pane verschoben wird.
- `setView` zusammen mit Leaflets 250-ms-CSS-Übergang behält einen weichen Zoom,
  ohne den programmierten `flyTo`-Frame-Loop. `flyTo` deshalb nicht wieder für
  Marker-reiche Kartenbewegungen einsetzen.
- `markerZoomAnimation` steuert ausschließlich das Marker-Verhalten. Aktiviert
  bewegen sich Marker optisch mit; deaktiviert blendet Leaflet die komplette
  Marker-Pane über `leaflet-zoom-hide` für den Übergang aus.
- `TileLayer.updateWhenZooming` steuert die Kachelaktualisierung und ist nicht für
  das Marker-Ausblenden verantwortlich. `false` spart Zwischenarbeit, kann die
  vorhandenen Kacheln während des kurzen Übergangs aber etwas unschärfer zeigen.
- `zoomAnimation={false}` ist zwar performant, wurde optisch aber als unnatürliches
  Springen bewertet. Der aktuelle Stand behält die CSS-Zoomanimation bei.
- React-Leaflet vergleicht Markerpositionen per Referenz. Ein memoisiertes
  `[latitude, longitude]`-Tupel verhindert unnötige `setLatLng`-Aufrufe für Marker,
  deren Koordinaten unverändert geblieben sind.
- Stabile Eventhandler mit `useRef` und `useMemo` verhindern, dass Marker bei jedem
  React-Render neue Leaflet-Click-Listener erhalten. Accessibility-Attribute werden
  nur aktualisiert, wenn Label oder Pressbarkeit wechseln.
- Das Viewport-Culling verwendet derzeit 25 % Puffer pro Seite. Der vorherige
  45-%-Puffer umfasste in der Fläche wesentlich mehr Marker und machte besonders
  den Abschluss eines Zooms teurer. Clustering ist ausdrücklich nicht gewünscht.
- Parkplätze werden bei `longitudeDelta < 0.18` zugeschaltet. Diese harte Schwelle
  bleibt ein bekannter Lastsprung, weil dabei viele zusätzliche Einzelmarker auf
  einmal gemountet werden können.
- Die Web-Region wird nach `moveend` in einer React-Transition aktualisiert. Damit
  bleibt die direkte Karteninteraktion priorisiert, während die neue Marker-Auswahl
  berechnet und reconciled wird.
- Der verschobene Zahlen-Badge entstand, weil `.hwb-css-marker` ein Inline-`span`
  war und seine Breite/Höhe deshalb nicht als erwartete Bezugsfläche dienten.
  `display: block` stellt die korrekte Zentrierung her.
- SVG-`feDropShadow` und Schatten pro Marker sind bei vielen Markern unnötig teuer.
  Die leichten CSS-Marker ohne Filter bleiben der bevorzugte Webpfad.
- Der Geolocation-Watch darf nicht von wechselnden Callback-Identitäten abhängen.
  Der aktuelle Callback liegt in einer Ref; praktisch identische Koordinaten werden
  vor einem State-Update dedupliziert.

## Teststrategie für spätere Änderungen

Zuerst den aktuellen optischen Modus mit sichtbaren, animierten Markern testen.
Wenn Zoom erneut ruckelt, die Maßnahmen einzeln vergleichen:

1. `markerZoomAnimation={false}` aktivieren und Marker-Renders sowie Long Tasks
   vergleichen.
2. Erst danach `updateWhenZooming={false}` testen.
3. `zoomAnimation={false}` nur als Diagnose verwenden, nicht als bevorzugtes UX-
   Ergebnis.
4. Markerzahl rund um die Parkplatzschwelle beobachten.
5. Keine neue Cluster-Lösung einführen.

Start-, Build-, Browser- und Messablauf stehen in
[`local-rnweb-development.md`](./local-rnweb-development.md).

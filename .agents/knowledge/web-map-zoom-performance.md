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


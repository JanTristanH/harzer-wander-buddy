# Screenshots der Offline-Kartenverwaltung

Die drei PNGs zeigen die Produktionskomponente `OfflineMapManager` auf React Native Web mit Beispieldaten: gespeicherte Karte, laufender Download und fehlgeschlagener Download. Es sind **keine nativen Gerätescreenshots und keine Aufnahme gerenderter Offline-Kacheln**. Die Fixture enthält keine nachgebildete Kartenansicht.

Reproduktion: `esbuild` und `playwright` außerhalb der App installieren; dann vom Repository-Root:

```
OFFLINE_PREVIEW_TOOLS=/tmp/hwb-offline-preview CHROMIUM_PATH=/usr/bin/chromium node docs/screenshots/offline-maps/capture.cjs
```

Offene Android-/iOS-Prüfungen: [Offline-Wanderkarten](../../offline-hiking-maps.md).

## Echte lokale Kartendaten

`live-map-web-validation.png`: 390 × 844 Pixel, echte OpenFreeMap-Kacheln und Glyphen aus einem begrenzten Brocken-/Schierke-Paket, derselbe lokale Stil. Browser-Netzwerk auf Loopback beschränkt; 33 Wege/Pfade und vier Gipfelfeatures ohne Kartenfehler gerendert. Die Aufnahme ist ein WebGL-Datentest, keine native Flugmodus-Abnahme. Reproduktion über `scripts/check-offline-map-download.cjs` und `scripts/check-offline-map-render.py`; siehe [Prüfumfang](../../offline-hiking-maps.md).

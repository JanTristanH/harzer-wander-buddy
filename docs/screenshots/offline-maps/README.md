# Screenshots der Offline-Kartenverwaltung

Die drei PNGs zeigen die Produktionskomponente `OfflineMapManager` auf React Native Web mit Beispieldaten: gespeicherte Karte, laufender Download und fehlgeschlagener Download. Es sind **keine nativen Gerätescreenshots und keine Aufnahme gerenderter Offline-Kacheln**. Die Fixture enthält keine nachgebildete Kartenansicht.

Reproduktion: `esbuild` und `playwright` außerhalb der App installieren; dann vom Repository-Root:

```
OFFLINE_PREVIEW_TOOLS=/tmp/hwb-offline-preview CHROMIUM_PATH=/usr/bin/chromium node docs/screenshots/offline-maps/capture.cjs
```

Offene Android-/iOS-Prüfungen: [Offline-Wanderkarten](../../offline-hiking-maps.md).

# Themenhefte – Komponentenvorschau

Die PNGs zeigen die Produktionskomponente `ThemeBookletsView` auf React Native Web: Heftliste, Grenzweg-Sonderstempel und Filter auf fehlende Stellen. Die Beispieldaten stellen bewusst einen Sammler mit 20 regulären Grenzweg-Stempeln und drei noch fehlenden Sonderstempeln dar. Die Detailfixture zeigt nur einen Ausschnitt der regulären Stellen und alle drei Sonderstempel. Die Daten stammen nicht von einem echten Nutzerkonto.

Es sind keine nativen Gerätescreenshots und kein vollständiger App-Browser-Smoke-Test. Die Anbindung an Badge-/Admin-API wird separat durch echte lokale CAP-HTTP-Tests geprüft.

Reproduktion: `esbuild` und `playwright` außerhalb der App installieren, dann:

```
OFFLINE_PREVIEW_TOOLS=/tmp/hwb-offline-preview CHROMIUM_PATH=/usr/bin/chromium node docs/screenshots/theme-booklets/capture.cjs
```

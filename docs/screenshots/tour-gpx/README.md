# GPX export preview

`01-gpx-export.png` renders the production `TourGpxExport` component through React Native Web with a fixture tour. It is a component preview, not an Android/iOS screenshot or the complete tour screen. The capture also clicks the actual browser export and checks the downloaded filename and route coordinates.

Reproduce with Node dependencies `esbuild` and `playwright` installed outside the app:

```
OFFLINE_PREVIEW_TOOLS=/tmp/hwb-offline-preview CHROMIUM_PATH=/usr/bin/chromium node docs/screenshots/tour-gpx/capture.cjs
```

Native share sheets require device validation. GPX exports every saved leg in rank order as a separate track, including driving legs marked `driving`. Missing or invalid geometry blocks export; no straight-line substitute or fabricated elevation is written. GPX contains the tour name and route, without friend/account data. The export uses cached tour data when present and requires no backend write.

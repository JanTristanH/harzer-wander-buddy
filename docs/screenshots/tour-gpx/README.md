# GPX export and tour map — web verification

These are screenshots of the complete production RN-Web screens against a local CAP `dev-basic` backend, using a fixture tour with real saved route geometry. They replace the earlier isolated component preview. They are not native Android/iOS screenshots.

- `01-gpx-export.png`: tour details with the saved route.
- `02-actions-menu.png`: neutral GPX action inside the top-right overflow menu.
- `03-edit-route.png`: route remains visible while editing.
- `04-selected-marker.png` and `05-dismissed-marker.png`: selecting a marker and dismissing it by clicking its transparent lower corner.
- `06-export-choice.png`: choosing between one connected route and individual stages before download.

The capture uses a two-leg fixture and the actual menu buttons. It checks cancellation, both downloaded GPX formats (one track/segment versus two), filename/content, and that clicking a transparent marker corner dismisses the selection. The backend integration test separately checks geometry after saving a tour with repeated stops.

Reproduce from the repository root with the local database, the test account from `AGENTS.md`, Python Playwright and Chromium. Build the same configuration used by PR previews:

```
cd app
HWB_PREVIEW_PR=86 EXPO_PUBLIC_AUTH_MODE=basic EXPO_PUBLIC_BACKEND_URL=http://localhost:4004 npx expo export --platform web
cd ..
cp -a app/dist/. backend/hwb/app/rnweb/
npm run start:basic --prefix backend/hwb
```

In a second terminal, set `HWB_TEST_USERNAME` and `HWB_TEST_PASSWORD` to the local test credentials, then run `python docs/screenshots/tour-gpx/capture.py`. The script creates a local test tour and marks that test account's onboarding complete. It saves screenshots only, without browser tokens or signed-in profiles. In this managed environment, source `/workspace/android-flow/env.sh` first; the capture uses Python's current CA trust and inherited proxy for public OpenFreeMap assets, with TLS verification enabled.

Validation: 54 Jest suites / 286 tests, 30 backend tests, TypeScript, targeted ESLint, web export, actual browser download and marker dismissal passed. Both the user-supplied XML (2 tracks / 352 points) and an actual browser download validate against the official GPX 1.1 XSD. The supplied attachment was named `.bin`; its XML is valid and does not need coordinate changes.

The export-choice change additionally passed 17 targeted Jest tests, TypeScript, targeted ESLint, web export and actual browser downloads of both formats. The user confirmed that Komoot successfully imports the original stage-based export and offers its separate tracks as individual tours. The connected mode still requires a Komoot import check on a device.

Native exports previously deleted the cached file as soon as the share sheet resolved. Receiving apps can read later, so exports now remain in separate cache directories with their `.gpx` filename and GPX MIME type; the OS can reclaim them later. Native sharing is covered by unit tests.

Every export asks for its format. Individual stages preserve each saved leg as a separate track, including driving legs marked `driving`. Connected mode creates exactly one track with one segment in rank order and removes consecutive duplicate coordinates. It includes driving legs and directly joins any gaps; the selection explains this. Mixed hiking/driving tours do not declare the whole track as hiking. Missing or invalid geometry blocks both formats, and no fabricated elevation is written. The export uses cached tour data when present and requires no backend write.

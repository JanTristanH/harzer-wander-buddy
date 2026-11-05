# Local visual review fixtures

These scripts serve **synthetic UI data**, not real hiking guidance. They do not authenticate, bypass Auth0, or write to production. No real user fixtures, tokens, emulator state, or APKs are included.

Start the seeded CAP backend from the existing checkout:

```sh
cd backend/hwb
node ../../scripts/ui-audit/seed-memory-backend.cjs
```

It uses CAP's `memory` profile and seeds eight stamps and one parking spot. Keep this process running. In another terminal:

```sh
cd app
EXPO_PUBLIC_BACKEND_URL=http://localhost:4004 npx expo export --platform web --output-dir /tmp/hwb-ui-web
```

Serve the export under the app's configured `/app/rnweb` base path (Python 3 and `aiohttp` required):

```sh
python scripts/ui-audit/serve-web.py /tmp/hwb-ui-web 8083
```

Open `http://localhost:8083/app/rnweb/`. Inspect 320×568, 390×844, 768×1024 and 1440×900 viewports. Wait for actual content and fonts; for maps also wait for tiles and the end of loading/fade transitions. Never treat an error overlay or a skeleton as a screenshot of the completed screen. Use isolated browser contexts; do not export browser storage or signed-in profiles.

Public stamp detail: `/app/rnweb/stamps/00000000-0000-4000-8000-000000000001`.
Public parking detail: `/app/rnweb/parking/00000000-0000-4000-9000-000000000001`.

Check search, clear search, no results, each filter, map switches (including `aria-checked`), zoom, marker selection, opening details, back navigation, guest onboarding and keyboard focus. Authenticated, admin and native behavior require separate authorized runtime evidence. Guest fixtures cannot certify those flows.

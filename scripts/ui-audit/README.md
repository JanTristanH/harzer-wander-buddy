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

## Approved Auth0 workflow on port 4004

For signed-in review use the repository's web build served by CAP; ports 8081 and 8083 are not registered callbacks for this test client:

```sh
# Terminal 1, from backend/hwb; optionally include fictional buddies/requests:
HWB_UI_RICH_FIXTURES=1 node --require ../../scripts/ui-audit/runtime-proxy.cjs ../../scripts/ui-audit/seed-memory-backend.cjs
# Terminal 2, from app:
EXPO_PUBLIC_BACKEND_URL=http://localhost:4004 npm run dev:sso:web:build
# Terminal 3, from repository root (Python Playwright and Chromium required):
python scripts/ui-audit/capture-web.py /workspace/artifacts/ui-audit/final
```

The capture reads only the approved test credentials from `AGENTS.md` and performs actual Auth0 login. Profile setup and visit writes go to the disposable local memory backend. It never exports cookies, tokens, storage state or emulator userdata. `runtime-proxy.cjs` enables Node fetch to use the configured environment proxy for Auth0, preserving local exclusions and TLS verification. Without an environment proxy it leaves fetch unchanged.

The capture records source commit, viewport overflow, interaction outcomes and sanitized browser errors alongside PNGs. Run it against the built working tree and record any uncommitted UI changes in the review ledger. A failed capture or missing screen is not a passing check. Do not publish the runtime directory or test credentials.

# Harzer Wanderbuddy app

Die öffentliche Website baut dieselbe Expo-App mit statischem Datenprofil:
[Buildprofil und Datenadapter](../docs/public-stamp-catalogue.md).

This is the React Native app for Harzer Wanderbuddy. Basic development uses a separate Expo Web server; Auth0 web development is served by CAP; see [Local web development and Auth0](#local-web-development-and-auth0).

## Local development profiles

Both development profiles use the ignored `db.local.db` database. On first start,
CAP copies the checked-in `db.sqlite` seed once; existing local data is never
overwritten. Visits and profile edits remain local and keep the Git checkout clean.

### Basic Auth: CAP and Expo Web in separate terminals

From the repository root:

```bash
# Terminal 1: CAP, SQLite and local test users; no Auth0 configuration needed
npm run watch:basic --prefix backend/hwb

# Terminal 2: Expo Web with hot reload
npm run web:basic --prefix app
```

Open `http://localhost:8081/login`. Enter the test credentials documented in `../AGENTS.md`.
The app sends HTTP Basic credentials to CAP at `http://localhost:4004` and creates the
local user profile on first login. Credentials stay in memory: logout or a page reload
requires a new login. Local accounts are configured under `[dev-basic]` in CAP's
`package.json`; registration and Auth0 are not used in this mode.

Onboarding is controlled by the user's `onboardingCompleted` field in CAP's
`ExternalUsers` table, not by the authentication method. A new user starts with
`false`; completing the final step writes `true` to the backend. Login loads this
value: `false` opens onboarding, `true` opens the stamp list. Profile edits keep the
existing completion state when their response omits the field.

The local database survives server restarts, so logging out, reloading the browser
or restarting Expo does not repeat completed onboarding. A page reload does clear
the in-memory Basic session and requires another login. For repeat onboarding tests,
reset only the test user's `onboardingCompleted` field in your own ignored
`backend/hwb/db.local.db`; do not delete the database or change the checked-in seed.

For native Basic development, use `npm run start:basic`. On a physical device, override
`EXPO_PUBLIC_BACKEND_URL` with the CAP host's LAN address instead of localhost; start
Expo with `EXPO_PUBLIC_AUTH_MODE=basic EXPO_PUBLIC_BACKEND_URL=http://<host>:4004 npx expo start`.

### SSO: Auth0 and CAP-served web export

```bash
./scripts/build-and-copy-rnweb.sh
npm run watch:sso --prefix backend/hwb
```

Open `http://localhost:4004/app/rnweb`. SSO web login continues to use the registered
CAP callbacks below. The build script explicitly selects SSO and keeps the CAP mount
path even after a Basic Expo session. Run the script after changes to `app/` and reload
the browser. `npm run web:basic` is the separate Expo Web workflow; it does not require
Auth0 callback changes.

## Get started

1. Install dependencies (from this directory)

   ```bash
   npm ci
   ```

2. Start Expo for native development

   ```bash
   npx expo start
   ```

Use this Expo server for iOS/Android development. Do not press `w` or add `--web` for local Auth0 login; use the CAP-served web workflow below.

You can open the native app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Creating a new development build

### locally

`npx expo run:ios`

### remote
`eas build --platform ios --profile development`

`npx expo start` starts the native development server.

## Runtime configuration

`app.config.ts` is the single source for the backend URL. It reads
`EXPO_PUBLIC_BACKEND_URL` at build/start time and falls back to the local backend.
In particular:

- local development: `EXPO_PUBLIC_BACKEND_URL=http://localhost:4004`
- preview and production builds: `EXPO_PUBLIC_BACKEND_URL=https://app.harzer-wander-buddy.de`

The EAS profiles define both values in `eas.json`. The root `Dockerfile` defaults
to the production backend so Google's existing container trigger can build without
arguments. Set the `EXPO_PUBLIC_BACKEND_URL` build argument to override it for
another environment. GitHub Actions validates the Docker build without publishing
an image; Google continues to build and deploy from `main`.

Android emulators automatically map the local hostname to `10.0.2.2`. A physical
device needs an explicit LAN URL or HTTPS tunnel via `EXPO_PUBLIC_BACKEND_URL`.

The remaining public Auth0 configuration is stored in `app.json`:

```
      "auth0Domain": "dev-ijucl08spdudaszc.us.auth0.com",
      "auth0ClientId": "Pf0WY4b3Q2yu6CllOGaZC4RIlolcd4xh", => legacy fallback
      "auth0ClientIdNative": "Pf0WY4b3Q2yu6CllOGaZC4RIlolcd4xh", => needs to be a native app
      "auth0ClientIdWeb": "YOUR_WEB_CLIENT_ID", => needs to be a SPA app
      "auth0Audience": "https://app.harzer-wander-buddy.de/api/v2/",
      "auth0Scope": "openid profile email offline_access",
      "auth0LogoutReturnPath": "auth/logout",
```

### Local web development and Auth0

For web login, serve the static Expo export through CAP. Do not use `npx expo start --web` for this flow: Auth0's local callback is registered for the CAP URL, not Expo's development-server URL. Follow the [CAP React Native Web instructions](../backend/hwb/README.md#react-native-web-via-cap).

After editing files under `app/`, rebuild and copy the web export again:

```bash
./scripts/build-and-copy-rnweb.sh
```

For a local container build, the production backend is the default. To override it:

```bash
docker build \
  --build-arg EXPO_PUBLIC_BACKEND_URL=https://app.harzer-wander-buddy.de \
  -t harzer-wander-buddy .
```
For native development against a local backend, `EXPO_PUBLIC_BACKEND_URL` can still point to the CAP server. Android emulators map `localhost` to `10.0.2.2` automatically.

## Android Maps Config

Android requires a Google Maps SDK key for `react-native-maps`.

Set this env var for EAS/local builds:

```bash
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_android_maps_sdk_key
```

For EAS cloud builds, create it for the `preview` environment with readable visibility so it can also be used by local tooling:

```bash
eas env:create --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value your_android_maps_sdk_key --environment preview --visibility sensitive
```

If the variable already exists as a `secret`, update it instead:

```bash
eas env:update --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value your_android_maps_sdk_key --environment preview --visibility sensitive
```

For `eas build --local`, EAS cannot read variables with `secret` visibility. Export the key in your shell or put it in a local `.env`/`.env.local` file before running the build.

## Internal Distribution
```
eas build --platform android --profile preview
```

npx eas update --channel preview --platform android --message "Message"

## OTA-Pipeline mit GitHub Actions

Der Workflow [Expo OTA Update](../.github/workflows/expo-update.yml) veröffentlicht
bei App-Änderungen auf **`main` automatisch auf `preview` für beide Plattformen**.
Auf `develop` wird er ausschließlich manuell gestartet; Android ist dann voreingestellt. Er installiert
die App mit `npm ci`, führt die App-Tests aus, prüft die Backend-Konfiguration
und veröffentlicht anschließend mit `eas update --environment preview`.

### 1. Expo-Zugriff für GitHub einrichten

Erstelle im Expo-Konto unter **Account settings → Access tokens** einen Token:
[Expo Access Tokens](https://expo.dev/settings/access-tokens).
Das Konto muss Zugriff auf das EAS-Projekt
`1511f3e0-0255-4c5b-97a4-43e285483bc2` haben.

Speichere den Token im GitHub-Repository unter **Settings → Secrets and variables
→ Actions → New repository secret** mit dem Namen **`EXPO_TOKEN`**.
Den Token nicht ins Repository oder in den Chat kopieren.

### 2. EAS-Umgebung prüfen

Im Verzeichnis `app/`:

```bash
npx eas-cli@latest login
npx eas-cli@latest project:info
npx eas-cli@latest env:list preview
```

Lege den Backend-Endpunkt in der EAS-Umgebung `preview` an, falls er dort fehlt:

```bash
npx eas-cli@latest env:create --environment preview \
  --name EXPO_PUBLIC_BACKEND_URL \
  --value https://app.harzer-wander-buddy.de --visibility plaintext
```

Für eine bereits vorhandene Variable verwende `env:update` statt `env:create`.
Weitere öffentliche Konfigurationswerte, etwa Auth0-Overrides oder der Google
Maps Key, müssen zum installierten Build passen. Für OTA benötigte Variablen
brauchen `plaintext` oder `sensitive` Sichtbarkeit; EAS-Variablen mit `secret`
Sichtbarkeit können auf dem GitHub-Runner nicht geladen werden.

**Wichtig:** Die `env`-Werte der Build-Profile in `eas.json` werden bei
`eas update` nicht übernommen. Mit `--environment preview` kommen die Werte
aus der EAS-Umgebung; lokale `.env`-Dateien werden dabei nicht verwendet.
Die Pipeline bricht ab, falls die Backend-Variable fehlt oder auf eine andere
Adresse zeigt. [Expo: Umgebungsvariablen](https://docs.expo.dev/eas/environment-variables/usage/)

### 3. Installierten Build und Channel prüfen

Ein Channel gehört zum **installierten App-Build**. Im Expo-Dashboard unter
**Projekt → Builds → Build-Details** lässt sich der Channel des jeweiligen
Builds prüfen. Ein mit dem Profil `preview` erstellter Build verwendet hier
den Channel `preview`; `production` verwendet `production`.

Die App kann auf dem Gerät mit `Updates.channel`, `Updates.runtimeVersion`
und `Updates.updateId` den Channel, die Runtime und das laufende Update anzeigen.
Eine solche Diagnoseanzeige ist bisher nicht implementiert. Die Build-Liste
ist kein Inventar aller Installationen auf einzelnen Geräten.
[Expo: Updates API](https://docs.expo.dev/versions/v54.0.0/sdk/updates/)

Alle kompatiblen Preview-Installationen erhalten ein auf `preview` veröffentlichtes
Update. Für einen dauerhaften Wechsel eines Geräts nach `production` dort einen
neuen Build mit dem Profil `production` installieren. Änderungen in `eas.json`
ändern bestehende Installationen nicht. Ein serverseitiges Umhängen des Channels
auf einen anderen EAS-Branch betrifft alle Builds dieses Channels; für einen
Wechsel innerhalb der App müsste ein Channel-Override implementiert werden.
[Expo: Channels und Branches](https://docs.expo.dev/eas-update/how-it-works/)

OTA ersetzt JavaScript und Assets, aber keinen nativen Build. Plattform und
Runtime müssen übereinstimmen. Dieses Projekt verwendet die Runtime-Policy
`fingerprint`: Expo ermittelt native Kompatibilität aus dem Projekt. Die sichtbare
App-Version kommt aus `package.json` über `app.config.ts`. Bei geänderter nativer
Runtime neue Builds verteilen. Auch der erstmalige Wechsel von `appVersion`
auf `fingerprint` erfordert neue Binaries; alte Installationen erhalten diese
Updates nicht. EAS erhöht Buildnummern unabhängig davon automatisch.
[Expo: Runtime-Versionen](https://docs.expo.dev/eas-update/runtime-versions/)

### 4. Erstes Update starten und prüfen

Nach dem Merge erscheint der Workflow unter **GitHub → Actions → Expo OTA
Update → Run workflow**. Wähle den Git-Branch mit dem gewünschten App-Code und
die passende Plattform. Der gewählte Branch wird ausgecheckt; das Ziel bleibt
immer `preview`. App-Pushes auf `main` veröffentlichen automatisch Updates.
Nach einem Merge nach `develop` zum OTA-Test **Run workflow → Branch develop →
Plattform android** wählen. Pushes auf `develop` und PRs veröffentlichen keine Updates.

Die Job-Ausgabe enthält den Expo-Link zur veröffentlichten Update-Gruppe;
die Update-Nachricht enthält Git-Branch, Commit und GitHub-Run-ID. Prüfe im
Expo-Dashboard die Ziel-Runtime und den Channel. Öffne anschließend einen
passenden Preview-Build auf einem Gerät mit Internetzugang. Bei der normalen
Startprüfung wird das Update heruntergeladen und üblicherweise beim nächsten
App-Neustart angewendet. Expo Go ist kein Test für den fest zugewiesenen
Channel eines Release-Builds.

Bei einem fehlerhaften Update lässt sich im Expo-Dashboard unter **Updates**
eine vorherige kompatible Update-Gruppe erneut veröffentlichen (Republish).
Alternativ den betreffenden Commit zurücknehmen und die Pipeline erneut starten.
[Expo: Rollbacks](https://docs.expo.dev/eas-update/rollbacks/)

### 5. Produktionsreleases

**Prepare Release** wird manuell auf `develop` gestartet und erstellt dort
getrennte App-/CAP-Versions-PRs. Erst die anschließende Freigabe nach `main`
veröffentlicht Tags/Releases ohne weitere Versionscommits. Ein App-Release
startet Produktionsbuilds für beide Plattformen; Produktions-OTA und
Store-Einreichung erfolgen nicht automatisch. Google baut das Docker-Image
weiterhin von `main`. Einrichtung und Ablauf: [Releases](../docs/releases.md).

## build ios locally

npx expo run:ios --configuration Release

then in xcode -> run on the connected device

## Native offline visits

On iOS and Android, own visits from the list, map and stamp details are saved to an
account-specific device outbox before confirmation and uploaded when connected.
Group stamping, editing and deleting remain online. See the
[implementation notes, tests and screenshot previews](../docs/screenshots/native-offline-visits/README.md)
for persistence, retry behaviour and device-validation limits.

## Native offline notes

Personal stamp notes on iOS and Android are saved in an account-specific persistent
outbox and synchronized on reconnect. Conflicting changes from other devices remain
available for an explicit choice between the local and remote versions. See
[offline note synchronization](../docs/native-offline-notes.md) for behavior,
backend requirements, tests and limitations.

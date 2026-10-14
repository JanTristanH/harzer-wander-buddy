# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

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

###  remote
`eas build --platform ios --profile development`

`npx expo start` => start the dev server

## Auth0 Config

`app.json` file contains the configuration.

```
      "backendUrl": "https://app.harzer-wander-buddy.de",
      "auth0Domain": "dev-ijucl08spdudaszc.us.auth0.com",
      "auth0ClientId": "Pf0WY4b3Q2yu6CllOGaZC4RIlolcd4xh", => legacy fallback
      "auth0ClientIdNative": "Pf0WY4b3Q2yu6CllOGaZC4RIlolcd4xh", => needs to be a native app
      "auth0ClientIdWeb": "YOUR_WEB_CLIENT_ID", => needs to be a SPA app
      "auth0Audience": "https://app.harzer-wander-buddy.de/api/v2/",
      "auth0Scope": "openid profile email offline_access",
      "auth0LogoutReturnPath": "auth/logout",
```

For local development against a local backend, start Expo with:

```bash
EXPO_PUBLIC_BACKEND_URL=http://localhost:4004 npx expo start
```

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
zunächst ausschließlich **manuell auf `preview`**. Android ist voreingestellt;
iOS oder beide Plattformen können beim Start ausgewählt werden. Er installiert
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
`appVersion`: Entscheidend ist `expo.version` in `app.json` (aktuell `1.5.2`),
nicht die Paketversion in `package.json`. Bei Änderungen an nativen Modulen,
Expo SDK, Berechtigungen oder nativer Konfiguration zuerst `expo.version`
erhöhen und neue Builds verteilen. Eine reine OTA-Korrektur für vorhandene
Builds behält deren Runtime-Version.
[Expo: Runtime-Versionen](https://docs.expo.dev/eas-update/runtime-versions/)

### 4. Erstes Update starten und prüfen

Nach dem Merge erscheint der Workflow unter **GitHub → Actions → Expo OTA
Update → Run workflow**. Wähle den Git-Branch mit dem gewünschten App-Code und
die passende Plattform. Der gewählte Branch wird ausgecheckt; das Ziel bleibt
immer `preview`. Ein Push oder PR veröffentlicht derzeit kein Update.

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

### 5. Später nur von main automatisch veröffentlichen

Wenn Preview erfolgreich getestet ist, ersetze den gesamten `on`-Block durch:

```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'app/**'
      - '.github/workflows/expo-update.yml'
```

Entferne damit `workflow_dispatch`, damit ausschließlich Pushes auf `main`
veröffentlichen. Setze außerdem im Job:

```yaml
env:
  CI: '1'
  OTA_CHANNEL: production
  OTA_ENVIRONMENT: production
  OTA_PLATFORM: all
```

Ändere die Concurrency-Gruppe zu `expo-update-production`. Richte zuvor die
EAS-Umgebung `production` mit denselben zu den Production-Builds passenden
Variablen ein. Stelle im Production-Build-Profil explizit
`"environment": "production"` ein und installiere Production-Builds auf den
Zielgeräten. Bisherige Preview-Installationen bleiben auf `preview` und erhalten
diese Production-Updates nicht.


## build ios locally

npx expo run:ios --configuration Release

then in xcode -> run on the connected device

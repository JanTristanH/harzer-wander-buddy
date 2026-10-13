# Harzer Wanderbuddy app

This is the React Native app for Harzer Wanderbuddy. The web version used for local Auth0 testing is served by CAP; see [Local web development and Auth0](#local-web-development-and-auth0).

## Local development profiles

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

### Local web development and Auth0

For web login, serve the static Expo export through CAP. Do not use `npx expo start --web` for this flow: Auth0's local callback is registered for the CAP URL, not Expo's development-server URL. Follow the [CAP React Native Web instructions](../backend/hwb/README.md#react-native-web-via-cap).

After editing files under `app/`, rebuild and copy the web export again:

```bash
./scripts/build-and-copy-rnweb.sh
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


## build ios locally

npx expo run:ios --configuration Release

then in xcode -> run on the connected device

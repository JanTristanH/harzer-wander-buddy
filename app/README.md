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
      "backendUrl": "http://localhost:4004", => change to remote url when deploying
      "auth0Domain": "dev-ijucl08spdudaszc.us.auth0.com",
      "auth0ClientId": "Pf0WY4b3Q2yu6CllOGaZC4RIlolcd4xh", => legacy fallback
      "auth0ClientIdNative": "Pf0WY4b3Q2yu6CllOGaZC4RIlolcd4xh", => needs to be a native app
      "auth0ClientIdWeb": "YOUR_WEB_CLIENT_ID", => needs to be a SPA app
      "auth0Audience": "https://app.harzer-wander-buddy.de/api/v2/",
      "auth0Scope": "openid profile email offline_access",
      "auth0LogoutReturnPath": "auth/logout",
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
````

npx eas update --channel preview --platform android --message "Message"


## build ios locally

npx expo run:ios --configuration Release

then in xcode -> run on the connected device

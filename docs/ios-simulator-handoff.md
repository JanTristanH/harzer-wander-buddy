# Übergabe zum iOS Simulator

Stand: 16. November 2026. Die App ist auf dem lokalen iPhone-18-Pro-Simulator
installiert und startet nach einer UIScene-Korrektur. Stempelstellenansicht und
Navigation zum Login wurden geprüft. Die Anmeldung wurde nicht abgeschlossen.

## Repository und Änderungen

- Projektroot: `/Users/tristan.heisecke/git/xprivat/harzer-wander-buddy`.
- Branch: `fix/ios-scene-lifecycle`, von `origin/develop` erstellt.
- Änderungsumfang: `app/app.json` und `app/plugins/with-ios-scene-lifecycle.js`
  sowie diese Übergabe mit README-Link.
- PR [#124](https://github.com/JanTristanH/harzer-wander-buddy/pull/124)
  zum vorherigen SQLite-Installationsfix ist bereits gemergt.
- `app/ios/` ist generiert und ignoriert. Native Korrekturen müssen in der
  Expo-Konfiguration beziehungsweise im Config-Plugin erhalten bleiben.

## Startabsturz und Fix

Der erste Release-Build war erfolgreich, stürzte aber sofort mit
`___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke`
ab. Das Simulator-Log nennt die Ursache:
`UIScene life cycle is required for apps built with this SDK`.
Siehe [Apples Migrationshinweise](https://developer.apple.com/documentation/technotes/tn3187-migrating-to-the-uikit-scene-based-life-cycle).

`app/app.json` registriert jetzt einen SceneDelegate bei deaktivierter
Mehrfenster-Unterstützung. Das Config-Plugin entfernt die Fensteranlage aus dem
generierten AppDelegate und ergänzt den SceneDelegate in derselben Swift-Datei.
Dieser erzeugt ein `UIWindow(windowScene:)`, startet die vorhandene
Expo-React-Native-Factory und leitet URLs, Universal Links und Lebenszyklusereignisse
an den AppDelegate weiter. Cold-/Warm-Deep-Links und SSO sind noch nicht funktional
geprüft.

## Build reproduzieren

Toolchain: Node `26.13.1`, npm `11.20.0`, Xcode unter
`/Applications/Xcode.app/Contents/Developer`, Simulator-SDK `27.2`.
CocoaPods hat 124 Pods installiert.

```bash
cd /Users/tristan.heisecke/git/xprivat/harzer-wander-buddy/app
EXPO_PUBLIC_AUTH_MODE=basic EXPO_PUBLIC_BACKEND_URL=http://localhost:4004 \
  npx expo prebuild --platform ios --no-install
(cd ios && pod install)
EXPO_PUBLIC_AUTH_MODE=basic EXPO_PUBLIC_BACKEND_URL=http://localhost:4004 \
  xcodebuild \
  -workspace ios/HarzerWanderbuddy.xcworkspace \
  -scheme HarzerWanderbuddy -configuration Release -sdk iphonesimulator \
  -destination 'id=40ABA026-2D77-4B89-920B-B4204017F824' \
  -derivedDataPath /private/tmp/hwb-ios-build \
  IPHONEOS_DEPLOYMENT_TARGET=15.1 CODE_SIGNING_ALLOWED=NO build
```

Das Deployment-Target muss für diesen Build explizit gesetzt werden: Xcode 27
lehnt die alten Mindestversionen einiger Pods ab. Der Release enthält sein
JavaScript-Bundle und benötigt keinen Metro-Server. Die App verwendet das lokale
Basic-Backend. Falls es nicht läuft, im separaten Terminal ab Projektroot:

```bash
npm run dev:basic:cap --prefix backend/hwb
```

Für Expo Web gilt ab Projektroot `npm run dev:basic:web --prefix app`;
aus `backend/hwb` lautet der relative Prefix `../../app`.
Der bestehende Backend-Prozess und der vom Benutzer gestartete Metro-Server
wurden nicht beendet. Portbelegung vor Änderungen neu prüfen.

## Simulator und Artefakte

- Host: `local`.
- Device-ID: `40ABA026-2D77-4B89-920B-B4204017F824`.
- Gerät: iPhone 18 Pro, iOS 27.2.
- Bundle-ID: `de.kuestenbit.harzer-wander-buddy`.
- App: `/private/tmp/hwb-ios-build/Build/Products/Release-iphonesimulator/HarzerWanderbuddy.app`.
- Build-Log: `/private/tmp/hwb-ios-build.log`.
- Runtime-Log des ursprünglichen Absturzes: `/private/tmp/hwb-ios-runtime.log`.
- Crashberichte: `~/Library/Logs/DiagnosticReports/HarzerWanderbuddy*.ips`.

Für weitere Gerätesteuerung `device_open` mit Host und Device-ID aufrufen und
den neu gelieferten `agent-device`-Befehl verwenden. Alte Session-Befehle nicht
übernehmen. Installation: `install <Bundle-ID> <App-Pfad>`, Start: `open <Bundle-ID>`.
Eingaben, Screenshots und Deep Links ebenfalls über die Gerätewerkzeuge ausführen;
nicht über `simctl` steuern.

## Offene Punkte und nächste Schritte

1. **Gespeicherte Anmeldung:** Das native Basic-Login zeigt
   „Gespeicherte Anmeldung konnte nicht geladen werden. Bitte erneut anmelden.“
   Ursache ungeklärt. Der Build ist unsigniert (`CODE_SIGNING_ALLOWED=NO`);
   mögliche Keychain-/Entitlement-Probleme prüfen, bevor SecureStore verändert
   wird. Das ist eine Hypothese, kein bestätigter Befund.
2. **Login-Test:** Benutzername aus `AGENTS.md` wurde eingetragen. Passworteingabe
   über `agent-device fill` schlug wiederholt mit `XCTEST_RECORDED_FAILURE` und
   „iOS runner session was invalidated“ fehl. Frische Snapshots und das Schließen
   eines einmaligen iOS-Tastaturhinweises lösten das Problem nicht. Anschließend
   wurde die Gerätesteuerung gemäß Werkzeugvorgabe beendet. Die App lief weiter;
   das Login wurde nicht abgesendet.
3. **Migration absichern:** Anmeldung, Wiederanlauf, Hintergrund/Vordergrund und
   Cold-/Warm-Deep-Links prüfen. Config-Plugin bei weiteren Expo-Änderungen gegen
   einen neuen Prebuild testen. Die generierte Swift-Datei kompiliert;
   `node --check` und `git diff --check` waren erfolgreich.
4. Weitere Änderungen per PR nach `develop` richten und Conventional-Commit-Titel
   verwenden. Keine Zugangsdaten in Dokumentation oder PR übernehmen.

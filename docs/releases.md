# Gitflow und Releases

## Einmalige Einrichtung

- Repository-Secret `RELEASE_PLEASE_TOKEN`: Token eines Release-Bots mit Zugriff auf
  dieses Repository, Contents und Pull requests (write), Issues (write für Labels).
  Bei Fine-grained Tokens zusätzlich Workflows (write), falls ein Release-PR durch
  seine Historie Workflowänderungen enthält. Alternativ den Workflow auf einen
  GitHub-App-Installationstoken umstellen. Nicht durch `GITHUB_TOKEN` ersetzen:
  damit starten auf automatisch erstellten PRs keine CI-Prüfungen.
- `EXPO_TOKEN` als Repository-Secret hinterlegen. EAS-Projekt und native Signierung
  für Android und iOS einmal interaktiv einrichten, bevor CI Builds anfordert.
- EAS-Umgebungen `preview` und `production` samt Maps-Key und Auth-Konfiguration
  pflegen. Preview nutzt derzeit ebenfalls das Produktionsbackend; ein separates
  Staging-Backend benötigt eine eigene URL und Infrastruktur.
- In GitHub `main` und `develop` schützen: PRs, App Jest tests, Backend CAP tests
  und Conventional Commit PR title sowie Release automation tests als Pflichtprüfungen; Force-Push deaktivieren.
- GitHub muss Actions das Erstellen von PRs erlauben. Das GitHub-Environment
  `production` kann für Produktionsbuilds Reviewer verlangen.

## Native Builds über GitHub Actions

Unter **Actions → Native Build → Run workflow** den Branch, die Plattform
(`android`, `ios`, `all`) und das Profil (`preview`, `production`) wählen.
Der Workflow baut genau den ausgewählten Branch/Commit nach erfolgreichen
App-Tests auf EAS. Er ist unabhängig vom Release-Token nutzbar; dafür reicht
`EXPO_TOKEN`. Auf der GitHub-Actions-Seite erscheint der manuelle Workflow erst,
wenn die Workflowdatei auch im Default-Branch `main` vorhanden ist.

Standard ist Android/Preview mit Warten auf das Build-Ergebnis. Android-Preview
liefert ein installierbares APK; Production ist für Store-Binaries vorgesehen.
Bei iOS-Preview brauchen Geräte ein passendes Ad-hoc-Provisioning-Profil.
Mit aktivem Warten schlägt der Job auch bei einem EAS-Buildfehler fehl. Ohne
Warten bestätigt ein grüner Job nur die Annahme der Aufträge. Das Beenden eines
GitHub-Jobs stoppt bereits gestartete EAS-Builds nicht automatisch.
Buildstatus, Logs und Installationslinks stehen im EAS-Schritt. Es erfolgt
keine automatische Store-Einreichung. Das GitHub-Environment des gewählten
Profils kann zusätzliche Freigaberegeln enthalten.

### Expo einmalig vorbereiten

Das Projekt ist in `app.json` bereits mit EAS verbunden; kein neues Projekt
anlegen. Im bestehenden Expo-Konto einen Access Token erstellen und direkt als
Repository-Secret **EXPO_TOKEN** speichern:

**GitHub → Settings → Secrets and variables → Actions → New repository secret**.
Den Token nicht in Dateien oder Chatnachrichten hinterlegen.

Einmal lokal interaktiv anmelden und vorhandene Signierung prüfen/einrichten:

```bash
cd app
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest project:info
npx eas-cli@latest credentials:configure-build --platform android --profile preview
npx eas-cli@latest credentials:configure-build --platform ios --profile preview
npx eas-cli@latest credentials:configure-build --platform android --profile production
npx eas-cli@latest credentials:configure-build --platform ios --profile production
```

Vorhandene Android-Keystores beibehalten, wenn bereits veröffentlichte Apps
aktualisiert werden. iOS-Geräte für interne Builds bei Bedarf vorher mit
`npx eas-cli@latest device:create` registrieren und das Provisioning-Profil
entsprechend einrichten. CI läuft nichtinteraktiv und kann fehlende
Signierungsentscheidungen nicht selbst abfragen.

In den EAS-Umgebungen `preview` und `production` insbesondere
`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` hinterlegen. Backend-URL und Channels sind in
`eas.json` bereits gesetzt. Die native Signierung wird remote über EAS
verwaltet; dafür sind keine Keystore-/Zertifikatsdateien im Git-Repository nötig.

Danach zuerst einen Android-Preview-Build starten und auf einem Gerät prüfen.
Native Builds werden ausschließlich manuell über **Native Build** gestartet.
Der Release-Workflow veröffentlicht Tags und Release-Notizen und erstellt den
Backmerge-PR; er startet keine Production-App-Builds.

Quellen: [EAS aus CI starten](https://docs.expo.dev/build/building-on-ci/),
[Expo-Tokens](https://docs.expo.dev/accounts/programmatic-access/),
[interne Verteilung](https://docs.expo.dev/build/internal-distribution/).

## Release vorbereiten und freigeben

1. Feature-PRs nach `develop` mergen und testen. Feature-PRs per Squash mit
   Conventional-Commit-Titel mergen. OTA auf `develop` bleibt manuell über
   **Actions → Expo OTA Update → Run workflow → Branch develop**.
2. Vor der nächsten Vorbereitung `main` per Merge-PR nach `develop` zurückführen.
   Der Workflow prüft, dass der aktuelle main-Stand enthalten ist.
3. **Actions → Prepare Release → Run workflow → Branch develop** starten.
   Die Versionsvorbereitung läuft ausschließlich manuell auf `develop`, führt
   die Tests aus und lässt Release Please getrennte App-/CAP-Versions-PRs nach
   `develop` erstellen/aktualisieren. Zusätzlich wird der Freigabe-PR
   `develop` → `main` als Entwurf angelegt bzw. ein vorhandener PR aktualisiert.
   Er enthält einen Conventional-Commit-Titel, Versionsübersicht, Changelog,
   Links zu offenen Versions-PRs und den Hinweis auf Merge-Commits.
   Es entstehen noch keine Tags oder GitHub-Releases.
4. Versions-PRs einschließlich Changelogs und Lockdateien prüfen und nach
   `develop` mergen. Alle zur Freigabe gehörenden Komponenten berücksichtigen.
   Danach den Stand testen; bis zur Freigabe keine weiteren Features mergen.
5. Der vorbereitete Freigabe-PR wird nach develop-Pushes und erfolgreichen Tests
   automatisch aktualisiert. Sobald die Versions-PRs gemergt sind und neue
   Versionen vorliegen, wird er zur Prüfung freigegeben. Änderungen an App-/CAP-
   Dateien nach dem Versionsbump setzen ihn zurück auf Entwurf. Zusätzliche
   eigene PR-Notizen bleiben beim Aktualisieren erhalten.
   Den Freigabe-PR prüfen und per **Merge-Commit** mergen; es gibt keinen Auto-Merge.
   Der Commit enthält bereits die neuen Versionen.
6. Google baut/deployt wie bisher bei Änderungen auf `main`. Es gibt keinen
   nachgelagerten Versionscommit auf main und damit keinen zweiten Docker-Build
   wegen eines Versionsbumps.
7. Der Workflow **Releases** prüft den main-Stand und veröffentlicht die bereits
   vorbereiteten Versionen als `app-vX.Y.Z` / `cap-vX.Y.Z`, mit Notizen aus den
   jeweiligen Changelogs. Er schreibt keine Dateien/Branch-Commits. Veröffentliche
   Vorbereitungs-PRs werden als `autorelease: tagged` markiert, damit Release
   Please anschließend die nächste Version vorbereiten kann.
8. Bei einem App-Release werden keine nativen Builds automatisch gestartet.
   Falls eine neue Runtime oder Store-Binary benötigt wird, **Native Build**
   manuell mit dem gewünschten Profil und Branch `main` starten.
9. Nach erfolgreicher Veröffentlichung erstellt/aktualisiert **Releases**
   automatisch den Backmerge-PR `main` → `develop`, sofern main dort noch nicht
   integriert ist. Der Link steht in der Job-Zusammenfassung. Diesen PR prüfen
   und **per Merge-Commit mergen, nicht squashen**. Es gibt keinen Auto-Merge.
   Dadurch werden die Release-Tags in der develop-Historie erreichbar. Erst dann
   die nächste Release-Vorbereitung starten. Der Backmerge-PR wartet nicht auf
   native EAS-Builds; bei fehlgeschlagener Release-Veröffentlichung wird er
   nicht erzeugt. Er verwendet das vorhandene `RELEASE_PLEASE_TOKEN`, damit
   die normalen PR-Prüfungen starten.

App-Änderungen auf `main` veröffentlichen weiterhin automatisch ein OTA auf
`preview`. Es erfolgen kein automatisches Produktions-OTA und keine automatische
Store-Einreichung. Google-Deployment, OTA und Release-Veröffentlichung laufen
unabhängig voneinander; ein fehlgeschlagener GitHub-Job stoppt Google nicht.

### Wiederholungen und Fehler

- **Prepare Release** erneut auf `develop` starten, um offene Versions-PRs zu
  aktualisieren. Ist ein Versions-PR bereits gemergt, zunächst diesen Stand über
  main veröffentlichen; Release Please wartet solange auf dessen Tag.
- **Releases** nur auf `main` starten. Ein erneuter Lauf kann eine unterbrochene
  Veröffentlichung ergänzen. Vorhandene Tags werden nicht verschoben.
- Ein Wiederholungslauf veröffentlicht fehlende Tags/Releases und aktualisiert
  den Backmerge-PR. Native Builds werden dabei nicht gestartet.
- Manifest, package.json und die beiden Versionsfelder der Lockdatei müssen
  zusammenpassen. Neue Versionen ohne passende Changelog-Notizen werden abgelehnt.
- Nachträgliche Features nach dem Versionsbump vermeiden: Die Automatik prüft
  Versionen und Notizen, ersetzt aber keine inhaltliche Release-Abnahme.
- Hotfixes benötigen ebenfalls eine vorbereitete Version vor dem Merge nach
  main. Der Vorbereitungsworkflow unterstützt aktuell `develop`; ein direkter
  Hotfix-Merge nach main deployt weiterhin über Google, erzeugt ohne vorbereitete
  neue Version aber keinen neuen Komponenten-Release.

### Einmaliger Umstieg

Diesen Infrastruktur-PR zuerst nach `develop` und anschließend nach `main`
übernehmen. Erst danach ist **Prepare Release** im Actions-Menü sichtbar.
Die bestehenden Ausgangsversionen ohne Komponenten-Changelog werden dabei
nicht rückwirkend veröffentlicht. Anschließend main zurück nach develop führen
und die erste echte Version mit **Prepare Release** vorbereiten.

## Versionen und OTA-Kompatibilität

- App startet mit `1.5.3`, CAP mit `2.6.0`; das Manifest hält die Startwerte fest.
- Der Bootstrap-Commit ist der main-Stand vor Einführung der Automatik. Historische
  Tags ohne Komponentenpräfix werden nicht als App-/CAP-Releases interpretiert.
  Alte Commits ohne Conventional-Commit-Format erzeugen keinen Versionsbump;
  bei der ersten Vorbereitung die Vorschläge und Changelogs prüfen.
- `app/package.json` ist die Quelle der sichtbaren Expo-Version. `app.config.ts`
  übernimmt sie; `app.json` enthält keine zweite Versionsangabe.
- EAS verwaltet Android-versionCode/iOS-buildNumber remote und erhöht sie bei
  Preview- und Produktionsbuilds. OTA-Veröffentlichungen erhöhen sie nicht.
- `runtimeVersion.policy = fingerprint` trennt native Kompatibilität von SemVer.
  Der Wechsel von appVersion erfordert neue installierte Binaries. Bestehende
  appVersion-Builds erhalten keine neuen fingerprint-Updates. Auch bei späteren
  Fingerprint-Änderungen ist ein neuer nativer Build erforderlich.
- `app/fingerprint.config.js` nimmt mit `ExpoConfigVersions` die App-Version,
  Android-versionCode und iOS-buildNumber vom Fingerprint aus. Reine
  Versionsbumps durch Release Please erzeugen damit keine neue Runtime. Native
  Konfiguration und Abhängigkeiten bleiben Teil der Kompatibilitätsprüfung.
  `app.config.ts` liest die JSON-Dateien als Daten statt über `require()`, damit
  diese nicht zusätzlich unnormalisiert als Config-Plugin-Quellen gehasht werden.
- Die Einführung dieser Fingerprint-Konfiguration erzeugt einmalig eine neue
  Runtime. Nach diesem Release einen neuen Android-Preview-Build von `main`
  erstellen und installieren. Alte APKs (einschließlich 1.7.0) wechseln nicht
  per OTA auf diese Runtime; spätere kompatible OTAs können über Release-
  Versionsgrenzen hinweg empfangen werden.
- Build und OTA müssen dieselben EAS-Umgebungswerte verwenden, insbesondere
  für native Konfiguration wie den Google-Maps-Key.

- Expo-SDK- und SAP-CDS-Abhängigkeiten werden separat aktualisiert.

Quelle: [Expo Fingerprint](https://docs.expo.dev/versions/v54.0.0/sdk/fingerprint/).

## Docker

Das Root-Dockerfile verwendet `https://app.harzer-wander-buddy.de` als Standard
für `EXPO_PUBLIC_BACKEND_URL`. Der bestehende Google-Trigger benötigt daher keine
Buildargumente. Andere Umgebungen können die URL per `--build-arg` überschreiben;
ein explizit leerer Wert wird weiterhin abgelehnt. Der Tests-Workflow prüft den
vollständigen Docker-Build ohne Buildargumente auf PRs, `develop` und `main`,
veröffentlicht aber keine Images.

Der Release-Job benötigt `pull-requests: write`, um nach erfolgreicher
Veröffentlichung die Labels der Versions-PRs auf `autorelease: tagged` zu setzen.
Fehlt diese Berechtigung, können Tags/Releases bereits veröffentlicht sein,
während der Job beim Labeln mit HTTP 403 abbricht. Nach Übernahme des Fixes kann
**Releases** auf `main` erneut gestartet werden; vorhandene Tags bleiben erhalten.

Der alte tagbasierte GitHub-Docker-Workflow ist entfernt. Googles vorhandener
main-Trigger bleibt zuständig; seine Konfiguration wird durch diesen PR nicht
geändert. Versionsbumps werden vorab auf develop gemergt und gemeinsam mit den Features
nach main übernommen. Tags und GitHub-Releases ändern main nicht und lösen
daher keinen zusätzlichen branchbasierten Google-Build aus. Deployments erfolgen
weiterhin auf jedem main-Stand, nicht nur beim Erstellen eines CAP-Tags.

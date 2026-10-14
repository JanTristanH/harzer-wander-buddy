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
  und Conventional Commit PR title als Pflichtprüfungen; Force-Push deaktivieren.
- GitHub muss Actions das Erstellen von PRs erlauben. Das GitHub-Environment
  `production` kann für Produktionsbuilds Reviewer verlangen.

## Täglicher Ablauf

1. Feature/Fix von aktuellem `develop` abzweigen, PR nach `develop` erstellen.
2. Conventional-Commit-Titel verwenden und per Squash mit diesem Titel mergen.
   `feat(app): …` bedeutet Minor, `fix(cap): …` Patch, `feat(cap)!: …` Major.
   Die geänderten Dateipfade entscheiden über betroffene Release-Komponenten.
3. Jeder App-Push auf `develop` veröffentlicht nach App-Tests ein Preview-OTA für
   beide Plattformen. Bei neuer nativer Runtime zunächst Preview-Binaries bauen:
   `cd app && npx eas build --platform all --profile preview`.
4. Für eine Freigabe PR `develop` → `main` erstellen, z. B.
   `chore: promote develop to main`. Per Merge-Commit mergen, nicht squashen.
5. Google baut/deployt weiterhin bei Änderungen auf `main` das Docker-Image.
   Release Please erzeugt nach erfolgreichen Tests getrennte Release-PRs für App
   und CAP. Diese prüfen und mergen; dadurch entstehen Changelogs, Versionsbumps
   einschließlich Lockdateien sowie Tags `app-vX.Y.Z` und `cap-vX.Y.Z`.
6. Ein App-Release startet im selben Workflow Produktionsbuilds für Android und
   iOS. EAS erhöht die Buildnummern. Der Workflow wartet nur auf die Annahme der
   Buildaufträge; Ergebnisse und Store-Einreichung anschließend in EAS prüfen.
   Es erfolgt keine automatische Store-Einreichung und kein Produktions-OTA.
7. `main` einschließlich Release-Commits per Merge-PR zurück nach `develop`
   führen, z. B. `chore: sync main into develop`.

Hotfixes starten auf `main` und gehen per PR dorthin zurück. Danach ebenfalls
`main` nach `develop` mergen. Für längere Abnahmen kann ein `release/*`-Branch
von `develop` erstellt werden; Korrekturen nach der Freigabe zurückführen.

## Versionen und OTA-Kompatibilität

- App startet mit `1.5.3`, CAP mit `2.6.0`; das Manifest hält die Startwerte fest.
- Der Bootstrap-Commit ist der main-Stand vor Einführung der Automatik. Historische
  Tags ohne Komponentenpräfix werden nicht als App-/CAP-Releases interpretiert.
  Alte Commits ohne Conventional-Commit-Format erzeugen keinen Versionsbump;
  bei der ersten Freigabe die Vorschläge prüfen und bei Bedarf mit dem von
  Release Please unterstützten `Release-As`-Footer bewusst initialisieren.
- `app/package.json` ist die Quelle der sichtbaren Expo-Version. `app.config.ts`
  übernimmt sie; `app.json` enthält keine zweite Versionsangabe.
- EAS verwaltet Android-versionCode/iOS-buildNumber remote und erhöht sie bei
  Preview- und Produktionsbuilds. OTA-Veröffentlichungen erhöhen sie nicht.
- `runtimeVersion.policy = fingerprint` trennt native Kompatibilität von SemVer.
  Der Wechsel von appVersion erfordert neue installierte Binaries. Bestehende
  appVersion-Builds erhalten keine neuen fingerprint-Updates. Auch bei späteren
  Fingerprint-Änderungen ist ein neuer nativer Build erforderlich.
- Expo-SDK- und SAP-CDS-Abhängigkeiten werden separat aktualisiert.

## Docker

Der alte tagbasierte GitHub-Docker-Workflow ist entfernt. Googles vorhandener
main-Trigger bleibt zuständig; seine Konfiguration wird durch diesen PR nicht
geändert. Der CAP-Versionsbump auf main löst damit ebenfalls den bestehenden
Google-Build aus. Deployments erfolgen weiterhin auf jedem main-Stand, nicht
nur beim Erstellen eines CAP-Tags.

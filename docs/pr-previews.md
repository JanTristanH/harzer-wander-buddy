# PR-Previews auf GCP

Der Workflow **PR Preview** baut für jeden Commit eines offenen PRs mit dem Label
**`preview`** ein Docker-Image
mit CAP und Expo Web, deployt es auf Cloud Run und baut anschließend eine
installierbare Android-APK mit genau dieser Backend-URL. Kein EAS-Konto oder
Expo Go erforderlich. Beispiel: [PR #65](https://github.com/JanTristanH/harzer-wander-buddy/pull/65)
aus `codex/abzeichenalbum` nach `develop`.

## Ergebnis und Verhalten

- Dienst: fest `hwb-pr-65`; eine stabile HTTPS-URL pro PR von Cloud Run.
- Web: `<Cloud-Run-URL>/app/rnweb`; API: `<Cloud-Run-URL>/odata/v4/api`.
- Live-URL, APK-Download und Workflow-Link stehen nach dem Build direkt in einem
  automatisch aktualisierten Abschnitt der PR-Beschreibung. Der übrige Text bleibt
  erhalten. Veraltete Runs überschreiben keine Links eines neueren PR-Commits.
- APK im GitHub-Actions-Artefakt des gleichen Runs; der Link steht in der
  Job-Zusammenfassung. ZIP herunterladen, entpacken und `preview.apk` installieren.
  GitHub-Anmeldung mit Repository-Zugriff erforderlich; Aufbewahrung 14 Tage.
- `preview.json` neben der APK enthält PR, Commit, Backend-URL, Image-Digest und
  APK-SHA256. `<Cloud-Run-URL>/app/rnweb/preview.json` zeigt den Backend-Commit.
- Je PR eigene Android-App-ID (`de.kuestenbit.harzerwanderbuddy.preview.pr65`),
  Name `HWB PR 65`, keine OTA-Updates. Mehrere PRs können parallel zur normalen
  App installiert werden. Eine neuere APK desselben PRs ersetzt dessen alte APK.
- HTTPS-Basic-Login mit dem Testkonto aus [AGENTS.md](../AGENTS.md), kein Auth0.
  Die öffentliche URL und das bekannte Testkonto sind nur für Testdaten gedacht.
- SQLite auf dem flüchtigen Container-Dateisystem, initialisiert mit allen vorhandenen
  CAP-Dummy-CSV-Dateien aus `backend/hwb/db/doNotDeploy-data`. Das Preview-Image
  kopiert diese nach `db/data` und importiert sie bereits beim Docker-Build in
  `preview-seed.sqlite`. Der Kaltstart kopiert diese Datenbank nach `/tmp`, statt
  die großen CSV-Dateien unter dem 1-GiB-Limit erneut zu importieren. Die Quelldateien
  bleiben unverändert. Keine lokale `db.sqlite` oder Produktions-DB-Anbindung wird
  übernommen. Daten gehen beim Neustart
  verloren. Ein Cloud-Run-Dienst pro PR mit maximal einer Instanz, Skalierung auf null im Leerlauf.
- Vor dem Cloud-Deployment prüft `check-pr-preview-container.sh` den gebauten
  Container unter 1 GiB RAM und 1 CPU einschließlich Web-Route, Login und SQLite.
  Der Image-Build erlaubt dem einmaligen CSV-Import 2 GiB Node-Heap; diese höhere
  Grenze wird nicht in die Laufzeitkonfiguration übernommen.
- Das Deployment startet deaktiviert mit `--scaling=0` und ohne Startup-Healthcheck.
  Erst nach erfolgreichem APK-Build aktiviert der Workflow automatische Skalierung
  mit `min=0, max=1` und prüft die Live-App. Bei APK-Fehlern bleibt der neue Dienst
  deaktiviert. Request-basierte Abrechnung (`--cpu-throttling`) und deaktivierter
  CPU-Boost halten die Kosten niedrig; es wird keine Instanz dauerhaft vorgehalten.
- Neue Commits ersetzen das Backend im selben Dienst und unter derselben URL.
  Ältere APKs dieses PRs verwenden deshalb ebenfalls das neueste Backend; ihre
  ursprüngliche Commit-/Image-Zuordnung im Manifest ist keine dauerhafte Bindung
  an eine unveränderte Serverversion. Zum Testen die aktuelle APK verwenden.
  Die Preview ist kein Ort für dauerhafte Daten. Beim Schließen/Mergen oder
  Entfernen des Labels wird der Dienst gelöscht. Container-Images bleiben im
  Registry-Speicher (siehe Aufräumen).
- Migration: Vor dem Deployment entfernt der Workflow alle alten, durch ihn
  verwalteten Dienste dieses PRs mit Commit-Suffix. Ein bereits vorhandener
  stabiler Dienst bleibt bestehen und wird aktualisiert. Nach dem Deployment
  prüft der Workflow, dass genau ein verwalteter Dienst für den PR vorhanden ist.
  Alte APKs mit Commit-URLs benötigen einmalig eine neue APK mit der stabilen URL.
  Während Deployment und APK-Build bleibt der stabile Dienst deaktiviert; nach
  erfolgreichem Build wird er wieder aktiviert.
- Fork-PRs werden übersprungen. Es wird `pull_request`, niemals
  `pull_request_target` zum Ausführen von PR-Code verwendet.

## Preview gezielt ein- und ausschalten

Ohne Label gibt es bei normalen PR-Pushes **keinen Docker-/APK-Build und kein
Deployment**. Das Label `preview` am gewünschten PR hinzufügen, um einmalig und
bei jedem weiteren Push zu bauen. Das Label entfernen, um alle Cloud-Run-Dienste
dieses PRs zu löschen und weitere automatische Deployments zu verhindern.
Schließen/Mergen räumt unabhängig vom Label auf.

```bash
# Label einmal im Repository anlegen (alternativ über GitHubs Oberfläche):
gh label create preview --color 0E8A16 --description 'PR-Preview mit Live-App und APK' --force
gh pr edit 65 --add-label preview
gh pr edit 65 --remove-label preview
```

Alternativ **Actions → PR Preview → Run workflow**: PR-Nummer und Aktion
`deploy` oder `remove` wählen. Ein manueller Start benötigt kein Label und löst
ohne Label auch keine automatischen Builds bei weiteren Pushes aus. Bei einem
manuellen `remove` bleibt ein vorhandenes Label erhalten; für dauerhaftes Abschalten
also zusätzlich das Label entfernen. Der manuelle Start ist erst verfügbar, wenn
die Workflow-Datei im Default-Branch existiert.

Die Repository-Variable `GCP_PREVIEW_PROJECT_ID` bleibt die globale Freigabe:
ohne sie startet kein Preview-Job, auch kein Cleanup. Deshalb zum Abschalten
zuerst bestehende Previews entfernen und erst danach die Variable löschen.

`max=1` bedeutet eine Obergrenze, keine dauernd laufende Instanz. Ein vollständig
deaktivierter Cloud-Run-Dienst verwendet **manuelle Skalierung 0**, nicht
`--max-instances=0`. Nach Aktivierung fährt `min=0, max=1` bei Bedarf von null
hoch und im Leerlauf wieder herunter. Startup, Anfragen, Builds, Artefakte und
Registry-Speicher können weiterhin Kosten verursachen. Das Maximum gilt je
PR-Dienst; mehrere gleichzeitig getestete PRs haben eigene Limits.
Siehe [Cloud Run: manuelle Skalierung](https://docs.cloud.google.com/run/docs/configuring/services/manual-scaling).

## Geführte Einrichtung auf deinem Rechner

Starte aus dem Repository den deutschsprachigen Assistenten:

```bash
bash scripts/setup-pr-previews.sh
```

Er führt durch die folgenden Abschnitte: lokale Werkzeuge, GitHub-/GCP-Anmeldung,
Projekt und Billing, GCP-Ressourcen, GitHub-Environment, Android-Signatur und
optionalen Maps-Key. Zum Schluss setzt er die fünf Repository-Variablen mit
`gh`; `GCP_PREVIEW_PROJECT_ID` setzt er zuletzt, um neue Previews zu aktivieren.
Vor Änderungen fragt er nach. Er startet keinen Build und merged oder pusht
keinen Branch. Für die Ausführung brauchst du GCP-Administrationsrechte im
Preview-Projekt und GitHub-Adminrechte für das Repository.

Nur die lokalen Voraussetzungen prüfen (ohne Anmeldung oder Cloud-Änderungen):

```bash
bash scripts/setup-pr-previews.sh --check
```

Fehlende Werkzeuge zeigt der Assistent mit Installationsbefehlen für Homebrew an
und bietet bei vorhandenem Homebrew die Installation nach Bestätigung an.
Docker und Android SDK sind für die Einrichtung nicht nötig; gebaut wird später
in GitHub Actions. Das GCP-Projekt und die Billing-Verknüpfung legst du bei Bedarf
über die angezeigten Console-Links an. Der Assistent prüft danach aktives Billing
und zeigt dir den Hinweis zum Budget an. Bestehende GitHub-Environment-Schutzregeln
bleiben erhalten und müssen im Browser auf passende Freigaben/Branches geprüft werden.

Vorhandene Android-Signatur-Secrets bleiben erhalten. Fehlt die Signatur, fragt der
Assistent nach einem dauerhaften Keystore-Pfad **außerhalb des Repositorys** und
einem verdeckt eingegebenen Passwort. Einen vorhandenen Preview-Keystore kannst
du dort wiederverwenden; einen neuen erzeugt er erst nach Bestätigung. Keystore
und Passwort separat sicher aufbewahren. Bei einer unvollständigen bestehenden
Signaturkonfiguration verlangt er den bisherigen Schlüssel. Secrets werden über
Standardeingabe an `gh` übergeben und nicht als Befehlsargument gespeichert.

Bei einem Abbruch denselben Assistenten erneut starten; GCP-Setup und vorhandene
Signatur werden wiederverwendet. Bereits ausgeführte Schritte werden nicht
zurückgerollt. Bei schon aktiven Previews keine parallelen Builds während einer
Umkonfiguration laufen lassen. Optional kannst du `PROJECT_ID`, `REGION` und
`GITHUB_REPOSITORY` als Vorgaben exportieren; es wird keine lokale Passwort- oder
Konfigurationsdatei geschrieben. Die einzelnen manuellen Schritte stehen im Folgenden.

## 1. Ein eigenes GCP-Projekt vorbereiten

Ein separates Preview-Projekt mit aktiviertem Billing verwenden. Dadurch bleiben
Preview-IAM, öffentlich erreichbare Testdienste und Ressourcen von Produktion
getrennt. Der Runtime-Service-Account erhält keine Projektrollen. Der
Deploy-Service-Account darf Cloud Run verwalten, in das Preview-Repository pushen
und nur den Preview-Runtime-Account verwenden. GitHub authentifiziert sich über
OIDC / Workload Identity Federation, ohne heruntergeladenen GCP-Schlüssel.

Auf deinem Rechner oder in Google Cloud Shell mit `gcloud`, `gh` und einem
angemeldeten GCP-Administrator aus dem Repository ausführen:

```bash
export PROJECT_ID='DEINE-PREVIEW-PROJEKT-ID'
export REGION='europe-west3'
export GITHUB_REPOSITORY='JanTristanH/harzer-wander-buddy'
export GITHUB_REPOSITORY_ID=$(gh api "repos/$GITHUB_REPOSITORY" --jq .id)
bash scripts/setup-gcp-pr-previews.sh
```

Das Skript aktiviert APIs, erstellt Artifact Registry, zwei Service-Accounts und
den OIDC-Provider. Es ist erneut ausführbar und verwendet überall explizit das
angegebene Projekt. Es erstellt kein Projekt und verknüpft kein Billing-Konto.
Es braucht entsprechend Rechte zum Aktivieren von APIs und Verwalten von IAM,
Service-Accounts, Workload Identity Pools und Artifact Registry.

Der OIDC-Provider akzeptiert nur die numerische Repository-ID, das GitHub-
Environment `pr-preview` und `.github/workflows/pr-preview.yml` aus diesem Repo.
Verwende diesen Pool nur für dieses Repository. Änderungen an diesem Workflow
und PRs aus dem eigenen Repository sind damit vertrauenswürdig auszuführender
Code innerhalb des isolierten Preview-Projekts.

Cloud Run muss öffentliche Aufrufe erlauben. Wenn die Organisation öffentliche
IAM-Bindings oder externe Ingress-Verbindungen verbietet, schlägt
`--allow-unauthenticated` fehl; die GCP-Administration muss die entsprechende
Ausnahme für dieses Preview-Projekt freigeben. Keine Produktionsrichtlinie lockern.

## 2. GitHub einstellen

Unter **Settings → Environments** das Environment **`pr-preview`** anlegen.
Für automatische Previews keine verpflichtende Freigabe konfigurieren und die
Deployment-Branch-Regeln so setzen, dass PR-Refs und der Demo-Branch erlaubt sind.
Der Environment-Name muss exakt stimmen, da er Bestandteil des OIDC-Subjects ist.

Unter **Settings → Secrets and variables → Actions → Variables** diese
Repository-Variablen mit den vom Setup-Skript ausgegebenen Werten anlegen:

| Variable | Inhalt |
| --- | --- |
| `GCP_PREVIEW_PROJECT_ID` | Eigenes Preview-Projekt |
| `GCP_PREVIEW_REGION` | `europe-west3` oder gewählte Region |
| `GCP_PREVIEW_DEPLOY_SERVICE_ACCOUNT` | `hwb-preview-deploy@PROJECT_ID.iam.gserviceaccount.com` |
| `GCP_PREVIEW_RUNTIME_SERVICE_ACCOUNT` | `hwb-preview-runtime@PROJECT_ID.iam.gserviceaccount.com` |
| `GCP_PREVIEW_WORKLOAD_IDENTITY_PROVIDER` | `projects/NUMMER/locations/global/workloadIdentityPools/github-previews/providers/github` |

`GCP_PREVIEW_PROJECT_ID` muss eine **Repository-Variable** sein, damit die
Startbedingung des Workflows sie vor dem Betreten des Environments lesen kann.
Solange sie fehlt, werden Preview-Jobs übersprungen.

## 3. Android-Testsignatur und Maps-Key

Einmalig einen eigenen Preview-Keystore erstellen. Er wird nur für diese APKs
verwendet; keinen Store-/Produktionsschlüssel hinterlegen. Derselbe Schlüssel
muss für spätere Builds erhalten bleiben, damit Android Updates akzeptiert.
Mit JDK (`keytool`) und GitHub CLI ausführen; das Passwort wird interaktiv gelesen:

```bash
signing_dir=$(mktemp -d)
read -rsp 'Neues Preview-Keystore-Passwort: ' PREVIEW_ANDROID_KEYSTORE_PASSWORD
echo
export PREVIEW_ANDROID_KEYSTORE_PASSWORD
keytool -genkeypair -keystore "$signing_dir/preview.jks" -alias preview \
  -keyalg RSA -keysize 2048 -validity 3650 -dname 'CN=HWB PR Preview' \
  -storepass:env PREVIEW_ANDROID_KEYSTORE_PASSWORD \
  -keypass:env PREVIEW_ANDROID_KEYSTORE_PASSWORD
base64 < "$signing_dir/preview.jks" | tr -d '\n' | \
  gh secret set PREVIEW_ANDROID_KEYSTORE_BASE64 --env pr-preview
printf '%s' "$PREVIEW_ANDROID_KEYSTORE_PASSWORD" | \
  gh secret set PREVIEW_ANDROID_KEYSTORE_PASSWORD --env pr-preview
keytool -list -v -keystore "$signing_dir/preview.jks" -alias preview \
  -storepass:env PREVIEW_ANDROID_KEYSTORE_PASSWORD
# preview.jks vor dem Löschen sicher außerhalb des Repositories sichern.
rm -rf "$signing_dir"
unset PREVIEW_ANDROID_KEYSTORE_PASSWORD
```

Optional für native Karten: Google **Maps SDK for Android** aktivieren und einen
Android-API-Key als Environment-Secret **`PREVIEW_GOOGLE_MAPS_API_KEY`** hinterlegen.
Eine Environment-Variable gleichen Namens wird ebenfalls unterstützt. Wenn beides
gesetzt ist, hat das Secret Vorrang. Nach dem Eintragen muss eine neue APK gebaut
und installiert werden; bestehende APKs übernehmen die Einstellung nicht live.
Den Key auf Maps SDK for Android und die Kombinationen aus Paketname und
SHA-1-Fingerprint des Preview-Keystores beschränken. Für die Demo ist der Paketname
`de.kuestenbit.harzerwanderbuddy.preview.pr65`; bei neuen PRs entsprechende
Paketnamen ergänzen. Der Fingerprint steht in der `keytool -list`-Ausgabe.
Ohne Key baut die APK trotzdem, die vorhandene Karten-Fehlermeldung bleibt sichtbar.
Ein in einer APK eingebetteter Maps-Key ist auslesbar; seine API-/App-Beschränkung
ist daher entscheidend.

Analyse eines sofortigen Android-Kartenabsturzes, Key-Einrichtung und das lokale
Protokoll unter **Profil → Technische Details → Preview-Protokoll**:
[Preview-Diagnose](preview-diagnostics.md). JavaScript-Logs und native
Crash-Berichte sind unterschiedliche Dinge; die Grenzen sind dort dokumentiert.

## 4. Demo mit `codex/abzeichenalbum` / PR #65

1. Den eigenständigen Preview-PR aus `codex/pr-preview-deployments` nach
   `develop` übernehmen. Anschließend `develop` in `codex/abzeichenalbum`
   übernehmen und pushen, damit auch PR #65 die Preview-Dateien enthält.
   Der Preview-PR kann nach der Einrichtung selbst bereits als erster Test dienen.
2. GCP und GitHub wie oben konfigurieren. Solange `GCP_PREVIEW_PROJECT_ID` fehlt,
   gibt es keine Deployment-Versuche.
3. Dem offenen PR #65 das Label `preview` hinzufügen. Dies startet **PR Preview**;
   weitere Commits bauen nur so lange automatisch, wie das Label vorhanden ist.
4. In **Actions → PR Preview** den Run öffnen. Nach **android** und **activate**
   stehen Live-URL und APK-Download direkt in der PR-Beschreibung. Das ZIP
   herunterladen, entpacken und die APK installieren.
5. Web und APK mit dem Testkonto aus `AGENTS.md` anmelden; Profil/Album prüfen.
   Die Deployment-Prüfung prüft bereits Commit-Metadaten, Web-Route, Ablehnung
   anonymer API-Aufrufe, Testlogin und lesbare SQLite-Testdaten.
6. Einen weiteren Commit pushen: gleiche URL, neue Backend-Revision und neue APK.
   Es darf nur `hwb-pr-65` als verwalteter Dienst dieses PRs vorhanden sein. Beim
   Schließen/Mergen von #65 oder Entfernen des Labels muss der Dienst verschwinden.

Nach Übernahme der Workflow-Datei in den Default-Branch steht zusätzlich der
manuelle Start zur Verfügung. Den Branch wählen, der die Preview-Implementierung
enthält; für `deploy` muss `pr` ein offener PR dieses Repositories sein:

```bash
gh workflow run pr-preview.yml --ref codex/abzeichenalbum -f pr=65 -f action=deploy
# Alle Cloud-Run-Dienste dieses PRs entfernen:
gh workflow run pr-preview.yml --ref codex/abzeichenalbum -f pr=65 -f action=remove
```

Ein manuell gestarteter Run verwendet den aktuellen Head des angegebenen PRs,
nicht automatisch den gewählten Workflow-Branch. Dieser PR-Head muss also die
Preview-Dockerdatei und die Skripte enthalten. Für automatische Previews nach
dieser Demo die Implementierung nach `develop` übernehmen. Der bestehende
Google-Trigger für Produktions-Builds von `main` bleibt zuständig für Produktion.

## Betrieb, Kosten und Fehler

Cloud Run skaliert im Leerlauf auf null, ist aber nicht garantiert kostenlos.
Build-Minuten in GitHub Actions, Cloud-Run-Anfragen/Startzeiten und Registry-Speicher
können Kosten verursachen. Im Preview-Projekt ein Budget mit Benachrichtigung
einrichten; ein Budget ist kein hartes Ausgabenlimit. Je aktivem PR bleibt genau
ein Dienst bestehen, bis das Label entfernt oder der PR geschlossen wird.

`cleanup` entfernt alle mit `managed-by=hwb-pr-preview,pr=<Nummer>` markierten
Cloud-Run-Dienste. Images bleiben aktuell in Artifact Registry liegen und können
Speichergebühren verursachen, auch wenn der Dienst gelöscht oder deaktiviert ist.
Nach PR-Schließung die betreffenden Images in **Artifact Registry → hwb-previews
→ pr-65** samt Versionen löschen. Auch Images fehlgeschlagener Deployments bleiben
dort erhalten, wenn der Image-Push bereits erfolgreich war.

Alternativ lässt sich im dedizierten Repository `hwb-previews` eine automatische
Cleanup-Policy einrichten, etwa für Images älter als 14 Tage. Cloud Run importiert
das Image beim Deployment: Das Löschen des ursprünglichen Registry-Images beendet
einen bereits deployten Dienst nicht und verhindert auch dessen Kaltstart nicht.
Ein späteres neues Deployment desselben gelöschten Digests erfordert jedoch einen
erneuten Image-Build/Push. Der Workflow richtet derzeit keine Image-Löschregel ein.
Siehe [Cloud Run: Image-Import](https://docs.cloud.google.com/run/docs/deploying)
und [Artifact Registry: Cleanup-Policies](https://docs.cloud.google.com/artifact-registry/docs/repositories/cleanup-policy).
APK-Artefakte laufen unabhängig davon nach 14 Tagen ab.

Falls ein Cleanup-Run ausfällt oder die Workflow-Datei noch nicht im Default-Branch
verfügbar ist, im Preview-Projekt manuell aufräumen:

```bash
gcloud run services list --project "$PROJECT_ID" --region "$REGION" \
  --filter='metadata.labels.managed-by=hwb-pr-preview AND metadata.labels.pr=65'
# Nur die oben aufgelisteten PR-Dienste löschen, jeweils:
gcloud run services delete DIENSTNAME --project "$PROJECT_ID" --region "$REGION"
```

- **OIDC 403:** Repository-ID, Provider-Pfad, Workflow-Dateipfad und Environment-
  Name prüfen; IAM-Änderungen können einige Minuten bis zur Wirksamkeit brauchen.
- **Cloud Run startet nicht:** Container-Logs prüfen; der Preview-Container muss
  `NODE_ENV=development` und das Basic-Profil verwenden. Keine Produktions-Env-
  Variablen, DB-Bindings oder Auth0-Secrets hinzufügen.
- **Android-Job schlägt fehl:** Die beiden Keystore-Secrets und Alias `preview`
  prüfen. Der Linux-Runner baut arm64-v8a (Handys) und x86_64 (Emulatoren).
  Der erste native Build benötigt deutlich länger als spätere Cache-Builds.
- **APK lässt sich nicht als Update installieren:** Signatur mit dem bisherigen
  Preview-Keystore vergleichen. Nicht ungefragt die vorhandene App deinstallieren.

## Lokale Prüfung ohne Cloud-Zugang

```bash
docker build -f deploy/preview/Dockerfile --build-arg PREVIEW_PR=65 \
  --build-arg PREVIEW_SHA="$(git rev-parse HEAD)" -t hwb-preview:local .
docker run --rm -p 127.0.0.1:8080:8080 hwb-preview:local
# In einem zweiten Terminal:
PREVIEW_URL=http://127.0.0.1:8080 PREVIEW_PR=65 \
  PREVIEW_SHA="$(git rev-parse HEAD)" node scripts/smoke-pr-preview.cjs
```

Für die APK ist `scripts/build-pr-preview-apk.sh` auch lokal ausführbar: frischer
Checkout ohne `app/android`, installierte App-Abhängigkeiten, Android SDK/JDK und
die gleichen Environment-Variablen wie im Android-Job erforderlich. Das Skript
verweigert das Überschreiben eines bestehenden nativen Projekts und seiner Caches.

Stand der Vorbereitung am 29.10.2026: Preview-Docker-Image lokal gebaut und den
laufenden Container mit `smoke-pr-preview.cjs` erfolgreich geprüft. Die 18
Backend-Tests und alle 37 App-Testsuites mit 189 Tests bestehen (App mit frisch
installierten Abhängigkeiten im Web-Build-Container). Workflow mit `actionlint`
geprüft; Shell-Skripte syntaktisch geprüft. Android-Prebuild separat erzeugt und
App-ID, Version, URL-Konfiguration und deaktivierte OTA-Updates geprüft; kein
vollständiger nativer APK-Build und kein Emulator-Test dieses Preview-Flows.
GCP-Ressourcen wurden mangels konfigurierten GCP-Zugangs nicht angelegt; Live-
Deployment, OIDC-Anmeldung und Cleanup müssen nach der Einrichtung erstmals
in GitHub Actions geprüft werden. Die Vorbereitung wurde anschließend auf den separaten Branch
`codex/pr-preview-deployments` übertragen und mit dem aktuellen `develop`
integriert. Die bestehenden Static-Web-Konfigurationen bleiben dabei erhalten.
Am 04.11. wurden die Konfigurationstests einschließlich der Static-Web-Regression,
Workflow-Lint und Shell-Syntax auf dieser Basis erneut erfolgreich geprüft.
Die obigen vollständigen Build-/Testresultate beziehen sich auf die ursprüngliche
Vorbereitung vom 29.10., nicht auf einen erneuten vollständigen Build auf `develop`.

Am 04.11. lief der ursprüngliche Preview-Workflow für Commit `c38f586` erfolgreich
auf GCP und GitHub Actions durch, einschließlich installierbarer Android-APK.
Die anschließenden Änderungen für Opt-in per Label, PR-Beschreibung und den
deaktivierten Start mit späterer Aktivierung sind lokal mit Policy-Tests und
Workflow-Lint geprüft; dieser neue Cloud-Ablauf ist noch separat live zu prüfen.

Für die Umstellung auf die vorhandenen CAP-Dummy-Daten wurden alle zwölf CSV-Dateien
aus `db/doNotDeploy-data` in eine separate SQLite-Datenbank importiert. Die
Zeilenzahlen aller Tabellen stimmen mit CAPs CSV-Parser überein, darunter 222
Stempelstellen, 211 Parkplätze und 4.358 Reisezeit-Datensätze. Die Quelldaten und
vorhandenen lokalen Datenbanken wurden dabei nicht verändert.

# Auswahl der GitHub-Actions-Jobs

Stand: 7. November 2026. Patchbasis: develop `7513b1b90171f7b2706b96fee9e4056f72a92e59`.

## Befund und Nachweise

[PR #121](https://github.com/JanTristanH/harzer-wander-buddy/pull/121) ändert acht Markdown-Dateien: `app/xTODO.md`, sechs Dateien unter `docs/todos/premium-gamification/` und `founder/pricing-strategy.md`. Die vollständige Dateiliste ist als Regressionstest in `.github/ci/pr-121-files.json` festgehalten.

Im [Tests-Lauf](https://github.com/JanTristanH/harzer-wander-buddy/actions/runs/42313542594) liefen Docker build (3:50), App Jest tests (2:21), Backend CAP tests (0:43) und Release automation tests (0:19). Im [statischen Lauf](https://github.com/JanTristanH/harzer-wander-buddy/actions/runs/42313542557) lief static-expo (2:11). Alle erfolgreich; Summe 9:24 Job-Laufzeit. Diese Summe ist weder die parallele Gesamtdauer noch eine Aussage über abgerechnete Minuten.

Ursachen:

- `tests.yml`: alle PRs und Pushes auf develop/main; kein Jobfilter.
- `static-website.yml`: `app/**` trifft auch `app/xTODO.md`.
- `prepare-release.yml`: jeder develop-Push ruft tests.yml zusätzlich auf; danach wird ein bestehender Freigabe-PR aktualisiert. Manuelle Vorbereitung ebenfalls mit Tests.
- `releases.yml`: jeder main-Push bzw. manueller Start ruft tests.yml erneut vor Veröffentlichung auf.
- `expo-update.yml`: main-Push mit `app/**` konnte auch wegen xTODO eine identische OTA veröffentlichen.
- `pr-preview.yml`: automatische Deployments nur bei Preview-Label, gleiches Repository und konfiguriertem GCP-Projekt; bisher ohne Inhaltsfilter. Ein Deployment umfasst Docker und Android-APK. Entfernen/Schließen benötigt weiterhin einen Workflow-Lauf.
- Native Build wird ausschließlich manuell gestartet. PR-Titelprüfung und Public stamp catalogue haben eigene Auslöser; sie bleiben erhalten.

## Umsetzung

`.github/ci/select-jobs.cjs` ist die gemeinsame Auswahlregel. `changes.yml` führt ihre Tests und die Git-Auswertung ohne npm-Installation aus und reicht boolesche String-Outputs weiter. Die teuren Jobs behalten ihre IDs und Anzeigenamen und erhalten ausschließlich `needs`/`if`-Bedingungen. Ihre eigentlichen Test-, Build- und Schutzschritte bleiben erhalten.

Bekannte Dokumentation: Markdown unter `docs/` und `founder/`, `app/xTODO.md` und Dateien namens README.md, CHANGELOG.md oder AGENTS.md. Andere Markdown-Dateien, etwa unter `app/assets/`, werden bewusst weiter geprüft. Neue Dateitypen unter docs/founder werden ebenfalls geprüft. Keine Ableitung aus PR-Titel, Label `docs` oder Commit-Text.

| Änderung | Docker | Backend | App inkl. Fingerprint | Release-Skripte | Statisches Expo | Automatisches Preview* |
| --- | --- | --- | --- | --- | --- | --- |
| Nur bekannte Dokumentation, einschließlich #121 | – | – | – | – | – | – |
| `app/app/(tabs)/map.tsx`, App-Lockfile oder App-Skripte | ✓ | – | ✓ | – | ✓ | ✓ |
| `backend/hwb/srv/service.cds`, Backend-Lockfile oder UI5 im Backend | ✓ | ✓ | – | – | – | ✓ |
| `scripts/prepare-promotion-pr.cjs` (generell scripts/, außer statischem Builder) | – | – | – | ✓ | – | ✓ |
| `scripts/build-static-website.mjs` | – | – | – | – | ✓ | – |
| `.agents/skills/hwb-sites-preview/scripts/prepare-preview.mjs` | – | – | – | – | ✓ | – |
| `deploy/preview/Dockerfile` (generell deploy/) | ✓ | – | – | – | – | ✓ |
| Root-Dockerfile, .dockerignore, Release-Konfiguration, .github/** oder sonstiger unbekannter Pfad | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dokumentation + Code | Vereinigung der zutreffenden Zeilen | | | | | |

\* Weiterhin nur mit Preview-Label, gleicher Repository-Herkunft und eingerichteter Umgebung. Ein ausdrücklich gesetztes `preview`-Label und manuelle Deployments bleiben als bewusste Build-Anforderung unabhängig vom Pfadfilter möglich. Entfernen des Labels, Schließen und manuelles Entfernen bleiben unabhängig von Dateipfaden aktiv. Bei geöffnetem/wieder geöffnetem/aktualisiertem PR wird die gesamte PR-Dateiliste geprüft, nicht nur der letzte Commit. Deshalb kann ein PR mit Codeänderungen nach einem zusätzlichen Dokumentationscommit erneut bauen; die kumulative Auswahl verhindert, dass noch ungeprüfter Code übersprungen wird. Keine Wiederverwendung eines alten Prüfergebnisses.

Bisher liefen bei jedem Beispiel-PR oben alle vier Tests-Jobs. Der statische Build lief zusätzlich bei app/**, dem statischen Builder, hwb-sites-preview/** oder seiner eigenen Workflow-Datei. Nach dem Patch gilt die Tabelle; PR-Titel und gegebenenfalls Public catalogue laufen weiterhin separat. Für #121 bleiben nur die kleinen Auswahl-/Regressionstest-Jobs, `CI result` und die Titelprüfung, gegebenenfalls der kleine Preview-source-Job. Es werden keine fünf teuren Jobs mehr ausgeführt.

## Diff-Grenzen und konservativer Rückfall

PR: vollständiger Drei-Punkt-Diff von Base-SHA zu Head-SHA (Merge-Base). Push: Zwei-Punkt-Diff von `before` zu `after`. Checkout lädt die vollständige Historie; es gibt keine 300-Dateien-Grenze der GitHub-Ereignisfilter. Umbenennungen werden als Entfernen und Hinzufügen behandelt, damit auch der alte Codepfad berücksichtigt wird. NUL-getrennte Pfade werden ohne Shell-Interpolation verarbeitet. Leere Dateiliste, neue Branches, fehlende SHAs, fehlende Historie oder Git-Fehler wählen alle Jobs.

Preview nutzt im bestehenden source-Job die paginierte PR-Dateiliste und bei Umbenennungen auch previous_filename. Ab 3000 Dateien, bei unvollständiger Liste, inzwischen geändertem Head oder API-Fehler wird gebaut. Fork-Sperre, vertrauenswürdiger Workflow-Checkout, Umgebungen, OIDC, Secrets, Cold-start-Prüfung und Provenienz bleiben bestehen. Kein neues pull_request_target und keine zusätzliche Schreibberechtigung.

## Wiederverwendung, Releases und OTA

`tests.yml` hat bei workflow_call `force-full: true` als sicheren Standard. `releases.yml` nutzt ihn weiterhin unverändert: alle vier Prüfungen müssen vor Veröffentlichung bestehen, auch bei einem Dokumentationsrelease. Manuelle Tests-Starts laufen vollständig. Manuelle Prepare-Release-Starts setzen force-full ebenfalls; auf automatischen develop-Pushes wird hingegen nach Diff ausgewählt. Die vorhandene Prüfung, dass main integriert ist, und die Aktualisierung bestehender Freigabe-PRs laufen weiter. Release-, Backmerge-, Versions-, Tag- und Changelog-Logik bleiben erhalten. Doppelte volle Prüfungen bei main-Push und Release-Aufruf werden nicht pauschal abgeschafft; eine erfolgreiche frühere Pipeline wird nicht als Ersatz für den Release-Gate verwendet.

OTA nutzt dieselbe App-Auswahl statt `app/**`. Dokumentationspushes veröffentlichen kein Update; manuelle OTA-Starts führen weiter App-Tests, Tokenprüfung und EAS-Umgebungsprüfung aus. Native Builds bleiben ausdrücklich manuell und führen ihre Tests aus.

## Erforderliche Statuschecks

Kein kompletter Tests- oder Static-Workflow wird wegen eines Pfadfilters unterdrückt. GitHub behandelt übersprungene Jobs als erfolgreich; ein auf Workflow-Ebene übersprungener erforderlicher Check kann dagegen Pending bleiben. Siehe [GitHub: bedingte Jobs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions) und [übersprungene Workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs).

Die bestehenden Namen `Docker build`, `Backend CAP tests`, `App Jest tests`, `Release automation tests` und `static-expo` bleiben erhalten. Der neue, immer ausgewertete `CI result` schlägt bei fehlgeschlagener Auswahl, fehlenden Outputs sowie fehlgeschlagenen/abgebrochenen/unerwartet übersprungenen ausgewählten Jobs fehl. Als Branch-Regel sollte zusätzlich `CI result` erforderlich sein; bestehende Regeln nicht blind ersetzen. Wiederverwendete Aufrufe haben weiterhin den üblichen Präfix des aufrufenden Jobs, etwa `tests / ...`.

Repository-Regeln geprüft: sichtbarer Ruleset 15307314 (`develop`) ist deaktiviert und enthält nur Lösch-/Force-push-Schutz, keine Statuschecks. Klassische Branch-Protection ist über die Integration mit HTTP 403 nicht lesbar. Deshalb sind die tatsächlich erforderlichen Checks nicht vollständig verifizierbar. Vor Aktivierung eines neuen Gate-Namens dessen ersten erfolgreichen PR-Lauf abwarten und die bestehenden Regeln im Repository prüfen. Der Patch verändert keine Branch-Regeln.

## Validierung

```sh
node --test .github/ci/*.test.cjs scripts/*.test.cjs
actionlint -shellcheck= .github/workflows/*.yml
git diff --check
```

73 Tests erfolgreich: 30 neue Auswahl-/Verdrahtungs-/Gate-Fälle plus 43 bestehende Release-/Preview-Tests. Abgedeckt sind die acht echten #121-Pfade, reine und gemischte Dokumentation, App/Backend/Lockfiles/UI5/Fingerprint, unbekannte Dateien, CI-Änderungen, vollständige Overrides, Push-/PR-Diff-Grenzen, echte Git-Umbenennung, problematische Dateinamen, Preview-API-Grenzen/Rennen/Fehler und Gate-Ergebnisse einschließlich fehlender Outputs. Die #121-Dateiliste ist eine feste Fixture, damit Tests nicht von einer dauerhaft vorhandenen PR-Branch abhängen.

Alle Workflow-Dateien bestehen actionlint 1.7.7 (ShellCheck ausgeschaltet); YAML wurde zusätzlich lokal geparst. Die Änderung wurde lokal geprüft, noch nicht auf GitHub ausgeführt. Keine erneuten Docker-, Expo-, App- oder Backend-Builds lokal: deren Befehle wurden nicht geändert. Nach Übernahme auf einem Dokumentations-PR, einem App-PR und einem gemischten PR die tatsächlichen Checks kontrollieren; manuelle Tests müssen alle vier Jobs ausführen. Preview-Label/Entfernen/Schließen in eingerichteter Preview-Umgebung prüfen. Neue Laufzeiten und Kosten erst aus diesen Läufen ableiten; die kleinen Auswahljobs verursachen weiterhin Laufzeit.

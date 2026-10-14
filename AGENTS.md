# Gitflow und Pull Requests

- Feature- und Fix-Branches von `develop` erstellen; PRs nach `develop` richten.
- Jeder PR-Titel muss Conventional Commits entsprechen: `type(scope): Beschreibung`.
  Beispiele: `feat(app): Tourenfilter hinzufügen`, `fix(cap): Gruppenstempel korrigieren`,
  `feat(cap)!: API-Antwort ändern` für inkompatible Änderungen.
- Erlaubte Typen: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `style`, `revert`.
  Scope ist optional; bevorzugt `app`, `cap` oder `release`. `feat` erhöht Minor,
  `fix`/`perf` Patch und `!` beziehungsweise `BREAKING CHANGE` Major.
- Bei Änderungen an der Benutzeroberfläche Screenshots der betroffenen Ansicht erstellen
  und in der PR-Beschreibung einbinden.
- Feature-PRs per Squash mit dem PR-Titel als Commit-Betreff mergen.
- `develop` → `main` und `main` → `develop` per Merge-Commit mergen, damit
  Conventional Commits und gemeinsame Historie erhalten bleiben.
- Hotfixes von `main` abzweigen und nach `main` mergen. Nach jedem Release/Hotfix
  `main` per PR nach `develop` zurückführen (z. B. `chore: sync main into develop`).
- Versionen und Changelogs verwaltet Release Please. Keine manuellen Versionsbumps
  in Feature-PRs. **Prepare Release** manuell auf `develop` starten und die
  Versions-PRs nach `develop` prüfen und mergen. Danach keine weiteren Features
  vor der Freigabe mergen. Prepare Release erstellt/aktualisiert auch den
  Freigabe-PR `develop` → `main`: zunächst als Entwurf, nach gemergten Versions-PRs
  automatisch zur Prüfung. Diesen PR mit den vorbereiteten Versionen per Merge-Commit mergen.
  Auf main nur vorbereitete Tags/Releases veröffentlichen, keine weiteren Versionscommits.
- Google baut und deployt das Docker-Image weiterhin von `main`; keinen zusätzlichen
  Docker-Publish-Workflow anlegen. Details und Einrichtung: `docs/releases.md`.

# Testzugang

Für lokale Tests kann folgender Benutzer verwendet werden:

- Nutzername: `user1@hwb.de`
- Passwort: `user1@hwb.deA`

Diese Zugangsdaten sind ausschließlich für die Testumgebung bestimmt.

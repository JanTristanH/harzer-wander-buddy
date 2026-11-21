# PR #123: Testumgebung und Live-Import nachgeprüft

17. November 2026, Ausgangshead `bcbeda2a622d2a2fb406b6a43447494de031521a`.

Die zunächst gemeldeten Paket-/Netzwerkblocker wurden vom Orchestrator mit regulärer Netzwerkfreigabe behoben: NPM-Registry und Sonatype erreichbar, PR123-Backend-Abhängigkeiten installiert und ladbar (`cheerio` 1.2.0, `proxy-from-env` 1.1.0, `https-proxy-agent` 7.0.6, `sqlite3` 5.1.7). Die PR123-Abhängigkeiten blieben erhalten; für den lokalen SQLite-Installationsfix wurde nur das bekannte `napi-build-utils`-Override aus develop ergänzt. CocoaPods installierte anschließend 124 Pods erfolgreich.

## Backend und tatsächliche Quelle

`node --test --test-concurrency=1 test/*.test.js`: **81 Tests in 15 Suites erfolgreich**. Anschließend separat den echten Live-Import auf einer eigenen In-Memory-Datenbank geprüft; keine produktiven Datenbankänderungen.

Der ursprüngliche Live-Test scheiterte an historischen, explizit auf den 7. November 2026 datierten Meldungszahlen: erwartet 17 zugeordnet/11 offen vor Initialisierung, tatsächlich 11/10. Eine separate Diagnose mit tatsächlichen aktuellen Quelldaten bestätigte nach Initialisierung 20 zugeordnet und nur Brandberg offen. Initialisierung erzeugte unverändert 151 Sonderstempel. Wiederholung blieb idempotent und die synthetische ältere Warnung blieb erhalten.

Der Live-Test prüft nun konkrete Importinvarianten anstelle der historischen absoluten Meldungszahlen: bekannte reguläre Meldungen vorhanden, zusätzliche Zuordnungen nach Sonderstempel-Initialisierung, keine verlorenen Quellmeldungen, exakt 151 initialisierte Sonderstempel, ausschließlich Brandberg weiterhin ungeklärt, Vorschau ohne Schreibwirkung, bestehende Warnung erhalten und gleiche IDs nach wiederholtem Import. Ungeklärte Identitäten und Datenverlust werden weiterhin als Fehler gewertet.

Der geänderte Originaltest besteht: **1 Live-Test erfolgreich**, tatsächliche Zähler im `LIVE_RESULT` protokolliert (11/10 → 20/1, `retainedPrevious=true`, `idempotent=true`). Das ist keine native Abnahme und ändert weder Importcode noch Produktionsdaten. Deterministische fachliche Backend-Tests bleiben unverändert.

## Native Abnahme

Die isolierte Konfiguration `HWB PR 123`, Bundle-ID `de.kuestenbit.harzer-wander-buddy.pr123test`, OTA deaktiviert, wurde erneut geprüft. Der iOS-Build wurde nach erfolgreicher Pod-Installation erneut gestartet. Native Funktionsabnahme folgt separat; aus Paketinstallation oder Backend-Tests wird keine native Merge-Freigabe abgeleitet. Die lokale Simulator-Baseline aus develop und der Basic-Persistenzfix bleiben ausschließlich Testintegration und sind nicht Teil dieses Testkorrektur-Commits.

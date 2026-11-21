# PR #123 – Integration und erneute Abnahme

17. November 2026. Ausgangsstand `db707b40d21aac7f1cdea9d8c0a05d1a41c08ad0`, integriert mit `develop` auf `fc0a0099f0beec2f43f16c62567c30028c00c67b`.

Die Konflikte aus der inzwischen per Squash integrierten Abzeichenarbeit sind aufgelöst. Die Sonderstempel-Identitäten, Themenheft-Verknüpfungen und öffentlichen Katalogfelder bleiben erhalten; aktuelle Profil-, Kronen-, Freundesuche- und Sammelziel-Korrekturen aus develop sind übernommen.

## Automatisierte Prüfung des integrierten Standes

- App: 432 Tests in 81 Suites bestanden.
- Backend: 83 Tests in 16 Suites bestanden.
- CI-/Release-Skripte: 74 Tests bestanden.
- Liveprüfung der offiziellen Sonderstempelquelle: 1/1 bestanden, inklusive Wiederholungsimport und Erhalt bestehender Warnungen. Quellabgleich vom 17. November 2026; Ergebnisse sind zeitabhängig.
- TypeScript und gezieltes ESLint bestanden.
- PostgreSQL-DDL erfolgreich kompiliert; kein externer Datenbankzugriff und keine produktive Migration.
- Containerquellpaket enthält `db/init.js`; der normale Deploy initialisiert die Sperrzeilen `official` und `special-catalog` außerhalb des gelöschten Fixture-Verzeichnisses `db/data`. Die lokalen Backend-Integrationstests prüfen den expliziten, serialisierten und wiederholbaren Import.

- Vollständiger Expo-Webexport bestanden. Eine erneute saubere Installation der im Lockfile fixierten Pakete behob zuvor eine lokale Metro-Modulauflösungsstörung; keine Paketversion wurde verändert.

Die native Abnahme einschließlich der Root-Nachprüfung des Kartenfixes ist in [pr123-native-merge-ready.md](pr123-native-merge-ready.md) dokumentiert. Die geprüften Kernabläufe sind erfolgreich; die Grenzen lokaler Besuche und der bereits befüllten Katalogdatenbank bleiben ausdrücklich ausgewiesen. Frühere Simulatorberichte werden nicht als zusätzlicher Nachweis dieses integrierten Standes umgedeutet.

## Rollout

Vor produktiver Nutzung das neue Datenbankschema regulär migrieren und sichern; der Katalogimport bleibt eine ausdrückliche Admin-Aktion. Neue Bild-URLs setzen die Veröffentlichung der Website-Bilder und Credits aus Website-PR #11 voraus. Das ist ein Rollout-Schritt, keine Behauptung einer bereits erfolgten Veröffentlichung.

Unbestätigte Koordinaten und fünf redaktionell unvollständige Themenhefte bleiben absichtlich eingeschränkt beziehungsweise unveröffentlicht. Ein Sonderbesuch erhöht nicht den regulären Bronze-Fortschritt.

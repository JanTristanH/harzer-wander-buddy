# PR120: develop-Konflikt aufgelöst

17.11.2026. PR-Basis a50109b2580d51a062054f180e6d5b5a77705e04, integriertes develop bafddb5fdcc6976e6f9bca974854d6f5431bd746.

Einziger Konflikt: backend/hwb/package-lock.json, napi-build-utils. Version 2.0.0 und Integrität aus develop übernommen, dev:true erhalten, weil SQLite in diesem PR Entwicklungsabhängigkeit ist. Manifest enthält den develop-Override ^2.0.0. Lockfile mit npm install --package-lock-only --ignore-scripts normalisiert; keine weiteren Paketupdates. Anschließend npm ci erfolgreich. Node26 meldet vorhandene Engine-Warnungen älterer SAP-HDI-Pakete.

- Backend: node --test --test-concurrency=1 test/*.test.js, 44/44 bestanden.
- App: sieben gezielte Suites zu Auth-/Cache-Hydration, Offline-Startup, Connectivity, Core-Sync, Profilcache, Startup-Bridge und Routen, 33/33 bestanden.
- Echter lokaler PostgreSQL-Server, ausschließlich temporäre Datenbank pr120 auf 127.0.0.1:55420. Produktionsmodell kompiliert; startProduction deployte das Schema erfolgreich vor einem prüfenden Serve-Callback. Datenbankidentität und Stempel-Tabelle bestätigt. Bereits-migrierter Start mit deployOnStart:false und SQL-Abfrage ebenfalls bestanden. Erster Testoverride ließ dialect aus und erzeugte falsches SQL; mit ausdrücklich postgres korrigiert. Kein Produktfehler daraus abgeleitet.
- PostgreSQL nach Prüfung regulär beendet. Daten unter /private/tmp/hwb-pr120-postgres-data bleiben als isoliertes Testartefakt erhalten.

Kein vollständiger HTTP-Produktionsstart, Docker-Build, echtes Geräte-Offlineszenario oder Hosted-Test. Keine Produktionsfreigabe. Aktuelle develop-UIScene-/SQLite-Baselines sind nun tatsächlich integriert; kein neuer nativer Build in dieser Konfliktkorrektur. Vorhandene Simulatorberichte bleiben unverändert.

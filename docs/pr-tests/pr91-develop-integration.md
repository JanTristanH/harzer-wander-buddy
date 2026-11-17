# PR91: develop-Integration

17.11.2026. Head fea5fa5e16f89730b7df090d8cca4d8081112c46 mit develop bafddb5fdcc6976e6f9bca974854d6f5431bd746 konfliktfrei zusammengeführt. UIScene-/Fingerprint-Baseline und SQLite-Installeroverride tatsächlich integriert; Tourenlogik unverändert.

App und Backend frisch per npm ci installiert. Backend 58/58 Tests bestanden, einschließlich Tourautomatisierung/API, Geometrie und Routengültigkeit. App 32 gezielte Suites zu Touren, GPX, Zeitwahl, Gruppen, Offline und Konfiguration: 168/168 bestanden. Die vorhandene Zeitwahlregression prüft die obere 720-Minuten-Grenze rechnerisch; dies ersetzt keinen nativen Gestentest.

Kein neuer nativer Build, keine Hosted-/Produktionsänderung. Native obere Gestengrenze sowie produktiver Schema-/API-Rollout bleiben außerhalb dieser Integrationsabnahme.

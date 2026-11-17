# PR89: develop-Integration

17.11.2026. Head f6fa0bf8b2b7c519c2432fb0d1049d19992518e1 mit develop bafddb5fdcc6976e6f9bca974854d6f5431bd746 konfliktfrei zusammengeführt. UIScene-/Fingerprint-Baseline und SQLite-Installeroverride sind nun tatsächlich enthalten; keine Meldungslogik überschrieben.

App und Backend jeweils frisch per npm ci aus dem Branch-Lockfile installiert. Backend 42/42 Tests bestanden, einschließlich Meldungen, offizieller Abruf, Gruppen und Offline-Stempeln. App: 23 gezielte Suites zu Meldungen, Gruppen, Offline, Basic-Auth und Konfiguration, 122/122 Tests bestanden.

Kein neuer nativer Build, kein externer Live-Import und keine Hosted-/Produktionsänderung. Die bestehenden nativen Nachweise bleiben Teilabnahmen; CI und Integration ersetzen keine noch offenen Gerätefälle.

# PR123: develop und PR65-Persistenz integriert

17.11.2026. Ausgangshead 2eae4f9d5d4b2aa8aa5ca979858859f2342c186e. develop bafddb5fdcc6976e6f9bca974854d6f5431bd746 konfliktfrei integriert (3b0be75), anschließend aktueller PR65-Head 4a413b391d07042b94c96642311b163f32a3f601 konfliktfrei übernommen. Die zweite Integration ergänzt Basic-Profilpersistenz und deren Regression/Nachweise. Das alte PR88-Modell wurde nicht gemergt: PR123 enthält Themenhefte bereits auf dem gemeinsamen stampType-Modell.

App und Backend jeweils frisch mit npm ci installiert. Backend vollständig 83/83 Tests in 16 Suites bestanden. Explizit enthalten:

- special-theme-integration: alle 46 historischen Aliase, Konfliktabbruch, beide Importreihenfolgen und kanonisch vorinitialisierter Katalog; Wiederholungen bewahren UUIDs, Besuche, Notizen, Ausgaben und regulären 222er-Fortschritt.
- public-stamp-catalog: echte anonyme HTTP-Abfragen auf Liste und Detail liefern die von der App angeforderten Katalogmetadaten.
- Themenhefte, Sonderstempel, Abzeichen, Tour-Sonderzählung und Meldungsregressionen.

App: zehn gezielte Suites zu Sonderstempeln, Themenheften, Abzeichen, Basic-Profil-/Neustartpersistenz und Konfiguration, 52/52 bestanden.

Alle Importtests ausschließlich gegen eigene lokale In-Memory-Datenbanken. Kein Live-Websiteabruf, keine Hosted-Mutation, kein neuer nativer Build. Website-Bildverfügbarkeit, vollständige native Admin-/Meldungs-/Heftabschlussfälle und tatsächlicher Zielsystem-Schema-/Importrollout bleiben separate Voraussetzungen. Keine Produktionsfreigabe.

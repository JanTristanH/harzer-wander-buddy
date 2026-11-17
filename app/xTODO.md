# Aufgaben und PR-Abgleich

Stand: 17. November 2026. Dokumentationsbasis dieses PRs ist `develop` `7513b1b`; der aktuelle Remote-Stand ist `bafddb5`. Die unten genannten Feature-PRs sind weiterhin offen.
„In PR“ bedeutet Code auf einem offenen Branch. „Gemeinsam integriert“ bezeichnet ausdrücklich einen Folgebranch, keine Integration in `develop` und keine Produktionsfreigabe.

## Priorisierte Arbeit

| Prio | Thema | Stand und nächster Schritt |
| --- | --- | --- |
| P1 | Offizielle Defektmeldungen und Community-Meldungen | [#89](https://github.com/JanTristanH/harzer-wander-buddy/pull/89): ältere develop-Basis im Featurebranch integriert. Native Meldung/Freigabe, Liste/Detail/Karte und Tourwarnung lokal geprüft; aktueller Live-Import, Offline- und Gruppenvarianten offen. |
| P1 | Abzeichenfortschritt und nächstes Sammelziel | [#65](https://github.com/JanTristanH/harzer-wander-buddy/pull/65): Album, Zielmodell und gemeinsamer Stempelerfolg implementiert. Native Kernabläufe geprüft, Basic-Profilpersistenz als `4a413b3` korrigiert. Foto/Crop, Meilenstein und vollständige Freundschaftsabnahme offen. Vollständige Startkarte aus TODO 01 separat abgleichen. |
| P1 | Konsistente Oberflächen und Suchfeld löschen | [#118](https://github.com/JanTristanH/harzer-wander-buddy/pull/118): enthält #65-Code im Folgebranch; 421 App-/57 Backendtests und native Kernabläufe geprüft. Große Bedienungshilfen-Schrift schneidet Aktionen ab; Accessibility-Semantik vor UX-Freigabe korrigieren. #65 zuerst integrieren. |
| P1 | Feedback beim Hinzufügen von POIs | #118 korrigiert Karten-/Vollbildwechsel und Hinweiszustände; #91 ergänzt Vorschläge und gemeinsame Tourenansicht. Ursprünglichen Interaktionspunkt bei der vollständigen Abnahme erneut prüfen. |
| P1 | Erfolgsfeedback für Liste, Details und Karte | [TODO 03](../docs/todos/premium-gamification/03-stempelerfolg.md): in #65 und dessen #118-Folgebranch umgesetzt. Native Kernabläufe teilweise geprüft; keine vollständige Meilenstein-/Foto-/Gruppenabnahme behauptet. Offline-Outbox erst nach erfolgreicher Synchronisierung belohnen. |
| P1 | Tourenautomatik und gemeinsame Routenansicht | [#91](https://github.com/JanTristanH/harzer-wander-buddy/pull/91): ältere develop-Basis im Featurebranch integriert. Native Vorschläge, Sheet, Speichern/Editor, GPX und manuelle Tour geprüft. Obere Zeitgrenze, Offline-/Gruppenfälle und gemeinsamer Schema-/API-Rollout offen. Premium-Rechte/Billing separat. |
| P1 | Kontodatenschutz und Auth-Migration | [#63](https://github.com/JanTristanH/harzer-wander-buddy/pull/63) vor [#119](https://github.com/JanTristanH/harzer-wander-buddy/pull/119). Lokaler Export mit Owner-Isolation/Bildbytes und Löschgate geprüft; echte Supabase-/Provider-/Scheduler-/Stagingabnahme weiter offen. Historischer CAP-Grants/RLS-Befund bleibt Releaseblocker; keine Hosted-Rechte geändert, technische Runtime-Rolle unbestätigt. |
| P2 | Themenhefte und Sonderstempel | [#88](https://github.com/JanTristanH/harzer-wander-buddy/pull/88) basiert auf #65, enthält dessen späteren Persistenzfix noch nicht. 414 App-/65 Backendtests und native Kernabläufe geprüft. Fünf redaktionelle Ausgaben bleiben verborgen. Überschneidung mit #123 vor Integration entscheiden. |
| P2 | Native Offline-Wanderkarten | [#87](https://github.com/JanTristanH/harzer-wander-buddy/pull/87): 384 App-/39 Backendtests. Nativer iOS-Download, lokale MapLibre-Dateidarstellung und Wiederöffnung nach Neustart geprüft: 78 Kacheln/fünf Fonts, 1.586.626 Bytes. Echte Netztrennung, User-Agent-Empfang und weitere Lifecyclefälle sowie Android offen. Draft beibehalten. |
| P2 | Stempel entdecken | [TODO 04](../docs/todos/premium-gamification/04-stempel-entdecken.md): Bilddarstellung teilweise in develop, Layout überschneidet sich mit #118. Restumfang anhand vollständiger Abnahmekriterien prüfen. |
| P3 | Freundschaftsanfragen deutlicher anzeigen | Anfrageverwaltung vorhanden; gemeinsamer Suchflow und lokales Annehmen in #118 nativ geprüft. Tab-Badge und Hinweis auf neue Anfragen gesondert prüfen. |
| P3 | App zuletzt geöffnet / weitere Analytics | Offen. Zweck, Datensparsamkeit und Aufbewahrung vor Umsetzung abstimmen. Keine neuen Drittanbieter-Tracker daraus ableiten. |

## Abhängigkeiten und zusätzliche offene PRs

- #65 vor #88/#118, #63 vor #119; nach Squash-Merges Folgebranches gegen develop bereinigen und erneut prüfen. App-Adminrolle ist keine PostgreSQL-Runtime- oder Premiumrolle.
- #89/#91 enthalten die ältere develop-Basis `7513b1b`. Die Basisintegration gegen den heutigen develop-Stand ist vor Merge erneut zu prüfen; die PRs sind nicht bereits in develop gemergt.
- [#123](https://github.com/JanTristanH/harzer-wander-buddy/pull/123) enthält Sonderstempelkatalog und Überschneidungen mit #65/#88/#89. Öffentlichen OData-Vertrag korrigiert, native Kernabläufe geprüft; Admin-/Meldungs-/Tourenrestfälle und Website-/Integrationsabhängigkeiten offen. Keine doppelten Feature-Merges ohne Abgleich.
- [#120](https://github.com/JanTristanH/harzer-wander-buddy/pull/120): 394 App-/44 Backendtests und nativer Cache-/Kontowechsel-/Backend-Ausfall-Smoke geprüft. Echte Offline-0-Requests und lokale Container/PostgreSQL-Runtime offen. GitHub meldet aktuell Konflikte mit develop, ebenso bei #119; grüne Head-Checks ersetzen deren Lösung nicht.
- [#122](https://github.com/JanTristanH/harzer-wander-buddy/pull/122): CI-Pfadfilter, 73 Tests und iOS-Smoke geprüft. Produktentscheidung offen: Reopen mit Preview-Opt-in und reinem Doku-Diff stellt die zuvor entfernte Preview nicht wieder her.
- Die iOS-Tests verwendeten offengelegte lokale UIScene-/SQLite-/Konfigurationsbaselines und isolierte Testdaten, keine unveränderten nativen Feature-Heads oder Produktionsfreigaben. Einzelheiten und Restfälle stehen in den Testkommentaren der jeweiligen PRs. Historische Web-/Benchmarknachweise sind keine neu gemessenen nativen Ergebnisse.

## Bereits in develop nachgewiesen

- Mehrfachauswahl und Mehrfachstempeln einschließlich Buddy-Erfolgsmoment: #113.
- Native Offline-Besuche und persönliche Notizen mit Synchronisierung: #85.
- GPX-Export gespeicherter Routen: #86.
- Dauerhafte native Preview-Anmeldung: #117.
- Globale Kartenstilauswahl in den erweiterten Profileinstellungen: #108.

## Noch zu konkretisieren oder gezielt abzunehmen

- „Wenn gestempelt, Zurück-Button nicht sichtbar“: betroffene Ansicht, Plattform und reproduzierbarer Ablauf fehlen; bei nativer Abnahme prüfen.
- „Irgendwas springt links und rechts“: Reproduktion und betroffene Ansicht fehlen; #118 behebt einen konkreten Karten-/Vollbild-Suchwechsel, aber belegt nicht die Lösung jedes Layoutsprungs.
- „Gesten?“: Anforderungen nicht festgelegt; bekannte offene Gestentests sind #65, #91 und #118 zugeordnet.
- OTA-CI: aktuelle Workflows und Umgebungs-/Fingerprint-Schutz berücksichtigen; nach #119 gegen isoliertes Staging prüfen, kein pauschaler Produktions-OTA-Auftrag.

Die folgenden älteren Erledigt-Einträge bleiben als Historie erhalten; sie sind keine erneute Geräte- oder Produktionsabnahme.

## ✅ Bereits erledigt / gepusht

- Speichern überholt sich (Race Conditions) — Fix Pushed
- Logout bei App-Neustart — Fix Pushed
- Kein Offline-Modus (Basisfunktionalität) — Pushed
- Bilder werden ständig neu geladen — Fix Pushed (Full Update)
- Suche nach Ortsnamen — Fix Pushed
- Detailsansicht kollidiert mit Android-Navigation — Pushed
- Entfernung + Höhenmeter zum Stempel — Fix Pushed
- Timeline letzte Besuche — Pushed
- Touren/Stempel per WhatsApp versenden geht nicht — DONE
- Nerviges Autofit des Karten-Kameraraums
- Vom Parkplatz direkt starten (Bottom Sheet)
- Fast Scroll auf der Liste
- Admin: neuer Parkplatz
- Admin: Stempelstelle verlegt
- Bottom Sheet kleiner beim Kartenbewegen
- Icons kleiner
- Allgemeine Notizen (Deckt auch Code für defekte Stempel ab)
- Samsung: keine Nutzung über mobile Daten

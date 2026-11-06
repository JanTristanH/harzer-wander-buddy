# Aufgaben und PR-Abgleich

Stand: 6. November 2026, geprüft gegen `develop` `7513b1b` und die offenen PRs.
„In PR“ bedeutet implementiert auf einem offenen Branch, nicht integriert oder produktiv abgenommen.

## Priorisierte Arbeit

| Prio | Thema | Stand und nächster Schritt |
| --- | --- | --- |
| P1 | Offizielle Defektmeldungen und Community-Meldungen | [#89](https://github.com/JanTristanH/harzer-wander-buddy/pull/89): develop integriert, Proxy-Abruf und wiederholter Live-Import in isolierter Datenbank geprüft. 11 Meldungen unzugeordnet; native Darstellung und Zielsystemabnahme offen. |
| P1 | Abzeichenfortschritt und nächstes Sammelziel | [#65](https://github.com/JanTristanH/harzer-wander-buddy/pull/65): Album, Zielkomponente und Profilbearbeitung implementiert. Integration und native Profilgesten prüfen; nicht erneut implementieren. |
| P1 | Konsistente Oberflächen und Suchfeld löschen | [#118](https://github.com/JanTristanH/harzer-wander-buddy/pull/118): gemeinsame Darstellung und löschbare Suche implementiert; Draft mit offener Android-Abnahme. |
| P1 | Feedback beim Hinzufügen von POIs | #118 korrigiert den Karten-/Vollbildwechsel und Hinweiszustände; #91 ergänzt Vorschläge und gemeinsame Tourenansicht. Den ursprünglichen Interaktionspunkt bei der Abnahme nochmals prüfen. |
| P1 | Erfolgsfeedback für Liste, Details und Karte | [TODO 03](../docs/todos/premium-gamification/03-stempelerfolg.md): Mehrfachauswahl hat bereits Buddy-Animation/Toast in develop (#113). Gemeinsame Fortschrittskarte, Wiederholungsbesuche und Abzeichenereignisse bleiben offen. Lokale Offline-Speicherung darf nicht als Serverbestätigung gefeiert werden. |
| P1 | Tourenautomatik und gemeinsame Routenansicht | [#91](https://github.com/JanTristanH/harzer-wander-buddy/pull/91): develop integriert, GPX-Export in neuer Leseansicht erhalten. Native Gestenprüfung offen. Premium-Rechte und Billing sind separate Arbeit. |
| P1 | Kontodatenschutz und Auth-Migration | [#63](https://github.com/JanTristanH/harzer-wander-buddy/pull/63) vor [#119](https://github.com/JanTristanH/harzer-wander-buddy/pull/119) integrieren. Staging, SMTP, Migration/Restore, Scheduler und echte Web-/Native-Auth-Abnahme offen; kein Produktions-Cutover allein aufgrund grüner CI. |
| P2 | Themenhefte und Sonderstempel | [#88](https://github.com/JanTristanH/harzer-wander-buddy/pull/88) baut auf #65 auf. Fünf redaktionelle Ausgaben und widersprüchliche offizielle Regeln offen. |
| P2 | Native Offline-Wanderkarten | [#87](https://github.com/JanTristanH/harzer-wander-buddy/pull/87): Downloadverwaltung implementiert; reale Kacheln, lokale Fonts und Flugmodus auf Android/iOS prüfen. |
| P2 | Stempel entdecken | [TODO 04](../docs/todos/premium-gamification/04-stempel-entdecken.md): Bilddarstellung teilweise in develop vorhanden, Layoutarbeit überschneidet sich mit #118. Restumfang danach anhand der Abnahmekriterien prüfen. |
| P3 | Freundschaftsanfragen deutlicher anzeigen | Anfrageverwaltung vorhanden, gemeinsamer Suchflow in #65. Tab-Badge und Hinweis auf neue eingehende Anfragen bleiben gesondert zu prüfen/umzusetzen. |
| P3 | App zuletzt geöffnet / weitere Analytics | Offen. Vor Umsetzung Zweck, Datensparsamkeit und Aufbewahrung mit dem Datenschutzstand abstimmen. Keine neuen Drittanbieter-Tracker aus dieser Liste ableiten. |

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

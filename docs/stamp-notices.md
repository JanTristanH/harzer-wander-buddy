# Sperrungen und Defektmeldungen

Nutzer sehen aktuelle freigegebene Meldungen an Stempelstellen: in der Stempelliste, auf der Detailseite, als ⚡ am Kartenmarker, in der Kartenauswahl, auf der Tourenkarte und in deren Stoppliste sowie bei benachbarten Stempeln. Die Besuchsmarkierung bleibt unabhängig vom Zustand der Stempelstelle. Eine Wegesperrung kann nur einen Zugang betreffen; betroffene Stempel werden deshalb nicht automatisch aus Touren entfernt oder als unbesuchbar behandelt.

## Quellen und Moderation

- **Offiziell:** [Defektmeldungen der Harzer Wandernadel](https://www.harzer-wandernadel.de/defektmeldungen/). Die Seite enthält Defekte, Wegesperrungen und Standortinformationen. Zuordenbare Einträge werden beim ausdrücklich gestarteten Admin-Import veröffentlicht.
- **Community:** Angemeldete Nutzer melden einen Defekt, eine Sperrung oder einen sonstigen Hinweis mit 10–2000 Zeichen. Neue Meldungen erhalten immer den Status `pending`. Erst ein Admin kann sie freigeben. Es erfolgt keine Weiterleitung an die Harzer Wandernadel.
- Meldungen durchlaufen `pending → approved → resolved` oder `pending → rejected`. Erledigte und abgelehnte Meldungen werden öffentlich nicht ausgegeben. Ein gleichzeitiger zweiter Moderationsversuch erhält HTTP 409.
- Öffentliche Hinweise enthalten weder Melder-ID noch Prüfer-ID. Der nur für Admins lesbare Datensatz bewahrt Ersteller und Moderationszeitpunkt auf. Direkte OData-Schreibzugriffe sind auch für Admins gesperrt; Änderungen laufen über die Aktionen.
- Das Meldelimit beträgt zehn noch ungeprüfte Meldungen je Nutzer. Meldungen sind nur online möglich. Bereits geladene Warnungen bleiben offline verfügbar und werden als letzter geladener Stand gekennzeichnet.

Die Detailseite zeigt Kategorie, Text, Herkunft und Abruf- bzw. Freigabedatum. „Keine Meldungen bekannt“ ist keine Zusicherung eines intakten Stempels oder freien Zugangs. Online werden die relevanten Ansichten spätestens alle fünf Minuten sowie beim erneuten Aufrufen nach Ablauf dieser Frist aktualisiert.

## Admin-Synchronisierung

Im Adminbereich „Sperrungen & Defektmeldungen“ zuerst **Offizielle Quelle prüfen (Vorschau)** wählen. Die Vorschau enthält zugeordnete und nicht zugeordnete Einträge. **Jetzt synchronisieren** ruft die Quelle erneut ab und übernimmt den dann aktuellen Stand. Es gibt keinen automatischen Zeitplan.

Der Import liest ausschließlich die fest hinterlegte HTTPS-Adresse. Er begrenzt Antwortgröße und Laufzeit und folgt keinen Redirects. HTML wird als Text verarbeitet, niemals als ausführbarer Inhalt angezeigt. Weiche Trennzeichen werden entfernt. Die Zuordnung erfolgt über eine eindeutige numerische Stempelnummer, sonst über einen exakt normalisierten Namen. Mehrdeutige Namen oder Nummern bleiben unzugeordnet. Es erfolgt keine unscharfe automatische Zuordnung von Sonderstempeln.

Identische Einträge werden anhand von Quelltext-Hash und Stempel-ID wiederverwendet. Parallele schreibende Importe werden über einen Datenbank-Lock auf dem Synchronisierungsdatensatz serialisiert; Abruf und Übernahme laufen innerhalb derselben Transaktion. Fehlende offizielle Einträge werden nur dann als erledigt markiert, wenn die Seite sicher erkannt wurde und alle gelesenen Einträge zugeordnet werden konnten. Bei unklaren Zuordnungen bleiben bisherige Warnungen erhalten. Das kann bewusst zu älteren Warnungen führen; die Vorschau weist auf die offenen Zuordnungen hin. Community-Meldungen werden vom Import nie verändert.

Bei HTTP-Fehlern, unerwarteter Seitenstruktur oder leerem Parsergebnis wird der Import mit HTTP 502 abgebrochen. Vorhandene Warnungen bleiben erhalten. Falls die offizielle Seite künftig ausdrücklich eine leere Meldeliste veröffentlicht, muss der Parser dafür angepasst werden; eine leere Antwort allein darf Warnungen nicht löschen.

## API

Alle Aktionen liegen unter `/odata/v4/api` und verwenden die vorhandene Authentifizierung.

| Aktion / Entität | Berechtigung | Nutzlast / Verhalten |
| --- | --- | --- |
| `POST reportStampNotice` | angemeldet | `{ "stampId": "UUID", "kind": "defect", "message": "Beschreibung …" }`; `kind`: `defect`, `closure`, `info` |
| `POST reviewStampNotice` | Admin | `{ "noticeId": "UUID", "status": "approved" }`; alternativ `rejected` oder `resolved` |
| `POST syncOfficialNotices` | Admin | `{ "preview": true }`; nur explizites `false` schreibt |
| `GET StampNotices` | Admin | interne Meldungen, mit `$expand=stamp` lesbar |
| `GET Stampboxes` | öffentlich bzw. angemeldet | virtuelles Feld `activeNotices`: JSON-Array ausschließlich veröffentlichter Meldungen |

Die beiden öffentlichen API-Wege (`/public/Stampboxes` und `/api/Stampboxes`) verwenden dieselbe Filterung veröffentlichter Meldungen.

## Deployment und Prüfung

Vor dem Backendstart die reguläre CAP-Datenbankmigration ausführen (`npm run deploy:postgres` für Produktion, `npm run deploy:sqlite` lokal). Neu sind `StampNotices` und `NoticeSyncState` samt der durch `db/init.js` angelegten Seed-Zeile `official`. Eine zusätzliche Datenmigration bestehender Stempel ist nicht erforderlich. Ein schreibender Import ohne die Seed-Zeile wird mit HTTP 503 abgewiesen.

Backend: `cd backend/hwb && npm test`. Die Integrationstests prüfen echte OData-Aufrufe für Authentifizierung, Adminrechte, Freigabe, Datenschutz, Idempotenz, Vorschau und ausfallsichere Synchronisierung; die externe Quelle ist dabei kontrolliert ersetzt.

App: `cd app && npm test -- --config jest.config.js --runInBand`; außerdem `npx tsc --noEmit` und `npm run lint`.

Die Screenshots unter `docs/screenshots/notices-*.png` stammen aus der laufenden Expo-Web-App mit isolierter In-Memory-Datenbank und synthetischen Meldungen. Sie sind UI-Beispiele, keine Behauptung über den tatsächlichen Zustand dieser Stempelstellen. Die aktuelle Quellseite wurde inhaltlich eingesehen; der direkte Live-Abruf aus der Entwicklungsumgebung ist durch deren Netzwerkfreigabe blockiert. Der Import muss beim Deployment mit freigegebenem Zugriff auf `www.harzer-wandernadel.de` einmal gegen die Live-Seite geprüft werden. Die Hintergrundkarte im Karten-Screenshot konnte aus demselben Grund nicht geladen werden; Marker und Auswahlhinweis stammen aus der laufenden App. Native Android-/iOS-Darstellung ist implementiert, aber hier nicht im Emulator geprüft.

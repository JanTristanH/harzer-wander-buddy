# App-Start: Cache, doppelte Abfragen und Offline-Betrieb

Stand: 2026-11-07. Untersucht wurden Anmeldung, Sitzungswiederherstellung,
Query-Persistenz, Startliste, Karte, Profil, Freunde und Touren. Die Grundlage
ist der App-Stand auf `develop`, erweitert im Performance-PR.

## Befunde und Änderungen

| Stelle | Bisher | Jetzt |
| --- | --- | --- |
| Query-Hydration | Der imperative Core-Sync konnte vor der Wiederherstellung des gespeicherten Query-Caches loslaufen. Auch die SSO-Profilwiederherstellung konnte den Cache zu früh prüfen. | SSO-Restore und Core-Sync warten auf die Query-Hydration. Ein vorhandenes Profil wird vor Netzwerkaktualisierungen angezeigt. |
| Verbindungsstatus | Online-Manager wurde erst in einem Layout-Effekt eingerichtet; frühe Requests konnten den unbekannten Verbindungsstatus überholen. | Einrichtung vor dem Mount der Queries, mit SSR-Guard. Erst bestätigte Internet-Erreichbarkeit gibt Requests frei. |
| Gastdaten während Restore | Bei noch unbekannter Sitzung konnte ein Gastabruf vor dem privaten Abruf starten. | Gast-Queries warten auf das Ende des Auth-Restores. Private Queries benötigen eine aufgelöste Benutzer-ID. |
| Startliste und Core-Sync | Core lud `stamps-overview` im Default-Modus, die sichtbare Liste `stamps-overview-by-filter/validToday`. Dies waren getrennte Abfragen. | Core und sichtbare Liste nutzen denselben `validToday`-Key einschließlich Benutzer und Gruppen-Signatur. Karte und Profil warten bei Bedarf auf dieselbe laufende Abfrage. |
| Profil und Freunde | Profil las `MyFriends` und Fortschritt erneut, obwohl die Freunde-Übersicht dieselben Informationen schon geladen hatte. | Profil übernimmt die vorhandene Freunde-Übersicht, wenn sie zum aktuellen Benutzer gehört. Die eigene Besuchshistorie wird weiterhin separat geladen. |
| Touren-Vorabruf | Für jede Tour wurden Stammdaten nochmals einzeln gelesen, obwohl die Übersicht dieselben Felder enthält; alle Touren wurden parallel geladen. | Stammdaten aus der Übersicht werden übernommen. Pro Tour bleibt nur der Pfadabruf: **N statt 2N Requests** für diesen Vorabruf. Höchstens zwei Pfade werden gleichzeitig geladen. |
| Fehlgeschlagene Pfadaktualisierung | Ein Netzwerkfehler konnte als erfolgreicher leerer Pfad zurückkommen und einen gespeicherten Offline-Pfad überschreiben. | Fehler werden weitergegeben; React Query behält vorhandene Daten. Eine echte erfolgreiche Leerantwort bleibt zulässig. |
| Sync-Metadaten | Ein aktueller Zeitstempel konnte fehlende Cache-Daten verdecken; `staleTime: Infinity` verhinderte teilweise eine spätere Aktualisierung. | Auch die benötigten Übersichts- und Tour-Detail-Daten werden geprüft. Core-Daten werden nach 15 Minuten wieder aktualisiert, statt dauerhaft als frisch zu gelten. Fehlende Einträge werden gezielt ergänzt. |
| Auth0-Discovery | Auch ein Online-Gast oder eine frische gespeicherte Sitzung lud das Discovery-Dokument vorsorglich. | Discovery erfolgt erst bei interaktiver Anmeldung oder notwendigem Token-Refresh. |
| Kontoprofil im Cache | Bloßes Anwenden gespeicherter Profildaten schrieb sie erneut und setzte ihren Zeitstempel frisch. | Unveränderte Daten werden nicht erneut gesetzt. Ältere Profile bleiben sichtbar und werden online nach 15 Minuten im Hintergrund aktualisiert. |
| Ältere Token-Sitzungen | Ohne separates ID-Token konnten private Daten unter einem anonymen Key gesucht werden. | Identität aus Access-Token oder passendem gespeichertem Profil dient als Fallback; Access-Token-Berechtigungen werden dabei nicht zu ID-Token-Claims übernommen. |
| Gleichzeitiger Sync / Konto-Wechsel | Mehrere Startauslöser konnten Vorabrufe parallel anstoßen. | Ein laufender Sync wird je QueryClient und Benutzer geteilt. Nach Logout oder Besitzerwechsel startet der alte Sync keine weiteren Ladephasen und schreibt keinen Erfolgsmarker. |

## Verhalten nach Neustart

Eine zuvor angemeldete Sitzung kann lokal wiederhergestellt werden, auch bei
abgelaufenem Token und fehlender Verbindung. Gespeicherte Daten desselben
Benutzers bleiben sichtbar; ein alter Default-Listen-Cache dient bei Bedarf
als Offline-Platzhalter für die aktuelle Liste. Er wird nicht als vollständige
Antwort für andere Filter oder Gruppen ausgegeben. Bestehende Persistenz wird
beim Update nicht pauschal gelöscht.

Nach bewusstem Logout bleibt die App beim nächsten Offline-Start abgemeldet.
Ein Cache-Eintrag ersetzt keine Anmeldung. Benutzer- und Gruppen-Keys bleiben
getrennt. Änderungen und noch ausstehende Offline-Besuche/-Notizen behalten
weiterhin ihre bisherigen Outbox-Regeln.

Nach echtem Reconnect oder App-Fokus werden aktive Besuchs-/Gruppen-Queries
weiterhin aktualisiert, damit fremde Gruppenstempel sichtbar werden. Die
Optimierung schaltet diese bestehende Aktualisierung nicht ab. Die Aussage
„keine Requests“ gilt deshalb für den getesteten Offline-Restore beziehungsweise
einen vollständigen frischen Core-Cache, nicht pauschal für jeden Online-Start.

## Nachweise

- **394 App-Tests erfolgreich**, darunter langsamer Query-Restore, Offline-Neustart,
  Logout, Konto-Wechsel, fehlendes ID-Token, Profilaktualisierung im Hintergrund,
  Erhalt der Zeitstempel, geteilte Requests und begrenzter Tour-Vorabruf.
- TypeScript `tsc --noEmit` erfolgreich; ESLint für die geänderten Laufzeitdateien
  und neuen Tests erfolgreich.
- Chromium mit synthetischer Sitzung und vorab gespeicherten Daten: Neustart,
  Liste und Profil bei simuliertem Offline-Status mit **0 Backend-/Auth-Anfragen**,
  ohne Seitenfehler. Der Profil-Zeitstempel blieb unverändert.
- Browser-Details und Screenshots:
  [Offline-Liste](../screenshots/app-startup-cache/offline-list.png),
  [Offline-Profil](../screenshots/app-startup-cache/offline-profile.png),
  [Testaufbau](../screenshots/app-startup-cache/README.md).

Der Browser durfte HTML/JavaScript vom lokalen Dev-Server laden;
`navigator.onLine` meldete offline, Backend- und Auth-Ziele waren blockiert.
Das ist eine Prüfung der Cache-/Restore-Logik, keine Messung eines nativen
APK-Kaltstarts. Es wurden keine produktiven Zugangsdaten oder Produktions-Logins
verwendet und keine Android-Simulatoren gestartet.

## Weitere Ansatzpunkte

Der Persistenz-Snapshot enthält Stempel weiterhin in mehreren Ansichten
(Liste, Karte, Profil). Ein normalisierter Entity-Cache könnte diese Duplizierung
bei Speicherung und Hydration verringern, benötigt aber eine gesonderte Migration
unter Erhalt vorhandener Offline-Daten. POI-Daten werden bewusst separat geladen:
Sie können historische Orte enthalten, die in der aktuellen Liste fehlen.
Vollständige Tour-Pfade können bei vielen Touren weiterhin viel Speicher belegen;
die Parallelitätsbegrenzung reduziert Lastspitzen, nicht die gesamte Offline-Datenmenge.
Es wird keine unbelegte pauschale Halbierung von App-Startzeit oder RAM behauptet.

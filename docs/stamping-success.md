# Serverbestätigter Stempelerfolg

Liste, Stempeldetails, Karte und Gruppenstempeln publizieren nach erfolgreicher Serverspeicherung ein gemeinsames Ereignis mit den bestätigten eigenen Besuchs-IDs. Ein globaler Host zeigt genau eine Fortschrittskarte je Ereignis an; Mehrfachauswahl und ein nativer Synchronisierungslauf werden gebündelt. Gescheiterte oder nur lokal gespeicherte Besuche erzeugen keine Fortschrittsbelohnung. Bestehende Offline-Hinweise bleiben als lokaler Speicherstatus sichtbar.

`getStampingFeedback` ist eine angemeldeten Nutzern vorbehaltene, lesende CAP-Aktion. Sie liest ausschließlich eigene Besuche. Aus einem Serverstand werden aktueller Fortschritt und der Stand ohne die angegebenen Besuchs-IDs berechnet. Mehrfachbesuche und mehrfach angegebene IDs erhöhen die eindeutige Stempelzahl nicht. Reguläre Nummern 1–222 und Sonderstempel werden getrennt gezählt; Abzeichen verwenden denselben Regelprüfer wie das Album. Fremde oder unbekannte Besuchs-IDs liefern keine bestätigten Besuche und keine Freischaltung. Es werden keine Nutzer-IDs oder fremden Besuchsdaten ausgegeben.

Die bisherige Aktion `stampForGroup` liefert unverändert `ok`. Die zusätzliche Aktion `stampForGroupWithFeedback` verwendet dieselbe atomare Speicherung und dieselben Freundschafts-/Stempelberechtigungen. Sie liefert nur eigene Besuchs-IDs, eine Ereignis-ID und die tatsächlich geschriebenen Freundesbesuche. Diese Zahl wird getrennt vom persönlichen Sammelfortschritt angezeigt.

Ein Fortschrittsabruf nach erfolgreicher Speicherung darf bei Fehlern keinen weiteren Besuchs-POST auslösen. Die Karte zeigt dann nur bestätigte Besuchszahlen ohne erfundene Fortschrittswerte. Unbestätigte/abgelehnte Offline-Einträge bleiben in der vorhandenen Outbox. Erst ein erfolgreich beendeter Synchronisierungslauf publiziert bestätigte IDs. Wiederholte Ereignisse werden im Host dedupliziert; Kontowechsel, Abmeldung und Hintergrundwechsel verwerfen offene Anzeigen. Eine verspätete Antwort aus einem anderen Konto wird nicht angezeigt. Ereignisse und Token werden nicht persistiert.

Die Karte enthält Schließen und Weiter-entdecken-Aktionen mit mindestens 48 dp. Meilensteine zeigen Abzeichen und Buddy sowie einen Album-Einstieg. Normale Karten schließen nach neun Sekunden, Meilensteine nach 14 Sekunden; mit aktiviertem Screenreader bleiben sie bis zum expliziten Schließen offen. Die neue Karte selbst animiert nicht und löst keine zusätzliche Haptik aus. Bestehende Haptikeinstellungen und die 3,9-Sekunden-Fortschrittsanimation bleiben erhalten. Der Inhalt bleibt bei großer Schrift scrollbar.

## Nachweise

- Backendtests: Wiederholung, Sonderstempel, neue Abzeichen, unbekannte IDs, Eigentümerschaft und Gastzugriff; Gruppenrechte und kompatible Altaktion.
- App-Tests: gemeinsame Mehrfachaktion, native Offline-/Bestätigungsgrenze, Deduplizierung, fremdes Konto, verspätete Antwort nach Kontowechsel, Fehler beim Fortschrittsabruf, Gruppenbesuche und Album-Aktion.
- Vollständige Web-App am isolierten Testbackend: echte Anmeldung und Besuchsaktionen für Bronze (7 → 8), Wiederholung (8 → 8) und neuen Ort (8 → 9), kein horizontaler Überlauf bei 390 Pixeln. [Screenshots und Capture](screenshots/stamping-success/README.md).
- Native Android-/iOS-Laufzeitabnahme bleibt offen. Der lokale Android-Emulator bootet, der Paketmanager/APK-Installationsweg reagiert weiterhin nicht zuverlässig. Kein bestandener nativer Gestentest wird daraus abgeleitet.

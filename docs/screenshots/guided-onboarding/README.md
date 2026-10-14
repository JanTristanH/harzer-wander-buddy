# Geführtes Onboarding

Screenshots des tatsächlichen Expo-Web-Flows mit lokalem CAP-Testserver, aufgenommen mit 390 × 844 Pixeln. Die Ansichten zeigen Willkommen, Anzeigename, Avatar, optionale Standortfreigabe und Wanderbuddies.

## Recherche und übernommene Muster

- [Duolingo: aufgezeichneter Onboarding-Ablauf](https://uidiscovery.com/studies/duolingo-onboarding): Erwartungen vorab erklären, eine Entscheidung je Schritt, sichtbarer Fortschritt und erkennbare Auswahl. Übernommen als fünf kurze Screens mit Zurück-Aktion und erhaltenen Eingaben.
- [Headspace: Onboarding-Fallstudie](https://growth.design/case-studies/headspace-user-onboarding/): positive, am Nutzen orientierte Ansprache. Übernommen als freundliche Illustrationen und konkrete Vorteile von Karte, Stempeln und Freunden.

Die Referenzen sind dokumentierte Beispielabläufe, keine Live-Prüfung aller aktuellen App-Varianten. Screens, Texte und Avatar-Illustrationen wurden für Harzer Wander Buddy eigenständig gestaltet.

## Validierung

- Gesamter Flow im Browser: Anmeldung → Name speichern → Standard-Avatar hochladen → zurück → Avatar entfernen → Avatar erneut wählen → Standort überspringen → Freundesuche öffnen/schließen → Abschluss zur Stempelstellen-Liste.
- Gespeicherten Namen, Attachment-URL, leeres Bild beim Entfernen und `onboardingCompleted` in der eigenen lokalen Testdatenbank geprüft.
- Sechs Regressionstests für Navigation, Namensvalidierung, Avatar-Auswahl/Entfernung, Upload-Fehler mit erneutem Versuch, optionale Schritte und abgelehnte Standortfreigabe.

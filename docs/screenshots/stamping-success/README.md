# Gemeinsamer Stempelerfolg

Screenshots der vollständigen React-Native-Web-App, 390 × 844 Pixel, reduzierte Bewegung, lokales CAP-Basic-Testbackend mit isolierter In-Memory-Datenbank. Echte Testanmeldung und echte Besuchs-POSTs; keine gemockten Erfolgsantworten und keine Produktionsdaten.

- `milestone.png`: achter regulärer Stempel, Bronze im digitalen Album freigeschaltet.
- `repeat.png`: erneuter Besuch ohne zusätzlichen einzigartigen Stempel.
- `normal.png`: neunter regulärer Stempel und Fortschritt zum nächsten Ziel.

Der lokale Testnutzer beginnt mit sieben Besuchen an den Repository-Stempelstellen 1–7. `capture.py` verwendet die Testzugangsdaten aus AGENTS.md nur im Speicher und speichert keine Browser-Sitzung. Die App muss am lokalen Testbackend unter `http://localhost:4004/` bereitstehen; die Fixture-Datenbank vor Wiederholung neu anlegen. Ausführung mit dem vorhandenen lokalen Playwright-Python. Diese Webaufnahme ersetzt keine native Android-/iOS-Abnahme.

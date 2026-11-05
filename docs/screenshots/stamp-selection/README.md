# Stempelauswahl und Erfolgsmoment

Unveränderte Screenshots der echten App aus dem lokalen Produktions-Webexport
von App-Commit `3db8a5b`, aufgenommen mit Chromium bei 430 × 932 px.
Basic-Anmeldung ausschließlich am lokalen Testbackend (`localhost:4004`).
Keine Produktionsdaten und keine nachgebaute Demo-Oberfläche.

- `before.png`: Ausgangsliste, 0 besuchte Stempelstellen.
- `selection.png`: zwei ausgewählte Zeilen, Hero entfernt, Stempeln hervorgehoben.
- `celebration.png`: bestätigte Besuche, Stempelabdruck und Konfetti am Hero.
- `after.png`: aktualisierter Hero und zwei farbig als besucht markierte Zeilen.

Browserprüfung: Nach langem Drücken und Loslassen bleibt genau eine Zeile
angewählt. Der Hero wird entfernt; Zeilenposition und gemessene Höhe seines
Ersatzbereichs bleiben innerhalb von 1 px unverändert. Nach dem Stempeln steigt
der Fortschritt von 0 auf 2; beide Zeilen zeigen den gespeicherten Besuch.

51 lokale Jest-Suites / 274 Tests, TypeScript und gezieltes ESLint bestanden.
Die CI-App-Tests des App-Commits sind ebenfalls grün. Der lokale Android-
Release-Build für x86 bestand zweimal (37:25 min, danach 30 s mit warmen Caches).
Der lokale Build enthält zusätzlich die vorher vorhandene, nicht zu diesem PR
gehörende SecureStore-Anpassung. Diese bleibt uncommitted.

Die Android-Laufzeitprüfung ist nicht bestätigt: Der Software-Emulator hing
bei ADB-Aufrufen und lieferte kein App-Bild. Screenshots und Geometrieprüfung
belegen die Web-Ausgabe der App; Haptik und Bewegungsgefühl auf Android müssen
mit der Preview-APK auf einem funktionsfähigen Gerät geprüft werden.

Zusätzliche Geometrieprüfung im Produktions-Webexport nach dem Speichern:
Bei Scrolloffset 0 bleibt die erste Zeile vor Auswahl, nach Auswahl und nach
Abbruch bei y=342 px; bei Offset 95 bleibt sie jeweils bei y=247 px. Die Prüfung
des Abbruchs löst den Button ohne die automatische Scroll-into-view-Funktion
des Browser-Testwerkzeugs aus, damit diese nicht selbst die Liste verschiebt.

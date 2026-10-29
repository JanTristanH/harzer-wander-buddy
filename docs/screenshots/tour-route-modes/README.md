# Tourkarte: Verkehrsmittel und Richtung

Screenshots der echten Expo-Web-App mit lokalem CAP-Testbackend und lokalem Testkonto.
Die ausschließlich lokal angelegte Tour verwendet zwei vorhandene OData-Etappen:
Parkplatz 89 → Parkplatz für Stempel 88 (Auto) → Aussichtspavillon Hoher Kleef (Wandern).

- Autofahren: blau; Wandern: grün. Die Legende zeigt die enthaltenen Verkehrsmittel.
- Wiederholte Pfeilspitzen zeigen die Richtung entlang des gespeicherten Routenverlaufs.
  Größe und Abstand passen sich dem Zoom und der Kartenhöhe an.
- Beim Öffnen und Schließen der Vollbildkarte bleibt der aktuelle Kartenausschnitt erhalten.

| Ansicht | Screenshot |
| --- | --- |
| Desktop, 1440 × 1000 | [desktop.png](desktop.png) |
| Mobile Web, 390 × 844 | [mobile.png](mobile.png) |
| Mobile Web, Vollbild, 390 × 844 | [mobile-fullscreen.png](mobile-fullscreen.png) |
| Mobile Web, Vollbild mit Zoom, 390 × 844 | [mobile-zoom.png](mobile-zoom.png) |

Geprüft: beide Routenfarben und Richtungspfeile im Browser, Vollbildwechsel und Zoom;
23 gezielte Jest-Tests, TypeScript und ESLint. Der lokale native Android-Release-Build
wurde erfolgreich erstellt. Native Sichtprüfung nicht abgeschlossen: Der Software-Emulator
meldete den Bootabschluss, reagierte aber nicht zuverlässig auf Eingaben/Screenshot-Anfragen;
die Proxy-Einrichtung lief in einen Timeout und die APK-Installation wurde nicht bestätigt.
Die Bilder oben sind ausdrücklich Web-Screenshots.

# Button, ruhiger Erfolgsmoment und Buddy-Stempel

Echte Screenshots des Produktions-Webexports der App, App-Code `1abd8f2`,
390 × 844 px, Chromium mit Touch-Emulation. Anmeldung ausschließlich am lokalen
Basic-Testbackend (localhost:4004), keine Produktionsdaten. Das Buddy-Badge
entspricht der vom Nutzer gewählten Option 2; transparentes generiertes Asset
auf Basis des originalen `onboarding-bear.png`.

Geprüft:
- Gäste sehen „Auswählen“ statt „222 gesamt“; der Button führt zur Anmeldung.
- Angemeldet öffnet Tippen auf den Button „0 ausgewählt“, ohne Long Press.
- Beim Umschalten bleiben Hero-Ersatzhöhe und erste Listenzeile stabil.
- Die interaktive Karte und ihr Titel haben user-select:none; contextmenu wird
  verhindert. Das ersetzt keine Prüfung des nativen Callouts auf einem iPhone.
- Zwei bestätigte Besuche erzeugen genau zwei gleichzeitig sichtbare Stempel.
  Die gemessenen Mittelpunkte liegen in der Flugphase mindestens 44 px auseinander;
  die Symbole bleiben damit einzeln erkennbar.
- Der gesamte Erfolgsablauf dauerte in diesem Prüflauf rund 6,7 Sekunden inklusive
  Speichern und Rendern. Die normale Mindestdauer beträgt 4,3 Sekunden (ein Besuch).
- Buddy-Stempel, längere Haltephase, aktualisierter Hero und besuchte Zeilen sind
  sichtbar; der Teststand stieg von 6 auf 8 besuchte Stempelstellen.
- Der Auswahlbutton bleibt auch bei 375 px und 320 px Breite im Bildschirm.

Tests: vollständiger Jest-Lauf mit 52 Suiten / 282 Tests bestanden; nach der
Badge-Integration alle 36 betroffenen Tests erneut bestanden; abschließende fünf
Motion-Tests sowie TypeScript und gezieltes ESLint bestanden. Produktions-Webexport
bestanden. Android-Gerätegefühl und echter iOS-Safari-Callout wurden hier nicht
auf einem funktionierenden Gerät geprüft; die Preview-APK wird in der CI gebaut.

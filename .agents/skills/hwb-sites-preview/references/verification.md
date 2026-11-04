# Funktionierende Vorschau nachweisen

Diese Prüfung gilt vor Veröffentlichung für den paketierten Build und danach
für die tatsächliche Sites-URL. Bestehende Browser-Sitzungen nicht exportieren.
Ein Deployment-Status bestätigt die Auslieferung, nicht den Inhalt der Karte.

1. Einstieg öffnen und der Weiterleitung zur echten Kartenroute folgen. Seite neu
   laden und den Kartenlink direkt öffnen; verschachtelte Asset-URLs dürfen keine
   404 liefern. Die private Anmeldung muss über den vorgesehenen Sites-Zugang
   funktionieren. Ohne berechtigte Sitzung keine Funktionsbestätigung behaupten.
2. Bei 390×844 und DPR 3 auf geladenen Kartenhintergrund und Daten warten. Kein
   „Karte konnte nicht geladen werden“, keine kaputten Symbole, keine Fehler in der
   Browserkonsole. Katalog-/Fontanfragen auf 401/403/404 und falschen Content-Type
   prüfen. Lokale Tests dürfen diese Fehler gezielt simulieren.
3. Ohne Filter **222 Stempel** prüfen, nicht einfach 222 beliebige Marker zählen:
   Parkplätze oder der Standort könnten mitgezählt sein. Die nummerierten
   `.hwb-css-marker__label`-Elemente beziehungsweise die tatsächlich verwendeten
   Stempel-Accessibility-Labels aus dem aktuellen Quellstand prüfen. Jede Nummer
   1–222 muss genau einmal vorhanden sein. Falls der gewählte App-Stand Viewport-
   Culling hat, das benennen und vor der Freigabe die Anforderung dauerhaft
   montierter Stempel im App-Code erfüllen; die Prüfung nicht abschwächen.
4. Symbolschriften über `document.fonts.ready` und den Ladezustand der tatsächlich
   verwendeten Fontfamilien prüfen; sichtbare Icons ansehen. Eine leere Fontliste
   ist kein bestandener Test. Aktuelle Familien aus dem Export ermitteln.
5. Zoomen und verschieben. Stempel bleiben montiert; DOM-Referenzen vor und nach
   der Bewegung vergleichen, nicht nur die Anzahl. Einen sichtbaren Marker über
   echte Pointer-/Touch-Eingabe auswählen; richtiges Auswahl-Sheet muss erscheinen.
   Synthetisches `element.click()` allein reicht dafür nicht. Details-Link auf
   die vorhandene öffentliche Stempelstellen-Seite prüfen, auch von der Site aus.
6. Falls der App-Stand einen Stilumschalter besitzt: jeden angebotenen Stil wählen.
   Hintergrund muss wechseln; Nummern 1–222, Marker-DOM-Knoten und Kartenausschnitt
   bleiben erhalten. Ohne Umschalter keine Stilvergleich-Funktion versprechen.
7. Screenshot mit sichtbaren Markern und einen kurzen Prüfbericht speichern:
   App-Commit, Site-Version/URL, Geräte-/Browserprofil, Markerzahl, Schriftstatus,
   Zoom/Pan/Auswahl, Stilwechsel falls vorhanden und aufgetretene Fehler. Keine
   Cookies, Tokens oder vollständigen Browserprofile speichern.

Externe Kacheln, Fonts/Sprites des Kartenanbieters und öffentliche Artikelbilder
bleiben netzabhängig. Ein Offline-Test ist kein Ersatz für die Funktionsprüfung.

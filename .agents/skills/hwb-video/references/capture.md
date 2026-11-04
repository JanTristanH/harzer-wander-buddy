# Aufnahmeablauf: aktuelle echte Web-App

Vor neuen Aufnahmen und Exporten den aktuellen **develop pullen**, wie im [Video-Skill](../SKILL.md) beschrieben. Tatsächlichen Commit dokumentieren. Diese Datei ergänzt den aktuellen Video-/Brand-Skill; die historische Generator-Dateiliste weiter unten ist optional.

## Lokale App mit Anmeldung

Die Repository-Dokumentation hat Vorrang bei Änderungen an Profilen oder Skripten.

```bash
# Terminal 1, aus backend/hwb:
PORT=4006 npm run start:basic

# Terminal 2, aus app: stabile Web-Aufnahme ohne Entwicklungs-Overlay
EXPO_PUBLIC_AUTH_MODE=basic EXPO_PUBLIC_BACKEND_URL=http://localhost:4006 \
  npx expo export --platform web --output-dir <temporaerer-webexport>
```

Den Export mit einem lokalen HTTP-Server ausliefern, der statische Routen wie `/login` auf `/login.html` und App-Routen ohne eigene Datei auf `index.html` abbildet. Nicht den Produktions-Backend als bequemen Ersatz wählen. Der lokale Basic-Start verwendet die ignorierte `db.local.db`; vorhandene Besuche werden nicht durch einen neuen Seed überschrieben.

Browser-Kontext mit 390×844 und DPR 2 erstellen. Testzugang ausschließlich aus der Repository-`AGENTS.md` lesen, Formular ausfüllen und anmelden. Gegebenenfalls Onboarding mit einem fiktiven Namen wie „Wander-Buddy“ abschließen.

**Basic-Anmeldung ist absichtlich nur im Speicher:** Nach Login kein `page.goto`, Reload oder neues Dokument für die Navigation verwenden; dadurch wird die Anmeldung verworfen. Über echte In-App-Links/Knöpfe und die SPA-Zurücknavigation gehen. Nach einem notwendigen Reload erneut anmelden. Vor dem Foto prüfen, dass Besuche speicherbar sind und kein „Anmelden zum Stempeln“ erscheint.

Der Entwicklungsserver hatte bei dieser Aufnahme gelegentlich Icon-Font-Timeouts mit Fehler-Overlay. Dafür den statischen Export verwenden; nicht eine kaputte Ansicht für den Screenshot verstecken. Native Emulatoren, Expo Go und EAS sind für diesen Web-Ablauf nicht erforderlich.

## Die Aufnahmen

Nur eigene Demo-Daten aufnehmen. Bei der ursprünglichen Fassung wurden die Stempel 1–5 über die App gestempelt; die Liste zeigte danach „5 von 222“. Diesen Wert nicht bloß als Zahl in ein Bild schreiben. Vorhandene Testbesuche verwenden; wenn schon mehr vorhanden sind, entweder den tatsächlichen Stand zeigen oder eine ausdrücklich getrennte Testdatenbank nutzen. Keine bestehenden Besuche für eine runde Zahl löschen.

Dateien nur für die ausdrücklich gewünschte historische klassische Generator-Vorlage:

| Dateiname | Inhalt |
|---|---|
| `list.png` | Echte angemeldete Liste, Suche leer, Fokus entfernt, Fortschritt geladen |
| `search.png` | Echte Suche nach Eckertalsperre mit passendem Ergebnis |
| `before-stamp.png` | Detailansicht vor dem gezeigten Stempelvorgang |
| `stamp-animation.png` | Holzstempel gut sichtbar beim Gedrückthalten des echten Knopfs |
| `stamp-success.png` | Erfolgszustand mit gespeichertem Besuch |
| `map-focused.png` | Nähere Karte um Stempel 1 mit grünen besuchten und offenen Markern |
| `map.png` | Etwas weiterer Ausschnitt mit unterscheidbaren Markern |
| `buddy.png` | Freigegebenes App-Artwork, z. B. `app/assets/images/onboarding-bear.png` |
| `music.mp3` | Freigegebene lokale Musik, kein Credential-/Netzwerkverweis |
| `click.ogg` | Freigegebener dezenter UI-Klick |
| `gsap.min.js` | Lokales GSAP 3.14.2 für die Vorlage |

Nur diese Dateien werden übernommen. Keine Cookie-/Storage-State-Dateien daneben als „Assets“ einschleusen.

## Karte richtig einrahmen

Den tatsächlichen Karten-Zoom und echte Ziehgesten nutzen. Die initiale Gesamtübersicht legt viele Marker übereinander und eignet sich nicht für den Film. In der Web-App sind Marker über `.leaflet-marker-icon[aria-label^="Stempel 1:"]` auffindbar. Bei Bedarf Markerposition messen, durch echte Map-Drags zentrieren und dann schrittweise zoomen. Nach jedem Zoom neu zentrieren, bevor der Marker aus dem Viewport verschwindet.

Labels müssen „besucht“ für die Demo-Stempel und „unbesucht“ für die Nachbarn zeigen. Gegen die gespeicherten lokalen Besuche und das sichtbare UI prüfen, keine Farben nachträglich erfinden. Nicht nur die Anzeige-Toastmeldung als Beweis einer erfolgreichen Speicherung werten.

## Stempelmoment ohne Doppelbesuch

Für einen zusätzlichen Actor-Screenshot den bereits besuchten Stempel öffnen, auf „Erneut stempeln“ drücken und etwa 1000 ms halten. Den Stempel noch bei gedrückter Maustaste fotografieren. Danach außerhalb des Knopfes ziehen und erst dort loslassen. So wird die Animation sichtbar, ohne einen zusätzlichen Besuch zu bestätigen. Falls doch ein Klick abgeschickt wurde, den tatsächlichen Stand prüfen und nicht unbemerkt doppelte Demo-Besuche sammeln.

Browser-Kontext zum Schluss schließen; keine angemeldeten Profile oder Sitzungsarchive speichern.

## Aktuelle Chatreihe: Tour und Gruppenbilder

- Standard ist eine echte mobile Aufnahme390×844 bei DPR2. Für einen besser lesbaren Bildanhang darf die echte App auch z.B.600×600 bei DPR2 geöffnet werden; dabei das originale Seitenverhältnis des aufgenommenen Bereichs bewahren.
- Die Tour über die echte SPA öffnen. Statisch exportierte dynamische Direkt-URLs können im Ladezustand hängen; dann über „Touren“ zur bestehenden lokalen Demo-Tour navigieren.
- Kartenkacheln und gespeicherte Routensegmente laden lassen. Echten Kartenbereich mit `page.screenshot(clip=<gemessene-bounds>)` aufnehmen, ohne DOM-Manipulation, gezeichnete Ersatzroute oder versteckte Fehlermeldungen. Eine funktionierende, auf die Tour angepasste Inlinekarte ist besser als eine unpassend weit herausgezoomte Vollbildkarte.
- Die aktuelle Implementierung lädt Route/TravelTime-Geometrie. Kontrollieren, dass tatsächlich Fußwege gezeichnet werden, nicht nur Stopps geradlinig verbunden sind. App-Commit und Wegdaten/Koordinaten im Manifest festhalten.
- Stempelnummer und Ortsname auch bei A/B/C-Tourmarkern erkennbar zuordnen. Für Gruppenstände die echte ausgewählte Gruppe und die zugehörigen gespeicherten Besuche dokumentieren.
- Für die Demo nur isolierte lokale Daten verwenden. Reale angemeldete Aufnahmen mit echten Aktionen bevorzugen; keine Produktansichten aus Fantasie erzeugen. Falls lokale API-Fixtures technisch nötig sind, ausdrücklich dokumentieren und keine Funktion simulieren, die die App nicht besitzt.
- Im Video jede Aufnahme proportional skalieren. Nummern/Namen, Marker, Details und Attribution nicht wegschneiden. Quelle/Autor/Lizenz für tatsächliche Landschaftsbilder dokumentieren. Der Aufnahmeprozess darf den Screenshot nicht vorab verzerren.

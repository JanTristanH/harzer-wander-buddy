# Mobile Web-Karte: Renderkosten reduzieren

Analyse der Vorschau `/preview/overview/app/map`, 24.10.2026.

## Befund und Änderung

Die ausgelieferte Karte verwendet bereits CSS-Div-Marker; im mobilen
Startausschnitt sind alle 222 regulären Stempel als einzelne Marker vorhanden.
Der Hintergrund wird dagegen von MapLibre GL innerhalb von Leaflet gerendert.
Der Liberty-Stil enthält 111 Layer und benötigt zusätzlich Stil, Tile-Metadaten,
Vektorkacheln, Sprites und Schriftdateien. Die längsten beobachteten
Netzwerkanfragen lagen unter 0,5 Sekunden. Im CPU-Sampling liegt die meiste
zuordenbare JavaScript-Arbeit im MapLibre-Modul; zusätzlich entstehen lange
Aufgaben beim Grafikaufbau.

Bei 390 × 844 CSS-Pixeln und `deviceScaleFactor: 3` erzeugt der bisherige
Renderer einschließlich Leaflet-MapLibre-Puffer ein Canvas mit 1404 × 3039
Pixeln. Die neue Obergrenze `pixelRatio: 1.5` reduziert es auf 702 × 1519:
von 4.266.756 auf 1.066.338 Pixel, rund **75 % weniger Zeichenfläche**.
Bildschirme mit DPR 1 bleiben unverändert. Nur der Hintergrund wird mit
geringerer Auflösung gezeichnet; DOM-Stempel, Zahlen und Bedienelemente behalten
die Bildschirmauflösung. Kartenschrift kann auf hochauflösenden Geräten etwas
weicher aussehen. `fadeDuration: 0` vermeidet zusätzliche MapLibre-Frames für
Beschriftungsübergänge; Leaflets Karten- und Markerzoom bleiben animiert.

Stempel bleiben nun unabhängig vom Viewport montiert. `visibleStampItems`
bleibt bei reinen Regionsänderungen referenzstabil, sodass auch die memoisierten
Marker-Elemente erhalten bleiben. Die 222 Stempel werden weder geclustert noch
beim Zoomen entfernt. Fachliche Stempelfilter gelten weiterhin. Die bestehende
Viewportbegrenzung für Parkplätze bleibt erhalten.

## Prüfung

- Echter statischer Expo-Export mit `scripts/build-static-website.mjs`.
- 35 Tests in fünf Karten-Testsuites sowie gezieltes ESLint und `git diff --check`.
- Playwright/Chromium bei 390 × 844 und DPR 3: Canvasgröße und 222 Marker prüfen;
  zoomen, verschieben und einen Marker auswählen. Identität der Marker-DOM-Knoten
  nach Zoom und Verschieben prüfen, nicht nur deren Anzahl.
- A/B auf derselben ausgelieferten JavaScript-Datei mit ausschließlich geänderten
  MapLibre-Optionen. Die Canvas-Reduktion ist in allen drei Paaren identisch.
  Long-Task-Zeiten schwanken deutlich; zwei Paare wurden durch einen parallel
  laufenden Export beeinflusst. Deshalb keine allgemeine Ladezeit- oder
  FPS-Prozentverbesserung daraus ableiten. Im letzten Paar ohne Export sank die
  längste Aufgabe von 467 auf 234 ms. Chromium verwendet hier Software-WebGL;
  ein echter Handyvergleich bleibt für belastbare FPS-Aussagen erforderlich.

Screenshot des exportierten Builds:

![Mobile Karte nach Zoom, Verschieben und Marker-Auswahl](screenshots/mobile-web-map-performance/after.png)

## Weiterer mobiler Engpass: Vektorhintergrund (25.10.2026)

Der reduzierte Stil behält die Vektorkachel-Decodierung, Beschriftungsberechnung
und den GL-Renderer bei. Deshalb steht nun „Schnell (Raster)“ zur Verfügung;
auf schmalen oder per Touch bedienten Geräten ist dies die Vorauswahl.
Die vorhandenen Vektorstile bleiben zum Vergleichen auswählbar.

Raster verwendet normale 256px-OSM-Bildkacheln über Leaflet, ohne Retina-
Vervielfachung, mit `updateWhenIdle: true`, `updateWhenZooming: false` und einem
Pufferring. Während Gesten verschiebt/skaliert der Browser vorhandene Bilder.
Ein Raster-/Vektorwechsel entfernt den bisherigen Hintergrund vollständig;
Marker und Kartenposition bleiben bestehen. Die OSM-Attribution ist im
Rastermodus ständig sichtbar. Die Darstellung unterscheidet sich vom bisherigen
Liberty-Stil; dies ist keine vorgerenderte Kopie des reduzierten Vektorstils.

Vergleich im Chromium-Software-WebGL-Browser bei 390×844, DPR 3 und vierfacher
CPU-Drosselung: dieselben zwei Pan-/Zoom-Sequenzen je Modus, nach dem Laden des
Stils. Der 95%-Bildabstand lag bei 250 ms für „Wandern reduziert“ und 33,4 ms
für Raster. Die Anzahl der Long Tasks fiel von 66 auf 4, die längste von 600
auf 73 ms. Diese einzelnen simulierten Messungen sind keine FPS-Garantie für
physische Handys. Der strukturelle Unterschied ist reproduzierbar: Raster startet
beim mobilen Einstieg keinen WebGL-Kontext und hat kein GL-Canvas; beim Wechsel
auf einen Vektorstil erscheint ein Canvas, beim Zurückwechseln verschwindet es.

Alle 222 Stempelnummern bleiben in jedem Modus montiert. Zusätzlich geprüft:
Schriftstatus, gleiche Marker-DOM-Knoten und Positionen beim Stilwechsel,
Zoom/Pan, Marker-Auswahl, korrekt geladene Rasterkacheln und Anbieter-Attribution.
Der vorhandene JavaScript-Build enthält weiterhin die Vektorbibliothek für die
optionalen Stile; eine kleinere JS-Downloadgröße wird hier nicht behauptet.

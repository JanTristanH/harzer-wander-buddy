# Buddy plant eine Tour

Vier Sekunden: Karte hoch, Blick nach links und rechts, Karte herunter. Stummer, nahtloser UI-Loop; kein Marketing-Reel. Die beiden Bildlagen wurden für diese Funktion mit Bildgenerierung aus dem vorhandenen Buddy (`app/assets/images/onboarding-bear.png`) erstellt und anschließend in Remotion animiert. Die im Auftrag ausdrücklich gewünschte UI-Animation bestimmt Format und Länge.

Rendern: Node 20, FFmpeg und Chromium; in diesem Ordner `npm ci` und `npm run render`. Optional `REMOTION_BROWSER_EXECUTABLE` auf vorhandenes Chromium setzen. Remotion: 540 × 720, 60 fps, 240 Frames; Laufzeitdatei: animiertes WebP, 270 × 360, 24 fps. Kein neues natives Video-Modul erforderlich. Expo Image spielt den Loop lokal ab. Bei reduzierter Bewegung erscheint nur das Poster.

Quellbilder und Komposition sind hier versioniert. Die App enthält nur WebP und Poster. Die Animation zeigt ausschließlich den laufenden echten Request; sie führt keine Wartezeit ein. Die Ausgangskomposition wurde bereits über alle 240 Frames, identische Anfangs-/Endpose und wiederholtes Seeking geprüft. Ein nativer Sichttest auf dem PR-Stand bleibt im Review-Nachweis separat ausgewiesen.

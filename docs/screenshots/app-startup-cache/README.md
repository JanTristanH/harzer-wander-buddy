# Offline-Cache-Prüfung im Browser

Chromium, 412 × 915 CSS-Pixel, 2026-11-07. Daten stammen ausschließlich aus einer
synthetischen Test-Sitzung „Dora Demo“ mit zwei vorab gecachten Stempelstellen.
Es wurden keine produktiven Anmeldedaten verwendet und kein Browserprofil,
Storage-State oder Laufzeit-Token als Artefakt gespeichert.

Der lokale Expo-Dev-Server lieferte HTML/JavaScript. Die App-Verbindung war über
`navigator.onLine=false` als offline markiert; Backend-/Auth-Anfragen wurden
zusätzlich abgefangen und blockiert. Nach einem vollständigen Seiten-Reload
waren Liste und Profil aus dem Cache bedienbar. Gemessen: **0 Backend-/Auth-Anfragen**,
**0 Seitenfehler**. Der ursprünglich fünf Minuten alte Profil-Zeitstempel blieb erhalten.

- [offline-list.png](offline-list.png): gespeicherte Liste mit Fortschritt und Offline-Hinweis.
- [offline-profile.png](offline-profile.png): gespeichertes Profil nach Navigation im Offline-Zustand.

Dies ergänzt die automatisierten React-Native-/Query-Provider-Tests. Ein nativer
APK-Prozess-Neustart oder eine Geräte-Laufzeitmessung ist damit nicht belegt.

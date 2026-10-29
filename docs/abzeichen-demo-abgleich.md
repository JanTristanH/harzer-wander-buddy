# Abzeichen-Demos und vollständige App

Die beiden veröffentlichten Sites sind bewusst eigenständige Mock-Demos.
Der React-Test ist ein echter Expo-/React-Native-Webexport des Abzeichenbereichs,
aber kein Export sämtlicher App-Funktionen. Änderungen an einer Site aktualisierten
bislang nicht automatisch den GitHub-PR. Die jetzt geprüften App-Änderungen werden
mit dieser PR-Aktualisierung separat übernommen.

| Bereich | Sites-Demos | App in diesem PR |
| --- | --- | --- |
| Name, Titel, Rahmen, drei Abzeichenplätze | Browserlokale Auswahl | Vorhandene Profil- und Abzeichen-APIs, kontobezogen |
| Früherer Name-/Bild-Editor | Der React-Test nutzte eine vereinfachte lokale Bildauswahl; der vollständige alte Editor war dort nicht enthalten | `/profile/edit` unverändert vorhanden und über Avatar sowie „Name und Profilbild bearbeiten“ erreichbar |
| Profilbild | React-Test: lokales Foto, kein Kontoupload | Bestehender Bildwähler mit Berechtigungen, quadratischer Auswahl, Upload und Fehlerbehandlung |
| Anmeldung und Wiederherstellung | Keine echte Anmeldung; kein Kontoabgleich | Bestehende Anmeldung, Token-/Kontozuordnung und Query-Cache |
| Besuchshistorie und Freischaltungen | Vier erfundene, umschaltbare Szenarien | Vollständige persönliche Historie und serverseitige Validierung/Entzug |
| Offline | Simulierter Zustand | Bestehender Cache und reale Schreibsperre |
| Profilstatistik, Freunde, Besuchsverlauf, Einstellungen, Footer | Weitgehend nicht enthalten | Bestehende Profilbereiche bleiben erhalten |
| Stempelstellen | Lokaler Katalog, Beispielnavigation | Bestehende gemeinsame Listenkarte und echte Detailrouten |
| Karten, Touren, Gruppen, echte Stempelaktionen und Administration | Nicht Teil der Demo | Bestehende App-Funktionen, durch diesen PR nicht ersetzt |
| Native Rechte, Haptik und Geräteverhalten | Browserdarstellung | Native App; eine neue Geräteabnahme steht aus |
| Physische Abzeichen | Information und offizielle Links, kein Nachweis | Ebenfalls nur Information; maßgeblich sind offizielle Nachweise und Ausgabestellen |

Der alte Editor wurde in der App nicht gelöscht. Sein Fehlen in der reduzierten
React-Demo war keine Aussage darüber, dass der normale Upload oder andere
App-Bereiche aus dem PR entfernt worden wären.

Die Mock-Sites bleiben getrennte Vorschauen. Weder die Demo-Besuche noch deren
lokale Profilbilder werden in den produktiven Kontostand übernommen. Die Demos
sind keine Live-Abnahme von Authentifizierung, Kontospeicherung oder Bild-Upload.

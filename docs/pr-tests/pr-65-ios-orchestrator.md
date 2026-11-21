# PR #65: eigene iOS-Nachprüfung und Persistenzfix

Geprüft am 16. November 2026 auf iPhone 18 Pro, iOS 27.2. Ausgangs-PR-Head: `003218d8db38658c06d518570344d60dd926fd32`. Der native Teststand integriert zusätzlich lokal die auf develop vorhandenen UIScene- und SQLite-Installer-Fixes (`3fff000fe5139c747c7107cbc4725dd8e82d8f02`, `4a953c2e97b69e99e8c1aba4ebd75ae3fe226f11`). Diese Integrationsdateien sind kein Bestandteil des hier beschriebenen Persistenzfixes. Basic-Backend mit isolierter SQLite-Testdatenbank und synthetischen Besuchen, keine Produktionsdaten.

## Eigene Ergebnisse

- Anmeldung bleibt nach App-Neustart erhalten.
- Rahmenauswahl funktioniert nach Scrollen im Editor. Bronze auswählen, speichern, App neu starten, Editor erneut öffnen: Bronze bleibt markiert.
- Profil und Liste zeigen nach Ende der bestehenden Fortschrittsanimation übereinstimmend 51 besuchte Orte und 23 Prozent. Der kurzzeitig angezeigte Listenwert 50 wurde als Animationszwischenstand eingeordnet.
- Vollständige Timeline über den Listen-Fortschrittsbereich geöffnet: zwei neue Besuche und 50 synthetische ältere Besuche sichtbar. Kein vollständiger Test aller Timeline-Filter oder Datumssprünge.
- Profilname war vor dem Fix nach Neustart reproduzierbar veraltet. Die gespeicherte Basic-Sitzung enthielt weiterhin den früheren Profilnamen, obwohl Editor und Backend den neuen Namen kannten.

## Fix und Nachweis

Der BasicAuthProvider synchronisiert jetzt Änderungen am aktuellen Profil auch in die bestehende geschützte Sitzungsspeicherung. Die vorhandene serialisierte Schreibwarteschlange verhindert, dass ein Profil-Schreibvorgang die Löschung beim Logout überholt. Browser-Sitzungen bleiben nur im Speicher.

Neue Regressionstests für iOS und Android schlugen vor dem Fix fehl: gespeicherter Name und Bild blieben unverändert. Mit Fix bestehen 24 Tests in drei Suites (`basic-auth-persistence`, `basic-auth-profile-edit`, `badge-customize`), TypeScript, gezieltes ESLint und `git diff --check`. Der vorangegangene Luna-Lauf hatte bereits 411 App-Tests in 77 Suites und 11 gezielte Backend-Tests bestanden; die vollständige Suite wurde nach dem Fix nicht erneut ausgeführt.

Der ad-hoc signierte iOS-Release-Build mit Fix wurde neu gebaut und installiert. Im nativen Editor Testnamen ändern, speichern, App neu starten, Profil öffnen: neuer Name bleibt sichtbar. Anmeldung, drei ausgewählte Abzeichen und 51 besuchte Orte bleiben erhalten. Bildpersistenz ist durch Regressionstests abgedeckt, der native Foto-Upload wurde nicht erneut abgenommen.

## Evidenz

- [Profilname vor Fix nach Neustart](evidence/pr65-profile-after-relaunch.png)
- [Bronze-Rahmen nach Neustart weiterhin gewählt](evidence/pr65-frame-persisted.png)
- [Profilname mit Fix nach erneutem App-Neustart](evidence/pr65-profile-persisted-fixed.png)

## Merge-Status

Noch keine vollständige native Freigabe: Fotoauswahl/Zuschnitt/Upload/Zoom, Meilenstein am achten einzigartigen Ort und vollständiger Freundschaftsablauf bleiben offen. Die neueren develop-Baseline-Fixes müssen im integrierten Merge-/Release-Stand enthalten sein. Restaufwand für diese Fälle geschätzt 1–2 Stunden; nicht als feste Zeitgarantie oder als bestandene Tests verstehen. Neue CI-Prüfungen nach dem Fix abwarten und Review durchführen.

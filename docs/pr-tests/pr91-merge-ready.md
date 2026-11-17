# PR91 – Integration für den Merge

17.November2026. Ausgangshead a4f243c50e15f4f1d28c19fc51af8ca3ffd94510, aktuelles develop fc0a009 (#65, #121, #122 und iOS-/SQLite-Baselines enthalten) ohne Force-Push integriert.

Einziger Textkonflikt: app/components/stamp-list-item.tsx. Beide Seiten definierten denselben Web-Interaktionsstil; die mehrzeilige gleichwertige Typdefinition erhalten. Tourenautomatik, bestehender Editor, gemeinsame Erfolgskarte/Abzeichen und neuer Profileditor bleiben gemeinsam enthalten.

Nach Integration sequenziell erfolgreich:

- App:432Tests/83Suites.
- Backend:74Tests, einschließlich echter HTTP-Tourenverträge/Geometrie/Gruppen-/Speicherregeln.
- CI-/Release-Skripte:74Tests.
- TypeScript und ESLint der integrierten Laufzeitdateien ohne Fehler.
- Vollständiger Basic-Expo-Webexport erfolgreich, git diff --check sauber.
- Keine offenen GitHub-Reviews oder Inline-Reviewkommentare beim Abgleich.

Native Nachprüfung des integrierten Heads folgt separat mit isoliertem Releasebinary, eigener SQLite und Backend41091. Vorangegangene iOS-Ergebnisse werden nicht als Prüfung dieses neuen Heads ausgegeben. Der normale Checkout und #89-Ports14004/18081 bleiben unberührt; bestehender Orchestratorcheckout verwendet, kein neuer Worktree.

## Konkreter Rollout-TODO

Gegen aktuelles develop ergänzt das DB-Schema ausschließlich Tours.previewSvg (LargeString, readonly). Reguläre PostgreSQL-Migration vor der neuen App verwenden; keine produktive Migration in diesem Auftrag. calculateHikingRoute liefert den dokumentierten inkompatiblen Pfadvertrag mit travelTime_ID/rank/eingebettetem travelTime sowie zusätzliche Ergebnisfelder. Backend und App gemeinsam ausliefern. Keine zusätzliche Produktentscheidung, kein manueller Versionsbump und kein zusätzlicher Docker-Publish nötig.

Keine Produktion, kein Merge und kein Auto-Merge ausgelöst. Abschließende native Evidenz und neue GitHub-CI am gepushten Integrationshead ergänzen.

Native Nachprüfung am Integrationshead: Login/Onboarding, Presets/5Minuten-Gesten, fünf echte Vorschläge, Karte/Sheet/Stationen, Speichern/Editor bestanden. Root bestätigte zusätzlich Fertig, Name nach Neustart, erneutes Öffnen und echte GPX-Datei708Punkte. Keine reproduzierbare Regression. Details pr91-native-merge-ready.md. GitHub-Checks am Runtimehead vollständig grün; nachfolgender Commit enthält ausschließlich Berichte/Bilder.

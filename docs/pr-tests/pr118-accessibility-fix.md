# PR118: Accessibility-Findings korrigiert

17.11.2026. Ausgangshead a107060; Codekorrekturen b914114 und ff8fd65. Aktuelles develop (UIScene-/SQLite-/Fingerprint-Basis) und #65-Persistenzfix tatsächlich in den Branch integriert.

## Änderungen

- Stempeldetails verwenden natürliche Textzeilenhöhen, wachsende Buttons, umbrechende Kopfaktionen und einen auf 45 Prozent begrenzten scrollbareren Aktionsbereich bei großer Schrift. Der Detailbaum wird bei einer Änderung des Schriftmaßstabs neu aufgebaut, damit native Textmaße nicht veraltet bleiben. Schriftvergrößerung bleibt aktiviert.
- Abschnittstitel und Headeraktionen stehen bei großer Schrift untereinander; lange Titel dürfen schrumpfen/umbrechen.
- Freunde-Filter erhalten Button-Rolle, Namen und Auswahlzustand. iOS stellte die zunächst getestete Tab-Rolle weiterhin als `other` dar; die finale Button-Rolle ist nativ bestätigt.
- Profilbearbeitung ist als benannter Button sichtbar. Gruppencheckboxen bilden jeweils einen benannten Accessibility-Knoten mit Auswahlzustand; dekorative Kinder werden nicht separat angesagt. Anmeldeaktionen und die drei Detailaktionen erhalten ausdrückliche Namen ohne Icon-Glyph.
- Zwei vorhandene TypeScript-Probleme in externen Abzeichenlinks und dem Fetch-Testmock korrigiert; keine Paketversion geändert.

## Verifikation

- Vollständige App-Suite nach Integration: **80 Suites, 424 Tests bestanden**.
- `tsc --noEmit`: bestanden. ESLint aller geänderten TypeScript-Dateien: bestanden.
- Regressionen prüfen benannte Anmeldebuttons sowie Gruppencheckbox-Namen und Auswahlzustände.
- Echter iOS-Simulator iPhone18Pro/iOS27.2, lokale isolierte Basic-Datenbank `/private/tmp/hwb-pr118-accessibility.sqlite`, Kopie der bisherigen synthetischen PR118-Testdaten. Keine Produktionsdienste.
- Finale JS-Quellen mit Expo `export:embed --platform ios --dev false` gebündelt und in eine Kopie des vorhandenen PR118-Release-Simulatorbinarys eingebettet, ad hoc signiert und neu installiert. **Kein erneuter vollständiger Xcode-Build des finalen Branchheads behauptet.** Native Module stammen aus dem zuvor dokumentierten PR118-Releasebuild. Bundle-ID bleibt `de.kuestenbit.harzer-wander-buddy.pr118test`; OTA im nativen Artefakt deaktiviert, Backend localhost4004. Artefakt `/private/tmp/HWBPR118-Accessibility.app`.
- Native Prüfung: normale Schrift `large`, Wechsel im geöffneten Detail zu `accessibility-extra-large`, Titel/Status/Teilen/Navigation/Karte/Stempeln, Scrollen der Beschreibung und Abschnittsaktionen. Freunde-Filter als Button mit wechselndem selected-Status; Profilbearbeitung als Button; Gruppenmitglied mit vollständigem Namen und unchecked-Status bestätigt.
- Kein vollständiger VoiceOver-Hör-/Gestendurchgang, keine vollständige App-Abnahme bei maximaler Schrift. Dark Mode bleibt außerhalb des dokumentierten Vollunterstützungsumfangs.

## Screenshots

- [Detail bei normaler Schrift](evidence/pr118-detail-standard-fixed.png)
- [Detail bei maximaler Schrift](evidence/pr118-accessibility-fixed.png)
- [Abschnittsaktionen bei maximaler Schrift](evidence/pr118-section-actions-fixed.png)
- [Freundefilter mit Auswahl](evidence/pr118-friend-tabs-fixed.png)
- [Profilaktion](evidence/pr118-profile-accessibility-fixed.png)
- [Gruppenwahl](evidence/pr118-group-accessibility-fixed.png)

Systemschrift am Ende auf `large` zurückgesetzt, eigene Device-Session geschlossen. Keine Feature-PR-Merges, keine Hosted-/Provider-/Produktionsänderungen.

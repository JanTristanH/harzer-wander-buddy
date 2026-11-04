# Frontend: gemeinsame Styles und Komponenten

Geprüft auf `develop` (`cb7a0fe`, 29.10.2026). Hauptfrontend: Expo SDK 54,
React 19, React Native 0.81, React Native Web. Die SAP-UI5-Administrationsapp
unter `backend/hwb/app/frontendhwb` ist ein separates Frontend.

## Befunde und Umsetzung

- Wiederkehrende Markenfarben waren als Groß-/Kleinschreibungsvarianten in
  Screens und Komponenten verteilt. `AppColors` in `app/constants/theme.ts`
  bündelt die identischen Werte; elf bestehende Dateien verwenden diese Tokens.
  `Spacing` und `Radii` liefern die tatsächlich benötigten Abstände/Radien für
  gemeinsame Bausteine. Neue Werte erweitern dieses Theme, kein zweites System.
- Stempel- und Parkplatzdetails hatten jeweils eine eigene `Section` mit
  identischen Karten-, Header- und Titelstyles. Notiz, Standortdistanz und
  Profil-Timeline wiederholten dieselben Styles. `SectionCard` übernimmt diese
  Struktur, akzeptiert Inhalt als `children`, optionale Headeraktionen und
  native View-Props. Lokale Layoutanpassungen werden zuletzt angewendet. Die
  flachere Android-Elevation des Profils bleibt erhalten.
- Der Freunde-Leerzustand war eine private Screenkomponente; Touren stellten
  denselben Inhalt separat dar. `EmptyState` bündelt Titel, optionales Bild,
  Beschreibung und optionale Aktion. `default` bewahrt die Freunde-Karte,
  `discovery` die warme, zentrierte Tourenansicht. Die Aktion besitzt eine
  Button-Rolle und wird nur mit Beschriftung und Handler gerendert.
- Standortberechnung, verweigerte Freigabe und erneuter Versuch nach einem Fehler
  wiederholten dieselbe Aktionszeile. Sie teilen sich nun die Darstellung;
  Statusmeldungen, Beschriftungen und Callbacks bleiben getrennt erhalten.

## Regeln für weitere Änderungen

1. Gemeinsame Farben aus `AppColors` beziehen; neue semantische Tokens im
   vorhandenen Theme ergänzen. Die älteren adaptiven `Colors.light/dark` steuern
   bestehende `ThemedText`-/`ThemedView`-Verbraucher. Die feste Markenpalette
   bedeutet noch keine vollständige Dark-Mode-Unterstützung der übrigen Screens.
2. Wiederverwendete Struktur als kleine Komponente mit einer klaren Aufgabe
   extrahieren. Eine zweite tatsächliche Verwendung ist ein guter Anlass;
   individuelle Screen-Layouts bleiben lokal.
3. Inhalte und Aktionen komponieren, statt für jede Screenvariante neue
   Konfigurationsparameter einzuführen. `StyleSheet.create` behält lokale Styles
   typisiert. Dynamische Styles und plattformspezifische Anpassungen sind legitim.
4. Gleiche Zahlen sind nicht automatisch dieselbe Designentscheidung. Lokale
   Bildmaße, Kartenmarker, Animationsfarben und Statusfarben erst nach fachlicher
   Prüfung vereinheitlichen.

Weitere Kandidaten sind die ähnlichen Admin-Listenheader, Suchleisten und
Fehlerkarten sowie profilinterne Aktionen. Diese erfordern jeweils Prüfung der
Interaktionen; sie werden nicht über ein großes globales Stylesheet gekoppelt.
Der PR migriert die oben genannten Verbraucher, nicht sämtliche App-Styles.

## Quellen

Am 29.10.2026 recherchiert und mit dem vorhandenen SDK abgeglichen:

- [React: Thinking in React](https://react.dev/learn/thinking-in-react):
  Komponenten anhand von Verantwortlichkeiten und wiederholten UI-Mustern schneiden.
- [React: Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component):
  flexible Komposition über Props und `children`.
- [React Native 0.81: StyleSheet](https://reactnative.dev/docs/0.81/stylesheet):
  benannte Styles und Typprüfung über `StyleSheet.create`.
- [React Native 0.81: Style](https://reactnative.dev/docs/0.81/style):
  Style-Arrays und Reihenfolge der Overrides.

Die lokalen Expo-Skills `expo-overview`, `expo-design-system` und `expo-ui`
wurden zusätzlich geprüft. Neue `@expo/ui`-Controls sind für diesen SDK-54-
Refactor nicht erforderlich; bestehende native und Web-Komponenten bleiben
kompatibel. Kein SDK-Upgrade und keine neue Styling-Abhängigkeit.

## Verifikation

- Isolierter PR-Stand ohne die bereits vorhandenen lokalen Auth-Änderungen:
  `jest --config jest.config.js --runInBand --watchman=false`:
  **45 Suiten, 237 Tests erfolgreich**, einschließlich sechs neuer
  Interaktionstests für Leerzustand und Standortaktionen.
- `tsc --noEmit`: erfolgreich. ESLint für alle geänderten TypeScript-Dateien:
  keine Fehler oder Warnungen.
- `expo export --platform web`: erfolgreich; zusätzlich lokaler Basic-Auth-
  Export für Browserprüfungen. Keine Änderungen an Paketversionen oder Lockfile.
- Chromium mit 390 × 844 Pixeln am lokalen CAP-Testbackend: Tourensuche ohne
  Treffer, Freunde-Leerzustand mit Öffnen/Schließen der Suche, Profil-Timeline
  sowie Notiz-, Standort-, Stempel- und Parkplatz-Abschnitte geprüft. Screenshots liegen unter
  [`screenshots/frontend-shared-ui`](screenshots/frontend-shared-ui).
- Kein nativer APK-/iOS-Gerätetest in diesem Refactor. Die Android-spezifische
  Profil-Elevation bleibt explizit erhalten.

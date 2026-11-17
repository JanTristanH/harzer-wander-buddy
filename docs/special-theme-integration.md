# Sonderstempel und Themenhefte: Integration von #123 und #88

## Ausgangspunkt und Abhängigkeiten

Geprüft am 07.11.2026: #123 `13ad40cd80b0c5e49d21aa3a1a97559eff416932`, #88 `aa5806e56fa011e79ca11fee3985f33dc7dc0881`, #65 `003218d8db38658c06d518570344d60dd926fd32`, #89 `f6fa0bf8b2b7c519c2432fb0d1049d19992518e1`. Alle vier PRs waren offen. #123 enthält #65 und #89; #88 baut auf #65 auf. Diese Integration ergänzt den Stand von #123 um die Themenheftfunktionen aus #88. Kein anderer PR muss dafür erneut in diesen Branch übernommen werden.

## Gemeinsames Modell

- `Stampboxes.stampType` ist das gemeinsame Feld. Es wird keine zweite persistierte Typenspalte eingeführt.
- Die 151 Katalogeinträge und ihre stabilen UUIDs aus #123 bleiben erhalten. Neue Themenstempel aus diesem Katalog verwenden dieselben Definitionen, einschließlich Bilder, Quellen, Themen und Standortstatus.
- `catalogue/special-stamp-key-aliases.json` ordnet die 46 bisherigen `hwn:special:…`-Schlüssel explizit den kanonischen `special-…`-Schlüsseln zu. Die Zuordnung folgt den bereits in beiden Katalogen enthaltenen Lutherweg-, Karstwanderweg-, Geschichtsorte- und Grenzweg-Einträgen; keine Laufzeit-Namensähnlichkeit entscheidet über Identität.
- Vorhandene Alias-Einträge und die drei ausdrücklich unterstützten historischen Grenzweg-Kennungen werden unter ihrer bisherigen UUID wiederverwendet. Schlüssel, Namen, Bilder, Koordinaten, Besuche, Notizen und Heftverknüpfungen werden nicht umgeschrieben. `hwn-1` bis `hwn-222` bleiben reguläre Schlüssel.
- Beide Admin-Schreibpfade verwenden denselben Datenbank-Lock. `createSpecialStamp` ist bei einer bereits eindeutig vorhandenen Identität idempotent; Konflikte liefern 409. Der Import prüft alle Stempelreferenzen vor dem ersten Schreibaufruf. Bestehende Ausgaben und redaktionelle Änderungen werden wie in #88 übersprungen.
- Bereits doppelte Identitäten werden nicht automatisch zusammengeführt. Der Import bricht mit den betroffenen Schlüsseln ab. Die Initialisierung meldet solche Identitäten als Konflikte und legt dafür keine weitere ID an.
- Album, Erfolgskarte und Themenhefte verwenden denselben Regelprüfer. Grenzweg bleibt bei den bestätigten 20 regulären + 3 Sonderstempeln. Die fünf ungeklärten Heftausgaben bleiben unveröffentlicht.

## Geplante Datenbankänderungen – hier nicht produktiv ausgeführt

Gegenüber #123 sind nur die Tabellen `ThemeCollections` und `ThemeStampLinks` mit ihren in `db/schema.cds` definierten Eindeutigkeits- und Fremdschlüsselbedingungen neu. Keine bestehende Stempel-ID, kein Besuch und keine Notiz muss migriert werden. Die reguläre CAP-Schemamigration und ein etwaiger Themenheftimport im Zielsystem benötigen eine separate ausdrückliche Freigabe. Es gibt keinen Import beim Start oder Deployment.

Vor einer Freigabe: Schema-Diff des konkreten Zielsystems erzeugen, vollständige Sicherung einschließlich Stempel-, Besuchs-, Notiz- und Themenhefttabellen erstellen, Konfliktbestand lesend prüfen und Vorschau der Sonderstempelinitialisierung kontrollieren. Wenn im Zielsystem bereits das alte #88-Schema existiert, dessen `stampKind`-Spalte nicht ungeprüft löschen: den konkreten CAP-Diff separat überprüfen und sichern. Alias-Schlüssel werden zur Laufzeit erkannt; eine automatische Datenumschreibung ist nicht nötig.

Auswirkung eines später ausdrücklich gestarteten Imports: fehlende kanonische Sonderstempel und noch nicht vorhandene Heftausgaben/Zuordnungen werden angelegt. Bereits bestehende Stempel und Ausgaben werden erhalten. Ein Import besteht aus mehreren API-Transaktionen; bei einem späteren Fehler können zuvor erfolgreich angelegte Ausgaben vorhanden bleiben. Wiederholung setzt idempotent fort. Es wird keine globale Transaktion über alle Heftausgaben behauptet.

Rückfallweg: vor Schreibaktionen die neuen Admin-Aktionen sperren und die vorherige Anwendungsversion wieder ausrollen; additive Themenhefttabellen zunächst stehen lassen. Falls ein genehmigter Import rückgängig gemacht werden muss, die neu angelegten IDs anhand eines vorab erfassten Bestands abgleichen und ausschließlich nach eigener Freigabe entfernen bzw. die Sicherung wiederherstellen. Niemals Stempel mit inzwischen neu hinzugekommenen Besuchen oder Notizen ungeprüft löschen. Ein späterer Betrieb auf dem früheren #88-Branch erfordert dessen Anpassung an das gemeinsame Modell; keine blinde Spaltenumbenennung oder ID-Neuvergabe.

## Regressionen

`npm test` im Backend und die App-Jest-Suite; zusätzlich TypeScript und PostgreSQL-Schemakompilierung. `test/special-theme-integration.test.js` prüft alle 46 Aliase, drei historische Grenzweg-Kennungen, kanonisch vorinitialisierte Datensätze sowie beide Importreihenfolgen mit Wiederholungen, unveränderte Besuche/Notizen/redaktionelle Werte, alle geordneten Heftzuordnungen, 20+3-Grenzweg-Regeln und unveränderten regulären Fortschritt über 222 Stellen. Mehrdeutige Identitäten müssen vor dem ersten Import-Schreibaufruf abbrechen.

Die Screenshots unter `docs/screenshots/theme-booklets/` zeigen die übernommene Themenheftkomponente mit gekennzeichneten Beispieldaten; sie ersetzen keine native Laufzeitabnahme.

Prüfergebnis dieser Integration: 81 Backend-Tests und 427 App-Tests in 80 Suites erfolgreich, TypeScript und gezieltes ESLint erfolgreich, PostgreSQL-Schema kompiliert und vollständiger Basic-Webexport einschließlich `/theme-booklets` erfolgreich. Nach der abschließenden Normalisierung historischer Grenzweg-Kennungen nochmals alle 19 betroffenen Backend-Tests erfolgreich. Ein bestehender Proxy-Unit-Test isoliert nun auch großgeschriebene npm-Proxyvariablen und stellt sie anschließend wieder her.

Neue Chromium-Aufnahmen konnten in dieser Ausführungsumgebung wegen `socket() failed: Operation not permitted` beim Browserstart nicht erstellt werden. Die vorhandenen drei Komponentenscreenshots wurden aus #88 übernommen; ihre Herkunft und Beispieldaten sind im zugehörigen README dokumentiert. Keine neue native oder vollständige Browser-Laufzeitabnahme behauptet. Alle Datenbanktests und Importaufrufe liefen ausschließlich gegen isolierte lokale In-Memory-Datenbanken.

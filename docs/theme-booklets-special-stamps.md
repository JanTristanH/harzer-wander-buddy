# Themenhefte, Sonderstempel und benannte Themenwege

Dieser PR baut direkt auf **[Badge-PR #65](https://github.com/JanTristanH/harzer-wander-buddy/pull/65)** (`codex/abzeichenalbum`) auf. Er ersetzt weder Album, Titel, Rahmen noch deren Auswahl. Nach dem Merge von #65 kann dieser Folge-PR auf `develop` umgestellt werden. Keine Versionsbumps und kein produktiver Datenimport durch diesen PR.

## Fachliches Modell

Eine `Stampboxes`-ID bezeichnet eine sammelbare Stempelidentität. `stampKind` unterscheidet reguläre und Sonderstempel; `catalogKey` ist ein stabiler, eindeutiger Schlüssel, unabhängig von Anzeigenummer und Schreibweise. Neu angelegte Sonderstempel dürfen die regulären Nummern 1–222 nicht verwenden. Identische Koordinaten sind kein Identitätsnachweis: verschiedene Stempel können am selben Ort stehen. Umgekehrt darf derselbe Stempel in mehreren Sammlungen vorkommen, ohne seine Besuchshistorie zu duplizieren.

`ThemeCollections` beschreibt eine Ausgabe eines Themenhefts oder einen **benannten Themenweg**, wie vom Nutzer bestätigt. Nutzer-Touren und berechnete `TravelTimes` bleiben eigenständig. Ein Themenweg ist hier ein kuratiertes Sammelziel mit geordneten Stellen, keine automatisch erzeugte oder als begehbar bestätigte Routengeometrie.

Jede Ausgabe besitzt Code, Ausgabe, Quellenverweis, Prüfdatum, Regeln, erwartete Anzahl und Veröffentlichungsstatus. `ThemeStampLinks` ordnet Stempel-IDs geordnet und eindeutig als Pflicht- oder Wahlstellen zu. Ein Gesamtschwellenwert für reguläre Stempel bildet den Steiger ab. Fehlende Angaben bleiben Entwürfe; eine unbekannte Gesamtzahl bleibt `null`.

Die optionale `badgeId` verbindet eine Ausgabe mit `goethe`, `witch`, `border` oder `steiger` aus #65. Pro Badge darf genau eine veröffentlichte Ausgabe die Regeln liefern; Datenbank-Eindeutigkeit schützt das auch bei konkurrierenden Schreibvorgängen. Neue Hefttypen bekommen dadurch **nicht automatisch erfundene Badge-Motive, Titel oder Rahmen**.

## Gemeinsame Regeln mit dem vorhandenen Album

`badge-catalog.js` bleibt der zentrale Regelprüfer. `theme-badge-rules.js` übersetzt veröffentlichte Zuordnungen in dessen Pflicht-, Wahl- und Schwellenbedingungen. Das bestehende `buildAlbum` nimmt diese Regeln als Ergänzung seines Katalogs an; Auswahlvalidierung und Entzug nicht mehr berechtigter Titel/Rahmen verwenden damit dieselben Bedingungen. Ohne verknüpfte veröffentlichte Ausgabe bleiben die Regeln aus #65 gültig.

Die Themenheftansicht verwendet denselben Prüfer, nicht eine zweite Freischaltlogik. Sie zeigt gesammelte/fehlende Stellen, Pflicht- und Wahlfortschritt, die Ausgabe und den Link zum zugehörigen Album. Zähler wie „11 von 20 Stellen gesammelt“ sind ein Inventarzähler; der Hexen-Stieg kann sein Sammelziel bereits mit neun Wahlstellen plus zwei Pflichtstellen erreichen. Digitale Besuche ersetzen den offiziellen Wanderpass-/Begleitheftnachweis nicht.

Neue offizielle Grenzweg-Kennungen `9901`, `9902`, `9903` und die stabilen Sonderstempelschlüssel werden auf die bereits in #65 verwendeten Identitäten abgebildet. Exakte historische Kennungen wie `SX-Jungborn` werden beim Import wiederverwendet. Unklare Mehrfachtreffer stoppen den Import. Die reguläre Profil-/Freundesstatistik und allgemeine Badge-Schwellen bleiben auf HWN 1–222 begrenzt; Sonderstempel erscheinen weiterhin in Besuchshistorie und Karte. Offene Gültigkeitsgrenzen (`null`) werden als unbeschränkt behandelt, damit solche neu angelegten Stellen nicht aus der Standardkarte verschwinden.

## Katalogstand und verbleibende Datenlücken

`backend/hwb/catalog/theme-booklets.json` enthält **12 Ausgaben, davon sieben vollständig zugeordnet**, sowie **46 explizite Sonderstempel**. Die 222 regulären Stellen werden anhand ihrer Nummer aus der vorhandenen Datenbank aufgelöst; keine bestehenden Produktiv-UUIDs sind fest eingebrannt.

| Sammlung / Ausgabe | Zuordnung | Herkunft und Freigabe |
| --- | --- | --- |
| Lutherweg | 10 Stellen: sieben Sonderstellen plus HWN 219, 215, 216 | Vollständige offizielle Tabelle; Veröffentlichung vorgesehen |
| Karstwanderweg Südharz | 24 Stellen: zehn Sonderstellen plus 14 reguläre | Vollständige offizielle Tabelle; Veröffentlichung vorgesehen |
| Harzer Geschichtsorte | 32 Stellen: 26 Sonderstellen plus sechs reguläre | Vollständige offizielle Tabelle; Veröffentlichung vorgesehen |
| Goethe im Harz | 28 reguläre Pflichtstellen | Vollständige vorhandene Regel aus #65, ausdrücklich als dessen Ausgabe bezeichnet |
| Harzer Hexen-Stieg | zwei Pflichtstellen plus 18 Wahlstellen, davon neun nötig | Vollständige vorhandene Regel aus #65 |
| Harzer Steiger | 23 Pflichtstellen und 111 reguläre insgesamt | Vollständige vorhandene Regel aus #65 |
| Grenzweg – Badge-Katalog #65 | 20 reguläre plus drei Sonderstellen | Bestehende bestätigte digitale Regel bleibt erhalten; keine stillschweigende Umstellung |
| Grenzweg – aktuelle Ausgabe | offen | Offizielle Seiten widersprechen sich; Entwurf |
| Klosterwanderweg | Liste offen | Themenübersicht nennt 15, Wegseite 16; Entwurf |
| Festjahr Quedlinburg | Liste und Gesamtzahl offen | Entwurf mit `expectedStampCount: null` |
| Selketal-Stieg | 17 Stellen, vollständige Liste offen | Entwurf |
| Jubiläumsheft 2026 | 20 angekündigt, Abstimmungstabelle hat 19 Standorte | Entwurf; Aufstellzeit bis Ende März 2027 ist keine belegte Einlösefrist |

**Das ist keine Behauptung, sämtliche mehr als 200 Sonderstempel der HWN bereits importiert zu haben.** Das technische Modell erlaubt ihre vollständige Zuordnung, der vorliegende Datenstand deckt die genannten Sammlungen ab. Weitere permanente, mobile oder temporäre Sonderstempel und Ausgaben müssen anhand belastbarer Listen ergänzt werden. Die fünf offenen Ausgaben bleiben verborgen, statt falsche vollständige Sammelziele anzuzeigen. Deshalb bleibt der Folge-PR zunächst Entwurf.

### Quellenprüfung vom 20.10.2026

- [Themenhefte](https://www.harzer-wandernadel.de/die-wandernadel/themenhefte/): Regeln und angekündigte Sammlungen.
- [Lutherweg, vollständige Zehn-Stellen-Tabelle](https://www.harzer-wandernadel.de/stempelstellen/lutherweg/): enthält ausdrücklich die regulären Referenzen 219, 215 und 216.
- [Karstwanderweg, vollständige 24-Stellen-Tabelle](https://www.harzer-wandernadel.de/stempelstellen/karstwanderweg/): Koordinaten in Grad/Dezimalminuten wurden rechnerisch in Dezimalgrad umgewandelt.
- [Geschichtsorte, vollständige 32-Stellen-Tabelle](https://www.harzer-wandernadel.de/stempelstellen/harzer-geschichtsorte-burgen-und-schloesser/).
- [Sonderstempel](https://www.harzer-wandernadel.de/stempelstellen/sonderstempel/): nennt **9900 Grenzturm Rhoden sowie 9901 Jungborn, 9902 Zweiländereiche und 9903 Dreiländerstein** als Grenzweg-Pflichtstellen. Die Themenheftseite nennt weiterhin 20 + 3. Nummer 9900 ist damit fachlich erfasst, aber in keiner unbestätigten Ausgabe als automatisch gültige zusätzliche Pflicht freigeschaltet. Seine UTM-Koordinaten wurden nicht ohne geprüfte Umrechnung als Dezimalgrad importiert.
- [Klosterwanderweg](https://www.harzer-wandernadel.de/stempelstellen/klosterwanderwerg/): 16 Stellen gegenüber 15 in der Themenübersicht.
- [Jubiläumsheft 2026](https://www.harzer-wandernadel.de/jubilaeumsheft-2026/): angekündigte Zahl und Aufstellzeit gegenüber Abstimmungstabelle.
- [Regeln des zugrunde liegenden Badge-PR](abzeichenalbum.md): bereits bestätigte digitale Ausgaben, keine neue unabhängige Verifikation offizieller Listen.

Quellenverweise und Koordinaten werden gespeichert; keine vollständigen Beschreibungen, Heftseiten oder fremden Bildmotive übernommen. `S-…`-Kennungen sind interne Anzeigekürzel, keine vorgetäuschten offiziellen HWN-Nummern.

## Implementierte Admin-Endpunkte

Basis: `/odata/v4/api/`. Alle Schreibaktionen und der Zuordnungsbericht erfordern die serverseitige Rolle `admin`. Normale Nutzer können nur ihre eigene veröffentlichte Sammlung über `getThemeCatalog()` lesen. Der Fortschritt akzeptiert keine fremde Nutzer-ID.

### Sonderstempel anlegen

`POST createSpecialStamp`

```json
{
  "catalogKey": "hwn:special:jungborn",
  "number": "9901",
  "name": "Jungborn",
  "latitude": 51.8856944444,
  "longitude": 10.6462777778,
  "sourceUrl": "https://www.harzer-wandernadel.de/stempelstellen/sonderstempel/"
}
```

Ergebnis: Stempelstelle mit UUID und `stampKind: special`. Koordinaten, Längen, Quellenprotokoll, Gültigkeitsintervall und reservierte reguläre Nummern werden geprüft. Ein bereits belegter `catalogKey` liefert 409; vorhandene Stelle über ihre ID zuordnen. Keine automatische Routenkalkulation beim Anlegen. Vorhandene Admin-Stempelbearbeitung kann Stammdaten anschließend bearbeiten; IDs und Schlüssel sind dabei redaktionell stabil zu halten.

### Themenheft oder benannten Themenweg anlegen / ersetzen

`POST saveThemeCollection`

```json
{
  "code": "mein-themenweg",
  "edition": "2026",
  "name": "Mein Themenweg",
  "kind": "trail",
  "sourceUrl": "https://example.org/verifizierte-wegliste",
  "reviewedAt": "2026-10-20",
  "expectedStampCount": 2,
  "minimumOptionalCount": 0,
  "regularVisitTarget": 0,
  "published": true,
  "entries": [
    {"stampId": "11111111-1111-4111-8111-111111111111", "required": true},
    {"stampId": "22222222-2222-4222-8222-222222222222", "required": true}
  ]
}
```

UUIDs im Beispiel sind Platzhalter und müssen aus existierenden Stempelstellen stammen. Für ein Heft `kind: booklet`. Optional `badgeId` für eines der vier vorhandenen Themenabzeichen. Bei Bearbeitung zusätzlich `ID` und die zuletzt gelesene `revision` mitsenden; eine veraltete Revision liefert 409. Die vollständige Mitgliederliste wird atomar ersetzt. Ungültige, doppelte oder unbekannte Stempel, unmögliche Wahlquoten und unvollständige veröffentlichte Listen werden abgelehnt. Entwürfe können unvollständig sein.

Direktes und tiefes CRUD auf `ThemeCollections`/`ThemeStampLinks` ist schreibgesperrt. Admins dürfen beide Entitäten zur Vorbereitung einer Änderung lesen, z.B. `GET ThemeCollections?$expand=entries`. Veröffentlichung erfordert die komplette erwartete Zuordnung und ein Prüfdatum; das ist eine redaktionelle Bestätigung durch den Admin, kein automatischer Abgleich mit der externen Quelle.

### Zuordnungen prüfen

`GET getThemeMappingReport()` liefert JSON als OData-String: erwartete und zugeordnete Stellen pro Ausgabe, Veröffentlichungsstatus und noch keiner Sammlung zugeordnete Sonderstempel. Eine Einzelstelle muss nicht zwingend zu einem Themenheft gehören; der Bericht ist eine Arbeitsliste, keine Behauptung eines Heftzwangs.

## Import und Einführung

Neue Tabellen/Spalten entstehen durch den vorhandenen Datenbank-Deployment-Prozess. Danach den Import explizit gegen die gewünschte Umgebung ausführen; **kein automatischer Start-/Produktivimport**:

```
node backend/hwb/scripts/import-theme-catalog.cjs
```

Ohne `--apply` validiert das Skript nur das lokale Manifest und zeigt dessen Umfang. Für den bewussten Import werden `HWB_BACKEND_URL` und `HWB_ADMIN_AUTHORIZATION` (Basic- oder Bearer-Admin-Header aus sicherer Umgebung) benötigt, dann denselben Befehl mit `--apply` ausführen. Keine Zugangsdaten in Dateien oder PRs ablegen.

Das Skript liest paginierte bestehende Stellen inklusive abgelaufener Stellen, prüft reguläre Referenzen vor dem Schreiben und legt fehlende Sonderstempel über den Admin-Endpunkt an. Bekannte exakte Grenzweg-Altkennungen werden wiederverwendet. Bestehende Heftausgaben werden übersprungen, damit Wiederholung keine redaktionellen Korrekturen überschreibt. Ein Lauf umfasst mehrere HTTP-Transaktionen: bei Abbruch bleiben erfolgreich importierte Datensätze erhalten; ein erneuter Lauf setzt anhand der stabilen Schlüssel fort. Der einzelne Heftwechsel bleibt atomar.

## Konzept für die weitere Admin-Oberfläche

1. Sonderstempel suchen oder mit stabilem Schlüssel, Anzeigenummer, Name, Kartenposition, Gültigkeit und Quelle anlegen; potenzielle Dubletten vor Wiederverwendung prüfen. Namen oder gleiche Koordinaten allein dürfen niemals automatisch Besuchshistorien zusammenführen.
2. Themenheft oder benannten Themenweg als neue Ausgabe anlegen. Existierende Stempel auswählen, Reihenfolge und Pflicht-/Wahlstatus pflegen, Schwellen festlegen. Wegverlauf bei Bedarf später als separat geprüfte GeoJSON-Linie ergänzen; aus Stempelkoordinaten keine erfundenen Wanderwege ableiten.
3. Fehlende Zuordnungen im Bericht abarbeiten, mit dem passenden offiziellen Heft prüfen, dann ausdrücklich veröffentlichen. Die Oberfläche verwendet dafür die implementierten Aktionen und die Revision; keine direkten Datenbank-Schreibwege.
4. Bei einer geänderten Stempelidentität eine neue ID verwenden und die Heftausgabe explizit zuordnen; alte Besuche und Ausgaben erhalten. Ein bloßer Namens-/Koordinatenfehler ist eine Stammdatenkorrektur derselben ID.
5. Für zukünftige neue Abzeichen sind redaktionell bestätigte Regeln und Gestaltung nötig. Eine neue Sammlung verleiht nicht automatisch Titel/Rahmen. Der Bericht und die Quellmetadaten bilden die Grundlage; eine eigene Admin-Maske und eine umfassende Änderungsjournal-Ansicht sind weitere Ausbauschritte.

## Nachweise

Automatisiert geprüft: Admin-/Leserechte, CRUD-Sperre, stabile Sonderstempel, Grenzweg-Altkennungen, Pflicht-/Wahl-/Gesamtschwellen, eindeutige Besuche, private Fortschritte, Ausgabe-Revision, vollständige Veröffentlichung, gemeinsamer Status in Album und Heft, Import über echte lokale HTTP-Endpunkte und wiederholter Import mit erhaltenen redaktionellen Änderungen. UI-Tests prüfen fehlende Sonderstempel, Filter, Navigation und Fehler mit vorhandenen Cachedaten. Komponentenscreenshots sind unter [screenshots/theme-booklets](screenshots/theme-booklets/README.md) dokumentiert. Native Gerätetests und die fünf redaktionellen Klärungen sind offen.

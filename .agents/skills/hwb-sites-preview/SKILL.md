---
name: hwb-sites-preview
description: Baue und veröffentliche eine funktionsgeprüfte Harzer-Wander-Buddy-Webvorschau als ChatGPT Site. Verwenden für HWB-Zwischenstand, Sites-Vorschau, aktualisierten Vorschau-Link oder Reparatur einer Vorschau ohne Marker oder Symbolschriften.
---

# Harzer Wander Buddy als Sites-Vorschau

Veröffentliche die echte Expo-Webapp im statischen Gastprofil. Dieser Skill ergänzt
den verfügbaren **Sites**-Plugin-Skill um HWB-Daten, Paketierung und Funktionsprüfung.
Bei „nur vorbereiten“ oder „nur PR“ nicht veröffentlichen. Keine Produktionswebsite,
keinen App-Release und keine Backend-Daten verändern.

## Quellstand und Voraussetzungen

1. Repository-`AGENTS.md`, `scripts/build-static-website.mjs` und den aktuellen
   Sites-Plugin-Skill lesen. Bestehende Änderungen und Caches erhalten; bei Bedarf
   einen separaten Worktree verwenden. Den vom Nutzer gewünschten Branch/Commit
   wählen und den tatsächlich gebauten Commit dokumentieren. Uncommittete
   Änderungen nicht stillschweigend als unveränderten Commit ausgeben.
2. Node.js und die zu `app/package-lock.json` passenden installierten Abhängigkeiten
   prüfen. Fehlende Abhängigkeiten im gewählten Checkout installieren. Keine
   Android-, Expo-Go- oder EAS-Builds für diese Webvorschau starten.
3. Sites-Werkzeuge müssen verfügbar sein. Bestehende `.openai/hosting.json` und
   Site-Identität wiederverwenden; bei unbekanntem Zugriff `get_site` verwenden.
   Neue Sites sind privat; bestehende Sichtbarkeit erhalten. Keine früheren
   Projekt-IDs, URLs, Tokens oder lokalen Maschinenpfade aus dieser Session kopieren.

## Export und öffentliche Daten

Aus dem Repository-Root; Platzhalter durch neue absolute Ausgabepfade ersetzen:

```bash
node scripts/build-static-website.mjs <expo-export>
curl --fail --location --output <public-catalogue.json> \
  https://www.harzer-wander-buddy.de/preview/overview/app/public-catalogue.json
node .agents/skills/hwb-sites-preview/scripts/prepare-preview.mjs \
  <expo-export> <public-catalogue.json> <site-checkout>/dist
```

- Einen vorhandenen `dist` erst nach Prüfung gezielt ersetzen oder einen neuen
  Ausgabeordner verwenden. Der Helfer überschreibt keine vorhandene Ausgabe.
- Nur den öffentlichen Gastkatalog verwenden, keine authentifizierten Backend-
  Antworten oder persönlichen Stempelstände. Der Helfer verlangt genau die 222
  regulären Stempel mit eindeutigen Nummern/IDs und gültigen Koordinaten und kopiert
  ausschließlich bekannte öffentliche Datenfelder.
- Der reale App-Build muss `__HWB_STATIC_CATALOGUE__` unterstützen. Der Helfer
  verweigert alte Builds. Er bettet den öffentlichen Katalog vor dem App-Bundle in
  HTML ein und ersetzt die lokalen Symbolschrift-URLs durch Font-Daten-URLs.
- `app-build.json` liefert den Basis-Pfad. Der Helfer erhält verschachtelte Assets
  und Routen, erstellt den Einstieg zur Karte und schreibt `preview-build.json`.
  Keine zweite UI nachbauen und keine beliebigen Zeichenketten im Bundle patchen.
- Die bisherige Fehlerursache: `fetch(..., {credentials: 'omit'})` kann in einer
  privaten Site ohne Anmeldung ankommen und 401 liefern. Der App-Fallback nutzt
  deshalb `same-origin`; die private Vorschau benötigt für den Katalog und die
  Symbolschriften gar keine separaten authentifizierten Asset-Anfragen mehr.

## Vor Veröffentlichung prüfen

```bash
node --test .agents/skills/hwb-sites-preview/scripts/prepare-preview.test.mjs
cd app
./node_modules/.bin/jest --config jest.config.js \
  __tests__/static-website.test.ts --runInBand --watchman=false
```

Den **paketierten** Build prüfen, nicht nur den Expo-Export davor. Die Plattform-
Browserregeln aus dem aktuellen Sites-Skill gelten auch hier. Den Ablauf aus
[Funktionsprüfung](references/verification.md) mit 390×844 und DPR 3 durchführen.
Insbesondere separate Katalog- und Fontanfragen testweise mit 401 beantworten:
Die 222 Marker und Symbolschriften müssen trotzdem funktionieren. Nur temporär
im QA-Browser simulieren; keine Authentifizierung des veröffentlichten Hosts umgehen.

## Als Site veröffentlichen

1. Neue Site nur einmal über `create_site` anlegen und die zurückgegebene ID sofort
   in `.openai/hosting.json` speichern. Bestehende Site über `get_site` und
   `create_source_repository_write_credential` öffnen. Den nativen Sites-Source-
   Helper aus dem installierten Plugin verwenden, keine Hilfspfade erfinden.
2. Hosting-Manifest im Site-Checkout: tatsächliche `project_id` und
   `static: {"directory": "dist"}` setzen; andere Felder erhalten. Ausschließlich
   den geprüften statischen Build als Laufzeitinhalt ausliefern. Die ursprüngliche
   App-Quelle und der Build-Commit bleiben im HWB-Repository nachvollziehbar.
3. Den genauen Site-Quellstand pushen und mit dem Source-Helper aus diesem Stand
   paketieren. Archiv enthält `.openai/hosting.json` und `dist`, keine Browser-
   Profile, Tokens, `.env`, Emulator-Daten oder Zugangsdaten. Temporäre Credentials
   ausschließlich im Speicher und über den vorgesehenen stdin-Kanal verwenden.
4. Für bestätigte Owner-private Sites `save_version_and_deploy_private` verwenden;
   sonst den im Sites-Skill passenden Save-/Deploy-Pfad. Zurückgegebene Commit-,
   Versions- und Deployment-IDs unverändert weiterverwenden. Bei nicht terminalem
   Status pollen, bis `succeeded` oder `failed` erreicht ist. Bei Abbruch IDs und
   nicht geheime Build-Metadaten erhalten; denselben Vorgang fortsetzen.
5. Nach Deployment den **echten veröffentlichten Link mit dem berechtigten
   Browser** gemäß [Funktionsprüfung](references/verification.md) öffnen. Ein
   lokaler Test mit abgefangenen Requests beweist weder den externen Zugriff noch
   das Verhalten der privaten Anmeldung. Keine pauschal injizierten Auth-Header
   auf alle Requests als Nachweis verwenden: Das würde `credentials: 'omit'`
   verdecken. Private Site nicht zum Testen öffentlich schalten.

Fehlen Plugin-Helper, Browserzugriff oder die berechtigte Sitzung: den konkreten
Blocker und die vorhandenen Prüfungen nennen. Eine erfolgreiche Veröffentlichung
ist dann nur „veröffentlicht, Funktionsprüfung ausstehend“, nicht „funktioniert“.
Keine neue Site anlegen, um einen gescheiterten Vorgang zu umgehen.

## Übergabe

Literal zurückgegebene URL, gebauten App-Commit, Site-Version, Datum des Katalogs
und Ergebnis der echten Funktionsprüfung nennen. Screenshot der Karte mit Markern
bereitstellen. Explizit sagen, ob Stilumschaltung im ausgewählten App-Stand
enthalten ist. „Performant“ nur mit Messung begründen; Marker nicht für eine
scheinbar schnellere Vorschau weglassen. Die 222 Stempel bleiben Einzelmarker.

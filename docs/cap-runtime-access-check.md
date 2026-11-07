# CAP-Runtime und Data API: schreibgeschützter Prüfpfad

Stand: 7. November 2026. Ergänzung zu [Befund und Absicherungsvorlage](data-api-access-review.md).
Keine Produktionsänderung und kein Abruf persönlicher Daten wurden für diese Ergänzung ausgeführt.
Die tatsächliche Hosted-Runtime-Rolle bleibt **unbestätigt**.

## Konfigurationsbefund

- `backend/hwb/package.json`: Produktionsprofil `@cap-js/postgres`, Pool max. 10;
  keine feste Rolle und keine Credentials im Profil. Entwicklungsprofile sind SQLite.
- `Dockerfile` startet `backend/hwb/start.sh`. Dieses führt bei **jedem Start**
  `npm run deploy --production` vor `npm start --production` aus. Deployment und
  Runtime sind im Code nicht durch verschiedene DB-Bindings getrennt.
- Credentials können aus CAP-Konfiguration, privaten Umgebungswerten und Bindings
  stammen. Ein `DATABASE_URL` allein ist kein Nachweis, dass CAP diesen Wert nutzt.
  Der installierte PostgreSQL-Adapter löst `credentials.username || credentials.user`
  auf; `client`-Optionen können die Treiberwerte überschreiben. Er setzt den
  Search-Path aus `credentials.schema`. Keine eigene `SET ROLE`-Logik im Anwendungscode gefunden.
- `srv/supabase-auth.js` liest `auth.sessions(id,user_id,not_after)` über
  **dieselbe CAP-Verbindung**. Der Supabase-Admin-Key ersetzt diese SQL-Rechte nicht.
  Selbst korrekte SELECT-Rechte können unter RLS null sichtbare Sessions liefern
  und damit jede Anmeldung ablehnen.

Daraus folgt weder `postgres` noch `service_role` als Runtime-Rolle. Der Dashboard-
SQL-Editor und eine Management-Verbindung beweisen die Runtime-Identität ebenfalls nicht.

## 1. Tatsächliche Runtime-Verbindung messen

Im bereits gebauten Backend-Image/Container mit **exakt demselben Arbeitsverzeichnis,
Profil, Konfiguration, Bindings und Prozessbenutzer** wie der Server, ohne `start.sh`
oder einen Deployment-Befehl aufzurufen:

```bash
cd /usr/src/app
NODE_ENV=production CDS_ENV=production node util/inspectCapDatabase.js
```

Im Checkout ist das entsprechende Arbeitsverzeichnis `backend/hwb`.
Nicht `cds env` oder komplette Umgebungen/Verbindungszeichenfolgen in Logs ausgeben.
Der Helfer startet keinen HTTP-Server und lädt keine Anwendungshooks. Er verwendet
`cds.connect.to('db')`, prüft PostgreSQL als aufgelösten Typ und führt sämtliche
Diagnoseabfragen in einer einzigen `REPEATABLE READ READ ONLY`-Transaktion mit
Zeitlimits aus. CAPs Adapter setzt vor BEGIN seine Sessionvariablen/Search-Path;
keine Tabellen werden angelegt, keine Geschäfts- oder Sessionzeilen gelesen.
Fehler führen zu Exitcode 1, ohne den möglicherweise sensitiven Treiberfehler auszugeben.

Den vollständigen Bericht nur zugriffsgeschützt aufbewahren. `identity` muss
`read_only=on` enthalten. Image-/Commit-ID, Umgebung und Zeitpunkt getrennt
protokollieren. Ein anderer Profil-/Binding-Stand macht den Nachweis ungültig.
Alle separat konfigurierten Instanzen, Jobs und gegebenenfalls Tenant-Verbindungen
prüfen; ein Einzelnachweis beweist keine abweichenden Deployments. Bei externen
Bootstrap-/Rollenwechsel-Hooks muss der Betreiber den Kontextabgleich bestätigen.
Ein neu gestarteter Diagnoseprozess beweist ohne diesen Abgleich nicht die Rolle
eines schon laufenden, anders konfigurierten Prozesses.

Alternativer SQL-Pfad für eine **bereits bestätigte identische** libpq-Verbindung:

```bash
PGSERVICE=hwb-runtime bash scripts/inspect-cap-database.sh
```

Credentials und TLS-Verifikation privat in libpq konfigurieren. Das Skript verwendet
`psql -X`, `ON_ERROR_STOP`, eine Read-only-Transaktion und abschließend ROLLBACK.
Das gemeinsame SQL liegt in `backend/hwb/util/inspectCapDatabase.sql`.
Eine zusätzliche Betreiberverbindung darf die Katalogsicht ergänzen, muss aber als
solche gekennzeichnet werden; deren `identity` ist keine CAP-Runtime-Evidenz.
Fehlende Berechtigung/fehlende Katalogsicht ist **offen**, kein grünes Prüfergebnis.

## 2. Bericht auswerten

| Abschnitt | Abnahmerelevante Aussage |
| --- | --- |
| `identity`, `roles` | `session_user` ist Login, `current_user` der effektive Kontext. Superuser/BYPASSRLS sind Attribute der effektiven Rolle; nicht einfach von Mitgliedsrollen übernehmen. `MEMBER`, `USAGE` und `SET` unterscheiden Mitgliedschaft, geerbte Rechte und mögliche Rollenwechsel. |
| `schemas` | Schema-Owner ist nicht automatisch Owner der enthaltenen Tabellen. USAGE erlaubt Namensauflösung, CREATE erlaubt neue Objekte. Keine dieser Eigenschaften allein beweist RLS-Bypass. |
| `relations` | Alle nicht-systemischen Tabellen/Partitionen/Views/Materialized Views/Foreign Tables, nicht nur 15 Namen. Effektive Tabellen- und Spaltenrechte berücksichtigen PUBLIC/Vererbung; `sequences` ergänzt Sequenzrechte. `runtime_owner_rights`, FORCE und `runtime_rls_active` zusammen bewerten. BYPASSRLS ersetzt fehlende Grants nicht. |
| `session_columns`, `policies` | `auth.sessions` und alle drei benötigten Spalten vorhanden, auth-USAGE und SELECT wirksam. Policy-Metadaten sind kein Nachweis sichtbarer echter Sessions. Ausdrücke separat intern prüfen; keine pauschalen Client-Policies. |
| `view_edges` | Abhängigkeiten auch außerhalb public, wiederholte Kanten transitiv verfolgen. Standard-Views verwenden Basisrechte/RLS des View-Owners; `security_invoker` allein entzieht keinen Grant. Materialized Views geben gespeicherte Daten aus, unabhängig von Basis-RLS. |
| `routines` | Alle nicht-systemischen RPC-Kandidaten mit effektivem EXECUTE einschließlich PUBLIC und Vererbung. SECURITY DEFINER und aufrufbare Hilfsfunktionen intern prüfen. Kein Funktionsaufruf während der Diagnose. Dynamisches SQL ist durch Katalogabhängigkeiten nicht vollständig nachweisbar. |
| `default_acl`, `ddl_hooks` | Defaults je tatsächlichem DDL-Ersteller, global und pro Schema; fehlende ACL-Zeilen sind kein Sicherheitsbeweis. PostgreSQL gibt Funktionen standardmäßig PUBLIC EXECUTE. DDL-Hooks separat prüfen. |

Grants + Schema-USAGE sind ein **möglicher** SQL-Zugriffspfad. Ob HTTP ihn anbietet,
hängt zusätzlich von aktivierter Data API, Exposed Schemas, PostgREST-Konfiguration,
Schema-Cache und JWT/Rollenwahl ab. Diese Einstellungen im echten Projekt bestätigen;
SQL-`current_setting` eines CAP-Logins kann die Gateway-Konfiguration nicht beweisen.
GraphQL separat auf Aktivierung, sichtbare Schemas, Views und Mutationen prüfen.

Die vorhandene `secureCapDataApi.sql` bleibt unverändert: Sie behandelt bestehende
`public.hwb_db_*` und `cds_model`. Sie garantiert **nicht**, dass geerbte Rechte,
explizite Spalten-Grants, anders benannte Views, andere Schemas oder spätere Tabellen
verschwinden. Der neue Test erzeugt solche Restpfade absichtlich, um diese Grenzen
sichtbar zu machen. Bei solchen Befunden bleibt die Freigabe gesperrt.
Neue Objekte mit dem kompilierten CAP-Modell abgleichen (einschließlich Modell-,
Medien-/Attachment- und Deploymenttabellen); reine Namenspräfixe reichen nicht.

## 3. Ausführbare lokale Prüfungen

Bestehende Docker-Abnahme, um Rollen-/View-/Default-/Sessionfälle erweitert:

```bash
bash scripts/test-cap-data-api-isolation.sh
```

Zusätzliche reproduzierbare SQL-Berichtsprüfung ohne Docker, außerhalb der
Projektabhängigkeiten installiert; kein Hosted-Verbindungsparameter:

```bash
npm install --prefix /tmp/hwb-audit-test @electric-sql/pglite@0.3.14
NODE_PATH=/tmp/hwb-audit-test/node_modules node scripts/test-cap-runtime-audit.cjs
node --test scripts/check-staging-data-api.test.cjs
```

Lokal in dieser Ergänzung bestätigt: PostgreSQL **17.5 via PGlite/WASM**, synthetische
Fixtures, wiederholte Absicherung, Schema-Owner ohne Tabellen-Bypass, Tabellen-Owner,
FORCE RLS, BYPASSRLS mit/ohne Grant, gewöhnliche Rolle ohne Policy, geerbte und
Spaltenrechte, zusätzliche View, neue Tabelle mit unsicheren Defaults und durch RLS
unsichtbare `auth.sessions` trotz SELECT. Die Read-only-Berichte funktionieren als
Admin und gewöhnliche Rolle, erkennen die eingebauten Restpfade und verweigern DDL.
Vier bestehende Backend-Authentifizierungstests bestehen ebenfalls. Der vollständige
Backend-Lauf war zunächst durch das fehlende native SQLite-Modul blockiert.
Drei HTTP-Helfertests prüfen Produktionssperre und fehlergeschlossene Auswertung mit
simulierten Antworten. Das beweist keine HTTP-Konfiguration des echten Projekts.

Die ältere Docker/PostgreSQL-17-Abnahme ist im Ausgangsbefund dokumentiert. Der
hier erweiterte Docker-Lauf und die CAP-TCP-Verbindung wurden in dieser Umgebung
mangels Docker/PostgreSQL-Server **nicht** ausgeführt. Der neue CAP-Helfer wurde
syntaktisch und gegen den installierten Adapter geprüft; sein Ende-zu-Ende-Lauf
mit tatsächlichen Bindings bleibt eine Abnahmevoraussetzung.

## 4. Isoliertes Staging: verbindliche Abnahme

Ausschließlich eigenes Staging-Projekt, synthetische Konten A/B/Admin und Medien;
keine Produktionskopie. Identität des Projekts vor jedem mutierenden Test bestätigen.
Baseline-Bericht, wirksame ACLs (auch Spalten), Owner, RLS/FORCE, Policies, Defaults
und Modellinventar intern sichern. Vorher/nachher denselben Build und dieselbe
Runtime-Rolle verwenden. Den produktiven `start.sh`-Deploymentzyklus im Staging
nachstellen. Fehlende Nachweise bedeuten keine Freigabe.

| Prüfung | Konkretes Bestehenskriterium |
| --- | --- |
| Runtime | CAP-Helfer Exit 0, tatsächlicher Rollen-/Schema-/Bindingnachweis für Server und Löschjob; keine Nutzung von anon/authenticated als Backend-Rolle. Unterschiede bei DDL-/Runtime-Rollen erklärt. |
| CAP nach Anwendung der geprüften Vorlage | Echter Login und OData-Lesen funktionieren; A kann eigene Besuche/Notizen/Medien anlegen, ändern, exportieren und löschen. B kann private Daten von A weder lesen noch ändern; erlaubte öffentliche Katalogfunktionen bleiben über CAP erreichbar. Adminrechte gesondert prüfen. Keine unerwarteten 401/403/500 oder stillen Nullzeilen. |
| Sessions | Echte synthetische Sitzung funktioniert. Nach globalem Logout/Widerruf wird derselbe noch unexpired Access-Token an jeder Backendinstanz abgelehnt. Nicht existierende, fremde und abgelaufene Session abgelehnt; auth.sessions selbst weder über Client-SQL-Rechte noch REST/GraphQL erreichbar. |
| Direkte Clientrechte | Für anon/authenticated keine nicht genehmigten Tabellen-, Spalten-, geerbten oder PUBLIC-Rechte an CAP/Modell/Sessiondaten; RLS auf allen betroffenen Basistabellen, Owner/BYPASS/FORCE dokumentiert. Nicht nur `information_schema.role_table_grants` prüfen. |
| Views/RPC/GraphQL | Alle tatsächlich exponierten Schemas inventarisiert. Direkte und transitive Viewpfade, Materialized Views, aufrufbare RPCs und dynamisches SQL bewertet. Keine CAP-/Sessiondaten über alternative Pfade; tatsächliche Gateway-/GraphQL-Konfiguration belegt. Unbekannte RPCs niemals probeweise in Produktion ausführen. |
| Neue Tabellen | Nach erneutem CAP-Deployment und Container-Neustart vollständiges Modellinventar erneut abgleichen und alle Checks wiederholen. Eine zusätzliche synthetische CAP-Tabelle unter jeder tatsächlichen DDL-Erstellerrolle anlegen: keine öffentliche Erreichbarkeit ohne gesonderte Rechtefreigabe. Unsichere Defaults oder automatische Re-Grants blockieren Release. |
| Wiederholung/Rückfall | Zweite Anwendung im Staging ohne neue Daten-/Rechteverluste. Vorbereitete exakte Rückfall-SQL im Staging getestet, vorherige Grants/Owner/Policies/RLS wiederhergestellt, anschließend Runtime- und Clienttests erneut geprüft. |

REST-Leserechte-Test (nur limit=0, keine Zeilen ausgegeben):

```bash
# Werte privat setzen: HWB_STAGING_SUPABASE_URL, HWB_STAGING_PUBLISHABLE_KEY,
# HWB_STAGING_USER_JWT (gültiger gewöhnlicher synthetischer Benutzer).
# Vollständige Liste aus Modell-/Kataloginventar UND allen Exposed Schemas bilden.
export HWB_ISOLATED_SYNTHETIC_STAGING=yes
export HWB_STAGING_RELATIONS_JSON='[{"schema":"public","name":"hwb_db_stampings"},{"schema":"public","name":"cds_model"}]'
node scripts/check-staging-data-api.cjs
```

Die Beispielliste ist **unvollständig**. Der Helfer testet ohne Benutzer-JWT und mit
echtem Benutzer-JWT; nur PostgreSQL-Fehler 42501 mit passendem HTTP-Status gilt als
explizite Sperre. 200 mit leeren Daten, falsches JWT, 404 oder Gatewayfehler bleiben
`REVIEW_REQUIRED`. Bei absichtlich deaktivierter Data API/nicht exponiertem Schema
kann das korrekt sein, benötigt aber gesonderten Konfigurationsnachweis. Dieser
Helfer beweist weder Schreibsperre noch RPC-/GraphQL-Sicherheit. Deren Negativtests
im Staging mit gültigen synthetischen INSERT-/UPDATE-/DELETE-Payloads und GraphQL-
Operationen aus dem tatsächlichen Schema durchführen; Constraint-/Syntaxfehler oder
Nulltreffer allein sind kein Rechtebeweis. Keine Tokens/Antwortdaten protokollieren.

## Produktionsfreigabe und Rückfall

Keine automatische Anwendung und keine Freigabe aus lokalen Tests ableiten.
Falls Rollen/Policies/Grants/Defaults/Views geändert werden müssen, zuerst einen
vollständigen, projektspezifischen SQL-Satz mit konkreten Rollennamen und Objekten,
Auswirkungen auf CAP/Deployment/Clientzugriff und exakten Rückfallanweisungen vorlegen.
Dafür fehlen derzeit die tatsächliche Runtime-Rolle und die aktuelle Rechtebaseline.
Ein allgemeines `GRANT ALL` ist kein Rückfallweg. Auch `DISABLE ROW LEVEL SECURITY`
allein stellt zuvor entzogene Rechte nicht wieder her und kann Daten offenlegen.
Rollback muss die genehmigte Baseline exakt wiederherstellen; eine unsichere alte
Baseline darf nicht unbemerkt als sichere Dauerlösung zurückkehren. Erst nach
isolierter Abnahme und **ausdrücklicher Betreiberfreigabe** produktiv ausführen.

Referenzen: [PostgreSQL 17 RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html),
[Rechte- und Rollenfunktionen](https://www.postgresql.org/docs/17/functions-info.html),
[View-Sicherheitskontext](https://www.postgresql.org/docs/17/sql-createview.html),
[Supabase Data-API-Sicherheit und Defaults](https://supabase.com/docs/guides/api/securing-your-api).

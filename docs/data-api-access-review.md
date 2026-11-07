# CAP-Datenbankrechte: lesender Befund und vorbereitete Absicherung

Am 7. November 2026 wurde das verbundene Projekt `vdqdopjinjyginervesk` ausschließlich lesend geprüft. Projektstatus gesund, Region eu-west-2, keine Entwicklungsbranches. Der öffentliche JWKS-Endpunkt liefert ES256. Der Security Advisor lieferte keine Befunde; das ist kein vollständiger Rechtebeleg.

Die Tabellenübersicht zeigt für 15 öffentliche CAP-Tabellen einschließlich `cds_model` deaktivierte RLS. Eine anschließende Abfrage der PostgreSQL-Kataloge bestätigte für **anon und authenticated SELECT, INSERT, UPDATE und DELETE auf allen 15 Tabellen**, einschließlich Profilen, Freundschaften, Besuchen, privaten Notizen und Bildreferenzen. `anon` besitzt außerdem USAGE auf public. Es wurden keine persönlichen Datensätze abgerufen oder verändert. Die Erreichbarkeit über eine konkrete öffentliche REST-Anfrage wurde nicht mit Nutzerdaten getestet; die bestätigten Datenbankrechte widersprechen bereits der vorgesehenen ausschließlich serverseitigen CAP-Nutzung.

## Konkrete Änderung zur Betreiberprüfung

Die vorhandene [SQL-Vorlage](../backend/hwb/util/secureCapDataApi.sql) entzieht PUBLIC, anon und authenticated Rechte an `public.hwb_db_*` und `public.cds_model`. Sie berücksichtigt auch CAP-Views und aktiviert RLS nur auf tatsächlichen Tabellen. Die bisherige Vorlage ließ das kompilierte Modell aus. Fremde öffentliche Tabellen und deren Rechte bleiben unverändert. Views/RPCs in anderen Schemas, SECURITY-DEFINER-Funktionen sowie neue Tabellen nach späteren Deployments müssen zusätzlich geprüft werden; die Vorlage behauptet keine vollständige Absicherung jeder möglichen API.

**Noch nicht im verbundenen Projekt angewendet.** Vorher die tatsächlich von CAP verwendete Datenbankrolle bestätigen und die Änderung auf isoliertem Staging abnehmen. Tabellen-Owner und BYPASSRLS-Rollen behalten Zugriff. Eine dedizierte Runtime-Rolle ohne diese Eigenschaften benötigt explizite serverseitige Policies und Grants. Ohne diese Rollenprüfung kann Aktivieren von RLS den laufenden CAP-Zugriff blockieren. Keine pauschalen Browser-Policies für sämtliche Nutzerdaten hinzufügen.

Die Vorlage wurde mit synthetischen Daten in einem wegwerfbaren lokalen PostgreSQL-17-Container geprüft: Browserrollen verlieren Lese-/Schreibrechte an CAP-Tabellen, Modell und CAP-View; RLS ist aktiv; Owner-Zugriff und vorhandene Daten bleiben erhalten; Rechte einer fremden Tabelle bleiben erhalten; zweite Anwendung ist erfolgreich. Reproduktion: `bash scripts/test-cap-data-api-isolation.sh`. Das Skript akzeptiert keine Hosted-Verbindungszeichenfolge und verwendet ausschließlich einen eigenen temporären lokalen Container.

## Abnahme nach tatsächlicher Anwendung

- Katalogabfrage für Clientrechte und RLS wiederholen; neue CAP-Tabellen nach jedem Deployment einbeziehen.
- Mit Publishable-Key ohne Nutzerdatenabfrage nachweisen, dass CAP-/Modell-Endpunkte nicht les-/schreibbar sind; ebenso GraphQL, Views und RPCs prüfen.
- Mit der tatsächlichen Runtime-Rolle CAP-Lesen, eigene/fremde Besuche, private Notizen, Medien und Verwaltung prüfen; keinen Serverzugriff über anon/authenticated erlauben.
- Ausführung, Rollenwahl und Rückfallplan intern dokumentieren; keine Zugangsdaten oder Nutzerexports ins Repository aufnehmen.

Quellen: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [API absichern](https://supabase.com/docs/guides/api/securing-your-api).

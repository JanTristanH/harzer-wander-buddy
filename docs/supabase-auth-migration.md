# Supabase Auth: Implementierung und Betreiber-Runbook

Stand: 6. November 2026. Draft, keine Produktionsfreigabe. Grundlage: aktuelles
`develop` (7513b1b) plus aktualisierter PR-63-Stand 587ff96. PR 63 bleibt separat;
dieser Branch integriert ihn als Vorbedingung. Nach Merge von #63 den Auth-PR
gegen develop erneut prüfen; bei Squash-Merge ggf. die reinen Auth-Commits auf
den neuen develop-Stand übernehmen. Keine parallele Datenschutzimplementation.

## Architektur und Grenzen

CAP/OData bleibt der einzige App-Datenzugriff. `@supabase/supabase-js` **2.119.0**
ist in beiden Lockfiles festgelegt, Node >=22 erforderlich. Client: Projekt-URL
und Publishable-Key; serverseitig ausschließlich `SUPABASE_SECRET_KEY` für Admin.
Keine Data-API- oder Storage-Migration. Profilbilder bleiben CAP-Medien.

Web/native: E-Mail/Passwort, Registrierung mit Bestätigung, Reset-Link und neues
Passwort, lokaler/globaler Logout, SDK-Refresh und AppState-Anbindung. E-Mail-
PKCE-Links müssen auf dem anfordernden Gerät/Browser geöffnet werden. Browser
speichert Sessions in localStorage, native ausschließlich in SecureStore, in
kleinen Unicode-sicheren Chunks mit atomarem Manifest. Bestehende Auth0-Tokens
werden nicht als Supabase-Sitzungen übernommen. Alte Clients benötigen einen
Update-/Wiederanmeldehinweis bei der Umstellung.

Social OAuth verwendet PKCE. `EXPO_PUBLIC_SUPABASE_OAUTH_PROVIDERS` ist eine
explizite kommaseparierte Liste der tatsächlich übernommenen Provider (SDK-Namen,
z. B. `google`, nur wenn belegt). Standard ist leer: Das Repository enthielt
Auth0 Universal Login, aber keinen Nachweis der im Tenant tatsächlich aktivierten
Social Connections. Deshalb wurde kein neuer Provider aktiviert. Vor Cutover
Auth0 Connections inventarisieren, jeden bestehenden Provider in Staging
übernehmen und mit realem Konto abnehmen. Provider-Client-ID/Secret und bei Apple
Widerrufsanforderungen sind zusätzliche Dashboard-Aufgaben, keine Codebelege.

Backend akzeptiert ausschließlich ES256/RS256-Projekt-JWTs mit Issuer
`SUPABASE_URL/auth/v1`, Audience `authenticated`, exp/iat/sub/session_id,
maximalem Tokenalter einer Stunde und nichtanonymen Nutzern. JWKS kommt nur vom
konfigurierten Projekt. **Legacy HS256 wird bewusst abgelehnt**: im Dashboard
zunächst asymmetrischen Signing-Key aktivieren und die Übergangszeit abwarten.
Es gibt keinen produktiven Basic-/Auth0-Fallback. `dev-basic` bleibt ein explizites
lokales Profil und ist zusammen mit production verboten.

Jeder authentifizierte Request prüft zusätzlich den aktuellen Benutzer über
Supabase Auth sowie `auth.sessions` per CAP-PostgreSQL-Verbindung (Session-ID,
User-ID und not_after). Die Backend-DB-Rolle braucht hierfür gezieltes SELECT;
keine Rechte an anon/authenticated vergeben. Bei Ausfall/fehlenden Rechten
schlägt Auth geschlossen fehl. Rollen stammen aus **aktuellem serverkontrolliertem
app_metadata.roles**, nur `admin`/`moderator`; user_metadata, alte JWT-Rollen und
Auth0-Namespaceclaims verleihen keine Rechte. Die UI orientiert sich am aktuellen
CAP-Profil. Eigentümerprüfungen verwenden weiter die interne ID.

Der alte UI5-Cookie-/OIDC-Login ist stillgelegt. Seine statischen Einstiegspunkte
und Abhängigkeiten leiten auf `/app/rnweb/login` weiter. Die gepflegte Web-App
verwendet Bearer-Authentifizierung; CSV-Gesamtexport benötigt weiterhin Admin.
Es gibt keine neue Browser-Cookie-Sitzung mit CSRF-Risiko.

## Bestätigter App-Rollenumfang

Der Betreiber hat für den aktuellen Betrieb nur Administratoren und normale Nutzer bestätigt. Vor dem Cutover die bisherigen Administratoren anhand bestätigter Bestandsidentitäten inventarisieren und deren neue Supabase-Konten gezielt mit serverkontrolliertem `app_metadata.roles = ["admin"]` ausstatten. Normale Nutzer erhalten keine privilegierte Rolle. Keine automatische Vergabe anhand gleicher E-Mail-Adressen, Clientangaben oder `user_metadata`; in diesem PR werden keine neuen Moderatorrollen zugewiesen.

Diese App-Rollen sind unabhängig von der PostgreSQL-Rolle der CAP-Verbindung. „Admin in der App“ beweist weder Tabellen-Ownership noch BYPASSRLS. Die technische Runtime-Rolle bleibt bis zum im Runbook beschriebenen Verbindungsnachweis offen; deshalb keine automatische Hosted-Rechteänderung.

## Identität und Bestandsdaten

Die internen IDs bleiben stabil. `AuthIdentities(subject, internalId,
proofReference, linkedAt, revokedAt)` ordnet genau eine Supabase-UUID genau einer
internen Kennung zu; eindeutiger Index auf internalId. Neue Konten verwenden
`supabase|UUID`. Auth0-Subjects werden niemals in UUIDs umgedeutet.

Damit bleiben ohne Referenzumschreibung erhalten:

- ExternalUsers.ID/sub, Profil, Onboarding, sid und Profilbildreferenzen;
- createdBy/modifiedBy der Besuche, privaten Notizen, Touren, Uploads und
  temporären Routen-/Places-Daten sowie shared/admin Datensätze;
- Friendships/PendingFriendshipRequests.fromUser_ID/toUser_ID inklusive
  Stempelberechtigungen; Tour2TravelTime referenziert unveränderte Tour-IDs;
- ContentReports.targetUser/createdBy, UserBlocks.fromUser/toUser sowie die
  subjectHash-Schutzmarker in AccountDeletions.

Es gibt **keinen E-Mail-Abgleich und keinen unbelegten Passwortimport**. Zugriff
auf einen Auth0-Free-Passworthash-Export ist nicht nachgewiesen. Supabase-Reset
setzt ausschließlich ein existierendes Supabase-Passwort zurück. Er beweist
keinen Besitz am alten Auth0-Konto. Neue Registrierung allein verknüpft keine
Altbestände. Für die Verknüpfung benötigt der Betreiber einen intern dokumentierten
Besitznachweis für **beide** Konten (kontrollierte Anmeldung am Altanbieter plus
verifizierte Supabase-Anmeldung; alternativ belastbare manuelle Identitätsprüfung).
Der Beleg bleibt intern, im Mapping nur eine Fallreferenz. Ohne diesen Nachweis
bleibt das Altkonto unverknüpft. Keine öffentliche Linking-API.

1. Geschützte DB-Sicherung und Wiederherstellung in isoliertem Staging testen.
2. Während Linking sämtliche App-/Sync-Writer stoppen (Wartungsfenster). Erst
   Registrierung/Bestätigung und Besitznachweis direkt beim Auth-Dienst im
   Wartungsfenster durchführen, ohne CAP-Profilabruf. Bestandsmapping einspielen,
   danach neue Clients freischalten. Das verhindert
   eine neue `supabase|UUID`-Dateninsel während des Mappings.
3. Ein freigegebenes, nicht eingechecktes JSON mit
   `[{"subject":"<Supabase UUID>","internalId":"auth0|…","proofReference":"<interne Fallreferenz>"}]`
   bereitstellen. Keine Passwörter, Tokens oder Mailarchive exportieren.
4. Mit explizit gewähltem Staging-DB-Profil:
   `node util/linkSupabaseIdentities.js mapping.json` (default Dry-run).
   Die CLI prüft lesend, dass die Supabase-Konten existieren und E-Mail bestätigt ist;
   dies ersetzt nicht den dokumentierten Besitznachweis. Gesamter Batch wird geprüft: fehlendes Profil, Mehrfachzuordnung,
   bereits gelöschtes/revoziertes Konto und bestehende neue App-Daten werden
   abgelehnt. Gleiche vorhandene Zuordnung ist idempotent.
5. Nach gesonderter Betreiberfreigabe `--apply`; eine DB-Transaktion, keine
   Referenzumschreibungen. Das Werkzeug veröffentlicht nur Summen. Prod wird
   in diesem PR nicht ausgeführt. Gleicher Dry-run danach muss nur existing melden.
6. Migration und Rechte anhand eigener/fremder Besuche, Notizen, Touren,
   Freundschaften und Moderation mit realen Staging-Konten prüfen.
7. Mappingdatei/Exporte nur verschlüsselt, Zugriff und Löschtermin dokumentieren;
   nach bestätigter Abnahme und vereinbartem Rollbackfenster löschen. Keine
   Passwort-/Tokenexporte oder signed-in Emulator-/Browserdaten archivieren.

Rollback vor Freigabe: Writer stoppen, neuen Client sperren, freigegebene
AuthIdentities-Zeilen transaktional entfernen bzw. Sicherung wiederherstellen,
vorherigen Backend-/Clientstand verwenden. Datenbesitz bleibt unverändert.
Nach neuen Schreibzugriffen Datenänderungen gesondert sichern und prüfen; kein
blindes Restore, das neue Inhalte verliert. Nach Kontolöschung kein Rollback,
der gelöschte Konten wiederherstellt; Löschmarker/Queue aus aktuellem Stand
übernehmen. Auth0-Rückkehr ist keine rechtliche Produktionsfreigabe.

## Kontolöschung, Queue und Cache

Die PR-63-Transaktion löscht weiterhin App-Daten und legt den dauerhaften
Schutzmarker an. Bei Mapping wird die Supabase-UUID in die Queue geschrieben und
der Link revoziert. `AccountDeletions.provider` unterscheidet Anbieter. Historische
NULL-Zeilen bleiben **Auth0**; sie werden nie an Supabase gesendet. Der Worker
wiederholt Fehler fair nach lastAttemptAt. Marker und revozierte Links bleiben
bis 30 Tage nach erfolgreichem Abschluss erhalten; offene Aufträge verfallen nie.
Supabase hard-delete entfernt Auth-User und Refresh-Sessions; bereits ausgestellte
JWTs scheitern zusätzlich an Marker, Link und Sessionprüfung. Auch wenn die
Providerlöschung ausfällt, können App-APIs keine gelöschten Konten reanimieren.

`dedicated-project` darf nur gesetzt werden, wenn das Projekt tatsächlich allein
diese App-Identitäten enthält. Für ein gemeinsam genutztes Auth-Projekt bleibt
Löschung blockiert, bis ein abgestimmter Scope implementiert ist. Kein Bulk-Delete.
Storage ist nicht eingeführt: sollten später Storage-Objekte existieren, müssen
Eigentümerabhängigkeiten vor Auth-Löschung geklärt werden. Fehler bleiben pending.
Alt-Auth0-M2M-Secrets erst nach leerer alter Queue und dokumentierter Abschaltung
entfernen; alte Auth0-Sitzungen/Refresh-Tokens beim Betreiber-Cutover widerrufen. Die eingeschränkten Auth0-Free-Verträge bleiben für Altbestände relevant.

Query-Cache wird vor Kontowechsel abgebrochen/geleert; persistenter Cache-Eigentümer
ist Projekt+Supabase-UUID. Offline-Outboxes bleiben Backend+interne-ID zugeordnet,
Onboarding stammt aus dem jeweiligen CAP-Profil. Logout entfernt Profile, Queries
und persönliche Outboxes. Providerwechsel übernimmt keine alten Sitzungen.
Bildcache-Invalidierung, eigener Export einschließlich Base64/Streams, Moderation,
faire Queue und physische Places-Cache-Bereinigung aus PR 63 bleiben erhalten.

## Konkrete Betreiberaufgaben vor Freigabe

- [ ] Je Umgebung isoliertes Supabase-Projekt/Backend, reale Projekt-URL und
  Publishable-Key festlegen. Serverseitiges Secret ausschließlich Secret Manager;
  Clientwerte in Expo/EAS/CI und Docker-Buildarguments setzen. EAS preview
  enthält keinen Produktionsbackend-Default mehr; Build/OTA-Prüfungen verlangen
  explizite HTTPS-/Publishable-Werte und sperren den Produktionshost für preview. Der bisherige
  Google-Dockertrigger muss die beiden neuen öffentlichen Werte erhalten;
  fehlende Werte zeigen eine Konfigurationssperre statt Auth0-Fallback.
- [ ] Asymmetrische Signing-Keys, JWT expiry **<=3600 Sekunden** (empfohlen 900),
  E-Mail-Bestätigung an, anonyme Anmeldung aus; vorhandene Social Connections
  belegen und einzeln migrieren. Dashboard-Werte wurden hier nicht eingesehen.
- [ ] URL Configuration: Site URL der jeweiligen Web-App; exakte Redirect-Allowlist
  `https://<staging-host>/app/rnweb/auth/callback`, Produktionsentsprechung erst bei
  Freigabe, lokal `http://localhost:4004/app/rnweb/auth/callback`, native
  `harzerwanderbuddyapp://auth/callback`. Keine allgemeinen Wildcards. Provider
  erhält als OAuth-Callback `https://<project>/auth/v1/callback`.
- [ ] CAP-Schema einschließlich AuthIdentities (unique internalId),
  AccountDeletions.provider und PR-63-lastAttemptAt in Staging migrieren; keine
  produktive `cds deploy`-Ausführung durch diesen PR. SQL-Diff vor Anwendung prüfen.
- [ ] Backend-DB-Rolle SELECT auf auth.sessions ermöglichen; direkte API-Grenzen
  anhand exponierter Schemas, Grants, Views und RPCs prüfen. Operator-SQL
  `backend/hwb/util/secureCapDataApi.sql` entzieht CAP-Tabellenzugriff und aktiviert
  RLS ohne Clientpolicies. CAP benötigt eine dedizierte Runtime-Rolle mit
  gezielten Tabellenrechten und serverexklusiven RLS-Policies; Schema-Deployment
  über separate Owner-Rolle. Bestehende Owner-Verbindungen umgehen RLS und müssen
  bei diesem Rechteabgleich ausdrücklich berücksichtigt werden. Erst Staging,
  dann gesonderte Produktionsfreigabe.
  Auch anon/authenticated/PUBLIC-Grants auf abweichende Schema-/View-Namen und
  SECURITY DEFINER-RPCs prüfen. CAP-Ownership ersetzt diese Prüfung nicht.
- [ ] Tatsächlichen **Custom SMTP** auswählen/einrichten: Host, Port/TLS, SMTP-User/
  Secret, verifizierter Absender, SPF/DKIM/DMARC, Bestätigungs-/Recovery-Templates,
  Redirects, Rate Limits, Bounce-/Zustelltests. Supabase-Standardversand ist auf
  Teamadressen und derzeit 2 Mails/Stunde beschränkt, ohne Zustell-SLA. STRATO ist
  ausschließlich für Betreiber-Mail/Domain bestätigt, nicht als Auth-SMTP.
- [ ] Für den gewählten Maildienst Vertragspartei/DPA, Region, Supporttransfers,
  Unterauftragsverarbeiter, Message-/Event-Aufbewahrung und Löschfristen festhalten;
  Vertragsregister und Rechtstexte **vor** Aktivierung ergänzen. Kein Anbieter wurde
  hier gebucht oder als eingerichtet behauptet.
- [ ] Free-Betrieb budgetieren/überwachen: veröffentlichter Free-Umfang am
  6. November: 50.000 MAU, 500 MB DB, 5 GB Egress plus 5 GB Cached Egress,
  1 GB File Storage, zwei aktive Projekte, Pause nach einer Woche Inaktivität,
  ein Tag API-/DB-Logaufbewahrung. [Offizielle Preisseite](https://supabase.com/pricing).
  Diese gemeinsamen DB-/Egress-Limits betreffen auch die vorhandenen App-Daten.
  SMTP hat separate Limits (Custom SMTP initial 30 Mails/Stunde). Dashboard-
  Einstellungen und Verbrauch prüfen; Wiederanlauf/Login-Ausfälle organisatorisch
  abdecken, kein SLA behaupten.
- [ ] Mapping-Besitznachweise, Dry-run, Wartungsfenster, Backup/Restore und Freigabe.
- [ ] Cloud Run Job/Scheduler/IAM/Alarmierung aus PR 63 wirklich abnehmen; alte
  Auth0-Queue überwachen. Keine echten Nutzer zu Testzwecken löschen.
- [ ] Vertragskonto Supabase Pte. Ltd./angenommene Version zuordnen;
  LEGAL_TRANSFER_DETAILS ohne Dummywerte finalisieren. London ist UK, erforderlich
  sind auch Singapur-/US-Supporttransfers. LEGAL_AUTH_RETENTION für tatsächliche
  Auth-Audit-Aufbewahrung; API-/DB-Logs, sichtbare Auth-Logs und persistente
  Auditdaten unterscheiden. Keine Auth0-14-Monatsfrist übernehmen.
- [ ] Nach echter Provider-/Staging-Abnahme den festen SUPABASE_AUTH_MIGRATION-
  Blocker durch überprüfte Supabase-Konfigurations-/Abnahmenachweise ersetzen.
  Bis dahin bleibt ready=false und check:legal-release scheitert absichtlich.
- [ ] Website JanTristanH/harzer-wander-buddy-website, PR #3: Auth0-Nennungen und
  Loginlinks auf Supabase-Flows prüfen, neue SMTP-Empfänger/Transfers ergänzen,
  live /datenschutz, /impressum und Konto-Löschlink auf Erreichbarkeit testen.
  Kein Website-Deployment/Store-Release Bestandteil dieses PR.

## Recherche und Nachweise

Offizielle Quellen am 6. November erneut abgerufen:
[Auth](https://supabase.com/docs/guides/auth),
[React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native),
[Deep Links/PKCE](https://supabase.com/docs/guides/auth/native-mobile-deep-linking),
[SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[JWT](https://supabase.com/docs/guides/auth/jwts),
[Signing Keys](https://supabase.com/docs/guides/auth/signing-keys),
[User deletion/session caveat](https://supabase.com/docs/guides/auth/managing-user-data),
[Terms](https://supabase.com/terms), [DPA](https://supabase.com/legal/customer-resources/data-processing-addendum),
[Transfers](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq).
Vertragsgrundlage und kontospezifische Grenzen siehe provider-contracts-free.md.

[Changelog](https://supabase.com/changelog.md) einschließlich
[CLI v3 vom 4. November](https://supabase.com/changelog/supabase-cli-v3) geprüft:
lokaler Default, Bestätigung gehosteter Änderungen, entfernte Befehle. Im Workspace
ist keine Supabase-CLI installiert; keine geratenen Hosted-Kommandos ausgeführt.
CAP-Schemaänderungen werden über den vorhandenen CAP-Prozess vorbereitet. Vor
späterem CLI-Einsatz Version und jeweiliges --help prüfen, Ziel explizit wählen.
TLS-Cipher-Abschaltung ab 10. November ist ebenfalls im Changelog relevant; moderne
Node-/Expo-Laufzeiten verwenden zeitgemäße TLS-Verbindungen, reale Geräte abnehmen.

Automatisierte Tests simulieren Providerantworten und verwenden lokale Signaturschlüssel;
sie sind **kein** Nachweis einer realen Supabase-Anmeldung, Löschung oder SMTP-Zustellung.
Konkrete ausgeführte Checks werden im Draft-PR dokumentiert.

## Lokale Validierung dieses Branches

- Node 22.23.4: 380 App-Tests in 68 Suites erfolgreich; zusätzlich gezielter
  Logout-/Basic-Regressionstest nach dem abschließenden Cache-Fix erfolgreich.
- 59 Backend-Tests erfolgreich: gültige/falsche/abgelaufene/fremde JWTs, Algorithmus,
  manipulierte Rollen, aktuelle Rollenentziehung, Sessionwiderruf, gelöschte Konten,
  Identity-Mapping/Dry-run/Idempotenz/Kollisionen, providerbezogene Altqueue,
  Providerfehler und bestehende Export-/Datenschutz-/Cache-/Ownershipregressionen.
- 43 Release-Automationstests sowie 2 OTA-/Fingerprint-Prüfungen erfolgreich.
- TypeScript ohne Fehler; ESLint ohne Fehler, zwei bestehende require()-Warnungen
  in components/maps/map-primitives.ts. PostgreSQL-CDS-Schema erfolgreich kompiliert.
- Web-Export mit synthetischen öffentlichen Supabase-Werten erfolgreich;
  Browserprüfung der leeren Anmeldemaske, [Screenshot](screenshots/supabase-login-web.png).
  Keine echten Zugangsdaten und keine angemeldete Sitzung im Screenshot.
- Lokaler Android-x86-Releasebuild erfolgreich: erster aktualisierter Build 8m6s,
  Folgelauf 1m7s mit bestehenden Caches; zusätzlicher aktueller JS-Build ebenfalls
  erfolgreich. Keine Cachebereinigung, kein EAS-/Expo-Go-Erfordernis.
- Emulator bootete nach ca. 644 Sekunden, Paketinstallation blieb jedoch ohne
  erfolgreichen Abschluss. Ein anschließender Start konnte die Activity nicht
  auflösen. **Kein Nachweis von nativer Anmeldung/Callback/Logout.** Native Logik
  ist automatisiert getestet; echte Android-Abnahme bleibt erforderlich. iOS
  mangels Xcode/Simulator nicht ausgeführt.
- `check:legal-release` scheitert erwartungsgemäß an festen Abnahme-/Rechtstext-
  und fehlenden Dashboard-/Schedulerwerten. Keine produktive Migration,
  Providerlöschung, SMTP-Einrichtung, Veröffentlichung oder Vertragsannahme.

Die vorbestehende lokale Android-Änderung an auth.tsx wurde vor dem develop-Pull
in einem benannten Git-Stash gesichert. Die beiden zuvor ungetrackten
Onboarding-Hilfsdateien bleiben lokale Arbeit und sind kein Bestandteil dieses PR.
Die neue Auth-Implementierung nutzt keine providerabhängigen Onboarding-Schlüssel;
der neue SecureStore-Adapter verwendet ausschließlich gültige Schlüssel und kleine
Werte. Caches und lokale Datenbanken wurden erhalten. Runtime-Browsertokens und
Emulator-Userdaten wurden nicht archiviert oder eingecheckt.

## Erneute Integration und lesende Hosted-Prüfung

Aktuellen #63-Stand integriert; Datenschutz-/Moderations- und Offline-APIs gemeinsam erhalten. Die Release-Sperren bleiben bestehen. Das verbundene Projekt liefert öffentlich ES256-Schlüssel und ist gesund; es gibt keine Entwicklungsbranches. Das ersetzt keine Staging-/SMTP-/Native-/Löschabnahme.

Die lesende Rechteprüfung bestätigt überbreite Browserrollen-Grants bei deaktivierter RLS auf 15 öffentlichen CAP-Tabellen. [Befund, konkret vorbereitete SQL-Änderung und lokale PostgreSQL-17-Abnahme](data-api-access-review.md). Das Hosted-Projekt wurde nicht verändert. Vor produktiver Anwendung sind CAP-Runtime-Rolle, isolierte Abnahme und Betreiberfreigabe erforderlich.

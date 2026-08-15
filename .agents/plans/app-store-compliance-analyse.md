# App-Store-Compliance-Analyse – Harzer Wanderbuddy

Stand: 30. Juli 2026  
Geprüfter Branch: `develop`  
App: Expo SDK 54 / React Native 0.81.5  
Zielplattformen: Google Play Store und Apple App Store

## Kurzurteil

**Die App ist derzeit nicht veröffentlichungsreif.**

Die native technische Basis ist grundsätzlich aktuell:

- Android wird aus der Expo-SDK-54-Konfiguration mit `compileSdk`/`targetSdk` 36 und `minSdk` 24 erzeugt.
- arm64 ist vorhanden; die untersuchten nativen Bibliotheken eines vorhandenen APK waren 16-KB-ausgerichtet. Das finale AAB muss trotzdem erneut geprüft werden.
- Ein unsigned iOS-Release-Build mit Xcode 26.6 und iOS-SDK 26.5 war erfolgreich und durchlief Apples `-validate-for-store`-Buildschritt.
- App-Icon, ATS/HTTPS-Grundkonfiguration, Auth0-PKCE und SecureStore für native Tokens sind grundsätzlich plausibel.

Vor einer Einreichung bestehen aber **fünf Freigabestopper**:

1. Eine Backend-Exportfunktion erlaubt jedem angemeldeten Konto den Export vollständiger Tabellen mit personenbezogenen Daten.
2. Datenbank-Dumps und personenbezogene bzw. personenbeziehbare Datensätze sind im Git-Repository getrackt und können in Docker-Images gelangen.
3. Die App bietet Kontoerstellung, aber keine Kontolöschung.
4. Datenschutzangaben, In-App-Rechtslinks und Store-Datendeklarationen sind nicht vollständig bzw. nicht konsistent mit dem tatsächlichen Verhalten.
5. Für Profile, Freunde, Touren und weitere nutzergenerierte/soziale Inhalte fehlen Melden, Blockieren, Regeln und Moderation.

Zusätzlich sind Berechtigungen zu breit, der aktuelle Arbeitsstand besteht die Qualitätsprüfungen nicht, und es wurden noch keine signierten Produktionsartefakte validiert.

## Prüfrahmen und Grenzen

Geprüft wurden:

- Expo-/EAS-Konfiguration, Abhängigkeiten und generierte native Konfiguration;
- App-Code, Authentifizierung, Profil-, Freundes-, Tour-, Standort- und Offline-Funktionen;
- CAP-Backend, Berechtigungen, Exportpfade, Datenmodell und Container-Build;
- vorhandene Android-/iOS-Artefakte und lokale Buildfähigkeit;
- aktuelle offizielle Store-Anforderungen mit Stand des Prüfdatums;
- öffentliche Datenschutzerklärung;
- Lint, TypeScript, Jest, Expo-Konfiguration und Bundling.

Nicht abschließend prüfbar waren:

- die tatsächlichen Auth0-Verbindungen und die gehostete Login-Konfiguration;
- App Store Connect und Play Console einschließlich Verträgen, Fragebögen und Entwicklerverifikation;
- Produktionssignierung, EAS-Credentials und endgültige AAB-/IPA-Dateien;
- Verhalten des produktiven Backends, Logs und bereits veröffentlichte Container-Images;
- rechtliche Zulässigkeit einzelner Datenverarbeitungen und Aufbewahrungsfristen;
- vollständige manuelle Geräte-, Accessibility- und Outdoor-Sicherheitstests.

`app/ios` und `app/android` sind lokal vorhanden, aber durch `app/.gitignore` ausgeschlossen. Sie zeigen einen älteren/stalen Stand (`1.0.0 (1)`) und sind nicht die alleinige Quelle für einen EAS-Produktionsbuild. Maßgeblich sind `app/app.json`, `app/app.config.ts`, `app/eas.json` und das tatsächlich erzeugte Release-Artefakt.

Während der Prüfung änderte sich der uncommittete Working Tree parallel, insbesondere an einer Gruppenfunktion. Die Qualitätsresultate unten stammen aus der letzten Momentaufnahme nach Vorliegen der neuen Module; nach Stabilisierung ist die komplette Prüfung in einem sauberen Checkout erneut auszuführen.

## Priorisierte Befunde

| Priorität | Befund | Store-Relevanz | Status |
|---|---|---|---|
| P0 | Vollständiger Backend-Datenexport für jedes angemeldete Konto | Sicherheit, Datenschutz, Review Guidelines | Blocker |
| P0 | DB-Dumps/PII im Repository und Container-Kontext | Sicherheit, Datenschutz, Incident-Risiko | Blocker |
| P0 | Keine Kontolöschung | Apple 5.1.1(v), Google Account Deletion | Blocker |
| P0 | Datenschutz/Store-Labels/In-App-Links unvollständig | Apple 5.1.1, Google User Data/Data Safety | Blocker |
| P0 | UGC-/Social-Funktionen ohne Report/Block/Moderation | Apple 1.2, Google UGC Policy | Blocker |
| P1 | Zu breite Backend-Leserechte | Datenminimierung und Zugriffsschutz | Vor Review beheben |
| P1 | Unnötige native Berechtigungen und SDKs | Permission Policy, Review-Risiko | Vor Release beheben |
| P1 | Kein signiertes AAB/IPA geprüft | Technische Einreichung | Vor Upload erforderlich |
| P1 | Tests, Lint und TypeScript nicht grün | Mindestqualität/Funktionalität | Vor Release beheben |
| P1 | Versionsquellen widersprechen sich | Store-/OTA-Versionierung | Vor Build beheben |
| P1 | Offline-Cache/Backups enthalten potenziell personenbezogene Daten | Datenschutz/Sicherheit | Vor Review klären |
| P1 | Sign in with Apple extern nicht verifizierbar | Apple 4.8, bedingt | Auth0 prüfen |
| P2 | Accessibility nicht ausreichend belegt | Store-Qualität/Barrierefreiheit | Vor Veröffentlichung testen |
| P2 | Store-Metadaten, Screenshots und Feature Graphic fehlen im Repo | Listing | Vor Einreichung erstellen |

## P0-Blocker im Detail

### 1. Backend-Export gibt vollständige sensible Tabellen aus

**Beleg**

- `backend/hwb/srv/server.js:98-111` erlaubt Exporte unter anderem für `ExternalUsers`, `Friendships`, `PendingFriendshipRequests`, `RouteCalculationRequest`, `Stampings`, `Tours` und `Attachments_local`.
- `backend/hwb/srv/server.js:198-207` prüft nur, ob irgendein Nutzer authentifiziert ist.
- `backend/hwb/srv/server.js:224-245` führt anschließend ein ungefiltertes `SELECT.from(...)` auf der kompletten Tabelle aus.
- Die Route wird in `backend/hwb/srv/server.js:299` produktiv registriert.

Damit kann nach Codebefund jedes gültige App-Konto Daten anderer Nutzer exportieren.

**Erforderlich**

- Exportroute sofort aus der Produktion entfernen oder ausschließlich mit einer serverseitig verifizierten Admin-Rolle schützen.
- Keine Rollen oder Admin-Flags aus ungeprüften Clientparametern akzeptieren.
- Negative Integrationstests anlegen: anonym, normaler Nutzer, abgelaufener Token und falsche Rolle müssen `401/403` erhalten.
- Für erlaubte Admin-Exporte Zweckbindung, minimale Felder, Audit-Logging, Rate Limit und Download-Protokollierung vorsehen.
- Produktivlogs auf Zugriffe auf `/export/csv` prüfen.
- Bei möglicher Nutzung Datenschutz-/Security-Incident-Prozess starten und Meldepflichten fachlich/rechtlich bewerten.

**Abnahmekriterium**

Ein normaler Testnutzer kann weder die Entitätenliste noch einen CSV-Datensatz abrufen; automatisierte Tests beweisen dies. Eine produktive Zugriffsauswertung ist dokumentiert.

### 2. Datenbank-Dumps und personenbezogene Daten sind getrackt

**Beleg**

Getrackt sind unter anderem:

- `backend/hwb/db.sqlite`
- `backend/hwb/dump.dump`
- `backend/hwb/db/doNotDeploy-data/hwb.db.ExternalUsers.csv`
- `backend/hwb/db/doNotDeploy-data/hwb.db.Friendships.csv`
- `backend/hwb/db/doNotDeploy-data/hwb.db.Stampings.csv`
- weitere Export-CSV-Dateien

`backend/hwb/db/schema.cds:20-34` zeigt für Nutzer unter anderem E-Mail, Namen, Auth0-Identifier und Profilbild. `Dockerfile:29-36` und `backend/hwb/Dockerfile:14-21` kopieren breit den Backend-Kontext; entfernt wird nur `db/data`, nicht `db.sqlite`, `dump.dump` oder `db/doNotDeploy-data`.

**Erforderlich**

- Herkunft und Realbezug sämtlicher Datensätze klären.
- Dateien aus dem aktuellen Stand und aus zukünftigen Build-Kontexten entfernen.
- `.dockerignore` ergänzen und im Dockerfile nur explizit benötigte Pfade kopieren.
- Ausschließlich synthetische, deterministische Test-Fixtures verwenden.
- Git-Historie, CI-Artefakte, Container-Registry und Deployments auf Kopien prüfen.
- Falls echte Daten oder produktive Identifier enthalten sind: Historie kontrolliert bereinigen, vorhandene Artefakte ersetzen, betroffene Tokens/Schlüssel rotieren und Datenschutzvorfall bewerten.
- CI-Prüfungen für Secrets, PII-Muster und verbotene Dump-Dateien ergänzen.

**Abnahmekriterium**

Der Release-Commit und das daraus erzeugte Container-Image enthalten keine Dumps oder echten Nutzer-/Bewegungsdaten. CI verhindert ein erneutes Einchecken.

### 3. Kontolöschung fehlt

**Beleg**

- `app/app/login.tsx:90-105` bietet „Konto erstellen“.
- `app/lib/auth.tsx:949-1048` startet den Auth0-Signup.
- `app/app/(tabs)/profile.tsx:180-206` bietet nur Admin, Onboarding-Reset und Logout.
- `app/lib/auth.tsx:1177-1212` löscht nur die lokale Sitzung und beendet die Auth0-Sitzung.
- Es wurde keine Backendaktion zur vollständigen Löschung gefunden.

Apple verlangt bei Kontoerstellung eine Löschmöglichkeit in der App. Google verlangt einen In-App-Pfad **und** eine öffentlich erreichbare Web-URL zur Löschung/Beantragung. Ein bloßes Deaktivieren oder Logout genügt nicht.

**Erforderlich**

- Im Profil einen klaren Flow „Konto und Daten löschen“ mit erneuter Authentifizierung und verständlicher Bestätigung einbauen.
- Server orchestriert die Löschung der Auth0-Identität und aller zugeordneten Daten, zum Beispiel:
  - `ExternalUsers` und Profilbild/Attachment;
  - Freundschaften und offene Anfragen;
  - Stampings, Notizen und gruppenbezogene Berechtigungen;
  - selbst erstellte Touren und zugehörige Verknüpfungen;
  - Cache-/Routing-/Suchdaten, soweit nutzerbezogen;
  - lokale Tokens und persistierter Query-Cache.
- Referenzielle Integrität und Löschreihenfolge automatisiert testen.
- Gesetzlich notwendige Restdaten nur mit dokumentierter Rechtsgrundlage, Frist und Sperrkonzept behalten.
- Eine öffentliche, ohne Login erreichbare Löschseite bereitstellen und in Play Console hinterlegen.
- Abschluss, Fehler- und Wiederholungsfall nutzerfreundlich behandeln; keine verwaisten Auth0- oder Backendkonten.

**Abnahmekriterium**

Ein Store-Reviewer kann ein Konto in der App vollständig löschen. Nach Abschluss sind Login, Profilsuche und Datenabruf nicht mehr möglich; Backend-, Auth0- und lokale Daten sind nachweislich entfernt oder rechtmäßig gesperrt. Die Web-Löschseite funktioniert.

Offizielle Anforderungen:

- [Apple – Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Google Play – Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en-EN)

### 4. Datenschutz und Store-Deklarationen sind nicht vollständig

**Beleg**

- In Login, Onboarding und Profil wurde kein leicht erreichbarer Link zu Datenschutz, Nutzungsbedingungen oder Support gefunden.
- Die öffentliche [Datenschutzerklärung](https://www.harzer-wander-buddy.de/privacy-policy) hat Stand 27. Januar 2025, ist überwiegend weborientiert und ist nicht konsistent mit allen mobilen Funktionen.
- Sie beschreibt Profile als nicht öffentlich; nach `backend/hwb/srv/hwb-service.cds:174-192` können alle authentifizierten Nutzer Namen/Bilder lesen.
- Die App fordert Auth0-Scope `openid profile email offline_access` (`app/app.json:82-90`).
- Genaue Koordinaten werden für Routen/Orte verarbeitet und teilweise gespeichert (`backend/hwb/db/schema.cds:92-97`, `backend/hwb/srv/hwb-service.js:1151-1160`).
- Daten werden für Routes, Elevation und Places an Google-Dienste übermittelt (`backend/hwb/srv/hwb-service.js:1428-1445`, `1528-1534`, `1653-1679`).
- `expo-insights` ist installiert (`app/package.json:49`) und kann App-Start-/Geräte-/Installationsmetadaten an Expo übermitteln.
- Profil-, Freundschafts-, Stempel-, Notiz-, Tour- und Suchdaten werden verarbeitet.
- Der React-Query-Cache wird 14 Tage in AsyncStorage gespeichert (`app/lib/query-persistence.ts:4-16`).
- Das lokale iOS-Privacy-Manifest weist keine erhobenen Datentypen aus; die final aggregierte Manifest-/Privacy-Report-Ausgabe und die App-Store-Labels müssen mit dem tatsächlichen Release-Bundle abgeglichen werden.

**Erforderlich**

- Mobile Datenschutzerklärung neu und konkret erstellen:
  - Verantwortlicher, Kontakt und Datenschutzanfragen;
  - Datenkategorien, Zwecke, Rechtsgrundlagen und Pflicht/optional;
  - genaue Standortdaten und Weitergabe an Google-Routen-/Karten-/Places-Dienste;
  - Auth0, Hosting, Expo/EAS Updates/Insights und weitere tatsächliche Empfänger;
  - Profilbilder, soziale Beziehungen, Stempel-/Besuchsverlauf, Notizen und Touren;
  - lokale Speicherung/Backups, Aufbewahrung, Löschung und Betroffenenrechte;
  - Drittlandtransfers und eingesetzte Garantien;
  - Alters-/Zielgruppenregelung.
- Datenschutzerklärung, Nutzungsbedingungen/Community-Regeln, Impressum und Support in Login/Signup und Profil leicht erreichbar verlinken.
- Google Data Safety und Apple App Privacy anhand einer gemeinsamen, versionierten Dateninventur ausfüllen.
- `expo-insights` und andere ungenutzte Telemetrie entfernen, wenn kein klarer Produktzweck besteht; andernfalls korrekt deklarieren.
- Das finale iOS-Privacy-Manifest/Privacy Report und die SDK-Manifeste gegen die Store-Antworten prüfen.
- Zustimmung und Version der Nutzungsbedingungen protokollieren; Datenschutzinformationen nicht unnötig als „Consent“ für zwingende Verarbeitung behandeln.

**Abnahmekriterium**

App-Verhalten, In-App-Texte, öffentliche Dokumente, Data Safety, Apple App Privacy und das finale Bundle widersprechen sich nicht. Alle Links sind ohne Anmeldung erreichbar und dauerhaft verfügbar.

Offizielle Anforderungen:

- [Apple App Review Guidelines 5.1.1](https://developer.apple.com/app-store/review/guidelines/)
- [Apple – Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Google Play – Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- [Google Play – User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en-GB)

### 5. UGC-/Social-Schutzmaßnahmen fehlen

**Beleg**

- Nutzer können Namen und Profilbilder pflegen.
- Alle authentifizierten Nutzer können Profile suchen/anzeigen.
- Freunde und Gruppen sehen Fortschritt/Stampings.
- Nutzer können Tour-Namen und Stempelnotizen anlegen; Touren sind nach `backend/hwb/srv/hwb-service.cds:275-298` breit lesbar.
- Es wurden keine Funktionen für Melden, Blockieren, Inhaltsausblendung oder Moderation gefunden.
- Es wurde keine explizite Zustimmung zu Community-Regeln vor Upload/Veröffentlichung gefunden.

**Erforderlich**

- Versionierte Nutzungsbedingungen und Community-Regeln mit klar verbotenen Inhalten erstellen.
- Zustimmung vor erstmaliger Veröffentlichung nutzergenerierter Inhalte einholen.
- „Nutzer/Inhalt melden“ an Profil, Tour und sonstigen relevanten Ansichten implementieren.
- Nutzer blockieren können; blockierte Nutzer und deren Inhalte/Interaktionen gegenseitig ausblenden.
- Backendmodelle und Zugriffsschutz für Reports/Blocks einführen.
- Moderationsqueue, Bearbeiterrollen, Audit-Trail, Eskalationsweg und Reaktions-SLA definieren.
- Erreichbare Support-/Kontaktmöglichkeit veröffentlichen.
- Missbrauchstests für Profilbild, Name, Tourtitel, Notiz und Freundschaftsanfragen durchführen.

**Abnahmekriterium**

Ein Reviewer kann Regeln akzeptieren, einen Nutzer/Inhalt melden und einen Nutzer blockieren. Meldungen erreichen eine getestete Moderationsqueue; blockierte Inhalte/Interaktionen werden wirksam unterdrückt.

Offizielle Anforderungen:

- [Apple App Review Guidelines 1.2](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play – User Generated Content](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en)

## Android / Google Play

### Bestandene bzw. plausible Basisanforderungen

- Effektive Expo-SDK-54-Konfiguration: `compileSdk 36`, `targetSdk 36`, `minSdk 24`.
- Damit ist auch die ab **31. August 2026** für neue Apps/Updates geltende API-36-Anforderung erfüllt.
- Paketname: `de.kuestenbit.harzerwanderbuddy`.
- arm64-v8a ist vorhanden.
- Die im vorhandenen APK untersuchten 64-Bit-Bibliotheken waren 16-KB-ausgerichtet. Wegen der seit 1. November 2025 geltenden 16-KB-Anforderung ist die Prüfung am finalen AAB und an Play-generierten APKs zu wiederholen.
- Hauptendpunkte nutzen HTTPS.

Quellen:

- [Google Play – Target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=de)
- [Android – Support 16 KB page sizes](https://developer.android.com/guide/practices/page-sizes)

### Berechtigungen bereinigen

`app/app.json:24-34` enthält doppelte Location-Einträge und ausdrücklich `RECORD_AUDIO`. `expo-image-picker` ergänzt ohne Gegenkonfiguration Kamera-/Mikrofontexte bzw. -Berechtigungen. Im erzeugten Manifest/älteren APK erschienen zusätzlich unter anderem Kamera, Mikrofon, Notifications, Boot, Wake Lock und Foreground Service.

Die App nutzt für das Profilbild nur die Mediathek. `expo-background-fetch`, `expo-notifications` und `expo-task-manager` sind installiert, aber im App-Code nicht fachlich verwendet.

**Maßnahmen**

- `RECORD_AUDIO` und doppelte Location-Permissions aus `app.json` entfernen.
- Beim Image-Picker mindestens `cameraPermission: false` und `microphonePermission: false` setzen.
- System Photo Picker verwenden; keine breite `READ_MEDIA_IMAGES`-/`READ_MEDIA_VIDEO`-Berechtigung für gelegentliche Profilbildwahl.
- Unbenutzte Notifications-/Background-/Task-/Insights-Pakete entfernen oder vollständig implementieren, begründen und deklarieren.
- Finales Manifest mit `apkanalyzer`/`bundletool` prüfen.
- Unvermeidbar durch Libraries eingebrachte, ungenutzte Rechte über `android.blockedPermissions` entfernen.
- Nur Vordergrundstandort anfordern, erst im Kontext der Funktion; Gastfunktionen ohne Standort erhalten.

Quelle: [Google Play – Photo and Video Permissions](https://support.google.com/googleplay/android-developer/answer/14115180?hl=en-CA)

### AAB, Signing und Maps

Es wurde kein finaler signierter Produktions-AAB erzeugt. Ein vorhandener lokaler nativer Releasepfad verwendet Debug-Signing, ist aber ignoriert/stale; für die Veröffentlichung muss ausschließlich ein sauber definierter Produktionspfad gelten.

**Maßnahmen**

- EAS-Produktionsbuild als AAB erzeugen.
- Play App Signing aktivieren und Upload-Key sicher verwalten.
- `versionCode` im Remote-Versionierungsfluss prüfen und vor jedem Upload erhöhen.
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` für den Produktionsbuild setzen.
- Maps-Key auf Android-Paketname und SHA-1 des Play-App-Signing-Zertifikats sowie nur benötigte APIs beschränken.
- AAB mit `bundletool`, `apkanalyzer` und 16-KB-Prüfung untersuchen.
- Über internen Play-Testtrack installieren; Login, Karte, Standort, Offline, Profilbild, Freunde, Gruppen, Touren, Stempeln, Logout und Löschung auf realen Geräten testen.

Quellen:

- [Android App Bundles](https://support.google.com/googleplay/android-developer/answer/9844679?hl=en)
- [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en)

### Play-Console-Pflichten

- App Access: dauerhaft nutzbaren Review-Account ohne MFA/OTP und genaue Prüfschritte bereitstellen.
- Data Safety, Privacy-URL und öffentliche Account-Deletion-URL.
- Content Rating, Target Audience, Werbung, Kategorie/Tags und Kontakt.
- Titel, Kurzbeschreibung, Langbeschreibung und Release Notes.
- 512×512 Store-Icon, 1024×500 Feature Graphic und mindestens zwei reale Phone-Screenshots.
- Keine echten personenbezogenen Daten in Screenshots.
- Falls das persönliche Entwicklerkonto nach dem 13. November 2023 erstellt wurde: Closed Test mit mindestens 12 dauerhaft angemeldeten Testern über 14 Tage vor Produktionszugang.

Quellen:

- [Google Play – Store listing assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en)
- [Google Play – App access](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en)
- [Google Play – Testing requirements for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-EN)

## iOS / Apple App Store

### Bestandene bzw. plausible Basisanforderungen

- Unsigned Release-Build für ein generisches iOS-Gerät mit Xcode 26.6/iOS-SDK 26.5 erfolgreich.
- Apples Buildschritt `-validate-for-store` war erfolgreich.
- Damit ist die seit **28. April 2026** geltende Anforderung, mit iOS-26-SDK oder neuer zu bauen, technisch erreichbar.
- Bundle-ID: `de.kuestenbit.harzer-wander-buddy`.
- Deployment Target 15.1 und arm64 sind plausibel.
- App-Icon: 1024×1024, RGB, ohne Alpha und ohne vorgerundete Ecken.
- ATS erlaubt keine beliebigen Klartext-Netzwerkzugriffe.
- Privacy-Manifeste/Required-Reason-API-Einträge werden grundsätzlich ins Bundle kopiert.
- Kein AdSupport/IDFA/ATT-Code gefunden. ATT ist nur dann nicht erforderlich, wenn auch die tatsächlichen SDK-/Backendpraktiken kein Cross-App-Tracking betreiben.

Quelle: [Apple – Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)

### Signiertes Archiv und Versionierung

Es wurde kein signiertes Distributionsarchiv/TestFlight-Build validiert.

**Maßnahmen**

- Distribution-Zertifikat, Provisioning, Team, App-ID, EAS-Credentials und Agreements prüfen.
- Signiertes EAS-IPA erzeugen, hochladen und TestFlight-Verarbeitung inklusive Privacy-Manifest-Warnungen abwarten.
- `app/package.json` (`1.5.3`) und `app/app.json` (`1.5.2`) vereinheitlichen.
- Remote `buildNumber`, `CFBundleShortVersionString` und Expo `runtimeVersion` am echten EAS-Artefakt prüfen.
- Einen einzigen reproduzierbaren Releasepfad dokumentieren; stale lokale Native-Projekte nicht als Releasequelle nutzen.

### Sign in with Apple

Die App nutzt Auth0 Universal Login. Aus dem Repository ist nicht ersichtlich, welche Provider dort aktiv sind. Die öffentliche Datenschutzerklärung nennt Google- und Apple-SSO, im Repo wurde jedoch keine Apple-Authentication-Konfiguration gefunden.

**Bedingtes Abnahmekriterium**

- Wenn Google/Facebook oder ein anderer Drittanbieter-Login angeboten wird, muss in der Regel auch eine gleichwertige datensparsame Loginoption, typischerweise Sign in with Apple, vollständig funktionieren.
- Bei ausschließlich eigenem E-Mail-/Passwortkonto ist die Ausnahme zu dokumentieren.
- Login, Signup, Account-Linking, E-Mail-Relay und Löschung mit Apple-Konto in TestFlight prüfen.

Quelle: [Apple App Review Guidelines 4.8](https://developer.apple.com/app-store/review/guidelines/)

### Purpose Strings, Fotoauswahl, Push und iPad

- Generierte iOS-Konfiguration enthält offenbar unbenutzte/generische Texte für Kamera, Mikrofon, Face ID und „Always“-Standort.
- Nur erforderliche Info.plist-Keys behalten und konkrete, lokalisierte deutsche Texte verwenden.
- Für eine einzelne Profilbildwahl möglichst den System-Photo-Picker ohne vorherige Vollbibliotheksfreigabe verwenden.
- Das Onboarding darf keine Benachrichtigungsfunktion versprechen, wenn Push/APNs nicht implementiert und getestet ist. Andernfalls APNs-Entitlement, Berechtigungsdialog, Tokenhandling und Löschung des Tokens vollständig umsetzen.
- `supportsTablet: true` verlangt vollständige iPad-QA und passende iPad-Screenshots. Split View, Landscape, große/kleine Fenster und Karte testen; sonst Tablet-Support bewusst deaktivieren.

### App Store Connect

- Name, Untertitel, Beschreibung, Keywords, Kategorie, Support-, Marketing- und Privacy-URL.
- neue Altersfreigabe, Content Rights und EU-DSA-Händlerstatus.
- reale iPhone-Screenshots; bei aktiviertem Tablet-Support auch iPad.
- App Privacy vollständig ausfüllen.
- Review Notes mit Standort-/Gastmodus-/Login-/Löschschritten und stabilem Produktions-Demoaccount.
- Keine lokalen Testzugangsdaten ungeprüft übernehmen; Store-Review benötigt einen eigens vorgesehenen, dauerhaft erreichbaren Produktions-/Stagingzugang.

Quellen:

- [Apple – Required app information](https://developer.apple.com/help/app-store-connect/reference/app-information/required-localizable-and-editable-properties/)
- [Apple – Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

## Weitere technische und datenschutzbezogene Befunde

### Backend-Zugriffe zu breit

- `backend/hwb/srv/hwb-service.cds:174-192`: alle authentifizierten Nutzer lesen Nutzername und Profilbild.
- `backend/hwb/srv/hwb-service.cds:233-254`: Friendship-Datensätze sind breit lesbar.
- `backend/hwb/srv/hwb-service.cds:275-298`: alle Tours sind lesbar.
- `backend/hwb/srv/hwb-service.cds:329-346`: Stampings aller Nutzer sind lesbar.
- `backend/hwb/srv/hwb-service.js:401-405` dokumentiert selbst, dass alle Stampings geladen und erst nachträglich teilweise gefiltert werden.

Leserechte auf Eigentümer, bestätigte Freunde und explizit freigegebene Gruppen begrenzen. Autorisierung muss in der Datenbankabfrage greifen, nicht erst nach dem Laden. Für jede Entität positive und negative Nutzer-Isolationstests anlegen.

### CORS-Allowlist ist wirkungslos

`backend/hwb/srv/server.js:41-48` enthält ein sofortiges `return true`; damit wird jede Browser-Origin als lokale Entwicklungs-Origin akzeptiert. CORS ersetzt keine Authentifizierung, muss aber für den Web-Client trotzdem korrekt auf die Produktions-Origins beschränkt und getestet werden.

### Offline-Cache und Android-Backup

Der gesamte React-Query-Cache wird 14 Tage unverschlüsselt in AsyncStorage persistiert. Darin können Profile, Freundschaften, Stempel-/Besuchsstände und Tourdetails liegen.

**Maßnahmen**

- Persistenz-Whitelist statt gesamtem Query-Cache.
- Personenbezogene Daten minimieren, sensible Daten ggf. verschlüsseln.
- Cache bei Logout, Accountwechsel, Löschung und Tokenfehler sicher leeren; Tests ergänzen.
- Android-Backup deaktivieren oder den Cache explizit von Cloud-/Device-Transfer-Backups ausschließen.
- Aufbewahrung in Datenschutzdokumentation und Dateninventur aufnehmen.

### Standort und Outdoor-Sicherheit

- Vor Standortfreigabe klar erklären, dass genaue Koordinaten an eigenes Backend und für Routing/Places an Google übermittelt werden.
- Nur „When in Use“ und nur kontextbezogen anfordern.
- Ohne Freigabe eine brauchbare Alternative anbieten.
- Routen auf gesperrte/gefährliche Wege, fehlende Netzabdeckung, veraltete Daten und fehlerhafte Startposition testen.
- Klarstellen, dass die App keine offizielle Gefahrenwarnung oder garantiert sichere Navigation ersetzt.
- Rechte/Lizenzen für Namen, Marken, Stempelstellen-, Karten-, Foto- und Badge-Inhalte dokumentieren.

### Accessibility

Eine statische Stichprobe zeigt viele `Pressable`-Elemente, aber vergleichsweise wenige Accessibility-Rollen/-Labels. Beispiele sind Icon-only-Kartencontrols, Filter-Toggles, Zurück-/Chevron-Icons und Profilbildwahl.

Vor Release manuell mit VoiceOver und TalkBack testen:

- Onboarding und Berechtigungen;
- Gastmodus, Login und Signup;
- Karte, Zoom, Standort und Auswahl-Sheets;
- Stempeln/Gruppe, Touren und Freunde;
- Profil, Rechtstexte, Report/Block und Kontolöschung;
- Fokusreihenfolge, Rollen, Zustände, Fehlermeldungen und Dialogfokus;
- 48-dp-Touchziele, 200-%-Text, Kontrast, Dark Mode und Reduced Motion.

Keine Apple Accessibility Nutrition Labels beanspruchen, bevor die Kriterien tatsächlich geprüft und dokumentiert sind.

## Gemeinsame Dateninventur für Apple App Privacy und Google Data Safety

Mindestens folgende Datentypen müssen anhand des echten Produktionssystems bewertet werden:

| Datentyp | Beispiele im Produkt | Zu klären/deklarieren |
|---|---|---|
| Kontakt-/Identitätsdaten | Name, E-Mail, Auth0-ID, User-ID | Zweck, Pflicht, Identitätsverknüpfung, Auth0/Hosting |
| Nutzerinhalt | Profilfoto, Tourname, Stempelnotiz | Sichtbarkeit, Moderation, Empfänger, Löschung |
| Genaue Position | aktuelle Koordinaten, Routing-/Places-Bias | Speicherung, Google-Weitergabe, Aufbewahrung |
| Social Graph | Freunde, Anfragen, Blockierungen, Gruppen | Sichtbarkeit, Zugriff, Löschung |
| Aktivität | Stampings, Besuchshistorie, Tourfortschritt | Identitätsbezug, Aufbewahrung, Freunde/Gruppe |
| Suchdaten | Places-/Nutzersuche, serverseitiger Cache | Logging, Cachefristen, Empfänger |
| App-Interaktionen | Expo Insights/App-Starts, EAS-Update-Checks | Zweck, Identifier, Opt-out/Entfernung |
| Diagnostik | Logs, Netzwerk-/Gerätemetadaten | tatsächliche SDKs, Fristen, Auftragsverarbeiter |
| Lokale Daten | Tokens, Query-Cache, Einstellungen | Verschlüsselung, Backup, Löschzeitpunkt |

Für jeden Datentyp dokumentieren:

- Quelle und konkrete Felder;
- Zweck und Rechtsgrundlage;
- erforderlich oder optional;
- mit Nutzeridentität verknüpft oder nicht;
- „collected“/„shared“ gemäß jeweiliger Storedefinition;
- Empfänger/Auftragsverarbeiter und Drittlandtransfer;
- Speicherort, Aufbewahrungsfrist und Löschmechanismus;
- Minderjährige/Zielgruppe;
- Nachweis im Apple-/Google-Fragebogen.

## Aktueller Qualitätsstatus

### Erfolgreich

- Expo-Konfiguration lässt sich auflösen/introspektieren.
- Ein früherer Expo-Export bündelte Android, iOS und Web erfolgreich; nach den aktuellen Working-Tree-Änderungen erneut ausführen.
- Unsigned iOS-Release-Build mit Store-Validierung erfolgreich.
- Das vorhandene ältere Android-Artefakt enthält arm64 und zeigte bei der Stichprobe 16-KB-Ausrichtung.
- Icon technisch geeignet: 1024×1024 RGB ohne Alpha.
- `npm ls --omit=dev --depth=0` meldete keinen kaputten Produktions-Abhängigkeitsbaum.

### Fehlgeschlagen / offen

Letzte Momentaufnahme der Schlussprüfung:

- `npm run lint`: erfolgreich, zwei Warnungen zu `require()`-Imports in `app/components/maps/map-primitives.ts`.
- `npx tsc --noEmit`: fehlgeschlagen; zwei `.tsx`-Importfehler in `app/(tabs)/map.web.tsx` und `app/tours/[id]/index.web.tsx` sowie ein Auth-Nullability-Fehler in `app/lib/auth.tsx:481`.
- Jest mit expliziter Konfiguration: 18 von 18 Suites und 71 von 71 Tests bestanden.
- Der normale `npm test`-Pfad hatte zuvor zwei konkurrierende Jest-Konfigurationen (`package.json` und `jest.config.js`).
- `expo install --check`: `@react-native-community/netinfo@11.5.2` weicht von der für Expo SDK 54 erwarteten Version `11.4.1` ab.
- Kein signierter Produktions-AAB.
- Kein signiertes Distributions-IPA/TestFlight-Build.

**Release-Gate**

Lint, TypeScript, alle Tests und Produktionsbundling müssen in einem sauberen Checkout reproduzierbar grün sein. CI muss genau dieselben Befehle ausführen. Danach sind Smoke-/E2E-Tests auf den Store-Artefakten erforderlich.

## Konkreter Veröffentlichungsplan

### Phase 0 – Sofortige Security-Maßnahmen

- [ ] CSV-Export entfernen oder strikt auf serverseitige Adminrolle begrenzen.
- [ ] Produktivzugriffe auf Exportroute untersuchen und Ergebnis dokumentieren.
- [ ] DB-/CSV-Dumps und PII aus Build-Kontext und künftigem Git-Stand entfernen.
- [ ] Git-Historie, Registry, CI-Artefakte und Deployments prüfen.
- [ ] Falls reale Daten betroffen sind: Incident-/Meldepflichten bewerten und Schlüssel/Tokens rotieren.
- [ ] `.dockerignore`, explizite Docker-COPYs und CI-PII-/Secret-Scans ergänzen.
- [ ] Breite Read-Berechtigungen und CORS korrigieren; Isolationstests ergänzen.

**Gate:** Security Review ohne P0/P1-Befund, dokumentierte Produktionsprüfung und grüne Autorisierungstests.

### Phase 1 – Pflichtfunktionen und Datenschutz

- [ ] Vollständigen In-App-Kontolöschflow plus öffentliche Web-Löschseite implementieren.
- [ ] Auth0-/Backend-/Attachment-/Cache-Löschung und Aufbewahrungsregeln testen.
- [ ] Mobile Datenschutzerklärung, Nutzungsbedingungen, Community-Regeln, Impressum und Support fertigstellen/verlinken.
- [ ] Report-, Block- und Moderationssystem einschließlich SLA implementieren.
- [ ] Gemeinsame Dateninventur erstellen und technisch/rechtlich abnehmen.
- [ ] Apple App Privacy und Google Data Safety zunächst als Entwurf aus der Inventur ableiten.
- [ ] Standortweitergabe und optionale Funktionen transparent gestalten.
- [ ] Offline-Cache, Backup und Aufbewahrung minimieren.

**Gate:** End-to-End-Tests für Löschung, Report und Block; Rechts-/Datenschutzfreigabe; Dokumente und App-Verhalten sind konsistent.

### Phase 2 – Native Konfiguration und Qualitätsgate

- [ ] Unbenutzte SDKs und native Permissions entfernen.
- [ ] iOS-Purpose-Strings minimieren und lokalisieren.
- [ ] Auth0-Provider prüfen; Sign in with Apple bei Bedarf fertigstellen.
- [ ] Versionsquelle auf einen Wert vereinheitlichen und Releaseprozess dokumentieren.
- [ ] Expo-kompatible Abhängigkeitsversionen herstellen.
- [ ] Jest-Konfiguration konsolidieren.
- [ ] Lint, TypeScript, Unit-/Integrationstests und Bundling grün machen.
- [ ] Accessibility-Befunde beheben und manuelle Tests dokumentieren.
- [ ] iPad vollständig unterstützen/testen oder `supportsTablet` deaktivieren.

**Gate:** sauberer Checkout, grüne CI, keine ungenutzten sensiblen Berechtigungen im finalen Manifest.

### Phase 3 – Produktionsartefakte

- [ ] Signierten EAS-Android-Produktionsbuild als AAB erzeugen.
- [ ] AAB: Signatur, versionCode, API 36, ABIs, 16-KB, Manifest und Maps-Key-Restriktionen prüfen.
- [ ] Signierten EAS-iOS-Produktionsbuild erzeugen und via TestFlight verarbeiten.
- [ ] IPA: Bundle-/Buildversion, Entitlements, Purpose Strings, Privacy Report, SDK-Manifeste und Export Compliance prüfen.
- [ ] Realgeräte-Matrix festlegen und vollständige Smoke-/Regressionstests auf Store-Builds durchführen.
- [ ] OTA-Update-Prozess beschränken: keine Umgehung von Review oder Änderung des Hauptzwecks/native Features ohne Store-Release.

**Gate:** beide Artefakte in internen Tracks installiert, vollständige Release-Checkliste ohne offenen Blocker.

### Phase 4 – Store Listings und Einreichung

- [ ] Apple- und Google-Texte, Kategorie, Altersfreigabe, Zielgruppe und Rechte/Lizenzen fertigstellen.
- [ ] Screenshots ohne personenbezogene Daten erzeugen.
- [ ] Google: 512-Icon, 1024×500 Feature Graphic, Phone-Screenshots.
- [ ] Apple: iPhone- und gegebenenfalls iPad-Screenshots.
- [ ] Privacy-/Deletion-/Support-URLs produktiv überwachen.
- [ ] Store-Fragebögen exakt nach finaler Dateninventur ausfüllen.
- [ ] Stabilen Reviewer-Account ohne MFA/OTP und nachvollziehbare Review Notes bereitstellen.
- [ ] Interne Tests, TestFlight und ggf. Googles 12-Tester-/14-Tage-Voraussetzung abschließen.
- [ ] Vor Submit einen letzten Diff zwischen Store-Angaben, Rechtstexten und finalem Bundle durchführen.

**Gate:** Play Console und App Store Connect zeigen keine Warnung/fehlende Pflichtangabe; ein unabhängiger Pre-Submission-Review ist bestanden.

## Definition of Done für „veröffentlichungsfähig“

Die App kann erst als veröffentlichungsfähig gelten, wenn alle folgenden Punkte erfüllt sind:

- keine P0-/P1-Sicherheits- oder Datenschutzbefunde offen;
- Kontolöschung, Report und Block funktionieren Ende-zu-Ende;
- Datenschutzerklärung, Community-Regeln und Store-Labels stimmen mit dem Produkt überein;
- minimale und begründete Berechtigungen;
- grüne CI einschließlich Lint, TypeScript, Tests und Bundling;
- finaler AAB/IPA signiert, analysiert und auf realen Geräten getestet;
- korrekte Versionen, Signierung, Entitlements und 16-KB/API-/SDK-Anforderungen;
- vollständige Store-Metadaten, Assets, Review-Zugang und Console-Fragebögen;
- Auth0-/Sign-in-with-Apple-Konfiguration geklärt;
- Accessibility-, iPad-/Gerätematrix- und Outdoor-Sicherheitstests dokumentiert;
- Produktionsbackend und Rechtstexte bleiben während des Reviews erreichbar.

## Offizielle Referenzen

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple – Account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Apple – App privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Apple – Third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/)
- [Apple – Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Apple – Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)
- [Google Play – Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=de)
- [Google Play – Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en-EN)
- [Google Play – Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- [Google Play – User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en-GB)
- [Google Play – UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en)
- [Google Play – Photo/Video permissions](https://support.google.com/googleplay/android-developer/answer/14115180?hl=en-CA)
- [Google Play – Store listing assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en)
- [Android – 16-KB page sizes](https://developer.android.com/guide/practices/page-sizes)

Diese Analyse ist eine technische und Store-Policy-Prüfung, keine Rechtsberatung. Datenschutztexte, Rechtsgrundlagen, Aufbewahrung und etwaige Incident-Meldepflichten sollten zusätzlich fachanwaltlich bzw. durch den Datenschutzverantwortlichen geprüft werden.

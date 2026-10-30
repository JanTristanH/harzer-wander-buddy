# Persönliche Stempelnotizen offline synchronisieren

Auf iOS und Android schreibt „Speichern“ zunächst in eine persistente AsyncStorage-Warteschlange. Erst nach erfolgreichem Schreiben erscheint „Auf Gerät gespeichert“. Pro Stempel bleibt die neueste gespeicherte Fassung samt ursprünglicher Serverversion erhalten. Auch eine leere Notiz wird übertragen. Nicht gespeicherter Text bleibt ein Entwurf und löst weiterhin die Rückfrage beim Verlassen aus.

Der Speicher ist nach Backend-URL und angemeldetem Authentifizierungssubjekt getrennt. Er enthält keine Zugangsdaten und unterliegt nicht der Ablaufzeit des Query-Caches. Abmelden löscht ausstehende Notizen nicht; sie sind nur nach erneuter Anmeldung mit demselben Konto sichtbar und übertragbar. Vor und nach einer asynchronen Token-Erneuerung wird das Konto erneut geprüft. Bereits gestartete Requests können beim Abmelden noch unter ihrem ursprünglichen Token abschließen.

Verbindung, Vordergrundwechsel und ein Intervall von 30 Sekunden starten einen Versuch. Eine neue lokale Speicherung startet ebenfalls einen Versuch. Netzwerk-, Authentifizierungs- und Serverfehler lassen den Text bestehen und zeigen einen Fehler mit Wiederholungsmöglichkeit. Bei Fehlern des Gerätespeichers wird kein Speichererfolg gemeldet; der Entwurf bleibt erhalten. Während einer Übertragung gespeicherte weitere Änderungen bleiben erhalten und erhalten nach der Bestätigung die neue Serverversion als Basis.

## Konflikte und mehrere Geräte

Die neue authentifizierte CAP-Aktion `syncStampNote` vergleicht ID, Änderungszeit und Text der Ausgangsfassung in einer Datenbanktransaktion. Der Client hält beim ersten Tippen die Ausgangsfassung fest, auch wenn ein Hintergrundabruf anschließend neuere Daten liefert. Bei unbekannter Ausgangsfassung wird nur eine noch nicht vorhandene Notiz ohne Konflikt angelegt.

Die Aktion sperrt zuerst die Stempelstelle und anschließend eine vorhandene Notiz. Die Sperre der Stempelstelle serialisiert auch zwei gleichzeitige Erstanlagen. Der bestehende Online-Upsert verwendet dieselbe Sperrreihenfolge; reguläre Updates und Löschungen kollidieren mit der Zeilensperre der vorhandenen Notiz. Das Datenbankschema bleibt unverändert. Die Integrationstests laufen mit SQLite; die PostgreSQL-Sperren müssen vor einer Produktionsfreigabe zusätzlich in einer passenden Testumgebung geprüft werden.

Identischer Servertext wird ohne erneutes Schreiben bestätigt. So kann nach verlorener Antwort sicher wiederholt werden. Steht inzwischen ein anderer Text auf dem Server, wird dieser nicht überschrieben. Die lokale Fassung und die beim Konflikt gelesene andere Fassung bleiben über Neustarts erhalten. Die Oberfläche zeigt die andere Fassung und bietet zwei ausdrückliche Entscheidungen:

- **Meine gespeicherte Fassung übernehmen:** erneut bedingt gegen die angezeigte Serverversion schreiben. Eine weitere Änderung auf einem anderen Gerät erzeugt wieder einen Konflikt.
- **Andere Fassung übernehmen:** lokale Änderung verwerfen und die angezeigte andere Fassung übernehmen. Spätere Serveränderungen werden regulär neu geladen.

Zum Zusammenführen kann die lokale Notiz vor der Entscheidung bearbeitet und gespeichert werden. Solange der sichtbare Entwurf ungespeicherte Änderungen enthält, sind die beiden Entscheidungen gesperrt. Konflikte werden niemals automatisch aufgelöst.

## Umfang und Grenzen

Die bestehende Besuchswarteschlange bleibt eigenständig. Gruppenstempeln und Bearbeiten/Löschen von Besuchen bleiben online. Web verwendet weiterhin den bisherigen Online-Notiz-Upsert. Die neue Backend-Aktion muss verfügbar sein, bevor die native Funktion zuverlässig synchronisieren kann; ein älteres Backend verursacht einen sichtbaren Übertragungsfehler und behält die lokalen Änderungen.

Übertragung erfolgt bei laufender App; keine garantierte Hintergrundübertragung bei geschlossener App. Der lokale Speicher ersetzt kein Backup gegen Deinstallation, Speicherlöschung oder Geräteverlust. Bereits synchronisierte Notizen verwenden weiterhin den normalen Detail-Query-Cache; der dauerhafte separate Speicher schützt ausstehende Änderungen und Konflikte.

## Reproduzierbare Prüfungen

```sh
cd app
npx jest --config jest.config.js --runInBand
npx tsc --noEmit
node --test scripts/fingerprint.test.cjs
cd ../backend/hwb
npm test
```

Die neuen Tests prüfen Zusammenfassen mehrerer Änderungen, Leeren, Neustart, Kontotrennung, Token-Erneuerung beim Kontowechsel, Web-Ausschluss, Speicherfehler und fehlgeschlagene Bestätigungsspeicherung, Fehler/Wiederholung, Änderungen während einer Übertragung, Konfliktpersistenz, beide Konfliktentscheidungen, erneute Konflikte und gleichzeitige Geräte. Backend-Tests prüfen zusätzlich Berechtigungen, Validierung und Konflikte mit dem bestehenden Online-Upsert.

Es wird nichts in Produktion deployt und keine produktive Datenbank migriert.

<!-- /founder:pricing-strategy · 2026-10-15 · input: Jahresabo ungefähr 8 Euro; manuelle Kernfunktionen gratis, Tourenautomatik Premium; Freunde im Pass; Compute 5 Euro monatlich plus Entwicklerzugänge. -->
# Preisstrategie: günstiges Sammlerabo und kostenlose Kernfunktionen

Arbeitsentwurf, 15.10.2026. Ersetzt 24,99 €/Jahr und eingeschränkten Gruppenvergleich. Bestätigt: manuelle Touren gratis, Automatik Premium; Freunde im Pass gewünscht. Exakte Preise und Gruppenregeln sind Vorschläge.

Assumption: Preisvorschläge: 7,99 €/Jahr, 2,99 €/14 Tage.

Assumption: Codeprüfung belegt keine Livefunktion. Bei widersprüchlichen Aufgabenlisten hat aktueller Code Vorrang.

Bestätigt: Compute kostet insgesamt 5 €/Monat; hinzu kommen Entwicklerzugänge bei Apple und Google. Geringe Verbrauchskosten sind berichtet, aber nicht beziffert. Gebührenannahmen und Beispielsummen bleiben Schätzungen.

## 1. Modell und Preis

**Basis kostenlos; Premium 2,99 € für 14 Tage ohne Verlängerung oder 7,99 € pro Jahr als Abo.** Beide Bezahlangebote haben dieselben Funktionen. Der Jahrespreis entspricht 0,67 €/Monat; ab drei Urlaubspässen ist das Jahr günstiger. Der Pass beginnt am gewählten Aktivierungstag, weil Urlauber vorab planen können sollen. Verlängerung des Jahresabos und Einmalcharakter des Passes gleich deutlich anzeigen.

Kein Monatsabo, weil Pass und günstiges Jahr beide Bedürfnisse abdecken. Kein Jahresrabatt gegenüber einem nicht angebotenen Monatsabo. Der Pass ist Kurzzeitoption und Preisanker bei gleichem Funktionsumfang.

| Modell | Passung 1 bis 5 | Vorteil | Nachteil |
|---|---:|---|---|
| Festes Abo | 4 | Finanziert laufende Pflege | Urlauber brauchen kurze Laufzeit |
| Nutzungsabhängig | 2 | Deckt Verbrauch | Bezahlen je Tour stört Planung |
| Pro Nutzerplatz | 1 | Erlös je Teilnehmer | Bremst Einladungen |
| Freemium | 5 | Kernprodukt verbreitet sich | Gratisbetrieb kostet Geld |
| Guthaben | 2 | Begrenztes Kostenrisiko | Unnötige Komplexität |
| Einmalkauf | 3 | Keine Abohürde | Lebenslange Leistung bei einmaligem Erlös |

Freemium plus Jahresabo und Pass passt am besten, weil Nutzungshäufigkeit die beiden Zielgruppen trennt. Ein Organisator bezahlt; eingeladene Freunde können Premium innerhalb seiner Gruppe nutzen, weil gemeinsame Planung ohne Einzelkäufe funktionieren soll.

## 2. Kostenloser Funktionsumfang

Keine künstlichen Grenzen für Freunde, Gruppenvergleich oder manuelle Touren.

| Funktion | Befund im Projekt | Empfehlung und Grund |
|---|---|---|
| Stempel erfassen, Datum und Besuchshistorie | Aktuelle App: Stempelansicht und Profil-Timeline | Gratis, weil es die persönliche Sammlung ist |
| Karte, Suche, besuchte/fehlende Stempel | Aktuelle Kartenansicht | Gratis, weil Orientierung zum Kern gehört |
| Freunde einladen, Profile und Fortschritt vergleichen | Freundesansicht, Gruppenauswahl, gruppenbezogene Stempelabfragen | Gratis auch für mehrere Freunde, weil gemeinsames Wandern der Kernnutzen ist |
| Touren manuell erstellen, bearbeiten und speichern | Tourenliste und Bearbeitungsansicht | Gratis, wie vom Gründer bestätigt |
| Touren teilen, geteilte Touren ansehen | Teilen-Funktion in Tourendetails | Gratis, weil Einladungen sonst ins Leere führen |
| Gemeinsam stempeln mit Berechtigung | Gruppendialog und Backendaktion vorhanden | Gratis, weil gemeinsames Erfassen Kernfunktion ist |
| Parkplatzinfos, Entfernung, Dauer und Höhenmeter | Parkplatz-, Stempel- und Tourenansichten | Gratis, weil grundlegende Tourenbeurteilung nötig ist |
| Notizen und zwischengespeicherte Basisdaten | Notizkomponente und Offline-Synchronisierung vorhanden | Gratis, weil Zuverlässigkeit kein Aufpreis sein sollte |

Stempel exportieren und eigene Daten behalten ebenfalls kostenlos vorsehen; ein fertiger persönlicher Exportdialog wurde nicht nachgewiesen. Server-CSV-Export ist kein Beleg dafür.

## 3. Premiumauswahl aus App und Planung

| Kandidat | Tatsächlicher Stand | Vorschlag |
|---|---|---|
| Automatische Tourenvorschläge nach Zeitbudget, Strecke und Startort | Backendalgorithmus und ältere UI5-Oberfläche vorhanden. API-Helfer in aktueller App vorhanden, dort keine eingebundene Automatikoberfläche gefunden | **Premium zum Start**, weil sie manuelle Sucharbeit spart |
| Automatisch passende Touren für die gewählte Gruppe | Gruppenstatus wird berechnet; Routensuche zählt zunächst fehlende Stempel des aktuellen Nutzers | **Premium ausbauen**: Gruppenoptimierung ist noch kein fertiges Leistungsversprechen |
| Gemeinsames Bearbeiten fremder Touren und Kopie als eigene Tour | In älterer README unter MVP 2 geplant; aktueller Editor allein belegt keine gemeinsame Bearbeitung | **Optional später Premium**, falls Nachfrage besteht. Ansicht, Teilen und eigene Bearbeitung bleiben gratis |
| Mehrere Stempelbücher getrennt verwalten | In älterer README geplant; keine fertige Mehrbuchverwaltung nachgewiesen | **Optional später Premium**, weil Vielnutzer mehrere parallele Sammlungen haben können |
| Abzeichenfortschritt und Profilübersicht | In aktueller TODO offen; alte README nennt Fortschritt erledigt, App enthält einfache Kennzahlen | **Basis gratis**; automatische Touren zum nächsten Abzeichen später Premium, als neue Erweiterung |
| Detaillierte Routenansicht und andere Karten | Aktuelle TODO nennt beides offen | **Standarddetails gratis**; echte herunterladbare Offline-Wanderkarte eventuell später Premium. Download ist eine neue Idee, kein nachgewiesenes Roadmapfeature |
| KI-Tourenbeschreibungen | Ältere README nennt es optional | **Zurückstellen**, weil laufende Zusatzkosten bei 7,99 € schwer zu tragen sind |
| Defekte Stempelkästen, Sperrungen und Meldefunktion | Aktuelle TODO teilweise offen; allgemeine Notizen bereits vorhanden | **Gratis**, weil Datenqualität allen hilft |

**Startpaket:** Tourenautomatik; Gruppenoptimierung nach Umsetzung: „Finde passende Rundtouren für uns, maximal drei Stunden, mit möglichst vielen neuen Stempeln.“

### Freunde im Pass

Vorschlag für Pass und Jahresabo: Inhaber plus bis zu fünf eingeladene Freunde. Die Personenzahl ist noch nicht beschlossen. Freunde nehmen per Link nach Anmeldung und Zustimmung teil; bestehende Freundschaft allein gewährt keinen Zugriff auf private Stempeldaten.

Alle Mitglieder dürfen während der Laufzeit für diese Gruppe die Tourenautomatik verwenden und Ergebnisse speichern und teilen. Einladungen übertragen kein eigenständiges Premiumabo für beliebige andere Gruppen. Das unterscheidet den Gruppenpass vom ohnehin kostenlosen Freunde-Einladen und Touren-Teilen.

Die Freigabe endet mit Ablauf oder Austritt. Stempel, manuelle Planung und gespeicherte Touren bleiben kostenlos nutzbar. Rechte müssen serverseitig geprüft werden. Einladung, Annahme, Gruppenrechte und Ablauf sind Umsetzungsvorschläge, keine bereits vorhandene Passfunktion.

Drei kostenlose Automatik-Proben vorsehen. Zunächst keine verkaufswirksamen Berechnungslimits festlegen, weil die gemeldeten Kosten niedrig sind. Lastschutz technisch vorsehen und tatsächlichen Verbrauch je Gruppe messen; bei späteren Kontingenten gemeinsam zählen, nicht je Einladung vervielfachen.

Gruppenoptimierung ausbauen: „fehlt allen“ oder „fehlt mindestens einer Person“ auswählbar machen.

## 4. Wirtschaftlichkeit mit tatsächlicher Kostenbasis

**Compute: 5 €/Monat = 60 €/Jahr für den bestehenden Betrieb**, laut Gründer. Das ersetzt die erfundenen 100 €/Monat und pauschalen Pro-Nutzer-Kosten der ersten Rechnung. Zusätzliche API-, Support- und Skalierungskosten sind nicht bestätigt; geringe Verbrauchskosten bedeuten keine garantierten Nullkosten bei Wachstum.

Entwicklerzugänge, am 15.10.2026 geprüft: [Apple](https://developer.apple.com/help/account/membership/program-enrollment/) nennt 99 USD pro Jahr beziehungsweise lokale Preise; [Google Play](https://support.google.com/googleplay/android-developer/answer/6112435) 25 USD einmalig. Maßgeblich sind die tatsächlichen Euroabbuchungen. Keine USD/EUR-Gleichsetzung. Bereits bezahlte Google-Registrierung zählt nicht erneut als laufender Aufwand.

Rechenannahmen, keine bestätigten Konditionen: 19 % Umsatzsteuer und 15 % Vertriebsgebühr auf den Nettopreis. Erlös nach Abzügen = Bruttopreis ÷ 1,19 × 0,85. Effektive Storegebühren und steuerliche Behandlung nach Verkaufskanal ersetzen.

| Angebot | Erlös nach Modellabzügen | Beitrag vor zusätzlichen Verbrauchskosten |
|---|---:|---:|
| Basis | 0 € | Kein Verkaufserlös |
| Urlaubspass 2,99 € | 2,14 €/Kauf | 2,14 € minus gemessene Zusatzkosten je Passgruppe |
| Jahr 7,99 € | 5,71 €/Jahr | 5,71 € minus gemessene Zusatzkosten je Jahresgruppe |

Mit A = tatsächlicher Apple-Jahresbeitrag in Euro und G = tatsächlich neu anfallende Google-Einmalgebühr in Euro: laufende Fixkosten **60 € + A**, erstes Registrierungsjahr gegebenenfalls **60 € + A + G**. Jahresabos zur Kostendeckung = aufrunden((60 + A) ÷ (5,7071 − variable Jahresgruppenkosten)). Für Passverkäufe entsprechend durch (2,1357 − variable Passgruppenkosten) teilen.

**Budgetbeispiel, keine Anbieterpreise oder Währungsumrechnung:** Mit A = 100 €, G = 25 € und vor zusätzlichen Verbrauchskosten: 29 Jahresabos decken 160 € laufende Jahreskosten; 33 decken 185 € inklusive neuer Registrierung. Alternativ 75 beziehungsweise 87 Passverkäufe jährlich. Bei geschätzten 0,50 € zusätzlichen Kosten je Jahresgruppe wären es 31 beziehungsweise 36 Jahresabos. Entwicklung und Unternehmerlohn fehlen.

Bruttomarge ist ohne gemessene variable Kosten nicht bestätigt. Beispiel bei 0,50 €/Jahresgruppe: (5,7071 − 0,50) ÷ 5,7071 = 91,2 % nach Vertriebsgebühr, vor Fixkosten. Hosting als Fixkosten nicht zusätzlich pro Nutzer berechnen.

Ziel-ARPU zahlender Jahresabonnenten: 7,99 €/Jahr brutto beziehungsweise 0,67 €/Monat. Gruppenpass bedeutet: zahlende Inhaber und kostenlose Mitnutzer getrennt zählen. Die frühere Warnung auf Basis von 5,40 € erfundenen variablen Jahreskosten entfällt; 7,99 € ist bei dieser kleinen Infrastruktur plausibel testbar.

## 5. Wettbewerbsposition

Bereits in dieser Sitzung am 15.10.2026 geprüft:

- [Harzer Wandernadel Community](https://apps.apple.com/de/app/harzer-wandernadel-community/id1620616675): 5,99 € Apppreis plus optional 14,99 €/Jahr oder 2,99 €/Monat für Zusatzfunktionen. Buddy liegt jährlich darunter, weil ein günstiger Einstieg gewünscht ist.
- [komoot Maps](https://www.komoot.com/product): Regionenpaket 8,99 €, Weltpaket 29,99 € einmalig mit Offline-Karten und Navigation. Buddy kostet jährlich weniger, bietet aber einen anderen, regionalen Automatiknutzen.
- [Outdooractive](https://www.outdooractive.com/de/membership/plans.html): Pro 29,99 €/Jahr, Pro+ 59,99 €/Jahr als Anbieter-Richtwerte. Buddy liegt darunter, weil der Umfang enger ist.

## 6. Einführung und nächste Entscheidung

7,99 € als regulären Startpreis testen, ohne zusätzlichen Einführungsrabatt, weil der Preis bereits niedrig ist. Pass zunächst 2,99 €. Beide Vorschläge sind noch nicht beschlossen.

Nach 90 Tagen, frühestens nach 100 zahlenden Organisatoren, Kosten pro Käufer, Automatiknutzung, Pass-zu-Jahr-Wechsel und Supportzeit auswerten. Steigen Zusatzkosten über 2 € je Jahresgruppe, zuerst Cache und Algorithmus verbessern; Limits nur anhand gemessener Nutzung erwägen. Wenn nötig 9,99 € für Neukunden testen; Umsatz steigt bei vergleichbarem Traffic erst, wenn mindestens 80 % der bisherigen Kaufquote erhalten bleiben. Erstattungen und Nutzung mitbeobachten.

Bezahlte Laufzeiten erfüllen. Spätere Bestandsänderungen erst zur Verlängerung nach klarer Vorankündigung; keine lebenslange Preisgarantie versprechen.

## Codegrundlage und Umsetzung

Quellen: `app/xTODO.md`, `backend/hwb/README.md`; aktuelle Tourenansichten unter `app/app/tours/`; `group-selector.tsx`, `group-stamp-dialog.tsx`; Automatik in `hwb-service.js`, `routingManager.js`, API-Helfer in `app/lib/api.ts`; ältere Oberfläche: `HikingRouteDialog.fragment.xml`.

Billing, geteilte Passrechte und Bezahlschranken sind noch umzusetzen.

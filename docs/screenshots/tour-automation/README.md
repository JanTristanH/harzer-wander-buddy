# Tourenautomatik (B1)

Screenshots der implementierten Expo-Web-App, keine Design-Mockups. Der mobile
Viewport ist 390 × 844; die Desktopansicht ist 1100 × 900. Zusätzlich wurden
320 × 740, dunkles Erscheinungsbild und reduzierte Bewegung geprüft.

Der Browserlauf verwendet eine getrennte lokale CAP-/SQLite-Testumgebung mit
Testanmeldung und den echten mitgelieferten Stempel-, Parkplatz- und Wegedaten.
Die Karten zeigen OpenFreeMap mit korrekter Attribution. Der Lauf prüft keinen
Auth0-Login und ersetzt keinen nativen Gerätetest.

| Ansicht | Screenshot |
| --- | --- |
| Tourenliste mit Routenbildern und Funkel-Button über dem Plus | [01-tour-list.png](01-tour-list.png) |
| Zeitbudget und bewusst gewählter Standort | [02-time-budget.png](02-time-budget.png) |
| Bestehende Gruppe als Standard in Schritt 2 | [03-group-default.png](03-group-default.png) |
| Bewusster Wechsel zu „Nur ich“ | [04-solo.png](04-solo.png) |
| Einer von fünf Vorschlägen mit echter Karte | [05-proposals.png](05-proposals.png) |
| Gespeichert, weiter im Vorschlag; Bearbeiten erst auf weiteren Tipp | [06-detail-saved.png](06-detail-saved.png) |
| Alle Vorschläge weiterhin unter Buddy-Empfehlungen | [07-buddy-recommendations.png](07-buddy-recommendations.png) |
| Detailansicht auf Desktop | [08-desktop-detail.png](08-desktop-detail.png) |

Geprüfter Ablauf: Gruppe auswählen → Zeit und Standort → Gruppenstandard prüfen
→ Solo auswählen → fünf Vorschläge berechnen → ersten Vorschlag speichern, ohne
den Screen zu verlassen → zweiten Vorschlag in Details öffnen → die weiteren
vier Vorschläge einzeln speichern → explizit Bearbeiten öffnen → zur Liste
zurückkehren → fünf gespeicherte Touren und alle Buddy-Vorschläge sehen → Seite
neu laden und gespeicherten Vorschlag erneut öffnen. Eine ungültige
Vorschlags-Session zeigt einen Wiederherstellungsweg statt einer falschen Tour.

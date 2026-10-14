# Harzer Wander Buddy · Designsprache

Diese Datei beschreibt die mit dem geführten Onboarding eingeführte Designsprache. Sie dient als Referenz, um weitere Ansichten der App schrittweise daran auszurichten. Die Werte stammen aus `app/app/onboarding.tsx`; sie sind bisher lokal definiert und noch kein zentral implementiertes Design-System. Das bestehende `Colors`-Objekt in `app/constants/theme.ts` entspricht dieser Palette noch nicht.

## 1. Charakter und Leitlinien

Die App wirkt wie ein freundlicher Begleiter für draußen: warm, ruhig, naturverbunden und leicht verständlich. Cremefarbene Flächen, Waldgrün, weiche Rundungen und illustrative Waldtiere tragen diesen Charakter. Große Serifentitel geben den Einstiegsansichten Persönlichkeit; klare Systemschrift hält Formulare und Navigation gut lesbar.

- Eine Ansicht hat einen klaren Zweck und eine erkennbare Hauptaktion.
- Informationen erscheinen dort, wo sie für die nächste Entscheidung gebraucht werden.
- Große Abstände und wenige Elemente geben wichtigen Inhalten Raum.
- Optionale Aktionen sind ausdrücklich freiwillig und visuell nachgeordnet.
- Dekoration unterstützt Orientierung und Stimmung. Listen, Karten und Detaildaten erhalten den Platz, den ihre Aufgabe benötigt.
- Auswahl, Ladezustand und Fehler sind verständlich erkennbar. Farbe allein reicht als Rückmeldung nicht aus.

## 2. Farben

### Hintergründe und Oberflächen

| Rolle | Aktueller Wert | Verwendung |
| --- | --- | --- |
| Seitenhintergrund | `#F7F5EF` → `#F3EFE6` → `#F0EBE1` | Sehr sanfter vertikaler Verlauf, keine kräftigen Farbwechsel |
| Aktionsbereich unten | `#F3EFE6` | Ruhige Fläche hinter der Hauptaktion |
| Inhaltskarte | `#FFFFFFCC` | Weiß mit 80 % Deckkraft über dem warmen Hintergrund |
| Leichte Kachel | `#FFFFFF99` | Weiß mit 60 % Deckkraft für Vorteile und Avatar-Auswahl |
| Hervorgehobene Auswahl | `#E7EDDE` | Heller Salbeiton, zusammen mit grünem Rand und Häkchen |
| Eingabefeld | `#F4F6ED` | Leicht grün getönte Fläche innerhalb einer Karte |
| Sekundärbutton | `#E8DFCF` | Warmer Sandton für zusätzliche Aktionen |
| Illustrationsfläche | `#DFE7D4` | Salbeigrün hinter großen Funktions-Icons |
| Kleiner Illustrationsakzent | `#F6DFC4` | Dezentes Apricot, sparsam einsetzen |

### Text, Aktionen und Konturen

| Rolle | Aktueller Wert | Verwendung |
| --- | --- | --- |
| Große Titel / Eingabetext | `#21382B` | Dunkles Waldgrün |
| Icons / Navigation / aktive Labels | `#315B43` | Wiederkehrendes funktionales Grün |
| Primärbutton | `#397B52` | Einzige aktive Hauptaktion der Ansicht |
| Text auf Primärbutton | `#F5F3EE` | Warmes, fast weißes Creme |
| Text auf Sekundärbutton | `#374337` | Dunkler Text auf Sand |
| Fließtext | `#65715E` | Gedämpftes Grün für Erklärungen |
| Hilfstext | `#697361` bzw. `#6C7666` | Kurze Hinweise unter Komponenten |
| Eyebrow | `#68775D` | Kleine kontextgebende Überschrift |
| Aktiver Fortschritt / Auswahlrand | `#41664A` | Fortschrittssegmente, Auswahlrand, Häkchenfläche |
| Inaktiver Fortschritt | `#DCE1D4` | Sichtbar, aber deutlich zurückhaltend |
| Neutraler Auswahlrand | `#E1E4D8` | Ungewählte Kacheln |
| Eingaberand | `#CBD6BF` | Feine Abgrenzung des Eingabefelds |
| Fehler | `#8A2D1F` | Dunkles Rostrot plus konkrete Fehlermeldung |

Für neue Ansichten diese Rollen wiederverwenden, statt jeweils ähnliche neue Grüntöne einzuführen. Bei einer späteren Zentralisierung eignen sich Namen wie `background`, `surface`, `textStrong`, `textMuted`, `primary`, `secondary`, `selectedSurface`, `border` und `error`. Diese Namen sind eine Empfehlung und derzeit keine vorhandenen Exporte.

## 3. Typografie

Schriftfamilien über `Fonts` aus `app/constants/theme.ts` verwenden. `Fonts.serif` nutzt auf iOS `ui-serif`, im Web Georgia / Times New Roman und auf anderen Plattformen die verfügbare Serifenschrift. Funktionale Texte verwenden die Systemschrift; für explizite plattformübergreifende Vorgaben steht `Fonts.sans` bereit. Es wird keine zusätzliche Schriftdatei benötigt.

| Element | Größe / Zeilenhöhe | Gewicht / Ausrichtung |
| --- | --- | --- |
| Einstiegstitel | 32 / 39 | Serif, zentriert im Onboarding |
| Kompakter Titel | 28 / 34 | Serif, z. B. über der Avatar-Auswahl |
| Erklärung | 15 / 23 | Systemschrift, zentriert in Einstiegsansichten |
| Kartentitel | 16 / 20 | 700, linksbündig |
| Schrittnavigation | 14 | 600 |
| Buttonlabel | 13 / 18 | 500, zentriert |
| Eingabelabel | 13 | 600 |
| Eingabewert | 20 | Systemschrift |
| Hinweis | 13 / 20 | Regulär |
| Kleiner Hilfstext | 12 / 18 | Regulär |
| Eyebrow | 11 | 700, Großbuchstaben, Buchstabenabstand 2 |

Großbuchstaben auf kurze Kontextlabels beschränken. Serifenschrift für zentrale Überschriften verwenden, Systemschrift für Zahlen, Metadaten, Bedienelemente und längere Texte. Listen und Detailinformationen bleiben linksbündig. Die Zentrierung des Onboardings ist kein Vorbild für jede Datenansicht.

## 4. Layout, Abstände und Rundungen

Alle Größen sind React-Native-Layoutwerte, also logische Einheiten; im Web entsprechen sie CSS-Pixeln.

- Onboarding-Inhalt: maximal 560 breit und auf großen Ansichten horizontal zentriert.
- Hauptinhalt: 28 horizontaler Außenabstand, 20 oben und 24 unten.
- Vertikale Inhaltsabstände: überwiegend 16; eng zusammengehörige Elemente 4–8.
- Inhaltskarten: 20 Innenabstand, 16 Abstand zwischen ihren Elementen.
- Kachelraster: 12 Abstand; Avatar-Kacheln je 47 % breit für zwei Spalten.
- Navigation oben: 24 horizontaler Außenabstand, 44 × 44 Zurück-Aktion.
- Fortschritt: 4 hohe Segmente mit 6 Abstand; bereits erreichte Segmente sind grün.
- Aktionsbereich unten: 28 horizontal, 12 oben, 10 Abstand zum Hilfstext; unten mindestens 16 oder der größere Safe-Area-Inset.

| Komponente | Radius |
| --- | --- |
| Inhaltskarte / Auswahlkachel | 24 |
| Vorteilskachel | 20 |
| Eingabefeld | 16 |
| Standardbutton | 18 |
| Hauptbutton unten | 22 |
| Modal | 22 |
| Avatar / runder Icon-Button | Halbe Breite bzw. Höhe |

Der Onboarding-Standard ist eine ruhige Fläche ohne starken Schatten. Die Anmeldekarte verwendet noch einen weichen warmen Schatten (`#BDA981`, Y 10, Opazität 0,18, Radius 24). Neue Karten bevorzugt durch Fläche, Abstand und bei Bedarf eine feine Kontur gliedern. Schatten für tatsächliche Überlagerungen oder wenige hervorgehobene Elemente einsetzen.

## 5. Button-Hierarchie

**Pro Ansicht genau eine aktive Primäraktion.** Zwei grüne Buttons dürfen nicht um dieselbe Aufmerksamkeit konkurrieren. Der Primärbutton steht für den nächsten entscheidenden Schritt. Zusätzliche Aktionen erhalten den sandfarbenen Sekundärstil; reine Navigation bleibt eine dezente Icon-Aktion.

Im angemeldeten Onboarding liegt die Primäraktion durchgehend im unteren Aktionsbereich:

| Schritt | Primäraktion unten | Zusätzliche Aktion |
| --- | --- | --- |
| 1 · Willkommen | Los geht’s | — |
| 2 · Name | Weiter | — |
| 3 · Avatar | Weiter | Eigenes Foto hochladen · sekundär |
| 4 · Standort | Ohne Standort weiter / Weiter | Standort aktivieren / erneut anfragen · sekundär |
| 5 · Wanderbuddies | Zu den Stempelstellen | Wanderbuddies finden · sekundär |

Vor der Anmeldung ist „Anmelden“ die aktive Primäraktion; „Los geht’s“ ist gesperrt. Nach der Anmeldung entfällt die Anmeldekarte.

- Standardbutton: mindestens 52 hoch, 18 horizontaler Innenabstand, Radius 18.
- Hauptbutton unten: mindestens 58 hoch, volle Inhaltsbreite, Radius 22.
- Gedrückt: Opazität 0,88. Gesperrt: Opazität 0,48 und tatsächlich deaktivierte Interaktion.
- Während des Speicherns zeigt die Aktion „Wird gespeichert…“; Vorwärts- und Zurück-Navigation sind gesperrt.
- Labels benennen die Aktion oder ihren Ausgang: „Standort aktivieren“, „Zu den Stempelstellen“, „Ohne Standort weiter“.

Bei der Überarbeitung anderer Ansichten zuerst festlegen, welche Aktion primär ist. Sind zwei Aktionen fachlich gleichwertig, eine klare Entscheidung über die Hierarchie treffen, statt beide grün darzustellen. Gefährliche Aktionen bekommen einen passenden eigenen Stil und keine beiläufige Platzierung neben der Hauptaktion.

## 6. Komponenten und Zustände

### Eingaben

Ein sichtbares Label über dem Feld beschreibt die Eingabe. Platzhalter zeigen ein kurzes Beispiel und ersetzen das Label nicht. Ein knapper Hilfstext erklärt den erwarteten Umfang. Bei einer fehlenden Pflichtangabe bleibt die Weiter-Aktion deaktiviert. Bei Speicherfehlern bleiben Eingaben erhalten.

### Auswahlkacheln

Das gesamte Element ist antippbar. Ungewählt: helle Fläche, neutraler 2-Pixel-Rand und gedämpftes Label. Gewählt: Salbeifläche, grüner Rand, kräftiges Label und ein weißes Häkchen auf einer grünen Kreisfläche. Auswahl zusätzlich über den zugänglichen Zustand mitteilen.

Die Avatar-Auswahl bietet Bär, Fuchs, Luchs und „Kein Avatar“. Avatare sind 82 × 82, kreisförmig beschnitten. Die ausgewählte Vorschau ist im kompakten Screen 80 × 80; die größere Profilvorschau 142 × 142. „Kein Avatar“ ist eine reguläre Auswahl und entfernt ein vorhandenes Profilbild. Ein eigenes Foto bleibt als sekundäre Aktion verfügbar.

### Illustrationen und Icons

Feather-Icons bilden das funktionale Icon-System: meist 20–22 für Aktionen, 35–58 für größere erklärende Darstellungen. Funktionsillustrationen kombinieren einen großen runden Salbeibadge, eine feine elliptische Kontur und einen kleinen Apricotbadge. Nicht jede Karte braucht eine Illustration.

Die drei Tier-Avatare sind eigene Aquarellillustrationen: freundlicher Blick, warme Erdtöne, grünes Wandertuch und cremefarbener Hintergrund. Neue Motive sollen dieselbe ruhige Stimmung und auch in kleinen Größen erkennbare Silhouetten haben. Keine Schrift oder komplexe Landschaft innerhalb eines Avatars. Dateien und ursprünglicher Imagegen-Prompt: [Avatar-Referenz](app/assets/images/avatars/README.md).

### Overlays

Eine modale Suche liegt auf weißer Fläche mit Radius 22 über einem gedämpften grünen Backdrop (`rgba(46,58,46,0.35)`). Titel, erreichbare Schließen-Aktion, Suchfeld und verständliche Leer-/Lade-/Fehlerzustände bilden die Struktur. Beim Übertragen auf andere Ansichten die Höhe und Platzierung auf kleinen Displays und mit geöffneter Tastatur prüfen; den aktuellen festen oberen Modalabstand nicht als allgemeine Layoutregel übernehmen.

## 7. Geführte Abläufe und Sprache

Das Onboarding folgt „Kontext → Nutzen → Eingabe oder Entscheidung → nächste Aktion“. Eine kurze Willkommen-Ansicht erklärt das Ziel, danach bekommt jede Komponente ihren eigenen Screen. Fortschritt und Zurück-Navigation bleiben an derselben Position. Der Inhalt scrollt; die Hauptaktion sitzt außerhalb des Scrollbereichs, damit längere Inhalte sie nicht verdrängen. Kleine Displays und größere Schrift dürfen weiterhin scrollen.

Standortberechtigungen werden erst nach einer Erklärung und einer bewussten Aktion angefragt. Eine Ablehnung verhindert den Einstieg nicht. Optionalität erscheint sowohl im Kontextlabel als auch in der möglichen Weiter-Aktion. Der Abschluss erfolgt erst, nachdem erforderliche Änderungen gespeichert wurden.

Die Sprache ist direkt, freundlich und konkret: „du“, „dein“, „Wanderbuddy“. Vorteile erklären statt technische Abläufe. Kurze Titel, danach ein bis zwei Sätze. Echte Umlaute verwenden. Keine nicht vorhandenen Funktionen oder Berechtigungen ankündigen. Fehler nennen das Problem und einen erreichbaren nächsten Schritt.

## 8. Übertragung auf den Rest der App

Für jede überarbeitete Ansicht:

1. Zweck, wichtigste Information und Primäraktion festlegen.
2. Warmen Hintergrund, passende Inhaltsflächen und bestehende Farbrollen verwenden.
3. Serifentitel und funktionale Systemschrift entsprechend der Informationshierarchie einsetzen.
4. Inhalte mit den beschriebenen Abständen und Rundungen gruppieren. Datenreiche Ansichten nach ihrer Aufgabe gestalten; die maximale Onboarding-Breite ist keine Vorgabe für Karten oder breite Tabellen.
5. Zusätzliche Aktionen sekundär gestalten und gewählte Zustände neben Farbe auch durch Text oder Icon zeigen.
6. Lade-, Leer-, Fehler-, Offline- und gesperrte Zustände mitdenken. Entwürfe bei Fehlern erhalten.
7. Auf kleinen und großen Displays, mit Tastatur, größerer Schrift und Safe Areas prüfen. Keine horizontalen Überläufe oder abgeschnittenen Bedienelemente.
8. Zugängliche Labels, Rollen, Zustände und ausreichende Kontraste prüfen. Die dokumentierten Farben ersetzen keine Kontrastprüfung der konkreten Kombination.
9. Screenshots der tatsächlichen Ansicht aufnehmen und im PR einbinden.

Langfristig können gemeinsame Farben, Abstände, Typografiestile und Buttonvarianten aus den lokal definierten Styles extrahiert werden. Diese Datei beschreibt die visuelle Richtung; eine technische Migration des gesamten Themes ist ein eigener Schritt. Für Dark Mode sind bisher keine entsprechenden neuen Tokens definiert.

## 9. Referenzen

- Umsetzung: [Onboarding](app/app/onboarding.tsx), [Schriftfamilien](app/constants/theme.ts).
- Visuelle Referenz: [Screenshots der fünf Schritte](docs/screenshots/guided-onboarding/README.md).
- [Duolingo-Ablauf](https://uidiscovery.com/studies/duolingo-onboarding): Erwartungen erklären, kurze Entscheidungen, sichtbarer Fortschritt.
- [Headspace-Fallstudie](https://growth.design/case-studies/headspace-user-onboarding/): freundliche Illustrationen und positive, am Nutzen orientierte Ansprache.

Die recherchierten Beispiele dienen als Muster für den Ablauf. Layout, Texte und Avatare sind für Harzer Wander Buddy gestaltet.

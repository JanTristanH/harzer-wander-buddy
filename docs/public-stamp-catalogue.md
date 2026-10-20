# Öffentliche statische Stempelstellen-Übersicht

Die Jekyll-Website `JanTristanH/harzer-wander-buddy-website` verwendet für
`/preview/overview` einen versionierten Export der CAP-Demodaten. Es ist kein
CAP-Server, Login oder Produktionszugang beim Website-Build erforderlich.

```sh
python3 scripts/export-public-stamps.py --as-of 2026-10-20 --output /tmp/guest_stamps.json
python3 -m unittest discover -s scripts/tests -v
```

Der Export enthält ausschließlich ID, Nummer, Name, Beschreibung, Koordinaten
und Gültigkeit. Bilder und ihre Lizenzhinweise sowie die kanonischen Detail-URLs
kommen aus den vorhandenen Jekyll-Beiträgen. Nutzer, Besuche, Gruppen, Touren und
berechnete Nutzerzustände werden nicht exportiert.

Das Datum ist explizit, damit ein Build reproduzierbar bleibt. Es wird pro Nummer
der zu diesem UTC-Zeitpunkt gültige Datensatz gewählt (`validFrom <= Datum <
validTo`). Fehlende oder doppelte aktive Nummern und unplausible Koordinaten
brechen den Export ab. Der aktuelle Vertrag umfasst genau die regulären HWN
1–222; Sonderstempel benötigen eine bewusste Erweiterung.

Im Website-Repository werden Quell-Commit, Stichtag und CSV-Prüfsumme festgehalten.
Bei Datenaktualisierungen den Export dort erneuern und im PR prüfen. Änderungen
am Schema benötigen koordinierte Anpassungen im Website-Repository. Die
Website bestimmt ihre Artikel-URLs selbst; niemals aus CAP-Namen neue Slugs
ableiten. Insbesondere verlegte Standorte vor einer produktiven Umschaltung
mit dem redaktionellen Stand abgleichen.

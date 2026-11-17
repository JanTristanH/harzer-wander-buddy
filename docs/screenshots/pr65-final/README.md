# PR #65: abschließende UI-Nachweise

Aufnahmen vom 17. November 2026 mit lokalen Testdaten, ohne Produktionsänderungen.

- `profile.png`: Profil mit sekundärer Outline-Aktion „Profil bearbeiten“ (Web).
- `badge-details.png`: Abzeichendetails mit Platz für die überstehende Krone (Web).
- `reward-preview.png`: Belohnungsvorschau mit proportionalem Kronenabstand (Web).
- `next-goal-details-ios.png`: Nach Antippen der Karte „Dein nächstes Ziel“ öffnet sich das passende Kaiserrucksack-Detail (iPhone 18 Pro, iOS 27.2).

Die iOS-Prüfung verwendete einen erneuerten JavaScript-/Asset-Bundle im vorhandenen nativen Testbuild. Die Abbildungen belegen die genannten Ansichten und ersetzen keine vollständige native Gestenprüfung. Der Freundedialog reserviert den oberen Sicherheitsabstand unabhängig von der Tastatur und fokussiert das Eingabefeld erst nach dem Öffnen; der ursprünglich einmalige Positionsfehler wurde nicht zuverlässig erneut reproduziert.

# Gayret

Persönlicher Fitness-Tracker als Web-App, gebaut wie die Gebetszeiten-App: reine Webseite ohne Server, läuft auf dem Handy wie eine App und auch ohne Internet.

## Was die App kann

- Training starten für Oberkörper oder Unterkörper, dazu Core und Ausdauer als freiwilliger Zusatz. Core zählt nie als fehlend und fließt nicht in Wochenziel oder Serie ein.
- Die App schlägt im Wechsel die Variante vor, die länger nicht dran war (Langhantel oder Hack-Squat, Klimmzüge oder Chin-Ups, Schrägbank oder Fliegende).
- Pro Satz siehst du den Wert vom letzten Mal, die Felder sind damit vorbefüllt. Nach jedem abgehakten Satz läuft ein Pausentimer.
- Klimmzüge, Chin-Ups und Dips: im Gewichtsfeld steht "Körpergewicht", für Zusatz tippst du nur die Zahl (+5, +10 oder eine eigene).
- Körpergewicht tracken mit Kurve (Einzelwerte und Trend). Für Klimmzüge und Dips wird in der Auswertung Körpergewicht plus Zusatz gerechnet, jeweils mit dem Eintrag, der dem Trainingstag am nächsten liegt.
- Kalender mit farbigen Trainingstagen, Fortschrittskurve pro Übung, "Zuletzt trainiert" pro Muskelgruppe.
- Übungen selbst anlegen, ändern, ausblenden. Ohne Rückfrage bei Claude.
- Sicherung als Datei speichern und wieder einspielen.

## Auf GitHub Pages veröffentlichen

1. Neues Repository anlegen, zum Beispiel `Gayret`, und alle Dateien dieses Ordners hochladen (ohne `node_modules`).
2. Im Repository: Settings, Pages, Source: "Deploy from a branch", Branch `main`, Ordner `/ (root)`, speichern.
3. Nach ein bis zwei Minuten läuft die App unter `https://<dein-benutzername>.github.io/Gayret/`.
4. Auf dem Handy öffnen und zum Home-Bildschirm hinzufügen (iPhone: Teilen, "Zum Home-Bildschirm". Android: Menü, "App installieren").

Alle Pfade sind relativ, die App läuft deshalb auch in einem Unterordner.

## Deine Daten

Alles bleibt im Browser des Geräts (localStorage), nichts wird an einen Server geschickt. Es werden auch keine Schriften oder Skripte von fremden Servern geladen.

Wichtig: Löschst du die Browserdaten oder wechselst das Handy, sind die Daten weg. Darum unter Einstellungen regelmäßig eine Sicherung speichern. Auf dem iPhone kann Safari Daten von Seiten löschen, die lange nicht geöffnet wurden, mit einer Sicherung bist du auf der sicheren Seite.

Handy und Laptop haben getrennte Daten. Mit Sicherung und Einspielen lassen sie sich übertragen.

## Änderungen an der App

Nach jeder Änderung an Dateien in `sw.js` die Zeile `VERSION` erhöhen (zum Beispiel `gayret-v2`), sonst zeigt das Handy noch die alte Fassung aus dem Zwischenspeicher.

## Tests

Rechenlogik und Bedienung sind getestet (Wechsel der Varianten, Körpergewicht plus Zusatz, Wochenserie, Import prüfen, kompletter Ablauf durch die Oberfläche).

```
npm install
npm test
```

## Aufbau

- `index.html`, `style.css`: Hülle und Gestaltung
- `logic.js`: Daten und Berechnungen, ohne Oberfläche
- `app.js`: Bildschirme und Bedienung
- `sw.js`, `manifest.webmanifest`, Symbole: Installation und Offline-Betrieb
- `tests/`: automatische Tests

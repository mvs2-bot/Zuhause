# 🏡 Zuhause

Eigenes Smart-Home-Dashboard als PWA für Home Assistant auf dem Raspberry Pi 4. Apple-Designsprache, Akzent Bernstein.

**App:** https://mvs2-bot.github.io/Zuhause/

## Was die App kann

- **Design:** Apple-Designsprache (Systemschrift SF Pro bzw. Roboto, kleine bis mittlere Schriftgrößen, gruppierte Karten, Linien-Symbole statt Emojis), hell/dunkel automatisch oder fest in den Einstellungen.
- **Navigation:** Navigation Rail am rechten Rand mit Übersicht, Räume, Licht, Klima, Heizung, Medien, Energie, Kameras, Sauger, Abläufe (Automationen) und Einstellungen. Jede Seite hat einen eigenen Verlaufseintrag, die Zurück-Taste des Handys geht also eine Seite zurück.
- **Übersicht:** Bewohnerstatus (person.*), Lage-Banner, drei Kästen mit Symbol (Licht, Klima, Fenster), **interaktiver Grundriss** der Wohnung (Lampen, Fenster, Türen live; Lampe tippen schaltet, lange drücken öffnet Helligkeit/Farbe, Raum tippen öffnet den Raum), Wetter, Hinweise. Feuchte-Hinweise nutzen dieselben Grenzwerte wie die Automation „Lüften“ (`input_number.luftfeuchte_grenze_<raum>`).
- **Licht:** alle Lampen nach Raum, Lieblingsszenen (früher auf der Startseite).
- **Klima:** alle Räume mit Temperatur und Feuchte, Verläufe aufklappbar.
- **Heizung:** Thermostate (climate.*) und Vorlagen der Fritzbox.
- **Multimedia:** Musik über die Echos, Durchsage, Lautstärke aller Echos.
- **Energieverbrauch:** jede Steckdose mit Strommessung (z. B. FRITZ!DECT 200 „Rechner“): Leistung jetzt, Verbrauch heute, Verbrauch je Stunde/Tag und Leistungsverlauf.
- **Kameras:** Blink scharf/unscharf, letztes Bild, „Neues Bild“; die Steckdose einer Kamera (Schalter im selben Raum mit „Kamera“ im Namen) sitzt direkt an der Kamera.
- **Abläufe:** alle Automationen mit Ein/Aus, Skripte, Helfer. Gruppe = Präfix vor dem Doppelpunkt im Namen („Lüften: …“).
- **Saugroboter, Räume:** wie bisher.
- **Einstellungen:** Erscheinungsbild, Übersicht anordnen, Räume sortieren, **Speedtest** (Integration „Speedtest.net“, „Jetzt messen“), Pi, Fritzbox, HA, Dienste, Zigbee, Verbindung.

Der Grundriss ist in `app.js` (`PLAN`) in den Koordinaten des Original-Plans hinterlegt. Lampen landen nach Namen sortiert auf den eingezeichneten Plätzen ihres Raums; einzelne Lampen lassen sich über `PLAN_LAMP` fest platzieren.

Nichts ist fest verdrahtet: Räume, Lampen, Sensoren und Kameras kommen aus den HA-Registern (Bereiche, Geräte, Entitäten). Neue Geräte erscheinen von selbst im richtigen Raum, sobald sie in HA einem Bereich zugeordnet sind. Versteckte Entitäten (in HA ausgeblendet) und Diagnose-Entitäten werden ignoriert.

## Verbindung und Sicherheit

- Die App spricht direkt mit der Home-Assistant-WebSocket-API unter `https://homeassistant.taildd4a66.ts.net` (Tailscale serve). Erreichbar nur, wenn auf dem Gerät Tailscale läuft.
- Login per **langlebigem Zugriffstoken** (HA → Profil → Sicherheit). Das Token wird **nur im localStorage des Geräts** gespeichert, nie im Repo und nie an einen anderen Server geschickt.
- Keine CORS-Einstellung in HA nötig: WebSocket und Kamerabilder (`entity_picture` mit Kamera-Token) laufen ohne CORS.
- Token verloren oder Gerät weg: in HA unter Profil → Sicherheit das Token löschen.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Oberfläche und Styles |
| `app.js` | Verbindung zu HA, Datenmodell, Rendern |
| `sw.js` | Service Worker (App-Dateien offline, HA-Daten nie gecacht) |
| `manifest.json`, `icon.svg`, `icons/` | PWA |
| `shared/ios-nav.js` | Zurück/Neu-laden-Leiste für iOS (Kopie aus mvs2-bot.github.io) |

Bei Änderungen an App-Dateien die Cache-Version in `sw.js` (`V=P+"vN"`) und die Version `app.js?v=N` in `index.html` und `sw.js` hochzählen.

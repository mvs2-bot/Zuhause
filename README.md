# 🏡 Zuhause

Eigenes Smart-Home-Dashboard als PWA für Home Assistant auf dem Raspberry Pi 4. Gleiche Designsprache wie die anderen mvs2-bot-Apps, Akzent Bernstein.

**App:** https://mvs2-bot.github.io/Zuhause/

## Was die App kann

- **Übersicht:** kompaktes Lage-Banner, Kacheln (Lichter, offene Fenster/Türen, Ø Temperatur und Feuchte), Wetter (HA-Wetter-Eintrag, 5-Tage-Vorhersage), Heizung, einklappbare Hinweise, Szenen in eigener Reihenfolge („Alles aus“ hervorgehoben), Lichter nach Raum gruppiert. Tippen schaltet, lange drücken öffnet Helligkeit, Farbtemperatur und Farbe.
- **Räume:** Raum-Kacheln oben, darunter der gewählte Raum mit Klima-Verlauf (24 h / 7 Tage / 30 Tage, mit Min/Max-Band und Tooltip), Thermostaten, Kontakten, Bewegung, Tastern, Szenen und Lampen. Raum-Reihenfolge einstellbar.
- **Kameras:** Blink scharf/unscharf, letztes Bild je Kamera, „Neues Bild“ (`blink.trigger_camera`).
- **System (⚙️ oben oder Pi-Zeile unten):** Pi-Werte und -Verlauf (System Monitor), Fritzbox (AVM FRITZ!Box Tools), HA-Kennzahlen, Integrationen, Zigbee-Geräte, Verbindung.
- **Durchsage an die Echos:** erscheint automatisch, sobald Alexa Media Player eingerichtet ist.
- Live-Updates per Abo, „verbunden“ pulsiert bei jeder Änderung. Persönliche Einstellungen (Szenen, Raum-Reihenfolge, Zeitraum) liegen nur im localStorage des Geräts.

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

Bei Änderungen an App-Dateien die Cache-Version in `sw.js` (`V=P+"vN"`) hochzählen.

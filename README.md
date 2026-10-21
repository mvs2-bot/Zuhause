# 🏡 Zuhause

Eigenes Smart-Home-Dashboard als PWA für Home Assistant auf dem Raspberry Pi 4. Gleiche Designsprache wie die anderen mvs2-bot-Apps, Akzent Bernstein.

**App:** https://mvs2-bot.github.io/Zuhause/

## Was die App kann

- **Übersicht:** Lage-Banner (Türen/Fenster, Bewegung), Lichter an, Ø Temperatur und Feuchte, Hinweise (Lüften, Batterie, Geräte offline, Updates, Backup), Lieblingsszenen, alle Lampen. Tippen schaltet, lange drücken öffnet Helligkeit, Farbtemperatur und Farbe.
- **Räume:** je HA-Bereich Klima mit 12-h-Verlauf, Tür-/Fensterkontakte, Bewegungsmelder, Taster (letzter Druck), Kameras, Hue-Szenen und Lampen.
- **Kameras:** Blink scharf/unscharf, letztes Bild je Kamera, „Neues Bild“ (`blink.trigger_camera`).
- **System:** HA-Version, Pi-Werte (wenn „System Monitor“ eingerichtet ist), alle Integrationen mit Status, Zigbee-Geräte mit Batterie und Funkqualität, Verbindung.
- **Durchsage an die Echos:** erscheint automatisch, sobald Alexa Media Player eingerichtet ist.

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

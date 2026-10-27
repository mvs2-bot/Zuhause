/* Zuhause – Dashboard für Home Assistant
   Spricht direkt mit der HA-WebSocket-API (über Tailscale serve). Räume, Lampen, Sensoren und Kameras werden
   aus den HA-Registern gelesen, nicht fest eingetragen: neue Geräte erscheinen automatisch im richtigen Raum.
   Adresse und Token liegen nur im localStorage dieses Geräts ('zuhause-ha'), nie im Repo. */
(function () {
  'use strict';

  var DEFAULT_URL = 'https://homeassistant.taildd4a66.ts.net';
  var LS_CONN = 'zuhause-ha', LS_FAV = 'zuhause-fav-scenes', LS_SCENES = 'zuhause-scenes', LS_ROOMS = 'zuhause-room-order',
    LS_ROOM = 'zuhause-room', LS_NOTES = 'zuhause-notes-open', LS_RANGE = 'zuhause-range-', LS_FOLD = 'zuhause-fold', LS_SPEAKER = 'zuhause-speaker', LS_SPDEV = 'zuhause-spotify-device', LS_BOARD = 'zuhause-board', LS_RAIL = 'zuhause-rail-order';

  // Reihenfolge und Symbole der Räume (HA-Bereichsnamen); unbekannte Bereiche kommen alphabetisch dahinter
  var ROOM_ORDER = ['wohnzimmer', 'küche', 'schlafzimmer', 'büro', 'badezimmer', 'flur', 'toilette', 'keller'];
  var ROOM_ICON = { 'wohnzimmer': 'sofa', 'küche': 'pot', 'schlafzimmer': 'bed', 'büro': 'desk', 'badezimmer': 'bath', 'bad': 'bath', 'flur': 'door', 'toilette': 'wc', 'keller': 'box' };
  // Symbole: eine Linienfamilie (24er-Raster, 1,8er Strich), statt Emojis
  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
    rooms: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 12h9M12 3v18M12 15h9"/>',
    plan: '<path d="M3 4h18v16H3z"/><path d="M11 4v7H3M11 15v5M15 11h6M11 11h1"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
    thermo: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/><path d="M12 10v7"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    window: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M4 12h16"/>',
    door: '<path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21"/><path d="M3 21h18"/><path d="M14.5 12v.01"/>',
    flame: '<path d="M12 21a6 6 0 0 0 6-6c0-3.6-2.6-5.6-3.6-8.6-.5 2-1.6 3-2.6 3.5C11.9 7 11 5 9 3c.3 3.2-3 5.5-3 10a6 6 0 0 0 6 8z"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
    camera: '<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.8l1.5-2h6.4l1.5 2h1.8A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.5"/>',
    cart: '<path d="M3 4h2.5l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L21 8H6.3"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
    vacuum: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3"/>',
    auto: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    plug: '<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0z"/><path d="M12 17v5"/>',
    megaphone: '<path d="M3 10v4h4l7 5V5l-7 5z"/><path d="M17.5 9a4 4 0 0 1 0 6"/>',
    speaker: '<rect x="6" y="3" width="12" height="18" rx="3"/><circle cx="12" cy="14" r="3"/><path d="M12 7v.01"/>',
    send: '<path d="M4 12 20 4l-6 16-3-7z"/><path d="m11 13 9-9"/>',
    walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="M9 21l2.2-6.5L14 17v4M8 12l2.5-3.5 3.5.8 2 3.2h3M11.2 14.5 10.5 8.6"/>',
    remote: '<rect x="7" y="2" width="10" height="20" rx="3"/><path d="M12 6v3M12 14v.01M12 17.5v.01"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    power: '<path d="M12 3v9"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
    prev: '<path d="M18 5v14L8 12zM6 5v14"/>', next: '<path d="M6 5v14l10-7zM18 5v14"/>',
    gauge: '<path d="M12 14l4-4"/><path d="M3.5 18a10 10 0 1 1 17 0"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2z"/><path d="M4 20a2 2 0 0 0 2 2h14v-4"/>',
    sunset: '<path d="M17 18a5 5 0 0 0-10 0M12 9V2M4.2 10.2l1.4 1.4M2 18h2M20 18h2M18.4 11.6l1.4-1.4M22 22H2M16 5l-4 4-4-4"/>',
    sofa: '<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v4H2z"/><path d="M5 17v2M19 17v2"/>',
    pot: '<path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M2 10h20M9.5 6.5c0-1 1-1 1-2.5M13.5 6.5c0-1 1-1 1-2.5"/>',
    bed: '<path d="M3 19V6M3 14h18v5M21 14v-1a3 3 0 0 0-3-3h-8v4"/><circle cx="6.5" cy="11" r="1.5"/>',
    desk: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    bath: '<path d="M3 12h18v2a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6z"/><path d="M6 12V5.5a2.5 2.5 0 0 1 4.6-1.3M7 20l-1 2M17 20l1 2"/>',
    wc: '<path d="M7 3h6v8H7z"/><path d="M5 11h14a6 6 0 0 1-6 6h-1l1 4H8l1-4.2A6 6 0 0 1 5 11z"/>',
    box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
    wifi: '<path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19v.01"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12 5 5 9-10"/>'
  };
  function ic(n, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || ICONS.sparkle) + '</svg>'; }
  var SVC_ICON = { homeassistant: '🏠', hue: '💡', zha: '📡', blink: '📷', alexa_media: '🔵', google_drive: '☁️', backup: '💾', tailscale: '🔐',
    adguard: '🛡️', matter: '🧩', thread: '🧵', systemmonitor: '📊', met: '🌦️', sun: '☀️', shopping_list: '🛒', radio_browser: '📻', mobile_app: '📱',
    google_translate: '🗣️', hassio: '🧰', go2rtc: '🎥', backup_google_drive: '☁️' };
  var WEATHER = { 'clear-night': ['🌙', 'Klar'], cloudy: ['☁️', 'Bewölkt'], fog: ['🌫️', 'Nebel'], hail: ['🌨️', 'Hagel'], lightning: ['🌩️', 'Gewitter'],
    'lightning-rainy': ['⛈️', 'Gewitter mit Regen'], partlycloudy: ['⛅', 'Teils bewölkt'], pouring: ['🌧️', 'Starkregen'], rainy: ['🌦️', 'Regen'],
    snowy: ['❄️', 'Schnee'], 'snowy-rainy': ['🌨️', 'Schneeregen'], sunny: ['☀️', 'Sonnig'], windy: ['💨', 'Windig'], 'windy-variant': ['💨', 'Windig, bewölkt'], exceptional: ['⚠️', 'Unwetter'] };
  var VAC = { cleaning: 'Saugt', docked: 'In der Station', returning: 'Fährt zur Station', paused: 'Pausiert', idle: 'Bereit', error: 'Fehler' };
  var HVAC = { off: 'Aus', heat: 'Heizen', auto: 'Auto', heat_cool: 'Auto', cool: 'Kühlen', dry: 'Trocknen', fan_only: 'Lüfter' };
  // Zeiträume für Verläufe: Langzeitstatistik von HA (5-Minuten-, Stunden-, Tageswerte)
  var RANGES = { '24h': { label: '24 h', ms: 864e5, period: '5minute' }, '7d': { label: '7 Tage', ms: 7 * 864e5, period: 'hour' }, '30d': { label: '30 Tage', ms: 30 * 864e5, period: 'day' } };
  var SVC_HIDE = { sun: 1, radio_browser: 1, google_translate: 1, shopping_list: 1, go2rtc: 1 };
  var COLORS = ['#ffb35c', '#ffd27a', '#fff4e0', '#ff5a4f', '#ff9a3c', '#ffe14d', '#4fd96b', '#47b5ff', '#7a6bff', '#d65cff', '#ff6fb5'];

  // ---------- kleine Helfer ----------
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt1 = function (n) { return (Math.round(n * 10) / 10).toFixed(1).replace('.', ','); };
  var num = function (s) { var n = parseFloat(s && s.state != null ? s.state : s); return isFinite(n) ? n : null; };
  var lsGet = function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  var unavailable = function (s) { return !s || s.state === 'unavailable' || s.state === 'unknown'; };

  function timeText(iso) {
    var d = new Date(iso), now = new Date();
    if (isNaN(d)) return '';
    var hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return hm;
    var y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'gestern ' + hm;
    return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' }) + ' ' + hm;
  }
  function ago(iso) {
    var m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return 'gerade eben';
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' h ' + (m % 60) + ' min';
    return Math.floor(h / 24) + ' Tg.';
  }

  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, 3000);
  }

  // ---------- Theme wie auf den anderen Seiten ----------
  function themeColor() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark'
      || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name="theme-color"]').content = dark ? '#000000' : '#f2f2f7';
    var cur = document.documentElement.getAttribute('data-theme') || 'auto';
    document.querySelectorAll('[data-theme-v]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.themeV === cur); });
  }
  // Erscheinungsbild in den Einstellungen: Automatisch (folgt dem Gerät), Hell, Dunkel; Schlüssel wie auf Stefans anderen Seiten
  $('themeSeg').addEventListener('click', function (e) {
    var b = e.target.closest('[data-theme-v]'); if (!b) return;
    var v = b.dataset.themeV;
    if (v === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v);
    try { if (v === 'auto') localStorage.removeItem('overall-theme'); else localStorage.setItem('overall-theme', v); } catch (x) {}
    themeColor();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeColor);
  themeColor();
  document.querySelectorAll('[data-ic]').forEach(function (el) { el.insertAdjacentHTML('afterbegin', ic(el.dataset.ic)); });

  // ---------- Verbindung (HA-WebSocket-API) ----------
  var ws = null, msgId = 0, pending = {}, subs = {}, retry = 0, retryTimer = null, connState = 'off', lastError = '';

  function setConn(state, text) {
    connState = state;
    var c = $('conn'), p = $('connPill');
    c.className = 'conn' + (state === 'ok' ? ' ok' : state === 'bad' ? ' bad' : '');
    c.textContent = text;
    p.className = 'pill ' + (state === 'ok' ? 'ok' : state === 'bad' ? 'open' : 'warn');
    p.textContent = state === 'ok' ? 'verbunden' : text;
    document.querySelectorAll('.conn-form [data-logout]').forEach(function (b) { b.hidden = !lsGet(LS_CONN); });
  }

  function send(msg) {
    return new Promise(function (resolve, reject) {
      if (!ws || ws.readyState !== 1 || !ws.authed) return reject(new Error('Keine Verbindung zu Home Assistant'));
      msg.id = ++msgId;
      pending[msg.id] = { resolve: resolve, reject: reject };
      ws.send(JSON.stringify(msg));
    });
  }
  function subscribe(eventType, cb) {
    // Callback vor dem Senden unter der eigenen ID ablegen: Events können direkt nach der Anmeldung kommen,
    // und mehrere Abos laufen gleichzeitig, msgId ist beim Antworten also schon weitergezählt
    subs[msgId + 1] = cb;
    return send({ type: 'subscribe_events', event_type: eventType });
  }

  // Herzschlag: Handys legen WebSockets im Hintergrund oft still schlafen, ohne sie zu schließen.
  // Kommt auf ein Ping keine Antwort, wird neu verbunden; nach dem Aufwachen wird der Stand neu geladen.
  function ping() {
    if (!ws || !ws.authed) return Promise.resolve(false);
    var sock = ws;
    return Promise.race([send({ type: 'ping' }), new Promise(function (_, j) { setTimeout(j, 5000); })])
      .then(function () { return true; }, function () {
        if (ws !== sock) return false;
        ws = null; try { sock.close(); } catch (e) {}
        setConn('bad', 'offline'); retry = 0; connect();
        return false;
      });
  }
  setInterval(function () { if (document.visibilityState === 'visible') ping(); }, 30000);
  function callService(domain, service, data, target) {
    return send({ type: 'call_service', domain: domain, service: service, service_data: data || {}, target: target })
      .catch(function (e) { toast('Hat nicht geklappt: ' + (e.message || e)); throw e; });
  }

  function connect() {
    clearTimeout(retryTimer);
    var conf = lsGet(LS_CONN);
    if (!conf || !conf.url || !conf.token) { setConn('off', 'nicht verbunden'); showWelcome(true); return; }
    if (ws && ws.readyState <= 1) return;
    setConn('wait', 'verbinde …');
    var url = conf.url.replace(/\/+$/, '').replace(/^http/, 'ws') + '/api/websocket';
    var sock;
    try { sock = new WebSocket(url); } catch (e) { lastError = 'Adresse ungültig'; formError(lastError); setConn('bad', 'Adresse ungültig'); return; }
    ws = sock; pending = {}; subs = {};
    sock.onmessage = function (ev) {
      var m = JSON.parse(ev.data);
      if (m.type === 'auth_required') { sock.send(JSON.stringify({ type: 'auth', access_token: conf.token })); return; }
      if (m.type === 'auth_invalid') {
        lastError = 'Token ungültig. Bitte neues Token in HA anlegen und hier einfügen.';
        sock.authFailed = true; formError(lastError); setConn('bad', 'Token ungültig'); showWelcome(true); sock.close(); return;
      }
      if (m.type === 'auth_ok') { sock.authed = true; retry = 0; formError(''); onConnected(m.ha_version); return; }
      if (m.type === 'pong' && pending[m.id]) { pending[m.id].resolve(); delete pending[m.id]; return; }
      if (m.type === 'result' && pending[m.id]) {
        var p = pending[m.id]; delete pending[m.id];
        if (m.success) p.resolve(m.result); else p.reject(new Error((m.error && m.error.message) || 'Fehler'));
        return;
      }
      if (m.type === 'event' && subs[m.id]) subs[m.id](m.event);
    };
    sock.onclose = function () {
      if (ws !== sock) return;
      Object.keys(pending).forEach(function (k) { pending[k].reject(new Error('Verbindung getrennt')); });
      pending = {};
      if (sock.authFailed) return;
      if (!sock.authed && retry === 0) {
        lastError = 'Home Assistant nicht erreichbar. Ist Tailscale auf diesem Gerät an und die Adresse richtig?';
        formError(lastError);
      }
      setConn('bad', 'offline');
      var wait = Math.min(30, Math.pow(2, retry++)) * 1000;
      retryTimer = setTimeout(connect, wait);
    };
  }

  // Beim Zurückholen der App sofort neu verbinden statt auf den Timer zu warten
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || !lsGet(LS_CONN)) return;
    if (!ws || ws.readyState > 1) { retry = 0; connect(); return; }
    ping().then(function (alive) { if (alive) refreshStates(); });
  });
  window.addEventListener('online', function () { if (!ws || ws.readyState > 1) { retry = 0; connect(); } });

  // ---------- Daten aus Home Assistant ----------
  var S = {}, areas = {}, devices = {}, ents = {}, entries = [], haVersion = '', tempHist = {}, renderQueued = false;

  function onConnected(version) {
    haVersion = version || '';
    setConn('ok', 'verbunden');
    showWelcome(false);
    loadAll().then(function () {
      subscribe('state_changed', function (e) {
        if (e.data.new_state) S[e.data.entity_id] = e.data.new_state; else delete S[e.data.entity_id];
        if (/^(light|binary_sensor|climate|alarm_control_panel|switch|media_player|cover|lock)\./.test(e.data.entity_id)) pulse();
        queueRender();
      });
      ['area_registry_updated', 'device_registry_updated', 'entity_registry_updated'].forEach(function (t) {
        subscribe(t, function () { clearTimeout(loadAll.t); loadAll.t = setTimeout(loadRegistries, 1500); });
      });
      loadHistory();
      subscribeWeather();
    }).catch(function (e) { toast('Laden fehlgeschlagen: ' + e.message); });
  }

  function pulse() {
    var c = $('conn'); c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse');
  }

  // Wettervorhersage (täglich) vom Wetter-Eintrag in HA, kommt per Abo und aktualisiert sich selbst
  var forecast = [], weatherSubbed = null;
  function subscribeWeather() {
    var w = Object.keys(S).filter(function (id) { return id.indexOf('weather.') === 0; })[0];
    if (!w || weatherSubbed === ws) return;
    weatherSubbed = ws;
    subs[msgId + 1] = function (ev) { forecast = ev.forecast || []; queueRender(); };
    send({ type: 'weather/subscribe_forecast', forecast_type: 'daily', entity_id: w }).catch(function () { weatherSubbed = null; });
  }

  function refreshStates() {
    return send({ type: 'get_states' }).then(function (list) {
      S = {}; list.forEach(function (s) { S[s.entity_id] = s; });
      queueRender();
    }).catch(function () {});
  }

  function loadAll() {
    return Promise.all([send({ type: 'get_states' }), loadRegistries(true)]).then(function (r) {
      S = {}; r[0].forEach(function (s) { S[s.entity_id] = s; });
      render();
    });
  }

  function loadRegistries(silent) {
    return Promise.all([
      send({ type: 'config/area_registry/list' }),
      send({ type: 'config/device_registry/list' }),
      send({ type: 'config/entity_registry/list_for_display' }).catch(function () { return null; }),
      send({ type: 'config_entries/get' }).catch(function () { return []; })
    ]).then(function (r) {
      areas = {}; r[0].forEach(function (a) { areas[a.area_id] = a; });
      devices = {}; r[1].forEach(function (d) { devices[d.id] = d; });
      ents = {};
      if (r[2] && r[2].entities) {
        var cats = r[2].entity_categories || {};
        r[2].entities.forEach(function (e) {
          ents[e.ei] = { id: e.ei, device: e.di || null, area: e.ai || null, platform: e.pl, hidden: !!e.hb, category: e.ec != null ? cats[e.ec] : null, key: e.tk || '' };
        });
      }
      entries = r[3] || [];
      if (!silent) render();
    });
  }

  // Temperaturverlauf der letzten 12 Stunden für die Mini-Diagramme
  function loadHistory() {
    clearTimeout(loadHistory.t);
    loadHistory.t = setTimeout(loadHistory, 15 * 60000);
    var ids = model().rooms.map(function (r) { return r.temp && r.temp.entity_id; }).filter(Boolean);
    if (!ids.length) return;
    send({ type: 'history/history_during_period', start_time: new Date(Date.now() - 12 * 3600000).toISOString(),
      entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false })
      .then(function (res) {
        tempHist = {};
        Object.keys(res).forEach(function (id) {
          tempHist[id] = res[id].map(function (p) { return [p.lu * 1000, parseFloat(p.s)]; }).filter(function (p) { return isFinite(p[1]); });
        });
        queueRender();
      }).catch(function () {});
  }

  // ---------- Modell: alles nach Räumen sortiert ----------
  function reg(id) { return ents[id] || { id: id, device: null, area: null, platform: '', hidden: false, category: null, key: '' }; }
  function areaOf(id) {
    var e = reg(id);
    if (e.area) return e.area;
    var d = e.device && devices[e.device];
    return d ? d.area_id : null;
  }
  function dc(s) { return s.attributes && s.attributes.device_class; }
  function isDoor(s) { return dc(s) === 'door' || dc(s) === 'garage_door' || /t(ü|ue)r\b|tür/i.test(name(s)); }
  function name(s) { return (s.attributes && s.attributes.friendly_name) || s.entity_id; }
  function devName(id) { var d = devices[id]; return d ? (d.name_by_user || d.name || '') : ''; }
  function visible(id) { var e = reg(id); return !e.hidden; }
  function primary(id) { var e = reg(id); return !e.hidden && !e.category; }

  // Entfernt den Raumnamen aus Gerätenamen („Klima Flur Temperatur“ → „Temperatur“ bleibt lesbar genug)
  function shortName(s, roomName) {
    var n = name(s);
    if (roomName && n.toLowerCase().indexOf(roomName.toLowerCase() + ' ') === 0 && n.length > roomName.length + 3) n = n.slice(roomName.length + 1);
    return n;
  }

  var _model = null;
  function model() {
    if (_model) return _model;
    var roomMap = {};
    Object.keys(areas).forEach(function (id) {
      var a = areas[id];
      roomMap[id] = { id: id, name: a.name, icon: ROOM_ICON[a.name.toLowerCase()] || 'door', lights: [], temps: [], hums: [], contacts: [], motions: [], cams: [], scenes: [], echos: [], climates: [], plugs: [], buttons: {} };
    });
    var m = { persons: [], power: [], energy: [], speed: {}, humLimit: {}, rooms: [], lights: [], contacts: [], cams: [], alarms: [], scenes: [], echos: [], climates: [], heatTpl: [], vacuums: [], todos: [], spotify: null, weather: null, fritz: [], automations: 0, autos: [], scripts: [], helpers: [], batteries: {}, lqi: {}, updates: [], backup: null, sys: {} };

    Object.keys(S).forEach(function (id) {
      var s = S[id], dom = id.split('.')[0], e = reg(id), r = roomMap[areaOf(id)] || null;
      if (e.platform === 'systemmonitor') m.sys[id] = s;
      if (e.platform === 'fritz' && /^(sensor|binary_sensor)$/.test(dom) && visible(id)) m.fritz.push(s);
      if (dom === 'automation') { m.automations++; if (visible(id)) m.autos.push(s); }
      if (dom === 'script' && visible(id)) m.scripts.push(s);
      if (/^input_(number|boolean|datetime|select|text)$/.test(dom) && visible(id)) m.helpers.push(s);
      if (dom === 'button' && e.platform === 'fritzbox' && visible(id)) m.heatTpl.push(s); // FRITZ!SmartHome-Heizungsvorlagen
      if (dom === 'weather' && !m.weather) m.weather = s;
      if (dom === 'person') m.persons.push(s);
      if (e.platform === 'speedtestdotnet' && dom === 'sensor') m.speed[/upload/.test(e.key + id) ? 'up' : /ping/.test(e.key + id) ? 'ping' : 'down'] = s;
      if (dom === 'input_number' && id.indexOf('input_number.luftfeuchte_grenze_') === 0) m.humLimit[id.slice(32)] = s;
      if (dom === 'sensor' && dc(s) === 'power' && visible(id) && e.device) m.power.push(s);
      if (dom === 'sensor' && dc(s) === 'energy' && visible(id) && e.device) m.energy.push(s);
      if (dom === 'switch' && r && visible(id)) r.plugs.push(s); // Steckdosen (auch deaktivierte Schalter fehlen in S)
      if (dom === 'sensor' && dc(s) === 'battery' && visible(id) && e.device) m.batteries[e.device] = s;
      if (dom === 'sensor' && /_lqi$/.test(id) && e.device) m.lqi[e.device] = s;
      if (dom === 'update' && s.state === 'on' && visible(id)) m.updates.push(s);
      if (e.platform === 'backup' && dc(s) === 'timestamp' && /automatic|automatisch/.test(id)) m.backup = s;
      if (dom === 'todo' && visible(id)) m.todos.push({ s: s, platform: e.platform });
      if (!primary(id)) return;
      if (dom === 'light') {
        if (s.attributes.is_hue_group || (s.attributes.entity_id && s.attributes.entity_id.length)) return; // Hue-Räume/Zonen und Gruppen weglassen
        var l = { s: s, room: r }; m.lights.push(l); if (r) r.lights.push(l);
      } else if (dom === 'sensor' && dc(s) === 'temperature') { if (r) r.temps.push(s); }
      else if (dom === 'sensor' && dc(s) === 'humidity') { if (r) r.hums.push(s); }
      else if (dom === 'binary_sensor' && /^(door|window|garage_door|opening)$/.test(dc(s))) { var c = { s: s, room: r }; m.contacts.push(c); if (r) r.contacts.push(c); }
      else if (dom === 'binary_sensor' && /^(motion|occupancy|presence)$/.test(dc(s)) && e.platform !== 'blink') { if (r) r.motions.push(s); }
      else if (dom === 'vacuum') m.vacuums.push(s);
      else if (dom === 'camera' && /dreame|xiaomi_miio|roborock/.test(e.platform)) { m.vacMaps = m.vacMaps || {}; m.vacMaps[e.device] = s; }
      else if (dom === 'media_player' && e.platform === 'spotify') m.spotify = s;
      else if (dom === 'camera') { var cam = { s: s, room: r }; m.cams.push(cam); if (r) r.cams.push(cam); }
      else if (dom === 'alarm_control_panel') m.alarms.push(s);
      else if (dom === 'climate') { var cl = { s: s, room: r }; m.climates.push(cl); if (r) r.climates.push(cl); }
      else if (dom === 'scene') { var sc = { s: s, room: r }; m.scenes.push(sc); if (r) r.scenes.push(sc); }
      else if (dom === 'media_player' && e.platform === 'alexa_media' && !/fire\s*tv/i.test(name(s))) { var ec = { s: s, room: r }; m.echos.push(ec); if (r) r.echos.push(ec); }
      else if (dom === 'event' && e.device && r) {
        // Taster (Hue Dimmer usw.): letzter Druck = jüngstes Event des Geräts
        var b = r.buttons[e.device];
        if (!b || (s.state > b.state && !unavailable(s))) r.buttons[e.device] = s;
      }
    });

    var mine = lsGet(LS_ROOMS) || [];
    var def = function (n) { var i = ROOM_ORDER.indexOf(n.toLowerCase()); return i < 0 ? 99 : i; };
    var orderOf = function (r) { var i = mine.indexOf(r.id); return i < 0 ? 1000 + def(r.name) : i; };
    m.rooms = Object.keys(roomMap).map(function (k) { return roomMap[k]; }).sort(function (a, b) {
      return orderOf(a) - orderOf(b) || a.name.localeCompare(b.name, 'de');
    });
    var pos = {}; m.rooms.forEach(function (r, i) { pos[r.id] = i; });
    var order = function (n) { var r = m.rooms.filter(function (x) { return x.name === n; })[0]; return r ? pos[r.id] : 99; };
    m.rooms.forEach(function (r) {
      r.temp = r.temps.filter(function (s) { return !unavailable(s); })[0] || r.temps[0] || null;
      r.hum = r.hums.filter(function (s) { return !unavailable(s); })[0] || r.hums[0] || null;
    });
    var byRoom = function (a, b) {
      var ra = a.room ? order(a.room.name) : 100, rb = b.room ? order(b.room.name) : 100;
      return ra - rb || name(a.s).localeCompare(name(b.s), 'de');
    };
    m.lights.sort(byRoom); m.climates.sort(byRoom); m.contacts.sort(byRoom); m.cams.sort(byRoom); m.scenes.sort(byRoom); m.echos.sort(byRoom);
    _model = m;
    return m;
  }

  // ---------- Rendern ----------
  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(function () { renderQueued = false; render(); });
  }
  function render() {
    _model = null; chartData = {};
    if (connState !== 'ok' && !Object.keys(S).length) return;
    var m = model();
    renderOverview(m); renderRooms(m); renderCams(m); renderSystem(m);
    if (current === 'automationen') renderAutos(m);
    if (DETAIL[current]) { detailKey = current; renderDetail(m); }
  }

  function lightInfo(s) {
    var on = s.state === 'on', a = s.attributes || {};
    var lvl = on ? (a.brightness != null ? Math.max(1, Math.round(a.brightness / 2.55)) : 100) : 0;
    var col = a.rgb_color ? 'rgb(' + a.rgb_color.join(',') + ')' : '#fcd34d';
    return { on: on, lvl: lvl, col: col, off: unavailable(s) };
  }

  // Nachtlicht-Countdown: Lampe wurde von der Automation „Nachtlicht“ (id nachtlicht_flur) eingeschaltet und die läuft noch.
  // Aus geht sie, wenn der Bewegungsmelder im Raum input_number.nachtlicht_dauer Minuten ruhig war, spätestens 1 h nach dem Auslösen.
  function nightTimer(id) {
    var s = S[id]; if (!s || s.state !== 'on') return null;
    var au = Object.keys(S).map(function (k) { return S[k]; }).filter(function (x) { return x.entity_id.indexOf('automation.') === 0 && x.attributes && x.attributes.id === 'nachtlicht_flur'; })[0];
    if (!au || !au.attributes.last_triggered || au.attributes.current === 0) return null;
    var t0 = Date.parse(au.attributes.last_triggered), lc = Date.parse(s.last_changed);
    if (!(lc >= t0 - 3000 && lc <= t0 + 20000)) return null; // von Hand oder anders eingeschaltet
    var area = areaOf(id), mot = Object.keys(S).filter(function (k) { return k.indexOf('binary_sensor.') === 0 && dc(S[k]) === 'motion' && areaOf(k) === area && reg(k).platform !== 'blink'; }).map(function (k) { return S[k]; })[0];
    var dauer = (num(S['input_number.nachtlicht_dauer']) || 2) * 60000, max = t0 + 3600000;
    if (!mot || mot.state === 'on') return { motion: true, until: Math.min(max, Date.now() + dauer), total: dauer };
    return { until: Math.min(max, Date.parse(mot.last_changed) + dauer), total: dauer };
  }
  function mmss(ms) { var t = Math.max(0, Math.round(ms / 1000)); return Math.floor(t / 60) + ':' + ('0' + t % 60).slice(-2); }
  function timerTxt(nt) { return nt.motion ? 'Bewegung · ' + mmss(nt.total) : 'noch ' + mmss(nt.until - Date.now()); }

  function lightBtn(l, small, noRoom) {
    var s = l.s, i = lightInfo(s);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'light' + (i.on ? ' on' : '') + (small ? ' small' : '') + (i.off ? ' off-line' : '');
    b.style.setProperty('--lc', i.col);
    b.setAttribute('aria-pressed', i.on);
    b.dataset.entity = s.entity_id;
    b.innerHTML = '<div class="top"><span class="bulb">' + ic('bulb') + '</span><span class="lvl">' + (i.off ? 'offline' : i.on ? i.lvl + ' %' : 'Aus') + '</span></div>'
      + '<div><div class="name">' + esc((small || noRoom) && l.room ? shortName(s, l.room.name) : name(s)) + '</div>' + (small || noRoom || !l.room ? '' : '<div class="room">' + esc(l.room.name) + '</div>') + '</div>'
      + '<div class="bar"><div style="width:' + i.lvl + '%"></div></div>';
    var nt = nightTimer(s.entity_id);
    if (nt) b.insertAdjacentHTML('beforeend', '<div class="ntimer">' + ic('moon') + '<span' + (nt.motion ? '' : ' data-until="' + nt.until + '"') + '>' + timerTxt(nt) + '</span></div>');
    return b;
  }

  // Tippen = umschalten, lange drücken / Rechtsklick = Helligkeit & Farbe
  (function lightInput() {
    var timer = null, longFired = false, startX = 0, startY = 0;
    document.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('.light, .lamp'); if (!b) return;
      longFired = false; startX = e.clientX; startY = e.clientY;
      timer = setTimeout(function () { longFired = true; openLight(b.dataset.entity); }, 500);
    });
    document.addEventListener('pointermove', function (e) { if (timer && (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8)) { clearTimeout(timer); timer = null; } });
    ['pointerup', 'pointercancel'].forEach(function (t) { document.addEventListener(t, function () { clearTimeout(timer); timer = null; }); });
    document.addEventListener('contextmenu', function (e) { var b = e.target.closest('.light, .lamp'); if (b) { e.preventDefault(); if (!longFired) openLight(b.dataset.entity); longFired = true; } });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('.light, .lamp'); if (!b) return;
      if (longFired) { longFired = false; return; }
      var s = S[b.dataset.entity]; if (!s || unavailable(s)) { toast('Lampe ist gerade nicht erreichbar.'); return; }
      b.classList.add('busy');
      callService('light', 'toggle', {}, { entity_id: s.entity_id }).catch(function () {}).then(function () { b.classList.remove('busy'); });
    });
    document.addEventListener('keydown', function (e) {
      var b = e.target.closest && e.target.closest('.lamp'); if (!b || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault(); callService('light', 'toggle', {}, { entity_id: b.dataset.entity }).catch(function () {});
    });
  })();

  // Grenzwert für Feuchte-Hinweise: derselbe Helfer wie in der Automation „Lüften: Hinweis bei hoher Feuchte“
  // (input_number.luftfeuchte_grenze_<raum>, z. B. _bad für Badezimmer). Ohne Helfer gibt es für den Raum keinen Hinweis.
  function slug(n) { return n.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
  function humLimit(m, r) {
    var sl = slug(r.name), k = Object.keys(m.humLimit).filter(function (x) { return sl === x || sl.indexOf(x) === 0; }).sort(function (a, b) { return b.length - a.length; })[0];
    return k ? num(m.humLimit[k]) : null;
  }
  function tooWet(m, r) { var h = num(r.hum), g = humLimit(m, r); return h != null && g != null && h > g; }

  function renderOverview(m) {
    var on = m.lights.filter(function (l) { return l.s.state === 'on'; }).length;
    var temps = m.rooms.map(function (r) { return num(r.temp); }).filter(function (v) { return v != null; });
    var hums = m.rooms.map(function (r) { return num(r.hum); }).filter(function (v) { return v != null; });
    var open = m.contacts.filter(function (c) { return c.s.state === 'on'; });
    var avg = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; };
    $('sLights').textContent = on + ' / ' + m.lights.length;
    $('sTemp').textContent = temps.length ? fmt1(avg(temps)) + '°' : '–';
    $('sHum').textContent = hums.length ? Math.round(avg(hums)) + ' %' : '';
    var wet = m.rooms.filter(function (r) { return tooWet(m, r); });
    $('sClimNote').textContent = wet.length === 1 ? wet[0].name + ' lüften' : wet.length ? wet.length + ' Räume lüften' : 'Ø Wohnung';
    $('sClimNote').title = wet.map(function (r) { return r.name; }).join(', ');
    $('sOpen').textContent = m.contacts.length ? open.length : '–';
    $('sOpenL').textContent = open.length ? 'offen' : m.contacts.length ? 'alles zu' : 'Fenster';
    $('sOpenBox').classList.toggle('warn', open.length > 0);

    // Bewohner: Personen aus HA, klein und dezent
    $('residents').innerHTML = m.persons.map(function (p) {
      var home = p.state === 'home', n = name(p);
      var where = home ? 'zu Hause' : p.state === 'not_home' ? 'unterwegs' : unavailable(p) ? 'unbekannt' : p.state;
      return '<span class="who' + (home ? ' home' : '') + '"><span class="av" aria-hidden="true">' + esc(n.charAt(0).toUpperCase()) + '</span><span><b>' + esc(n) + '</b> · ' + esc(where)
        + (!home && p.last_changed && !unavailable(p) ? ' seit ' + esc(timeText(p.last_changed)) : '') + '</span></span>';
    }).join('');

    var st = $('status');
    // Je Raum ein Chip: rot mit Anzahl, wenn dort etwas offen ist, sonst grün „zu“; Tippen öffnet die Fenster-Übersicht
    function roomChips(m) {
      return '<span class="rooms-oc">' + m.rooms.filter(function (r) { return r.contacts.length; }).map(function (r) {
        var o = r.contacts.filter(function (c) { return c.s.state === 'on'; }).length, u = r.contacts.every(function (c) { return unavailable(c.s); });
        return '<button type="button" class="roc' + (o ? ' open' : u ? ' unk' : '') + '" data-go="fenster">' + esc(r.name) + (o ? ' · ' + (o === r.contacts.length && o > 1 ? 'alle' : o) + ' offen' : '') + '</button>';
      }).join('') + '</span>';
    }
    if (open.length) {
      st.className = 'status alert';
      // Bei vielen offenen Fenstern nur die Anzahl und die Räume, sonst wird die Zeile endlos lang
      var many = open.length > 2, rooms = [];
      open.forEach(function (c) { var n = c.room ? c.room.name : name(c.s); if (rooms.indexOf(n) < 0) rooms.push(n); });
      st.innerHTML = '<span class="big">' + ic('window') + '</span><div><b>' + (many ? open.length + ' Fenster und Türen offen' : esc(open.map(function (c) { return name(c.s); }).join(', ')) + ' offen') + '</b><small>'
        + esc(many ? 'zuerst geöffnet ' + timeText(open.map(function (c) { return c.s.last_changed; }).sort()[0]) : open.map(function (c) { return 'seit ' + timeText(c.s.last_changed) + ' · ' + ago(c.s.last_changed) + (c.room && c.room.temp && num(c.room.temp) != null ? ' · ' + fmt1(num(c.room.temp)) + ' °C' : ''); }).join(' · ')) + '</small>'
        + roomChips(m) + '</div>';
    } else {
      var lastMotion = m.rooms.reduce(function (acc, r) { return acc.concat(r.motions); }, []).sort(function (a, b) { return a.last_changed < b.last_changed ? 1 : -1; })[0];
      st.className = 'status';
      st.innerHTML = '<span class="big">' + ic(m.contacts.length ? 'lock' : 'home') + '</span><div><b>' + (m.contacts.length ? 'Alle Fenster und Türen zu' : 'Alles ruhig') + '</b><small>'
        + (lastMotion ? esc(name(lastMotion)) + ': ' + (lastMotion.state === 'on' ? 'Bewegung jetzt' : 'zuletzt ' + timeText(lastMotion.last_changed)) : m.contacts.length + ' Fenster und Türen geschlossen') + '</small></div>';
    }

    // Hinweise
    var notes = [];
    open.forEach(function (c) {
      var r = c.room, t = r && num(r.temp), h = r && r.temp && tempHist[r.temp.entity_id];
      if (t != null && h && h.length && h[0][1] - t > 0.8)
        notes.push({ cls: 'crit', t: r.name + ': kühlt aus', d: name(c.s) + ' offen, ' + fmt1(h[0][1] - t) + ' °C kälter als vor 12 Stunden.' });
    });
    m.rooms.forEach(function (r) {
      if (tooWet(m, r)) notes.push({ cls: '', t: r.name + ': ' + Math.round(num(r.hum)) + ' % Luftfeuchte', d: 'Über der Grenze von ' + Math.round(humLimit(m, r)) + ' %. Lüften, damit sich kein Schimmel bildet.' });
    });
    Object.keys(m.batteries).forEach(function (d) {
      var b = num(m.batteries[d]);
      if (b != null && b < 20) notes.push({ cls: '', t: devName(d) + ': Batterie ' + Math.round(b) + ' %', d: 'Bald tauschen.' });
    });
    var off = deviceProblems(m);
    if (off.length) notes.push({ cls: '', t: off.length + (off.length === 1 ? ' Gerät' : ' Geräte') + ' nicht erreichbar', d: off.slice(0, 4).join(', ') + (off.length > 4 ? ' …' : '') });
    m.updates.forEach(function (u) { notes.push({ cls: 'info', t: 'Update verfügbar: ' + (u.attributes.title || name(u)), d: (u.attributes.installed_version || '') + ' → ' + (u.attributes.latest_version || '') + ' · in HA unter Einstellungen installieren' }); });
    if (m.backup && !unavailable(m.backup)) {
      var hrs = (Date.now() - new Date(m.backup.state)) / 3600000;
      notes.push({ cls: hrs > 36 ? '' : 'info', t: 'Backup ' + timeText(m.backup.state) + (hrs > 36 ? ' (älter als 1,5 Tage)' : ' erstellt'), d: 'Automatisches Home-Assistant-Backup, lokal und in Google Drive.' });
    }
    m.alarms.forEach(function (a) { if (/^armed/.test(a.state)) notes.push({ cls: 'info', t: name(a) + ' ist scharf', d: 'Blink meldet Bewegungen an die Blink-App.' }); });
    $('notes').innerHTML = notes.length ? notes.map(function (n) { return '<div class="note ' + n.cls + '"><span class="dot"></span><div><b>' + esc(n.t) + '</b><small>' + esc(n.d) + '</small></div></div>'; }).join('')
      : '<div class="empty">Nichts zu tun.</div>';
    var warnCount = notes.filter(function (n) { return n.cls !== 'info'; }).length;
    $('noteCount').textContent = warnCount ? warnCount + ' offen' : notes.length ? notes.length + ' Infos' : 'nichts zu tun';

    renderPlan(m);
    renderWeather(m);
    renderHeat(m);
    var echos = m.echos.filter(function (e) { return !unavailable(e.s); });
    renderSay(m, echos);
    renderMusic(m, echos);
    renderEchos(m);
    renderVacuum(m);
    renderShop(m);
    if (current === 'energie') renderEnergy(m);
  }

  // ---------- Grundriss der Wohnung (nach Stefans Plan, Einheiten = Pixel des Original-Bilds) ----------
  // Räume über den Bereichsnamen in HA. Lampen und Kontakte werden den eingezeichneten Plätzen zugeordnet:
  // Lampen nach Name sortiert auf die Plätze des Raums (PLAN_LAMP legt einzelne Lampen fest), Fenster mit „links“/„rechts“ im Namen
  // auf den linken/rechten Flügel, Türen auf die eingezeichneten Außentüren.
  var PLAN = {
    schlafzimmer: { d: 'M42 38H165V20H288V532H42Z', at: [160, 150], lamps: [[240, 84], [168, 293], [86, 494], [200, 420]], win: [[178, 20, 278, 20]] },
    kuche: { d: 'M288 62H505V425H288Z', at: [396, 150], lamps: [[465, 257], [380, 330]], win: [[345, 62, 445, 62]] },
    badezimmer: { d: 'M505 62H660V370H505Z', at: [582, 150], short: 'Bad', narrow: true, lamps: [[540, 330], [610, 250]], win: [[532, 62, 632, 62]] },
    toilette: { d: 'M660 88H757V270H660Z', at: [708, 140], short: 'WC', narrow: true, lamps: [[708, 235]], win: [[688, 88, 748, 88]] },
    flur: { d: 'M288 425H505V370H660V270H757V532H288Z', at: [420, 470], lamps: [[526, 502], [615, 500], [708, 330]], door: [{ x1: 757, y1: 523, x2: 757, y2: 445, leaf: 'M757 523 L683 523 A74 74 0 0 1 757 449 Z', lx: 683, ly: 523 }] },
    buro: { d: 'M42 532H452V880H42Z', at: [250, 600], lamps: [[190, 685], [170, 758], [300, 732], [360, 640]], win: [[162, 880, 253, 880], [253, 880, 345, 880]] },
    wohnzimmer: { d: 'M452 532H845V948H440V880H452Z', at: [648, 745], lamps: [[496, 573], [736, 620], [689, 838], [806, 838], [600, 660]], win: [[542, 948, 634, 948], [634, 948, 724, 948]],
      door: [{ x1: 440, y1: 943, x2: 440, y2: 887, leaf: 'M440 943 L498 943 A56 56 0 0 0 440 887 Z', lx: 498, ly: 943 }] }
  };
  var PLAN_OUT = [{ d: 'M42 880H440V985H42Z', at: [240, 940], name: 'Balkon' }];
  var PLAN_IDOOR = ['M288 442V522', 'M356 425H440', 'M660 282V362', 'M668 270H749', 'M312 532H395', 'M594 532H676'];
  var PLAN_LAMP = {}; // z. B. 'light.wohnzimmer_stehlampe': [806, 838]
  // Feste Plätze nach Lampenname (aus Stefans Skizze vom 27.10.); passt, wenn der Name in HA den Text enthält
  var PLAN_LAMP_NAME = [
    ['rotlicht', [241, 86]], ['schlafzimmerlampe', [169, 295]], ['leselampe', [86, 494]],
    ['schreibtischlampe', [191, 687]], ['burolampe', [302, 733]], ['bildschirm', [170, 759]], ['background', [170, 759]],
    ['wohnzimmertisch', [692, 840]], ['led_wohnzimmer', [810, 840]], ['wohnzimmer_led', [810, 840]],
    ['sternenlampe', [735, 425]], ['spiegel', [526, 502]]
  ];
  function lampPos(s) {
    if (PLAN_LAMP[s.entity_id]) return PLAN_LAMP[s.entity_id];
    var n = slug(name(s)), hit = PLAN_LAMP_NAME.filter(function (x) { return n.indexOf(x[0]) > -1; })[0];
    return hit && hit[1];
  }
  var planHtml = '';
  // Ring um die Lampe läuft ab, darunter die Restzeit (Nachtlicht-Automation)
  function planTimer(id) {
    var nt = nightTimer(id); if (!nt) return '';
    var C = 2 * Math.PI * 24, f = nt.motion ? 1 : Math.max(0, Math.min(1, (nt.until - Date.now()) / nt.total));
    return '<circle class="nring-bg" r="24"/><circle class="nring" r="24" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - f)).toFixed(1) + '" transform="rotate(-90)"' + (nt.motion ? '' : ' data-ring="' + nt.until + '|' + nt.total + '|' + C.toFixed(1) + '"') + '/>'
      + '<text class="ntime" y="-34"' + (nt.motion ? '' : ' data-until="' + nt.until + '" data-short') + '>' + (nt.motion ? 'Bewegung' : mmss(nt.until - Date.now())) + '</text>';
  }

  function renderPlan(m) {
    var rooms = '', over = '', lamps = '', halos = '', lit = 0, openN = 0;
    m.rooms.forEach(function (r) {
      var P = PLAN[slug(r.name)]; if (!P) return;
      var anyOn = r.lights.some(function (l) { return l.s.state === 'on'; });
      var roomOpen = 0, roomAt = rooms.length;
      rooms += '<path class="room' + (anyOn ? ' lit' : '') + '" d="' + P.d + '" data-plan-room="' + esc(r.id) + '"><title>' + esc(r.name) + '</title></path>';
      // Beschriftung: Name, darunter Temperatur und Feuchte (rot über dem Lüften-Grenzwert)
      var t = num(r.temp), h = num(r.hum), wet = tooWet(m, r), x = P.at[0], y = P.at[1];
      var motion = r.motions.some(function (s) { return s.state === 'on'; });
      over += '<text class="rname" x="' + x + '" y="' + y + '">' + esc(P.short || r.name) + '</text>';
      if (motion) over += '<circle class="motion" cx="' + (x + (P.short || r.name).length * 8 + 14) + '" cy="' + (y - 9) + '" r="7"><title>Bewegung</title></circle>';
      var tv = t != null ? fmt1(t) + '°' : '', hv = h != null ? Math.round(h) + ' %' : '';
      if (P.narrow) {
        if (tv) over += '<text class="rval" x="' + x + '" y="' + (y + 34) + '">' + tv + '</text>';
        if (hv) over += '<text class="rval' + (wet ? ' hot' : '') + '" x="' + x + '" y="' + (y + 64) + '">' + hv + '</text>';
      } else if (tv || hv) {
        over += '<text class="rval" x="' + x + '" y="' + (y + 34) + '">' + tv + (tv && hv ? ' · ' : '') + (hv ? '<tspan class="rval' + (wet ? ' hot' : '') + '">' + hv + '</tspan>' : '') + '</text>';
      }
      // Fenster: links/rechts nach Namen, so wie man im Raum zum Fenster schaut (auf dem Plan also gespiegelt), Rest der Reihe nach
      var wins = (P.win || []).map(function () { return null; }), doors = (P.door || []).map(function () { return null; });
      var cs = r.contacts.slice().sort(function (a, b) { return name(a.s).localeCompare(name(b.s), 'de'); });
      cs.filter(function (c) { return !isDoor(c.s); }).forEach(function (c) {
        var n = name(c.s).toLowerCase(), i = /links/.test(n) ? wins.length - 1 : /rechts/.test(n) ? 0 : wins.indexOf(null);
        if (i < 0 || wins[i]) i = wins.indexOf(null);
        if (i > -1) wins[i] = c.s;
      });
      cs.filter(function (c) { return isDoor(c.s); }).forEach(function (c) { var i = doors.indexOf(null); if (i > -1) doors[i] = c.s; });
      (P.win || []).forEach(function (w, i) {
        var s = wins[i], cls = !s ? 'none' : unavailable(s) ? 'unk' : s.state === 'on' ? 'open' : '';
        if (s && s.state === 'on') {
          openN++; roomOpen++;
          // offenes Fenster: roter Schein, dazu wird der Raum rot getönt – fällt auf einen Blick auf
          halos += '<line class="win-halo" x1="' + w[0] + '" y1="' + w[1] + '" x2="' + w[2] + '" y2="' + w[3] + '"/>';
        }
        over += '<line class="win ' + cls + '" x1="' + w[0] + '" y1="' + w[1] + '" x2="' + w[2] + '" y2="' + w[3] + '">' + (s ? '<title>' + esc(name(s)) + ': ' + (cls === 'open' ? 'offen' : cls === 'unk' ? 'nicht erreichbar' : 'zu') + '</title>' : '') + '</line>'
          + '<line class="win-in" x1="' + w[0] + '" y1="' + w[1] + '" x2="' + w[2] + '" y2="' + w[3] + '"/>';
      });
      (P.door || []).forEach(function (d, i) {
        var s = doors[i], isOpen = s && s.state === 'on', cls = !s ? 'none' : unavailable(s) ? 'unk' : isOpen ? 'open' : '';
        if (isOpen) { openN++; roomOpen++; halos += '<line class="win-halo" x1="' + d.x1 + '" y1="' + d.y1 + '" x2="' + d.x2 + '" y2="' + d.y2 + '"/>'; over += '<path class="swing" d="' + d.leaf + '"/><line class="leaf" x1="' + d.x1 + '" y1="' + d.y1 + '" x2="' + d.lx + '" y2="' + d.ly + '"/>'; }
        over += '<line class="win ' + cls + '" x1="' + d.x1 + '" y1="' + d.y1 + '" x2="' + d.x2 + '" y2="' + d.y2 + '">' + (s ? '<title>' + esc(name(s)) + ': ' + (isOpen ? 'offen' : 'zu') + '</title>' : '') + '</line>';
      });
      if (roomOpen) rooms = rooms.slice(0, roomAt) + rooms.slice(roomAt).replace('class="room', 'class="room opened');
      // Lampen
      // erst die Lampen mit festem Platz, dann die übrigen auf freie Plätze des Raums (nicht direkt neben einen festen)
      var spots = P.lamps.slice(), used = {}, ls = r.lights.slice().sort(function (a, b) { return name(a.s).localeCompare(name(b.s), 'de'); });
      ls.forEach(function (l) { var p = lampPos(l.s); if (p) spots.forEach(function (q) { if (Math.abs(q[0] - p[0]) < 40 && Math.abs(q[1] - p[1]) < 40) used[q] = 1; }); });
      ls.forEach(function (l) {
        var pos = lampPos(l.s);
        if (!pos) { pos = spots.filter(function (p) { return !used[p]; })[0]; }
        if (!pos) return;
        used[pos] = 1;
        var i = lightInfo(l.s); if (i.on) lit++;
        lamps += '<g class="lamp' + (i.on ? ' on' : '') + (i.off ? ' off-line' : '') + '" data-entity="' + esc(l.s.entity_id) + '" role="button" tabindex="0" aria-label="' + esc(name(l.s)) + ': ' + (i.off ? 'nicht erreichbar' : i.on ? 'an ' + i.lvl + ' %' : 'aus') + '"'
          + (i.on ? ' style="--lc:' + esc(l.s.attributes.rgb_color ? i.col : 'var(--lamp)') + '"' : '') + ' transform="translate(' + pos[0] + ' ' + pos[1] + ')">'
          + '<circle class="glow" r="' + (40 + i.lvl * .5) + '"/><circle class="hit" r="34"/><circle class="bulb" r="15"/>' + planTimer(l.s.entity_id) + '<title>' + esc(name(l.s)) + '</title></g>';
      });
    });
    var outs = PLAN_OUT.map(function (o) { return '<path class="room out" d="' + o.d + '"/>'; }).join('');
    var outT = PLAN_OUT.map(function (o) { return '<text class="rname out-name" x="' + o.at[0] + '" y="' + o.at[1] + '">' + esc(o.name) + '</text>'; }).join('');
    var html = '<svg viewBox="26 6 838 994" role="group" aria-label="Grundriss der Wohnung mit Lampen, Fenstern und Türen">'
      + '<defs><radialGradient id="lampGlow"><stop offset="0" style="stop-color:var(--lamp-glow)"/><stop offset="1" style="stop-color:var(--lamp-glow);stop-opacity:0"/></radialGradient></defs>'
      + outs + rooms + PLAN_IDOOR.map(function (d) { return '<path class="idoor" d="' + d + '"/>'; }).join('') + halos + over + outT + lamps + '</svg>';
    $('planCount').textContent = lit + ' Licht an · ' + openN + ' offen';
    if (html !== planHtml) { planHtml = html; $('plan').innerHTML = html; }
  }
  document.addEventListener('click', function (e) {
    var r = e.target.closest('[data-plan-room]'); if (!r) return;
    lsSet(LS_ROOM, r.dataset.planRoom); go('raeume');
  });

  // ---------- Energieverbrauch (Steckdosen mit Strommessung, z. B. FRITZ!DECT 200 „Rechner“) ----------
  var ERANGE = { '24h': { label: '24 h', ms: 864e5, period: 'hour' }, '7d': { label: '7 Tage', ms: 7 * 864e5, period: 'day' }, '30d': { label: '30 Tage', ms: 30 * 864e5, period: 'day' } };
  var eCache = {}, eLoading = {};
  // Verbrauch je Stunde/Tag aus der Langzeitstatistik (Typ „change“ des Zählers in kWh)
  function loadEnergy(id, range) {
    var key = range + '|' + id, c = eCache[key];
    if (c && Date.now() - c.at < 5 * 60000) return c.data;
    if (eLoading[key]) return c ? c.data : null;
    eLoading[key] = true;
    var R = ERANGE[range], start = new Date(Date.now() - R.ms);
    if (R.period === 'day') start.setHours(0, 0, 0, 0); else start.setMinutes(0, 0, 0);
    send({ type: 'recorder/statistics_during_period', start_time: start.toISOString(), statistic_ids: [id], period: R.period, types: ['change'], units: { energy: 'kWh' } })
      .then(function (res) { eCache[key] = { at: Date.now(), data: (res[id] || []).map(function (p) { return { t: typeof p.start === 'number' ? p.start : new Date(p.start).getTime(), v: Math.max(0, p.change || 0) }; }) }; })
      .catch(function () { eCache[key] = { at: Date.now(), data: [] }; })
      .then(function () { delete eLoading[key]; queueRender(); });
    return c ? c.data : null;
  }
  function kwh(v) { return v == null ? '–' : (v < 10 ? v.toLocaleString('de-DE', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : Math.round(v).toLocaleString('de-DE')); }
  function barChart(pts, range) {
    if (!pts.length) return '<div class="cload">Noch keine Verbrauchsdaten für diesen Zeitraum.</div>';
    var max = Math.max.apply(null, pts.map(function (p) { return p.v; })) || 0.01, hourly = ERANGE[range].period === 'hour';
    var lab = function (t) { return hourly ? new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr' : new Date(t).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' }); };
    var total = pts.reduce(function (a, p) { return a + p.v; }, 0), last = pts.length - 1;
    var xl = function (t) { return hourly ? new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : new Date(t).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' }); };
    return '<div class="chart" style="--cc:var(--p1)"><h4>Verbrauch ' + (hourly ? 'je Stunde' : 'je Tag') + '<span>Summe ' + kwh(total) + ' kWh · Ø ' + kwh(total / pts.length) + ' kWh</span></h4>'
      + '<div class="cgrid"><div class="yax"><span style="top:0%">' + kwh(max) + '</span><span style="top:50%">' + kwh(max / 2) + '</span><span style="top:100%">0</span></div>'
      + '<div class="plot" data-barplot><div class="gl" style="top:0"></div><div class="gl" style="top:50%"></div><div class="bars">' + pts.map(function (p, i) {
        return '<i' + (i === last ? ' class="today"' : '') + ' style="height:' + Math.max(1, p.v / max * 100).toFixed(1) + '%" data-tip="' + esc(lab(p.t) + ' · ' + kwh(p.v) + ' kWh') + '"></i>';
      }).join('') + '</div></div>'
      + '<div class="xax"><span>' + xl(pts[0].t) + '</span><span>' + (hourly ? 'jetzt' : 'heute') + '</span></div></div></div>';
  }
  document.addEventListener('pointermove', function (e) {
    var plot = e.target.closest && e.target.closest('[data-barplot]'); if (!plot) return;
    var bars = plot.querySelectorAll('.bars i'), r = plot.getBoundingClientRect(), x = e.clientX - r.left;
    var i = Math.max(0, Math.min(bars.length - 1, Math.floor(x / r.width * bars.length))), b = bars[i]; if (!b) return;
    plot.querySelectorAll('.bars i.hl').forEach(function (n) { n.classList.remove('hl'); }); b.classList.add('hl');
    var tip = plot.querySelector('.tip') || plot.appendChild(Object.assign(document.createElement('div'), { className: 'tip' }));
    tip.textContent = b.dataset.tip; tip.style.left = Math.max(18, Math.min(82, (i + .5) / bars.length * 100)) + '%';
  });
  document.addEventListener('pointerout', function (e) {
    var p = e.target.closest && e.target.closest('[data-barplot]');
    if (p && !p.contains(e.relatedTarget)) { p.querySelectorAll('.tip').forEach(function (n) { n.remove(); }); p.querySelectorAll('.hl').forEach(function (n) { n.classList.remove('hl'); }); }
  });

  function renderEnergy(m) {
    var el = $('energy'), byDev = {};
    m.power.forEach(function (s) { var d = reg(s.entity_id).device; (byDev[d] = byDev[d] || { dev: d }).power = byDev[d].power || s; });
    m.energy.forEach(function (s) { var d = reg(s.entity_id).device; (byDev[d] = byDev[d] || { dev: d }).energy = byDev[d].energy || s; });
    var list = Object.keys(byDev).map(function (k) { return byDev[k]; }).sort(function (a, b) { return devName(a.dev).localeCompare(devName(b.dev), 'de'); });
    if (!list.length) { el.innerHTML = '<section class="box empty">Keine Steckdose mit Strommessung gefunden.</section>'; return; }
    var range = rangeOf('energy');
    el.innerHTML = list.map(function (x) {
      var p = x.power, en = x.energy, w = num(p), room = areaOf((p || en).entity_id);
      var html = '<section class="box"><div class="box-head"><h2>' + ic('plug') + esc(devName(x.dev) || name(p || en)) + '</h2><span class="count">' + esc(room && areas[room] ? areas[room].name : '') + '</span></div>';
      var today = null, data = en ? loadEnergy(en.entity_id, range) : null, todayData = en ? loadEnergy(en.entity_id, '24h') : null;
      if (todayData) { var mid = new Date(); mid.setHours(0, 0, 0, 0); today = todayData.filter(function (q) { return q.t >= mid.getTime(); }).reduce(function (a, q) { return a + q.v; }, 0); }
      html += '<div class="energy-now">'
        + '<div><div class="v">' + (w == null ? '–' : (w < 10 ? fmt1(w) : Math.round(w).toLocaleString('de-DE'))) + '<small>W</small></div><div class="k">Leistung jetzt</div></div>'
        + (en ? '<div><div class="v">' + kwh(today) + '<small>kWh</small></div><div class="k">Heute</div></div>' : '')
        + (en && num(en) != null ? '<div><div class="v">' + kwh(num(en)) + '<small>kWh</small></div><div class="k">Zählerstand</div></div>' : '') + '</div>';
      html += '<div style="margin-top:12px">' + rangeChips('energy') + '</div>';
      if (en) html += data ? barChart(data, range) : '<div class="cload">Verbrauch wird geladen …</div>';
      if (p) html += chartsFor([p.entity_id], 'energy', function () { return { title: 'Leistung', unit: 'W', col: 'var(--p1)', dec: 0 }; });
      return html + '</section>';
    }).join('') + '<p class="hint">Werte aus der Langzeitstatistik von Home Assistant. Die Steckdose misst nur, sie wird hier nie geschaltet.</p>';
  }

  // ---------- Heizung (eigene Seite) ----------
  function renderHeat(m) {
    $('heat').innerHTML = m.climates.length ? m.climates.map(function (c) { return heatRow(c.s, c.room ? c.room.name : ''); }).join('')
      : '<div class="empty">Keine Thermostate in Home Assistant gefunden.</div>';
    var heating = m.climates.filter(function (c) { return c.s.attributes.hvac_action === 'heating'; }).length;
    $('heatCount').textContent = m.climates.length ? (heating ? heating + ' heizt' : 'keins heizt') : '';
    $('heatTplBox').hidden = !m.heatTpl.length;
    $('heatTpl').innerHTML = m.heatTpl.slice().sort(function (a, b) { return name(a).localeCompare(name(b), 'de'); }).map(function (b) {
      return '<button class="scene" type="button" data-press="' + esc(b.entity_id) + '"' + (b.state === 'unavailable' ? ' disabled' : '') + '>' + ic('thermo') + esc(name(b)) + '</button>';
    }).join('');
  }

  // ---------- Multimedia: Durchsage, Musik, Echos ----------
  function renderSay(m, echos) {
    $('sayBox').hidden = !echos.length;
    if (!echos.length) return;
    var sel = $('sayTarget'), cur = sel.value || 'alle';
    if (document.activeElement === sel) return;
    var single = echos.filter(function (e) { return e.room && !isGroup(e.s); }), groups = echos.filter(function (e) { return isGroup(e.s) || !e.room; });
    sel.innerHTML = '<option value="alle">Alle Echos</option>'
      + (single.length ? '<optgroup label="Räume">' + single.map(function (e) { return '<option value="' + esc(e.s.entity_id) + '">' + esc(e.room.name) + '</option>'; }).join('') + '</optgroup>' : '')
      + (groups.length ? '<optgroup label="Gruppen">' + groups.map(function (e) { return '<option value="' + esc(e.s.entity_id) + '">' + esc(name(e.s)) + '</option>'; }).join('') + '</optgroup>' : '');
    sel.value = cur; if (!sel.value) sel.value = 'alle';
  }
  function renderEchos(m) {
    var list = m.echos.filter(function (e) { return e.room && !isGroup(e.s); });
    $('echoBox').hidden = !list.length;
    if (!list.length) return;
    var playing = list.filter(function (e) { return e.s.state === 'playing'; }).length;
    $('echoCount').textContent = list.length + ' Geräte' + (playing ? ' · ' + playing + ' spielt' : '');
    $('echos').innerHTML = list.map(function (e) {
      var a = e.s.attributes || {}, off = unavailable(e.s);
      return '<div class="row"><span class="ico">' + ic(e.room.icon) + '</span><div class="txt"><b>' + esc(e.room.name) + '</b><small>'
        + esc(off ? 'nicht erreichbar' : e.s.state === 'playing' ? 'spielt ' + (a.media_title || '') : 'bereit') + '</small></div>'
        + (a.volume_level != null ? '<span class="dval">' + Math.round(a.volume_level * 100) + ' %</span>' : '') + '</div>';
    }).join('');
  }
  function isGroup(s) { return /^x\d|gruppe|überall|ueberall|\+/i.test(name(s)) || (s.attributes && s.attributes.member_ids); }

  // ---------- Musik über die Echos (Alexa Media Player), optional Spotify-Integration ----------
  function speaker(echos) {
    var id = lsGet(LS_SPEAKER);
    var playing = echos.filter(function (e) { return e.s.state === 'playing'; })[0];
    return echos.filter(function (e) { return e.s.entity_id === id; })[0] || playing || echos[0];
  }
  function renderMusic(m, echos) {
    if (!echos.length && !m.spotify) return;
    var sp = speaker(echos), a = sp ? sp.s.attributes : {}, conf = lsGet(LS_CONN) || {}, base = (conf.url || '').replace(/\/+$/, '');
    var playingNow = echos.filter(function (e) { return e.s.state === 'playing'; });
    $('musicCount').textContent = playingNow.length ? playingNow.length + ' spielt' : '';
    var opts = echos.map(function (e) { return '<option value="' + esc(e.s.entity_id) + '"' + (sp && e.s.entity_id === sp.s.entity_id ? ' selected' : '') + '>' + (e.s.state === 'playing' ? '▶ ' : '') + esc(e.room && !isGroup(e.s) ? e.room.name : name(e.s)) + '</option>'; }).join('');
    var html = '';
    if (sp) {
      var on = sp.s.state === 'playing';
      html += '<div class="np">' + (a.entity_picture ? '<img alt="" src="' + esc((/^https?:/.test(a.entity_picture) ? '' : base) + a.entity_picture) + '">' : '<img alt="" src="icon.svg">')
        + '<div class="txt"><b>' + esc(a.media_title || (on ? 'Spielt' : 'Nichts läuft')) + '</b><small>' + esc([a.media_artist, a.source].filter(Boolean).join(' · ') || 'Lautsprecher wählen und Musik starten') + '</small></div></div>'
        + '<div class="mctl"><select data-speaker aria-label="Lautsprecher">' + opts + '</select>'
        + '<button class="icon-btn" type="button" data-mp="media_previous_track" aria-label="Zurück">' + ic('prev') + '</button>'
        + '<button class="icon-btn" type="button" data-mp="' + (on ? 'media_pause' : 'media_play') + '" aria-label="' + (on ? 'Pause' : 'Abspielen') + '">' + ic(on ? 'pause' : 'play') + '</button>'
        + '<button class="icon-btn" type="button" data-mp="media_next_track" aria-label="Weiter">' + ic('next') + '</button></div>'
        // Lautstärke ohne Schieberegler (der hat sich beim Scrollen am Handy verstellt): − / + in 5er-Schritten und feste Stufen
        + (function () {
          var v = volPending[sp.s.entity_id] != null ? volPending[sp.s.entity_id] : a.volume_level != null ? Math.round(a.volume_level * 100) : null;
          return '<div class="vol"><span class="noclim">Lautstärke</span><span class="stepper"><button type="button" data-vol="-5" aria-label="leiser">−</button><output aria-live="polite">' + (v == null ? '–' : v + ' %') + '</output><button type="button" data-vol="5" aria-label="lauter">+</button></span></div>'
            + '<div class="chips vchips" role="group" aria-label="Lautstärke-Stufen">' + [10, 20, 30, 40, 60].map(function (x) { return '<button class="chip" type="button" data-volset="' + x + '" aria-pressed="' + (v === x) + '">' + x + ' %</button>'; }).join('') + '</div>';
        })()
        + '<form class="say" data-spotify><input type="text" placeholder="Spotify: Playlist, Künstler oder Song" aria-label="Was soll Spotify spielen?"><button class="btn" type="submit" aria-label="Auf Spotify abspielen">' + ic('play') + '</button></form>';
    }
    if (m.spotify && (m.spotify.attributes.source_list || []).length) {
      var sa = m.spotify.attributes;
      html += '<div class="mctl"><span class="noclim" style="white-space:nowrap">Spotify spielt auf</span><select data-spsource aria-label="Spotify-Gerät">'
        + sa.source_list.map(function (x) { return '<option' + (x === (sa.source || lsGet(LS_SPDEV)) ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div>';
    }
    if (m.spotify) {
      loadPlaylists(m.spotify);
      if (spLists && spLists.length) html += '<div class="noclim plh">Meine Playlists</div><div class="pls" role="list">' + spLists.map(function (x, i) {
        return '<button class="pl" type="button" role="listitem" data-plist="' + i + '">' + (x.thumbnail ? '<img alt="" loading="lazy" src="' + esc(x.thumbnail) + '">' : '<span class="ph">' + ic('play') + '</span>') + '<span>' + esc(x.title) + '</span></button>';
      }).join('') + '</div>';
      else if (spLists && !spLists.length) html += '<div class="noclim plh">Keine Playlists in Spotify gefunden.</div>';
    }
    if (playingNow.length > 1 || (playingNow.length === 1 && sp && playingNow[0] !== sp)) html += '<div class="playing">' + playingNow.map(function (e) {
      return '<div class="noclim">' + ic('play') + esc(e.room && !isGroup(e.s) ? e.room.name : name(e.s)) + ': ' + esc(e.s.attributes.media_title || 'spielt') + '</div>'; }).join('') + '</div>';
    var box = $('music'), fa = document.activeElement, focus = fa && box.contains(fa) && /^(INPUT|SELECT)$/.test(fa.tagName);
    if (!focus) box.innerHTML = html; // nicht neu zeichnen, während getippt oder geschoben wird
  }
  document.addEventListener('change', function (e) {
    if (e.target.matches('[data-speaker]')) { lsSet(LS_SPEAKER, e.target.value); e.target.blur(); queueRender(); }
    if (e.target.matches('[data-spsource]')) { lsSet(LS_SPDEV, e.target.value); var sp = model().spotify; callService('media_player', 'select_source', { source: e.target.value }, { entity_id: sp.entity_id }).catch(function () {}); e.target.blur(); }
  });
  // Lautstärke: Wert sofort anzeigen (Alexa meldet ihn erst nach ~2 s zurück), erst nach kurzer Pause senden
  var volPending = {}, volTimer = null;
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-vol], [data-volset]'); if (!b) return;
    var s = speaker(model().echos); if (!s) return;
    var id = s.s.entity_id, a = s.s.attributes || {};
    var cur = volPending[id] != null ? volPending[id] : Math.round((a.volume_level || 0) * 100);
    var v = b.dataset.volset ? +b.dataset.volset : Math.max(0, Math.min(100, Math.round((cur + +b.dataset.vol) / 5) * 5));
    volPending[id] = v; queueRender();
    clearTimeout(volTimer);
    volTimer = setTimeout(function () {
      callService('media_player', 'volume_set', { volume_level: v / 100 }, { entity_id: id }).catch(function () {})
        .then(function () { setTimeout(function () { delete volPending[id]; queueRender(); }, 3000); });
    }, 500);
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-mp]'); if (!b) return;
    var s = speaker(model().echos); if (!s) return;
    callService('media_player', b.dataset.mp, {}, { entity_id: s.s.entity_id }).catch(function () {});
  });
  // ---------- Spotify-Integration: eigene Playlists über media_player/browse_media ----------
  // Die Wurzel der Spotify-Mediathek enthält „Playlists“ (current_user_playlists); die ID-Form unterscheidet sich je nach HA-Version, daher suchen statt fest verdrahten.
  var spLists = null, spLoading = false;
  function browse(id, item) {
    var msg = { type: 'media_player/browse_media', entity_id: id };
    if (item) { msg.media_content_id = item.media_content_id; msg.media_content_type = item.media_content_type; }
    return send(msg);
  }
  function loadPlaylists(sp) {
    if (spLists || spLoading) return;
    spLoading = true;
    browse(sp.entity_id).then(function (root) {
      var kids = root.children || [];
      var pl = kids.filter(function (c) { return /current_user_playlists$/.test(c.media_content_id || ''); })[0] || kids.filter(function (c) { return /playlist/i.test(c.title || ''); })[0];
      return pl ? browse(sp.entity_id, pl).then(function (r) { return r.children || []; }) : [];
    }).then(function (list) { spLists = list.filter(function (c) { return c.can_play; }); queueRender(); })
      .catch(function () { spLists = []; })
      .then(function () { spLoading = false; });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-plist]'); if (!b) return;
    var m = model(), sp = m.spotify, item = spLists && spLists[+b.dataset.plist]; if (!sp || !item) return;
    var sel = document.querySelector('[data-spsource]'), want = sel && sel.value;
    // Läuft Spotify gerade nirgends, zuerst das gewählte Gerät (z. B. einen Echo) aktivieren
    var pre = want && want !== sp.attributes.source ? callService('media_player', 'select_source', { source: want }, { entity_id: sp.entity_id }) : Promise.resolve();
    pre.then(function () { return callService('media_player', 'play_media', { media_content_id: item.media_content_id, media_content_type: item.media_content_type }, { entity_id: sp.entity_id }); })
      .then(function () { toast(item.title + ' startet' + (want ? ' auf ' + want : '') + ' …'); }).catch(function () {});
  });
  document.addEventListener('submit', function (e) {
    if (!e.target.matches('[data-spotify]')) return;
    e.preventDefault();
    var inp = e.target.querySelector('input'), q = inp.value.trim(), s = speaker(model().echos);
    if (!q || !s) return;
    // Als Sprachbefehl an den Echo, genau wie „Alexa, spiele … auf Spotify“ (der Typ SPOTIFY startet bei Amazon oft nichts mehr)
    var cmd = /spotify/i.test(q) ? q : 'spiele ' + q + ' auf Spotify';
    callService('media_player', 'play_media', { media_content_id: cmd, media_content_type: 'custom' }, { entity_id: s.s.entity_id })
      .then(function () { toast('Spotify startet auf ' + (s.room && !isGroup(s.s) ? s.room.name : name(s.s)) + ' …'); inp.value = ''; inp.blur(); }).catch(function () {});
  });

  // ---------- Einkaufsliste (todo.*; bevorzugt die Alexa-Liste aus der Integration „Alexa Devices“) ----------
  // Änderungen gehen per todo.add_item / update_item / remove_item an HA, die Integration gleicht sie mit Alexa ab.
  var LS_SHOP = 'zuhause-shop-list', shop = { id: null, items: null, stamp: null, loading: false };
  function shopLists(m) {
    var score = function (t) { return (t.platform === 'alexa_devices' ? 2 : 0) + (/einkauf|shopping/i.test(t.s.entity_id + ' ' + name(t.s)) ? 1 : 0); };
    return m.todos.slice().sort(function (a, b) { return score(b) - score(a) || name(a.s).localeCompare(name(b.s), 'de'); });
  }
  function shopList(m) {
    var lists = shopLists(m), want = lsGet(LS_SHOP);
    return lists.filter(function (t) { return t.s.entity_id === want; })[0] || lists[0];
  }
  function loadShop(id) {
    shop.loading = true;
    return send({ type: 'todo/item/list', entity_id: id }).then(function (r) { if (shop.id === id) shop.items = r.items || []; })
      .catch(function () { if (shop.id === id) shop.items = shop.items || []; })
      .then(function () { shop.loading = false; queueRender(); });
  }
  function renderShop(m) {
    var lists = shopLists(m), t = shopList(m), box = $('shop');
    var open = t ? num(t.s) : null;
    $('shopBadge').hidden = !open; $('shopBadge').textContent = open || '';
    if (!t) { box.dataset.key = ''; box.innerHTML = '<div class="empty">Keine Einkaufsliste in Home Assistant gefunden. Richte die Integration „Alexa Devices“ ein, dann erscheint hier die Alexa-Einkaufsliste.</div>'; return; }
    var id = t.s.entity_id;
    if (shop.id !== id) { shop.id = id; shop.items = null; shop.stamp = null; }
    // Neu laden, wenn sich die Liste in HA geändert hat (z. B. „Alexa, setz Milch auf die Einkaufsliste“)
    if (current === 'einkauf' && !shop.loading && shop.stamp !== t.s.last_updated) { shop.stamp = t.s.last_updated; loadShop(id); }
    $('shopCount').textContent = open ? open + ' offen' : '';
    var items = shop.items, todo = (items || []).filter(function (i) { return i.status !== 'completed'; }), done = (items || []).filter(function (i) { return i.status === 'completed'; });
    var row = function (i) {
      var c = i.status === 'completed';
      return '<li class="si' + (c ? ' done' : '') + '"><button type="button" class="chk" data-shopchk="' + esc(i.uid) + '" aria-pressed="' + c + '" aria-label="' + esc(i.summary) + (c ? ' wieder offen' : ' abhaken') + '">' + (c ? ic('check') : '') + '</button>'
        + '<span class="st">' + esc(i.summary) + (i.description ? '<small>' + esc(i.description) + '</small>' : '') + '</span>'
        + '<button type="button" class="icon-btn del" data-shopdel="' + esc(i.uid) + '" aria-label="' + esc(i.summary) + ' entfernen">' + ic('x') + '</button></li>';
    };
    // Kopf (Listenwahl + Eingabe) nur bei Listenwechsel neu bauen, damit das Eingabefeld beim Tippen den Fokus behält
    var head = (lists.length > 1 ? '<div class="mctl"><span class="noclim">Liste</span><select data-shoplist aria-label="Liste wählen">' + lists.map(function (x) { return '<option value="' + esc(x.s.entity_id) + '"' + (x === t ? ' selected' : '') + '>' + esc(name(x.s)) + (x.platform === 'alexa_devices' ? ' (Alexa)' : '') + '</option>'; }).join('') + '</select></div>' : '')
      + '<form class="say" data-shopadd><input type="text" enterkeyhint="done" autocomplete="off" placeholder="Was fehlt?" aria-label="Neuer Eintrag"><button class="btn" type="submit" aria-label="Hinzufügen">' + ic('plus') + '</button></form>'
      + '<div id="shopItems"></div>';
    var key = id + '|' + lists.map(function (x) { return x.s.entity_id + name(x.s); }).join(',');
    if (box.dataset.key !== key || !$('shopItems')) { box.innerHTML = head; box.dataset.key = key; }
    var html = '';
    if (!items) html += '<div class="empty">Lädt …</div>';
    else if (!items.length) html += '<div class="empty">Die Liste ist leer.</div>';
    else {
      html += '<ul class="shoplist">' + todo.map(row).join('') + '</ul>';
      if (done.length) html += '<div class="shopdone"><span class="noclim">Erledigt (' + done.length + ')</span><button type="button" class="btn ghost" data-shopclear>Erledigte löschen</button></div><ul class="shoplist">' + done.map(row).join('') + '</ul>';
    }
    $('shopItems').innerHTML = html;
  }
  function shopItem(uid) { return (shop.items || []).filter(function (i) { return i.uid === uid; })[0]; }
  function shopCall(service, data) {
    return callService('todo', service, data, { entity_id: shop.id }).then(function () { return loadShop(shop.id); }).catch(function () { loadShop(shop.id); });
  }
  document.addEventListener('submit', function (e) {
    if (!e.target.matches('[data-shopadd]')) return;
    e.preventDefault();
    var inp = e.target.querySelector('input'), q = inp.value.trim(); if (!q || !shop.id) return;
    inp.value = '';
    shop.items = (shop.items || []).concat([{ uid: 'neu-' + Date.now(), summary: q, status: 'needs_action' }]); // sofort zeigen
    queueRender();
    shopCall('add_item', { item: q });
    inp.focus(); // für den nächsten Eintrag offen lassen
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-shopchk], [data-shopdel], [data-shopclear]'); if (!b || !shop.id) return;
    if (b.dataset.shopclear != null) { shop.items = (shop.items || []).filter(function (i) { return i.status !== 'completed'; }); queueRender(); return shopCall('remove_completed_items', {}); }
    var it = shopItem(b.dataset.shopchk || b.dataset.shopdel); if (!it) return;
    if (b.dataset.shopdel) { shop.items = shop.items.filter(function (i) { return i !== it; }); queueRender(); return shopCall('remove_item', { item: [it.uid] }); }
    var st = it.status === 'completed' ? 'needs_action' : 'completed';
    it.status = st; queueRender();
    shopCall('update_item', { item: it.uid, status: st });
  });
  document.addEventListener('change', function (e) {
    if (!e.target.matches('[data-shoplist]')) return;
    lsSet(LS_SHOP, e.target.value); e.target.blur(); queueRender();
  });

  // ---------- Saugroboter ----------
  function renderVacuum(m) {
    if (!m.vacuums.length) return;
    var conf = lsGet(LS_CONN) || {}, base = (conf.url || '').replace(/\/+$/, '');
    $('vacCount').textContent = m.vacuums.length > 1 ? m.vacuums.length + ' Geräte' : '';
    var html = m.vacuums.map(function (v) {
      var a = v.attributes || {}, dev = reg(v.entity_id).device, st = v.state;
      var batt = a.battery_level != null ? a.battery_level : num(m.batteries[dev]);
      var busy = st === 'cleaning' || st === 'returning';
      var info = [VAC[st] || st];
      if (batt != null) info.push('Akku ' + Math.round(batt) + ' %');
      if (a.fan_speed) info.push('Saugstufe ' + a.fan_speed);
      if (a.cleaned_area != null && busy) info.push(a.cleaned_area + ' m²');
      if (a.error && a.error !== 'no_error' && st === 'error') info.push(a.error);
      var h = '<div class="vac-top">' + ic('vacuum') + '<div class="txt"><b>' + esc(devName(dev) || name(v)) + '</b><small>' + esc(info.join(' · ')) + '</small></div>'
        + '<span class="pill ' + (st === 'error' ? 'open' : busy ? 'warn' : 'ok') + '">' + esc(VAC[st] || st) + '</span></div>';
      h += '<div class="btnrow">'
        + (st === 'cleaning' ? '<button class="btn" type="button" data-vac="pause" data-id="' + esc(v.entity_id) + '">' + ic('pause') + 'Pause</button>' : '<button class="btn" type="button" data-vac="start" data-id="' + esc(v.entity_id) + '">' + ic('play') + (st === 'paused' ? 'Weiter' : 'Saugen') + '</button>')
        + '<button class="btn ghost" type="button" data-vac="return_to_base" data-id="' + esc(v.entity_id) + '">' + ic('home') + 'Zur Station</button>'
        + '<button class="btn ghost" type="button" data-vac="locate" data-id="' + esc(v.entity_id) + '">Finden</button></div>';
      if ((a.fan_speed_list || []).length) h += '<div class="mctl"><span class="noclim">Saugstufe</span><select data-fan="' + esc(v.entity_id) + '">' + a.fan_speed_list.map(function (f) { return '<option' + (f === a.fan_speed ? ' selected' : '') + '>' + esc(f) + '</option>'; }).join('') + '</select></div>';
      // Raumreinigung (Dreame/Xiaomi: Attribut „rooms“ mit Segment-IDs)
      var segs = vacRooms(a);
      if (segs.length) h += '<div class="fsec' + (isFolded('vac-rooms') ? ' folded' : '') + '" data-fold-sec="vac-rooms"><h3 class="fh">Raum saugen<span class="chev">' + ic('chev') + '</span></h3><div class="scenes room">'
        + segs.map(function (r) { return '<button class="scene" type="button" data-seg="' + esc(r.id) + '" data-id="' + esc(v.entity_id) + '">' + ic('sparkle') + esc(r.name) + '</button>'; }).join('') + '</div></div>';
      var map = m.vacMaps && m.vacMaps[dev];
      if (map && map.attributes.entity_picture) h += '<div class="fsec' + (isFolded('vac-map') ? ' folded' : '') + '" data-fold-sec="vac-map"><h3 class="fh">Karte<span class="chev">' + ic('chev') + '</span></h3><div class="vac-map"><img alt="Karte" loading="lazy" src="' + esc(base + map.attributes.entity_picture) + '"></div></div>';
      return h;
    }).join('<hr style="border:0;border-top:1px solid var(--line);margin:14px 0">');
    var box = $('vac');
    if (!(document.activeElement && box.contains(document.activeElement) && document.activeElement.tagName === 'SELECT')) box.innerHTML = html;
  }
  function vacRooms(a) {
    var r = a.rooms, out = [];
    if (!r) return out;
    var list = Array.isArray(r) ? r : Object.keys(r).map(function (k) { return r[k]; }).reduce(function (acc, x) { return acc.concat(Array.isArray(x) ? x : [x]); }, []);
    list.forEach(function (x) { if (x && x.id != null && x.name) out.push({ id: x.id, name: x.name }); });
    return out;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-vac]');
    if (b) { callService('vacuum', b.dataset.vac, {}, { entity_id: b.dataset.id }).then(function () { toast(b.dataset.vac === 'locate' ? 'Der Sauger meldet sich …' : 'Gesendet.'); }).catch(function () {}); return; }
    var sg = e.target.closest('[data-seg]');
    if (sg) {
      var p = reg(sg.dataset.id).platform || 'dreame_vacuum';
      callService(p, 'vacuum_clean_segment', { segments: [isNaN(+sg.dataset.seg) ? sg.dataset.seg : +sg.dataset.seg] }, { entity_id: sg.dataset.id })
        .then(function () { toast('Saugt jetzt: ' + sg.textContent.trim()); }).catch(function () {});
    }
  });
  document.addEventListener('change', function (e) {
    if (!e.target.matches('[data-fan]')) return;
    callService('vacuum', 'set_fan_speed', { fan_speed: e.target.value }, { entity_id: e.target.dataset.fan }).catch(function () {});
    e.target.blur();
  });

  // ---------- Einklappen: jeder Kasten (data-fold) und Unterbereiche (data-fold-sec) ----------
  function isFolded(k) { var f = lsGet(LS_FOLD) || {}; return !!f[k]; }
  function setFolded(k, v) { var f = lsGet(LS_FOLD) || {}; if (v) f[k] = 1; else delete f[k]; lsSet(LS_FOLD, f); }
  document.querySelectorAll('[data-fold]').forEach(function (box) {
    var head = box.querySelector('.box-head'); if (!head) return;
    head.insertAdjacentHTML('beforeend', '<span class="chev" aria-hidden="true">' + ic('chev') + '</span>');
    head.setAttribute('role', 'button'); head.tabIndex = 0;
    box.classList.toggle('folded', isFolded(box.dataset.fold));
    head.setAttribute('aria-expanded', !isFolded(box.dataset.fold));
  });
  function toggleFold(e) {
    if (document.body.classList.contains('arrange') || boardLong) { boardLong = false; return; }
    if (e.target.closest('button:not(.box-head):not(.acc-h), a, select, input')) return;
    var head = e.target.closest('[data-fold] > .box-head, [data-fold-sec] > .fh'); if (!head) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    if (e.type === 'keydown') e.preventDefault();
    var box = head.parentNode, k = box.dataset.fold || box.dataset.foldSec, v = !box.classList.contains('folded');
    box.classList.toggle('folded', v); setFolded(k, v); head.setAttribute('aria-expanded', !v);
  }
  document.addEventListener('click', toggleFold);
  document.addEventListener('keydown', toggleFold);

  function sceneIcon(n) {
    n = n.toLowerCase();
    if (/morgen|wach|energ|konzentr|hell/.test(n)) return ic('sun');
    if (/abend|entspann|gemüt/.test(n)) return ic('sunset');
    if (/film|kino|tv|fernseh/.test(n)) return ic('film');
    if (/nacht|schlaf|nachtlicht|rot/.test(n)) return ic('moon');
    if (/lesen/.test(n)) return ic('book');
    return ic('sparkle');
  }

  function deviceProblems(m) {
    // Geräte, deren Hauptentitäten alle offline sind (Lampen, Sensoren, Kameras)
    var byDev = {};
    Object.keys(S).forEach(function (id) {
      var e = reg(id), dom = id.split('.')[0];
      if (!e.device || !primary(id) || !/^(light|sensor|binary_sensor|camera)$/.test(dom)) return;
      var d = byDev[e.device] || (byDev[e.device] = { ok: 0, bad: 0 });
      if (S[id].state === 'unavailable') d.bad++; else d.ok++;
    });
    return Object.keys(byDev).filter(function (d) { return byDev[d].bad && !byDev[d].ok; }).map(devName).filter(Boolean);
  }

  function spark(pts) {
    var w = 100, h = 40, t1 = Date.now(), t0 = t1 - 12 * 3600000;
    var vals = pts.map(function (p) { return p[1]; });
    var min = Math.min.apply(null, vals) - .3, max = Math.max.apply(null, vals) + .3;
    var xy = pts.map(function (p) { return [Math.max(0, (p[0] - t0) / (t1 - t0)) * w, h - 4 - (p[1] - min) / (max - min) * (h - 8)]; });
    xy.push([w, xy[xy.length - 1][1]]);
    var line = xy.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    var last = xy[xy.length - 1];
    return '<svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">'
      + '<polygon points="' + xy[0][0].toFixed(1) + ',40 ' + line + ' 100,40" fill="currentColor" opacity=".12"></polygon>'
      + '<polyline points="' + line + '" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"></polyline>'
      + '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.5" fill="currentColor"></circle></svg>';
  }

  function renderRooms(m) {
    var tiles = $('roomTiles'), det = $('roomDetail');
    if (!m.rooms.length) { tiles.innerHTML = ''; det.innerHTML = '<div class="box empty">Keine Bereiche in Home Assistant gefunden.</div>'; return; }
    var sel = lsGet(LS_ROOM);
    var r = m.rooms.filter(function (x) { return x.id === sel; })[0] || m.rooms[0];
    tiles.innerHTML = m.rooms.map(function (x) {
      var open = x.contacts.filter(function (c) { return c.s.state === 'on'; }).length;
      var on = x.lights.filter(function (l) { return l.s.state === 'on'; }).length;
      var t = num(x.temp), heat = x.climates.some(function (c) { return c.s.attributes.hvac_action === 'heating'; });
      var bits = [];
      if (open) bits.push('offen');
      if (t != null) bits.push(fmt1(t) + '°');
      if (heat) bits.push('heizt');
      if (on) bits.push(on + ' an');
      return '<button class="rtile' + (open ? ' alert' : '') + '" type="button" data-room="' + esc(x.id) + '" aria-pressed="' + (x === r) + '">' + ic(x.icon) + '<b>' + esc(x.name) + '</b><small>' + (bits.join(' · ') || '&nbsp;') + '</small></button>';
    }).join('');
    det.innerHTML = '';
    det.appendChild(roomCard(r, m));
  }

  function roomCard(r, m) {
    var c = document.createElement('section');
    var anyOpen = r.contacts.some(function (x) { return x.s.state === 'on'; });
    var bare = !r.lights.length && !r.temp && !r.hum && !r.contacts.length && !r.motions.length && !r.cams.length && !Object.keys(r.buttons).length && !r.echos.length && !r.climates.length;
    c.className = 'box room-card' + (anyOpen ? ' alert' : '');
    var html = '<div class="room-head"><h2>' + ic(r.icon) + esc(r.name) + '</h2>'
      + (r.echos.length ? '<span class="pill info">Echo</span>' : '') + '</div>';
    if (bare) { c.innerHTML = html + '<div class="noclim">Noch keine Geräte in diesem Raum.</div>'; return c; }

    var t = num(r.temp), h = num(r.hum);
    if (t != null || h != null) {
      var k = t == null ? '' : t >= 23 ? 'warm' : t < 19 ? 'cold' : '';
      html += '<div class="clim ' + k + '"><div>' + (t != null ? '<div class="t">' + fmt1(t) + '<small> °C</small></div>' : '')
        + '</div>' + (h != null ? '<div class="h' + (tooWet(m, r) ? ' wet' : '') + '">' + Math.round(h) + ' % Feuchte' + (tooWet(m, r) ? ' · Lüften' : '') + '</div>' : '') + '</div>';
      var ids = [r.temp, r.hum].filter(Boolean).map(function (x) { return x.entity_id; });
      html += '<div class="fsec' + (isFolded('room-charts') ? ' folded' : '') + '" data-fold-sec="room-charts"><h3 class="fh">Verlauf<span class="chev">' + ic('chev') + '</span></h3>' + rangeChips('room') + chartsFor(ids, 'room', function (id) { return id === (r.temp && r.temp.entity_id) ? { title: 'Temperatur', unit: '°C', col: 'var(--p1)', dec: 1 } : { title: 'Luftfeuchte', unit: '%', col: 'var(--cool)', dec: 0 }; }) + '</div>';
    } else if (r.temp) {
      html += '<div class="noclim">' + ic('thermo') + esc(name(r.temp)) + ': nicht erreichbar</div>';
    }
    if (r.climates.length) html += '<div class="heat-list">' + r.climates.map(function (x) { return heatRow(x.s, r.name); }).join('') + '</div>';
    r.contacts.forEach(function (ct) {
      var s = ct.s, isOpen = s.state === 'on', off = unavailable(s);
      var b = num(m.batteries[reg(s.entity_id).device]);
      html += '<div class="contact' + (isOpen ? ' open' : '') + '">' + ic(isDoor(s) ? 'door' : 'window') + '<div class="txt"><b>' + esc(name(s)) + '</b><small>'
        + (off ? 'nicht erreichbar' : (isOpen ? 'offen seit ' + timeText(s.last_changed) + ' · ' + ago(s.last_changed) : 'zu seit ' + timeText(s.last_changed))) + '</small></div>'
        + (b != null ? '<span class="batt' + (b < 20 ? ' low' : '') + '">Batterie ' + Math.round(b) + ' %</span>' : '')
        + '<span class="pill ' + (off ? 'warn' : isOpen ? 'open' : 'ok') + '">' + (off ? '?' : isOpen ? 'Offen' : 'Zu') + '</span></div>';
    });
    r.motions.forEach(function (s) {
      var on = s.state === 'on';
      html += '<div class="contact' + (on ? ' active' : '') + '">' + ic('walk') + '<div class="txt"><b>' + esc(name(s)) + '</b><small>'
        + (unavailable(s) ? 'nicht erreichbar' : on ? 'Bewegung seit ' + timeText(s.last_changed) : 'zuletzt ' + timeText(s.last_changed) + ' · vor ' + ago(s.last_changed)) + '</small></div>'
        + '<span class="pill ' + (on ? 'warn' : 'ok') + '">' + (on ? 'Bewegung' : 'ruhig') + '</span></div>';
    });
    Object.keys(r.buttons).forEach(function (d) {
      var s = r.buttons[d];
      html += '<div class="noclim">' + ic('remote') + esc(devName(d)) + (unavailable(s) ? '' : ' · zuletzt ' + timeText(s.state)) + '</div>';
    });
    if (r.cams.length) html += '<div class="noclim">' + ic('camera') + esc(r.cams.map(function (x) { return name(x.s); }).join(', ')) + '</div>';
    if (r.scenes.length) html += '<div class="fsec' + (isFolded('room-scenes') ? ' folded' : '') + '" data-fold-sec="room-scenes"><h3 class="fh">Szenen<span class="chev">' + ic('chev') + '</span></h3><div class="scenes room">' + r.scenes.map(function (sc) {
      var n = shortName(sc.s, r.name);
      return '<button class="scene" type="button" data-scene="' + esc(sc.s.entity_id) + '">' + sceneIcon(n) + esc(n) + '</button>';
    }).join('') + '</div></div>';
    c.innerHTML = html;
    if (r.lights.length) {
      var fs = document.createElement('div'); fs.className = 'fsec' + (isFolded('room-lights') ? ' folded' : ''); fs.dataset.foldSec = 'room-lights';
      fs.innerHTML = '<h3 class="fh">Lichter<span class="chev">' + ic('chev') + '</span></h3>';
      var g = document.createElement('div'); g.className = 'room-lights';
      r.lights.forEach(function (l) { g.appendChild(lightBtn(l, true)); });
      fs.appendChild(g); c.appendChild(fs);
    }
    return c;
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-room]'); if (!t) return;
    lsSet(LS_ROOM, t.dataset.room); queueRender();
  });

  // ---------- Wohnungs-Übersichten (Kacheln oben) ----------
  var detailKey = 'lights', accOpen = {};
  function renderDetail(m) {
    var el = $('detail'), html = '';
    if (detailKey === 'lichter') {
      var on = m.lights.filter(function (l) { return l.s.state === 'on'; }).length;
      html = '<section class="box"><div class="box-head"><h2>' + ic('bulb') + 'Licht in der Wohnung</h2><span class="count">' + on + ' von ' + m.lights.length + ' an</span></div><div class="btnrow" style="margin-top:0"><button class="btn ghost small" type="button" data-allon>Alle an</button><button class="btn ghost small" type="button" data-roomlights="__all">Alle aus</button></div></section>';
      // Lieblingsszenen (früher auf der Startseite), Auswahl und Reihenfolge nur auf diesem Gerät
      html += '<section class="box"><div class="box-head"><h2>' + ic('sparkle') + 'Szenen</h2><button class="link-btn" type="button" data-favedit>Bearbeiten</button></div><div class="scenes">'
        + (favScenes().map(function (id) {
          if (id === '__off') return '<button class="scene off" type="button" data-scene="__off">' + ic('power') + 'Alles aus</button>';
          return '<button class="scene" type="button" data-scene="' + esc(id) + '">' + sceneIcon(name(S[id])) + esc(name(S[id])) + '</button>';
        }).join('') || '<div class="empty">Keine Szenen gewählt.</div>') + '</div></section>';
      el.innerHTML = html;
      m.rooms.filter(function (r) { return r.lights.length; }).forEach(function (r) {
        var n = r.lights.filter(function (l) { return l.s.state === 'on'; }).length;
        var box = document.createElement('section'); box.className = 'box';
        box.innerHTML = '<div class="box-head"><h2>' + ic(r.icon) + esc(r.name) + '</h2><button class="link-btn" type="button" data-roomlights="' + esc(r.id) + '" data-on="' + (n ? 0 : 1) + '">' + (n ? n + ' an · ausschalten' : 'einschalten') + '</button></div>';
        var g = document.createElement('div'); g.className = 'room-lights';
        r.lights.forEach(function (l) { g.appendChild(lightBtn(l, true)); });
        box.appendChild(g); el.appendChild(box);
      });
      return;
    }
    if (detailKey === 'fenster') {
      var cs = m.contacts.slice().sort(function (a, b) { return (b.s.state === 'on') - (a.s.state === 'on'); });
      var open = cs.filter(function (c) { return c.s.state === 'on'; }).length;
      html = '<section class="box"><div class="box-head"><h2>' + ic('window') + 'Fenster und Türen</h2><span class="count">' + (cs.length ? open + ' offen' : '') + '</span></div><div class="dlist" style="display:grid;gap:8px">'
        + (cs.length ? cs.map(function (c) {
          var s = c.s, isOpen = s.state === 'on', off = unavailable(s), b = num(m.batteries[reg(s.entity_id).device]);
          return '<div class="contact' + (isOpen ? ' open' : '') + '">' + ic(isDoor(s) ? 'door' : 'window') + '<div class="txt"><b>' + esc(name(s)) + '</b><small>' + esc(c.room ? c.room.name + ' · ' : '')
            + (off ? 'nicht erreichbar' : (isOpen ? 'offen seit ' + timeText(s.last_changed) + ' · ' + ago(s.last_changed) : 'zu seit ' + timeText(s.last_changed))) + '</small></div>'
            + (b != null ? '<span class="batt' + (b < 20 ? ' low' : '') + '">Batterie ' + Math.round(b) + ' %</span>' : '')
            + '<span class="pill ' + (off ? 'warn' : isOpen ? 'open' : 'ok') + '">' + (off ? '?' : isOpen ? 'Offen' : 'Zu') + '</span></div>';
        }).join('') : '<div class="empty">Noch keine Tür-/Fenstersensoren in Home Assistant. Sobald die Aqara-Kontakte angelernt sind, erscheinen sie hier.</div>')
        + '</div></section>';
      el.innerHTML = html; return;
    }
    // Klima: alle Räume untereinander, Antippen klappt Temperatur- und Feuchteverlauf auf
    var rooms = m.rooms.filter(function (r) { return r.temp || r.hum; });
    var ts = rooms.map(function (r) { return num(r.temp); }).filter(function (v) { return v != null; });
    var hs = rooms.map(function (r) { return num(r.hum); }).filter(function (v) { return v != null; });
    var avg = function (a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; };
    html = '<section class="box"><div class="box-head"><h2>' + ic('thermo') + 'Klima in der Wohnung</h2><span class="count">Ø ' + (ts.length ? fmt1(avg(ts)) + ' °C' : '–') + ' · ' + (hs.length ? Math.round(avg(hs)) + ' %' : '–') + '</span></div>'
      + rangeChips('flat') + '<div style="margin-top:12px">';
    rooms.forEach(function (r) {
      var t = num(r.temp), h = num(r.hum), isOpen = !!accOpen[r.id];
      html += '<div class="acc"><button class="acc-h" type="button" data-acc="' + esc(r.id) + '" aria-expanded="' + isOpen + '">' + ic(r.icon) + '<span class="txt"><b>' + esc(r.name) + '</b><small>'
        + (isOpen ? 'Verlauf ' + RANGES[rangeOf('flat')].label : 'Verlauf anzeigen') + '</small></span><span class="vals">' + (t != null ? '<span>' + fmt1(t) + '°</span>' : '') + (h != null ? '<span class="h' + (tooWet(m, r) ? ' wet' : '') + '">' + Math.round(h) + ' %</span>' : '') + '</span><span class="chev" aria-hidden="true">' + ic('chev') + '</span></button>';
      if (isOpen) {
        var ids = [r.temp && r.temp.entity_id, r.hum && r.hum.entity_id].filter(Boolean), data = loadSeries(ids, rangeOf('flat'));
        html += '<div class="acc-b">';
        if (!data) html += '<div class="cload">Verlauf wird geladen …</div>';
        else {
          if (r.temp) html += chart(data[r.temp.entity_id] || [], rangeOf('flat'), { title: 'Temperatur', unit: '°C', col: 'var(--p1)', dec: 1 });
          if (r.hum) html += chart(data[r.hum.entity_id] || [], rangeOf('flat'), { title: 'Luftfeuchte', unit: '%', col: 'var(--cool)', dec: 0 });
        }
        html += '</div>';
      }
      html += '</div>';
    });
    el.innerHTML = html + '</div></section>';
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-acc]');
    if (a) { accOpen[a.dataset.acc] = !accOpen[a.dataset.acc]; queueRender(); return; }
    var d = e.target.closest('[data-detail]');
    if (d) { go(d.dataset.detail === 'open' ? 'fenster' : d.dataset.detail === 'lights' ? 'lichter' : 'klima'); return; }
    var rl = e.target.closest('[data-roomlights]');
    if (rl) {
      var m = model(), ls = rl.dataset.roomlights === '__all' ? m.lights : (m.rooms.filter(function (r) { return r.id === rl.dataset.roomlights; })[0] || { lights: [] }).lights;
      var turnOn = rl.dataset.on === '1';
      var ids = ls.filter(function (l) { return !unavailable(l.s) && (turnOn ? l.s.state !== 'on' : l.s.state === 'on'); }).map(function (l) { return l.s.entity_id; });
      if (ids.length) callService('light', turnOn ? 'turn_on' : 'turn_off', {}, { entity_id: ids }).catch(function () {});
      return;
    }
    if (e.target.closest('[data-allon]')) {
      var off = model().lights.filter(function (l) { return !unavailable(l.s) && l.s.state !== 'on'; }).map(function (l) { return l.s.entity_id; });
      if (off.length) callService('light', 'turn_on', {}, { entity_id: off }).catch(function () {});
    }
  });

  // ---------- Verläufe (Temperatur, Feuchte, Pi) ----------
  var statCache = {}, statLoading = {}, chartData = {}, chartSeq = 0;
  function rangeOf(ctx) { var r = lsGet(LS_RANGE + ctx); return RANGES[r] ? r : '24h'; }
  function rangeChips(ctx) {
    var cur = rangeOf(ctx);
    return '<div class="ranges">' + Object.keys(RANGES).map(function (k) {
      return '<button class="chip" type="button" data-range-ctx="' + ctx + '" data-range-v="' + k + '" aria-pressed="' + (k === cur) + '">' + RANGES[k].label + '</button>';
    }).join('') + '</div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-range-v]'); if (!b) return;
    lsSet(LS_RANGE + b.dataset.rangeCtx, b.dataset.rangeV); queueRender();
  });

  // Holt Mittel-, Min- und Maxwerte aus der HA-Langzeitstatistik; ohne Statistik (kein state_class) aus dem Verlauf
  function loadSeries(ids, range) {
    var key = range + '|' + ids.join(',');
    var c = statCache[key];
    if (c && Date.now() - c.at < 5 * 60000) return c.data;
    if (statLoading[key]) return c ? c.data : null;
    statLoading[key] = true;
    var R = RANGES[range], start = new Date(Date.now() - R.ms).toISOString();
    var toMs = function (v) { return typeof v === 'number' ? v : new Date(v).getTime(); };
    send({ type: 'recorder/statistics_during_period', start_time: start, statistic_ids: ids, period: R.period, types: ['mean', 'min', 'max'], units: {} })
      .then(function (res) {
        var data = {}, missing = [];
        ids.forEach(function (id) {
          var rows = (res[id] || []).filter(function (p) { return p.mean != null; });
          if (rows.length > 1) data[id] = rows.map(function (p) { return { t: toMs(p.start), v: p.mean, lo: p.min, hi: p.max }; });
          else missing.push(id);
        });
        if (!missing.length) return data;
        return send({ type: 'history/history_during_period', start_time: start, entity_ids: missing, minimal_response: true, no_attributes: true, significant_changes_only: false })
          .then(function (h) {
            missing.forEach(function (id) {
              data[id] = (h[id] || []).map(function (p) { return { t: p.lu * 1000, v: parseFloat(p.s) }; }).filter(function (p) { return isFinite(p.v); });
            });
            return data;
          });
      })
      .then(function (data) { statCache[key] = { at: Date.now(), data: data }; })
      .catch(function () { statCache[key] = { at: Date.now(), data: {} }; })
      .then(function () { delete statLoading[key]; queueRender(); });
    return c ? c.data : null;
  }

  function chartsFor(ids, ctx, meta) {
    var range = rangeOf(ctx), data = loadSeries(ids, range);
    if (!data) return '<div class="cload">Verlauf wird geladen …</div>';
    return ids.map(function (id) { return chart(data[id] || [], range, meta(id)); }).join('');
  }

  // Ein Messwert pro Diagramm (eine Achse), Band = Min/Max des Zeitabschnitts, Fadenkreuz mit Tooltip
  function chart(pts, range, o) {
    if (pts.length < 2) return '<div class="chart"><h4>' + esc(o.title) + '</h4><div class="cload">Noch keine Daten für diesen Zeitraum.</div></div>';
    var t1 = Date.now(), t0 = t1 - RANGES[range].ms;
    var lo = Infinity, hi = -Infinity;
    pts.forEach(function (p) { lo = Math.min(lo, p.lo != null ? p.lo : p.v); hi = Math.max(hi, p.hi != null ? p.hi : p.v); });
    if (o.lo != null && isFinite(o.lo)) { lo = Math.min(lo, o.lo); hi = Math.max(hi, o.hi); }
    var pad = Math.max((hi - lo) * 0.12, o.unit === '%' ? 2 : 0.3); lo -= pad; hi += pad;
    var X = function (t) { return Math.max(0, Math.min(100, (t - t0) / (t1 - t0) * 100)); };
    var Y = function (v) { return (hi - v) / (hi - lo) * 100; };
    var line = pts.map(function (p) { return X(p.t).toFixed(2) + ',' + Y(p.v).toFixed(2); }).join(' ');
    var band = '';
    if (pts[0].lo != null) band = '<polygon points="' + pts.map(function (p) { return X(p.t).toFixed(2) + ',' + Y(p.hi).toFixed(2); }).join(' ') + ' '
      + pts.slice().reverse().map(function (p) { return X(p.t).toFixed(2) + ',' + Y(p.lo).toFixed(2); }).join(' ') + '" fill="' + o.col + '" opacity=".14"></polygon>';
    var ticks = [hi - pad, (hi + lo) / 2, lo + pad];
    var f = function (v) { return o.dec ? fmt1(v) : String(Math.round(v)); };
    var id = 'c' + (++chartSeq);
    chartData[id] = { pts: pts, X: X, Y: Y, o: o, range: range, f: f };
    var vals = pts.map(function (p) { return p.v; });
    var xl = range === '24h' ? function (t) { return new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }
      : function (t) { return new Date(t).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' }); };
    return '<div class="chart" style="--cc:' + o.col + '"><h4>' + esc(o.title) + '<span>Ø ' + f(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length) + ' ' + o.unit
      + ' · ' + f(Math.min.apply(null, vals)) + '–' + f(Math.max.apply(null, vals)) + ' ' + o.unit + '</span></h4>'
      + '<div class="cgrid"><div class="yax">' + ticks.map(function (v) { return '<span style="top:' + Y(v) + '%">' + f(v) + '</span>'; }).join('') + '</div>'
      + '<div class="plot" data-chart="' + id + '">' + ticks.map(function (v) { return '<div class="gl" style="top:' + Y(v) + '%"></div>'; }).join('')
      + '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + band
      + '<polyline points="' + line + '" fill="none" stroke="' + o.col + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline></svg></div>'
      + '<div class="xax"><span>' + xl(t0) + '</span><span>' + xl((t0 + t1) / 2) + '</span><span>jetzt</span></div></div></div>';
  }
  function chartHover(plot, clientX) {
    var d = chartData[plot.dataset.chart]; if (!d) return;
    var rect = plot.getBoundingClientRect(), x = (clientX - rect.left) / rect.width * 100;
    var best = d.pts[0];
    d.pts.forEach(function (p) { if (Math.abs(d.X(p.t) - x) < Math.abs(d.X(best.t) - x)) best = p; });
    var px = d.X(best.t), py = d.Y(best.v);
    var when = d.range === '30d' ? new Date(best.t).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' })
      : new Date(best.t).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    var txt = when + ' · ' + d.f(best.v) + ' ' + d.o.unit + (best.lo != null && d.range !== '24h' ? ' (' + d.f(best.lo) + '–' + d.f(best.hi) + ')' : '');
    var xh = plot.querySelector('.xh') || plot.appendChild(Object.assign(document.createElement('div'), { className: 'xh' }));
    var xd = plot.querySelector('.xd') || plot.appendChild(Object.assign(document.createElement('div'), { className: 'xd' }));
    var tip = plot.querySelector('.tip') || plot.appendChild(Object.assign(document.createElement('div'), { className: 'tip' }));
    xh.style.left = px + '%'; xd.style.left = px + '%'; xd.style.top = py + '%';
    tip.textContent = txt; tip.style.left = Math.max(18, Math.min(82, px)) + '%';
  }
  function chartLeave(plot) { plot.querySelectorAll('.xh,.xd,.tip').forEach(function (n) { n.remove(); }); }
  document.addEventListener('pointermove', function (e) { var p = e.target.closest('.plot'); if (p) chartHover(p, e.clientX); });
  document.addEventListener('pointerdown', function (e) { var p = e.target.closest('.plot'); if (p) chartHover(p, e.clientX); });
  document.addEventListener('pointerout', function (e) { var p = e.target.closest && e.target.closest('.plot'); if (p && !p.contains(e.relatedTarget)) chartLeave(p); });

  // ---------- Wetter ----------
  function renderWeather(m) {
    var w = m.weather;
    $('weatherBox').hidden = !w;
    if (!w) return;
    if (weatherSubbed !== ws) subscribeWeather();
    var a = w.attributes || {}, c = WEATHER[w.state] || ['🌡️', w.state];
    var today = forecast[0];
    var r = function (v) { return v == null ? '–' : Math.round(v); };
    var html = '<div class="wnow"><span class="wi" aria-hidden="true">' + c[0] + '</span><span class="wt">' + r(a.temperature) + '°</span><div class="wd"><b>' + esc(c[1]) + '</b><small>'
      + (today ? 'heute ' + r(today.templow) + '° bis ' + r(today.temperature) + '°' + (today.precipitation ? ' · ' + fmt1(today.precipitation) + ' mm' : '') + ' · ' : '')
      + (a.humidity != null ? '💧 ' + r(a.humidity) + ' %' : '') + (a.wind_speed != null ? ' · 💨 ' + r(a.wind_speed) + ' ' + esc(a.wind_speed_unit || 'km/h') : '') + '</small></div></div>';
    var days = forecast.slice(1, 6);
    if (days.length) html += '<div class="wdays">' + days.map(function (d) {
      var dc = WEATHER[d.condition] || ['🌡️', ''];
      return '<div class="wday" title="' + esc(dc[1]) + '"><span>' + new Date(d.datetime).toLocaleDateString('de-DE', { weekday: 'short' }) + '</span><i aria-hidden="true">' + dc[0] + '</i><b>' + r(d.temperature) + '°</b> <small>' + r(d.templow) + '°</small>'
        + (d.precipitation ? '<em>' + fmt1(d.precipitation) + ' mm</em>' : '') + '</div>';
    }).join('') + '</div>';
    $('weather').innerHTML = html;
  }

  // ---------- Automationen ein/aus und ihre Einstellungen (Helfer input_*) ----------
  // Gruppe = Text vor dem Doppelpunkt im Namen, z. B. „Lüften: Feuchte-Grenze“ gehört zu „Lüften: Hinweis bei hoher Feuchte“
  var autoDesc = {};
  function splitName(s) {
    var n = name(s), i = n.indexOf(':');
    return i > 0 ? { g: n.slice(0, i).trim(), n: n.slice(i + 1).trim() } : { g: '', n: n };
  }
  function helperCtl(s) {
    var d = s.entity_id.split('.')[0], a = s.attributes || {}, id = esc(s.entity_id), off = unavailable(s);
    var dis = off ? ' disabled' : '', lbl = ' aria-label="' + esc(name(s)) + '"';
    if (d === 'input_boolean') return { ctl: '<button class="tgl" type="button" role="switch" aria-checked="' + (s.state === 'on') + '" data-hlp="' + id + '"' + dis + lbl + '></button>' };
    if (d === 'input_select') return { ctl: '<select data-hlp="' + id + '"' + dis + lbl + '>' + (a.options || []).map(function (o) { return '<option' + (o === s.state ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>' };
    if (d === 'input_text') return { ctl: '<input type="text" data-hlp="' + id + '" value="' + esc(s.state) + '" maxlength="' + (a.max || 100) + '"' + dis + lbl + '>' };
    if (d === 'input_datetime') {
      var t = (s.state || '').split(' '), date = a.has_date ? t[0] : '', time = a.has_time ? (a.has_date ? t[1] : t[0]) : '';
      return { ctl: (a.has_date ? '<input type="date" data-hlp="' + id + '" data-part="date" value="' + esc(date) + '"' + dis + lbl + '>' : '')
        + (a.has_time ? '<input type="time" data-hlp="' + id + '" data-part="time" value="' + esc((time || '').slice(0, 5)) + '"' + dis + lbl + '>' : '') };
    }
    // input_number: − Wert + und darunter ein Schieberegler
    var v = num(s), step = a.step || 1, dec = (String(step).split('.')[1] || '').length, unit = a.unit_of_measurement ? ' ' + esc(a.unit_of_measurement) : '';
    var shown = v == null ? '–' : v.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + unit;
    return {
      ctl: '<span class="stepper"><button type="button" data-num="' + id + '" data-d="-1" aria-label="weniger"' + dis + '>−</button><span class="numv" aria-live="polite">' + shown + '</span><button type="button" data-num="' + id + '" data-d="1" aria-label="mehr"' + dis + '>+</button></span>',
      below: '<input class="range" type="range" data-hlp="' + id + '" min="' + a.min + '" max="' + a.max + '" step="' + step + '" value="' + (v == null ? a.min : v) + '"' + dis + lbl + '>'
    };
  }
  function renderAutos(m) {
    var el = $('auto'), fa = document.activeElement;
    // nicht neu zeichnen, während jemand gerade tippt oder schiebt
    if (fa && el.contains(fa) && /^(INPUT|SELECT)$/.test(fa.tagName)) return;
    if (!m.autos.length && !m.helpers.length && !m.scripts.length) { el.innerHTML = '<section class="box empty">Noch keine Automationen in Home Assistant.</section>'; return; }
    var groups = {}, order = [];
    function grp(g) { if (!groups[g]) { groups[g] = { autos: [], scripts: [], helpers: [] }; order.push(g); } return groups[g]; }
    m.autos.slice().sort(function (a, b) { return name(a).localeCompare(name(b), 'de'); }).forEach(function (s) { grp(splitName(s).g).autos.push(s); });
    m.scripts.slice().sort(function (a, b) { return name(a).localeCompare(name(b), 'de'); }).forEach(function (s) { grp(splitName(s).g).scripts.push(s); });
    m.helpers.slice().sort(function (a, b) { return name(a).localeCompare(name(b), 'de'); }).forEach(function (s) { grp(splitName(s).g).helpers.push(s); });
    order.sort(function (a, b) { return (!a) - (!b) || a.localeCompare(b, 'de'); });
    var on = m.autos.filter(function (s) { return s.state === 'on'; }).length;
    var html = '<section class="box"><div class="box-head"><h2>' + ic('auto') + 'Automationen</h2><span class="count">' + on + ' von ' + m.autos.length + ' aktiv</span></div>'
      + '<p class="hint" style="margin:0">Ausgeschaltete Automationen laufen nicht mehr, bis du sie wieder einschaltest. Werte darunter gelten sofort.</p></section>';
    order.forEach(function (g) {
      var G = groups[g];
      html += '<section class="box"><div class="box-head"><h2>' + esc(g || (G.autos.length || G.scripts.length ? 'Weitere Automationen' : 'Weitere Einstellungen')) + '</h2></div>';
      G.autos.forEach(function (s) {
        var a = s.attributes || {}, isOn = s.state === 'on', off = unavailable(s), sub = [];
        if (autoDesc[s.entity_id] === undefined && a.id) {
          autoDesc[s.entity_id] = '';
          send({ type: 'automation/config', entity_id: s.entity_id }).then(function (r) { var c = r && (r.config || r); autoDesc[s.entity_id] = (c && c.description) || ''; if (autoDesc[s.entity_id]) queueRender(); }).catch(function () {});
        }
        if (autoDesc[s.entity_id]) sub.push(esc(autoDesc[s.entity_id]));
        sub.push(off ? 'nicht verfügbar' : a.last_triggered ? 'zuletzt ausgelöst ' + esc(timeText(a.last_triggered)) : 'noch nie ausgelöst');
        html += '<div class="arow' + (isOn ? '' : ' off') + '"><div class="txt"><b>' + esc(g ? splitName(s).n : name(s)) + '</b><small>' + sub.join('<br>') + '</small></div>'
          + '<button class="tgl" type="button" role="switch" aria-checked="' + isOn + '" data-auto="' + esc(s.entity_id) + '" aria-label="' + esc(name(s)) + (isOn ? ' ausschalten' : ' einschalten') + '"' + (off ? ' disabled' : '') + '></button></div>';
      });
      G.scripts.forEach(function (s) {
        var run = s.state === 'on', off = unavailable(s), a = s.attributes || {};
        html += '<div class="arow"><div class="txt"><b>' + esc(g ? splitName(s).n : name(s)) + '</b><small>' + (run ? 'läuft gerade' : a.last_triggered ? 'zuletzt ' + esc(timeText(a.last_triggered)) : 'Ablauf auf Knopfdruck') + '</small></div>'
          + '<button class="btn small" type="button" data-script="' + esc(s.entity_id) + '"' + (off || run ? ' disabled' : '') + '>Ausführen</button></div>';
      });
      if (G.helpers.length && (G.autos.length || G.scripts.length)) html += '<h3 class="agrp">Einstellungen</h3>';
      G.helpers.forEach(function (s) {
        var c = helperCtl(s);
        html += '<div class="arow" style="flex-wrap:wrap"><div class="txt"><b>' + esc(g ? splitName(s).n : name(s)) + '</b></div><div class="ctl">' + c.ctl + '</div>' + (c.below ? c.below : '') + '</div>';
      });
      html += '</section>';
    });
    el.innerHTML = html;
  }
  function setHelper(id, val, part) {
    var d = id.split('.')[0], s = S[id] || {}, a = s.attributes || {};
    if (d === 'input_number') return callService('input_number', 'set_value', { value: val }, { entity_id: id });
    if (d === 'input_select') return callService('input_select', 'select_option', { option: val }, { entity_id: id });
    if (d === 'input_text') return callService('input_text', 'set_value', { value: val }, { entity_id: id });
    if (d === 'input_datetime') {
      if (!val) return;
      if (a.has_date && a.has_time) {
        var t = (s.state || '').split(' '), date = part === 'date' ? val : t[0], time = part === 'time' ? val + ':00' : t[1];
        return callService('input_datetime', 'set_datetime', { datetime: date + ' ' + time }, { entity_id: id });
      }
      return callService('input_datetime', 'set_datetime', part === 'date' ? { date: val } : { time: val + ':00' }, { entity_id: id });
    }
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-auto]');
    if (t) { var isOn = t.getAttribute('aria-checked') === 'true'; t.setAttribute('aria-checked', !isOn); callService('automation', isOn ? 'turn_off' : 'turn_on', {}, { entity_id: t.dataset.auto }); return; }
    var sc = e.target.closest('[data-script]');
    if (sc) { callService('script', 'turn_on', {}, { entity_id: sc.dataset.script }).then(function () { toast('Gestartet'); }); return; }
    var b = e.target.closest('.tgl[data-hlp]');
    if (b) { b.setAttribute('aria-checked', b.getAttribute('aria-checked') !== 'true'); callService('input_boolean', 'toggle', {}, { entity_id: b.dataset.hlp }); return; }
    var n = e.target.closest('[data-num]');
    if (n) {
      var s = S[n.dataset.num], a = s.attributes, step = a.step || 1, v = num(s);
      v = Math.min(a.max, Math.max(a.min, Math.round(((v == null ? a.min : v) + step * n.dataset.d) / step) * step));
      setHelper(n.dataset.num, +v.toFixed(6));
    }
  });
  document.addEventListener('input', function (e) {
    var r = e.target.closest('.range[data-hlp]'); if (!r) return;
    var s = S[r.dataset.hlp], a = s.attributes || {}, dec = (String(a.step || 1).split('.')[1] || '').length;
    r.parentNode.querySelector('.numv').textContent = (+r.value).toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (a.unit_of_measurement ? ' ' + a.unit_of_measurement : '');
  });
  document.addEventListener('change', function (e) {
    var h = e.target.closest('#auto [data-hlp]'); if (!h || h.classList.contains('tgl')) return;
    var val = h.type === 'range' ? +h.value : h.value;
    Promise.resolve(setHelper(h.dataset.hlp, val, h.dataset.part)).then(function () { h.blur(); toast('Gespeichert'); }).catch(function () { h.blur(); queueRender(); });
  });

  // ---------- Heizung (climate-Entitäten, z. B. Heizkörperthermostate) ----------
  var heatPending = {}, heatTimer = {};
  function heatRow(s, roomName) {
    var a = s.attributes || {}, id = s.entity_id, off = unavailable(s);
    var target = heatPending[id] != null ? heatPending[id] : a.temperature;
    var heating = a.hvac_action === 'heating';
    var modes = (a.hvac_modes || []).filter(function (x) { return HVAC[x]; });
    return '<div class="heat' + (heating ? ' on' : '') + '">' + ic(heating ? 'flame' : 'thermo') + '<div class="txt"><b>' + esc(roomName ? shortName(s, roomName) : name(s)) + '</b><small>'
      + (off ? 'nicht erreichbar' : (roomName ? esc(roomName) + ' · ' : '') + 'ist ' + (a.current_temperature != null ? fmt1(a.current_temperature) + ' °C' : '–') + (heating ? ' · heizt' : s.state === 'off' ? ' · aus' : '')) + '</small></div>'
      + (target != null && s.state !== 'off' ? '<span class="stepper"><button type="button" data-heat="' + esc(id) + '" data-step="-1" aria-label="kälter">−</button><output>' + fmt1(target) + ' °</output><button type="button" data-heat="' + esc(id) + '" data-step="1" aria-label="wärmer">+</button></span>' : '')
      + (modes.length > 1 ? '<div class="modes">' + modes.map(function (md) { return '<button class="chip" type="button" data-hvac="' + esc(id) + '" data-mode="' + md + '" aria-pressed="' + (s.state === md) + '">' + HVAC[md] + '</button>'; }).join('') + '</div>' : '')
      + '</div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-heat]');
    if (b) {
      var id = b.dataset.heat, s = S[id]; if (!s) return;
      var a = s.attributes, step = a.target_temp_step || 0.5;
      var cur = heatPending[id] != null ? heatPending[id] : a.temperature;
      var v = Math.round((cur + step * +b.dataset.step) / step) * step;
      v = Math.max(a.min_temp != null ? a.min_temp : 5, Math.min(a.max_temp != null ? a.max_temp : 30, v));
      heatPending[id] = v; queueRender();
      clearTimeout(heatTimer[id]);
      heatTimer[id] = setTimeout(function () {
        callService('climate', 'set_temperature', { temperature: v }, { entity_id: id }).catch(function () {})
          .then(function () { setTimeout(function () { delete heatPending[id]; queueRender(); }, 1500); });
      }, 700);
      return;
    }
    var pb = e.target.closest('[data-press]');
    if (pb) { callService('button', 'press', {}, { entity_id: pb.dataset.press }).then(function () { toast((S[pb.dataset.press] ? name(S[pb.dataset.press]) : 'Vorlage') + ' angewendet.'); }).catch(function () {}); return; }
    var mb = e.target.closest('[data-hvac]');
    if (mb) callService('climate', 'set_hvac_mode', { hvac_mode: mb.dataset.mode }, { entity_id: mb.dataset.hvac }).catch(function () {});
  });

  // ---------- Kameras (Blink) ----------
  var camStamp = {};
  function renderCams(m) {
    var conf = lsGet(LS_CONN) || {}, base = (conf.url || '').replace(/\/+$/, '');
    $('alarms').innerHTML = m.alarms.map(function (a) {
      var armed = /^armed/.test(a.state), off = unavailable(a);
      return '<section class="box arm">' + ic(armed ? 'shield' : 'moon') + '<div class="txt"><b>' + esc(name(a)) + '</b><small>'
        + (off ? 'nicht erreichbar' : armed ? 'Scharf · Bewegungen werden aufgezeichnet' : 'Unscharf · keine Aufnahmen') + '</small></div>'
        + '<button class="btn' + (armed ? ' ghost' : '') + ' small" type="button" data-arm="' + esc(a.entity_id) + '"' + (off ? ' disabled' : '') + '>' + (armed ? 'Unscharf' : 'Scharf schalten') + '</button></section>';
    }).join('');
    var el = $('cams');
    if (!m.cams.length) { el.innerHTML = '<div class="box empty">Keine Kameras gefunden.</div>'; return; }
    // Bilder nur neu setzen, wenn sich das Bild geändert hat, damit nichts flackert
    var keep = {};
    el.querySelectorAll('.cam').forEach(function (n) { keep[n.dataset.cam] = n; });
    var frag = document.createDocumentFragment();
    m.cams.forEach(function (c) {
      var s = c.s, a = s.attributes || {}, id = s.entity_id, off = unavailable(s);
      var src = a.entity_picture ? base + a.entity_picture + (a.entity_picture.indexOf('?') < 0 ? '?' : '&') + 't=' + (camStamp[id] || 0) : '';
      var dev = reg(id).device, motion = null;
      Object.keys(S).forEach(function (oid) { if (reg(oid).device === dev && dev && oid.indexOf('binary_sensor.') === 0 && dc(S[oid]) === 'motion') motion = S[oid]; });
      var n = keep[id] || document.createElement('section');
      // Steckdose der Kamera (z. B. Tapo „Steckdose Kamera“ im Flur): gleicher Raum, „Kamera“ im Namen
      var plug = c.room ? c.room.plugs.filter(function (p) { return /kamera|cam/i.test(name(p) + ' ' + p.entity_id); })[0] : null;
      var plugOn = plug && plug.state === 'on';
      n.className = 'box cam' + (plug && plug.state === 'off' ? ' dark' : ''); n.dataset.cam = id;
      var img = n.querySelector('img');
      var meta = '<div class="txt"><b>' + esc(name(s)) + '</b><small>' + esc(c.room ? c.room.name : '') + (off ? ' · nicht erreichbar' : '')
        + (motion && !unavailable(motion) ? ' · Bewegung ' + (motion.state === 'on' ? 'jetzt' : timeText(motion.last_changed)) : '') + '</small></div>'
        + '<button class="btn ghost small" type="button" data-snap="' + esc(id) + '"' + (off ? ' disabled' : '') + '>Neues Bild</button>';
      if (!keep[id]) n.innerHTML = '<div class="img">Kein Bild</div><div class="meta"></div><div class="plugslot"></div>';
      n.querySelector('.meta').innerHTML = meta;
      n.querySelector('.plugslot').innerHTML = plug ? '<div class="plug">' + ic('plug') + '<div class="txt"><b>' + esc(name(plug)) + '</b><small>'
        + (unavailable(plug) ? 'nicht erreichbar' : plugOn ? 'an · Kamera hat Strom' : 'aus · Kamera ist stromlos') + (plug.last_changed && !unavailable(plug) ? ' seit ' + esc(timeText(plug.last_changed)) : '') + '</small></div>'
        + '<button class="tgl" type="button" role="switch" aria-checked="' + plugOn + '" data-plug="' + esc(plug.entity_id) + '" aria-label="' + esc(name(plug)) + (plugOn ? ' ausschalten' : ' einschalten') + '"' + (unavailable(plug) ? ' disabled' : '') + '></button></div>' : '';
      if (src && (!img || img.dataset.src !== src)) {
        var im = img || document.createElement('img');
        im.alt = 'Letztes Bild ' + name(s); im.loading = 'lazy'; im.dataset.src = src; im.src = src;
        im.onerror = function () { im.remove(); };
        if (!img) n.querySelector('.img').appendChild(im);
      }
      frag.appendChild(n);
    });
    el.innerHTML = ''; el.appendChild(frag);
  }
  document.addEventListener('click', function (e) {
    var snap = e.target.closest('[data-snap]');
    if (snap) {
      var id = snap.dataset.snap; snap.disabled = true; snap.textContent = 'Moment …';
      callService('blink', 'trigger_camera', {}, { entity_id: id }).then(function () {
        toast('Kamera macht ein neues Bild …');
        setTimeout(function () { camStamp[id] = Date.now(); queueRender(); }, 6000);
      }).catch(function () {}).then(function () { setTimeout(queueRender, 6500); });
      return;
    }
    var pl = e.target.closest('[data-plug]');
    if (pl) {
      var isOn = pl.getAttribute('aria-checked') === 'true'; pl.setAttribute('aria-checked', !isOn);
      callService('switch', isOn ? 'turn_off' : 'turn_on', {}, { entity_id: pl.dataset.plug }).then(function () { toast(isOn ? 'Kamera-Steckdose aus.' : 'Kamera-Steckdose an, die Kamera startet in etwa einer Minute.'); }).catch(function () { queueRender(); });
      return;
    }
    var arm = e.target.closest('[data-arm]');
    if (arm) {
      var s = S[arm.dataset.arm], armed = /^armed/.test(s.state);
      arm.disabled = true;
      callService('alarm_control_panel', armed ? 'alarm_disarm' : 'alarm_arm_away', {}, { entity_id: s.entity_id })
        .then(function () { toast(armed ? 'Blink ist jetzt unscharf.' : 'Blink ist jetzt scharf.'); }).catch(function () {});
    }
  });

  // ---------- System ----------
  function bars(n) { var s = '<span class="lqi" aria-label="Funk ' + n + ' von 4">'; for (var i = 1; i <= 4; i++) s += '<i class="' + (i <= n ? 'on' : '') + '" style="height:' + (i * 25) + '%"></i>'; return s + '</span>'; }
  function renderSystem(m) {
    // Speedtest (Integration „Speedtest.net“): misst die Leitung vom Pi aus, „Jetzt messen“ stößt eine neue Messung an
    var sp = m.speed, spd = function (x) { var v = num(x); return v == null ? '–' : v < 10 ? fmt1(v) : String(Math.round(v)); };
    if (sp.down || sp.up || sp.ping) {
      var when = (sp.down || sp.up || sp.ping).last_updated;
      $('speedCount').textContent = when ? 'gemessen ' + timeText(when) : '';
      if (!(document.activeElement && $('speed').contains(document.activeElement))) $('speed').innerHTML = '<div class="speed">'
        + [['Download', sp.down, 'Mbit/s'], ['Upload', sp.up, 'Mbit/s'], ['Ping', sp.ping, 'ms']].filter(function (x) { return x[1]; }).map(function (x) {
          return '<div class="meter"><span>' + x[0] + '</span><b>' + spd(x[1]) + '<small>' + x[2] + '</small></b></div>'; }).join('') + '</div>'
        + '<div class="btnrow"><button class="btn small" type="button" data-speedrun="' + esc((sp.down || sp.up || sp.ping).entity_id) + '"' + (speedRunning ? ' disabled' : '') + '>' + ic('gauge') + (speedRunning ? 'Misst …' : 'Jetzt messen') + '</button></div>'
        + (current === 'system' ? rangeChips('speed') + chartsFor([sp.down, sp.up].filter(Boolean).map(function (x) { return x.entity_id; }), 'speed', function (id) { return id === (sp.down && sp.down.entity_id) ? { title: 'Download', unit: 'Mbit/s', col: 'var(--p1)', dec: 0 } : { title: 'Upload', unit: 'Mbit/s', col: 'var(--cool)', dec: 0 }; }) : '');
    } else {
      $('speedCount').textContent = '';
      $('speed').innerHTML = '<p class="hint" style="margin:0">Für den Speedtest in Home Assistant die Integration „Speedtest.net“ hinzufügen (Einstellungen → Geräte &amp; Dienste → Integration hinzufügen). Sie misst dann regelmäßig Download, Upload und Ping vom Pi aus.</p>';
    }
    $('haVersion').textContent = haVersion ? 'HA ' + haVersion : '';
    $('haVersion').className = 'pill ok';
    // Pi-Werte über die Integration „System Monitor“
    var find = function (re) { var k = Object.keys(m.sys).filter(function (id) { return re.test(reg(id).key + ' ' + id) && !unavailable(m.sys[id]); })[0]; return k ? m.sys[k] : null; };
    var meters = [
      ['CPU-Temperatur', find(/processor_temperature|prozessortemperatur/), '°C', 85, ''],
      ['CPU-Last', find(/processor_use|prozessornutzung|prozessorauslastung/), '%', 100, ''],
      ['Arbeitsspeicher', find(/memory_use_percent|memory_usage|arbeitsspeicher.*(prozent|nutzung)|arbeitsspeicherauslastung/), '%', 100, 'cool'],
      ['SSD belegt', find(/disk_use_percent|disk_usage|datentrager.*(prozent|nutzung)|massenspeicher_auslastung/), '%', 100, 'cool']
    ].filter(function (x) { return x[1]; });
    $('pi').innerHTML = meters.map(function (x) {
      var v = num(x[1]);
      return '<div class="meter"><span>' + x[0] + '</span><b>' + (v == null ? '–' : (x[2] === '°C' ? Math.round(v) : Math.round(v)) + ' ' + x[2]) + '</b><div class="bar ' + x[4] + '"><div style="width:' + Math.min(100, (v || 0) / x[3] * 100) + '%"></div></div></div>';
    }).join('');
    var short = { 'CPU-Temperatur': 'Pi ', 'CPU-Last': 'CPU ', 'Arbeitsspeicher': 'RAM ', 'SSD belegt': 'SSD ' };
    $('piLine').textContent = meters.length ? meters.map(function (x) { var v = num(x[1]); return short[x[0]] + (v == null ? '–' : Math.round(v) + (x[2] === '°C' ? ' °C' : ' %')); }).join(' · ') + ' ›' : 'Raspberry Pi 4 · Einstellungen ›';
    var boot = find(/last_boot|letzter_start|uptime|betriebszeit/);
    if (boot && isNaN(new Date(boot.state))) boot = null;
    $('piHint').textContent = meters.length
      ? (boot ? 'Läuft seit ' + ago(boot.state) + ' · ' : '') + 'Home Assistant OS auf USB-SSD · LAN an der Fritzbox'
      : 'Für CPU, Speicher und SSD in HA die Integration „System Monitor“ hinzufügen (Einstellungen → Geräte & Dienste → Integration hinzufügen).';

    var sysIds = [['CPU-Temperatur', find(/processor_temperature|prozessortemperatur/), '°C', 'var(--p1)', 0], ['CPU-Last', find(/processor_use|prozessornutzung|prozessorauslastung/), '%', 'var(--p1)', 0],
      ['Arbeitsspeicher', find(/memory_use_percent|memory_usage|arbeitsspeicher.*(prozent|nutzung)|arbeitsspeicherauslastung/), '%', 'var(--cool)', 0]].filter(function (x) { return x[1]; });
    $('sysChartBox').hidden = !sysIds.length;
    if (sysIds.length && current === 'system') {
      var metaById = {}; sysIds.forEach(function (x) { metaById[x[1].entity_id] = { title: x[0], unit: x[2], col: x[3], dec: x[4] }; });
      $('sysChartBox').querySelector('.ranges').outerHTML = rangeChips('sys');
      $('sysCharts').innerHTML = chartsFor(sysIds.map(function (x) { return x[1].entity_id; }), 'sys', function (id) { return metaById[id]; });
    }

    // Fritzbox (Integration „AVM FRITZ!Box Tools“)
    var fk = function (re) { return m.fritz.filter(function (x) { return re.test(reg(x.entity_id).key || x.entity_id); })[0]; };
    var mbit = function (x) { if (!x || unavailable(x)) return null; var v = parseFloat(x.state), u = (x.attributes.unit_of_measurement || '').toLowerCase(); return u === 'kb/s' ? v * 8 / 1000 : u === 'kbit/s' ? v / 1000 : u === 'mbit/s' ? v : v; };
    var mb = function (v) { return v == null || !isFinite(v) ? '–' : (v < 10 ? fmt1(v) : Math.round(v)) + ' Mbit/s'; };
    var conn = fk(/^is_connected$|verbunden$|connection$/), dn = fk(/^kb_s_received$|download_durchsatz|download_throughput/), up = fk(/^kb_s_sent$|upload_durchsatz|upload_throughput/);
    var ldn = fk(/^link_kb_s_received$|link_download|leitung.*download/), lup = fk(/^link_kb_s_sent$|link_upload|leitung.*upload/);
    var cup = fk(/^connection_uptime$|verbindungsdauer|connection_uptime|verbunden_seit/), dup = fk(/^device_uptime$|^uptime$|betriebszeit|letzter_neustart/);
    var ip = fk(/^external_ip$|externe_ip|external_ip$/), gbr = fk(/^gb_received$|empfangen|gb_received/), gbs = fk(/^gb_sent$|gesendet|gb_sent/);
    var tiles = [];
    if (conn) tiles.push(['Internet', unavailable(conn) ? '–' : conn.state === 'on' ? '✓ verbunden' : '✕ getrennt']);
    if (dn || up) tiles.push(['Jetzt ↓ / ↑', mb(mbit(dn)).replace(' Mbit/s', '') + ' / ' + mb(mbit(up))]);
    if (ldn || lup) tiles.push(['Leitung ↓ / ↑', mb(mbit(ldn)).replace(' Mbit/s', '') + ' / ' + mb(mbit(lup))]);
    if (cup && !unavailable(cup)) tiles.push(['Online seit', isNaN(new Date(cup.state)) ? cup.state : ago(cup.state)]);
    if (gbr || gbs) tiles.push(['Daten ↓ / ↑', (gbr ? fmt1(num(gbr) || 0) : '–') + ' / ' + (gbs ? fmt1(num(gbs) || 0) : '–') + ' GB']);
    if (dup && !unavailable(dup)) tiles.push(['Fritzbox läuft seit', isNaN(new Date(dup.state)) ? dup.state : ago(dup.state)]);
    if (ip && !unavailable(ip)) tiles.push(['Externe IP', ip.state]);
    $('fritzCount').textContent = conn && conn.state === 'on' ? 'online' : '';
    $('fritz').innerHTML = tiles.length ? '<div class="kv">' + tiles.map(function (x) { return '<div class="meter"><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>'; }).join('') + '</div>'
      : m.fritz.length ? '<p class="hint" style="margin:0">Fritzbox verbunden, aber keine der üblichen Werte gefunden.</p>'
      : '<p class="hint" style="margin:0">Für Internet-Geschwindigkeit und Verbindungsdauer in HA die Integration „AVM FRITZ!Box Tools“ hinzufügen.</p>';

    var integ = entries.filter(function (e) { return e.source !== 'ignore' && !e.disabled_by; }).length;
    $('haStats').innerHTML = [['Version', haVersion || '–'], ['Integrationen', integ], ['Geräte', Object.keys(devices).length], ['Entitäten', Object.keys(S).length], ['Automationen', m.automations], ['Bereiche', Object.keys(areas).length]]
      .map(function (x) { return '<div class="meter"><span>' + x[0] + '</span><b>' + esc(x[1]) + '</b></div>'; }).join('');

    // Dienste = Integrationen in HA
    var list = entries.filter(function (e) { return e.source !== 'ignore' && !e.disabled_by && !SVC_HIDE[e.domain]; })
      .sort(function (a, b) { return (a.state === 'loaded') - (b.state === 'loaded') || a.title.localeCompare(b.title, 'de'); });
    var bad = list.filter(function (e) { return e.state !== 'loaded'; }).length;
    $('sysBadge').hidden = !bad;
    $('svcCount').textContent = list.length ? (bad ? bad + ' mit Problem' : 'alles ok') : '';
    $('services').innerHTML = list.map(function (e) {
      var ok = e.state === 'loaded';
      return '<div class="row"><span class="ico">' + (SVC_ICON[e.domain] || '🔧') + '</span><div class="txt"><b>' + esc(e.title) + '</b><small>' + esc(e.domain) + '</small></div>'
        + '<span class="pill ' + (ok ? 'ok' : 'open') + '">' + (ok ? 'läuft' : e.state === 'setup_retry' ? 'versucht neu' : 'Fehler') + '</span></div>';
    }).join('') || '<div class="empty">Keine Daten (Token braucht Admin-Rechte).</div>';

    // Zigbee-Geräte (ZHA)
    var zb = Object.keys(devices).map(function (k) { return devices[k]; }).filter(function (d) {
      return (d.identifiers || []).some(function (i) { return i[0] === 'zha'; }) && d.via_device_id && !d.disabled_by;
    }).map(function (d) {
      var b = num(m.batteries[d.id]), q = num(m.lqi[d.id]);
      var room = d.area_id && areas[d.area_id] ? areas[d.area_id].name : 'ohne Raum';
      var off = Object.keys(S).some(function (id) { return reg(id).device === d.id && primary(id) && S[id].state === 'unavailable'; });
      return { n: d.name_by_user || d.name, d: (d.manufacturer ? d.manufacturer.replace(/^LUMI$/, 'Aqara') + ' · ' : '') + room, b: b, q: q, off: off };
    }).sort(function (a, b) { return (a.b == null ? 101 : a.b) - (b.b == null ? 101 : b.b); });
    $('zbCount').textContent = zb.length ? zb.length + ' Geräte' : '';
    $('zigbee').innerHTML = zb.map(function (d) {
      return '<div class="row"><span class="ico">' + ic('wifi') + '</span><div class="txt"><b>' + esc(d.n) + '</b><small>' + esc(d.d) + (d.off ? ' · nicht erreichbar' : '') + '</small></div>'
        + (d.q != null ? bars(Math.max(1, Math.min(4, Math.ceil(d.q / 64)))) : '')
        + (d.b != null ? '<span class="batt' + (d.b < 20 ? ' low' : '') + '">Batterie ' + Math.round(d.b) + ' %</span>' : '') + '</div>';
    }).join('') || '<div class="empty">Keine Zigbee-Geräte gefunden.</div>';
  }

  var speedRunning = false;
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-speedrun]'); if (!b || speedRunning) return;
    speedRunning = true; queueRender(); toast('Speedtest läuft, das dauert etwa 30 Sekunden …');
    callService('homeassistant', 'update_entity', {}, { entity_id: b.dataset.speedrun }).catch(function () {})
      .then(function () { speedRunning = false; statCache = {}; queueRender(); });
  });

  // ---------- Szenen, Alles aus, Durchsage ----------
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-scene]'); if (!b) return;
    var id = b.dataset.scene;
    if (id === '__off') { allOff(); return; }
    callService('scene', 'turn_on', {}, { entity_id: id }).then(function () { toast((S[id] ? name(S[id]) : 'Szene') + ' aktiviert.'); }).catch(function () {});
  });
  function allOff() {
    var ids = model().lights.filter(function (l) { return l.s.state === 'on'; }).map(function (l) { return l.s.entity_id; });
    if (!ids.length) { toast('Es ist schon alles aus.'); return; }
    callService('light', 'turn_off', {}, { entity_id: ids }).then(function () { toast(ids.length + (ids.length === 1 ? ' Lampe' : ' Lampen') + ' ausgeschaltet.'); }).catch(function () {});
  }

  $('sayForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var inp = $('sayText'), txt = inp.value.trim();
    if (!txt) { toast('Schreib erst, was die Echos sagen sollen.'); inp.focus(); return; }
    var sel = $('sayTarget').value || 'alle';
    var target = sel === 'alle' ? model().echos.filter(function (x) { return x.room && !isGroup(x.s) && !unavailable(x.s); }).map(function (x) { return x.s.entity_id; }) : [sel];
    callService('notify', 'alexa_media', { message: txt, target: target, data: { type: 'announce' } })
      .then(function () { toast('Durchsage gesendet.'); inp.value = ''; }).catch(function () {});
  });

  function favScenes() {
    var list = lsGet(LS_SCENES);
    if (!list) list = ['__off'].concat(lsGet(LS_FAV) || []); // erste Nutzung: bisherige Favoriten übernehmen, „Alles aus“ vorne
    return list.filter(function (id) { return id === '__off' || S[id]; });
  }
  function sceneLabel(id) { return id === '__off' ? 'Alles aus' : name(S[id]); }
  function orderRows(list, label) {
    return list.map(function (id, i) {
      return '<div class="orow"><span class="n">' + esc(label(id)) + '</span>'
        + '<button type="button" data-mv="-1" data-i="' + i + '" aria-label="nach oben"' + (i ? '' : ' disabled') + '>↑</button>'
        + '<button type="button" data-mv="1" data-i="' + i + '" aria-label="nach unten"' + (i < list.length - 1 ? '' : ' disabled') + '>↓</button>'
        + (label === sceneLabel ? '<button type="button" data-rm="' + i + '" aria-label="entfernen">✕</button>' : '') + '</div>';
    }).join('');
  }
  function move(list, i, d) { var j = i + d; if (j < 0 || j >= list.length) return list; var x = list[i]; list[i] = list[j]; list[j] = x; return list; }

  function renderFavDlg() {
    var fav = favScenes(), m = model(), groups = { 'Allgemein': fav.indexOf('__off') < 0 ? ['__off'] : [] };
    m.scenes.forEach(function (sc) {
      if (fav.indexOf(sc.s.entity_id) > -1) return;
      var g = sc.room ? sc.room.name : 'Ohne Raum'; (groups[g] = groups[g] || []).push(sc.s.entity_id);
    });
    $('favOrder').innerHTML = orderRows(fav, sceneLabel) || '<div class="empty">Noch keine Szene gewählt.</div>';
    $('favAdd').innerHTML = Object.keys(groups).filter(function (g) { return groups[g].length; }).map(function (g) {
      return '<h3>' + esc(g) + '</h3>' + groups[g].map(function (id) { return '<button type="button" class="addrow" data-add="' + esc(id) + '"><b>＋</b>' + esc(sceneLabel(id)) + '</button>'; }).join('');
    }).join('');
  }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-favedit]')) { renderFavDlg(); $('favDlg').showModal(); } });
  $('favDlg').addEventListener('click', function (e) {
    var fav = favScenes(), b;
    if ((b = e.target.closest('[data-mv]'))) move(fav, +b.dataset.i, +b.dataset.mv);
    else if ((b = e.target.closest('[data-rm]'))) fav.splice(+b.dataset.rm, 1);
    else if ((b = e.target.closest('[data-add]'))) fav.push(b.dataset.add);
    else return;
    lsSet(LS_SCENES, fav); renderFavDlg(); queueRender();
  });

  function renderRoomDlg() {
    var rooms = model().rooms, byId = {};
    rooms.forEach(function (r) { byId[r.id] = r; });
    $('roomOrder').innerHTML = orderRows(rooms.map(function (r) { return r.id; }), function (id) { return byId[id].name; });
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-roomorder]')) return;
    renderRoomDlg(); $('roomDlg').showModal();
  });
  $('roomOrder').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mv]'); if (!b) return;
    var ids = model().rooms.map(function (r) { return r.id; });
    lsSet(LS_ROOMS, move(ids, +b.dataset.i, +b.dataset.mv)); _model = null; renderRoomDlg(); queueRender();
  });
  $('roomReset').addEventListener('click', function () { lsSet(LS_ROOMS, null); _model = null; renderRoomDlg(); queueRender(); });

  // Navigation Rail sortieren (nur auf diesem Gerät); neue Bereiche landen hinten
  var rail = $('rail'), railDefault = Array.prototype.map.call(rail.children, function (b) { return b.dataset.go; });
  function railIds() { return Array.prototype.map.call(rail.children, function (b) { return b.dataset.go; }); }
  function applyRail(ids) { ids.forEach(function (k) { var b = rail.querySelector('[data-go="' + k + '"]'); if (b) rail.appendChild(b); }); }
  function renderRailDlg() {
    $('railOrder').innerHTML = orderRows(railIds(), function (id) { return rail.querySelector('[data-go="' + id + '"]').childNodes[1].textContent; });
  }
  applyRail(lsGet(LS_RAIL) || []);
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-railorder]')) return;
    renderRailDlg(); $('railDlg').showModal();
  });
  $('railOrder').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mv]'); if (!b) return;
    var ids = move(railIds(), +b.dataset.i, +b.dataset.mv);
    applyRail(ids); lsSet(LS_RAIL, ids); renderRailDlg();
  });
  $('railReset').addEventListener('click', function () { applyRail(railDefault); lsSet(LS_RAIL, null); renderRailDlg(); });

  // ---------- Licht-Dialog ----------
  var dlgEntity = null, sendTimer = null;
  function openLight(id) {
    var s = S[id]; if (!s) return;
    dlgEntity = id;
    var a = s.attributes || {}, modes = a.supported_color_modes || [];
    var r = model().lights.filter(function (l) { return l.s.entity_id === id; })[0];
    $('ldName').textContent = name(s);
    $('ldSub').textContent = (r && r.room ? r.room.name + ' · ' : '') + (unavailable(s) ? 'nicht erreichbar' : s.state === 'on' ? 'an' : 'aus');
    var dimmable = modes.some(function (m) { return m !== 'onoff'; });
    $('ldBri').parentNode.hidden = !dimmable;
    $('ldBri').value = lightInfo(s).lvl || 80;
    $('ldBriVal').textContent = $('ldBri').value + ' %';
    var ct = modes.indexOf('color_temp') > -1;
    $('ldCtWrap').hidden = !ct;
    if (ct) {
      $('ldCt').min = a.min_color_temp_kelvin || 2000; $('ldCt').max = a.max_color_temp_kelvin || 6500;
      $('ldCt').value = a.color_temp_kelvin || 2700; $('ldCtVal').textContent = $('ldCt').value + ' K';
    }
    var color = modes.some(function (m) { return /^(hs|xy|rgb|rgbw|rgbww)$/.test(m); });
    $('ldColors').innerHTML = color ? COLORS.map(function (c) { return '<button type="button" class="swatch" style="background:' + c + '" data-c="' + c + '" aria-label="Farbe ' + c + '"></button>'; }).join('') : '';
    $('ldToggle').textContent = s.state === 'on' ? 'Ausschalten' : 'Einschalten';
    if (!$('lightDlg').open) $('lightDlg').showModal();
  }
  function sendLight(data) {
    clearTimeout(sendTimer);
    sendTimer = setTimeout(function () { callService('light', 'turn_on', data, { entity_id: dlgEntity }).catch(function () {}); }, 180);
  }
  $('ldBri').addEventListener('input', function () { $('ldBriVal').textContent = this.value + ' %'; sendLight({ brightness_pct: +this.value }); });
  $('ldCt').addEventListener('input', function () { $('ldCtVal').textContent = this.value + ' K'; sendLight({ color_temp_kelvin: +this.value }); });
  $('ldColors').addEventListener('click', function (e) {
    var b = e.target.closest('[data-c]'); if (!b) return;
    var h = b.dataset.c; sendLight({ rgb_color: [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)] });
  });
  $('ldToggle').addEventListener('click', function () {
    var s = S[dlgEntity]; if (!s) return;
    callService('light', s.state === 'on' ? 'turn_off' : 'turn_on', {}, { entity_id: dlgEntity }).then(function () {
      setTimeout(function () { openLight(dlgEntity); }, 400);
    }).catch(function () {});
  });

  // ---------- Verbindungsformular ----------
  function formError(msg) {
    document.querySelectorAll('.conn-form .err').forEach(function (p) { p.textContent = msg; p.hidden = !msg; });
  }
  var setupNeeded = false;
  function showWelcome(on) { setupNeeded = on; show(current); }
  document.querySelectorAll('[data-connform]').forEach(function (slot) {
    slot.appendChild($('connTpl').content.cloneNode(true));
    var f = slot.querySelector('form'), conf = lsGet(LS_CONN) || {};
    f.url.value = conf.url || DEFAULT_URL;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var url = f.url.value.trim().replace(/\/+$/, ''), token = f.token.value.trim();
      if (!/^https:\/\//.test(url)) { formError('Die Adresse muss mit https:// beginnen (Tailscale-Adresse).'); return; }
      if (token.length < 40) { formError('Das sieht nicht wie ein vollständiges Token aus.'); return; }
      lsSet(LS_CONN, { url: url, token: token });
      f.token.value = '';
      document.querySelectorAll('.conn-form input[name=url]').forEach(function (i) { i.value = url; });
      if (ws) { var old = ws; ws = null; old.close(); }
      retry = 0; connect();
    });
    f.querySelector('[data-logout]').addEventListener('click', function () {
      if (!confirm('Token auf diesem Gerät löschen? Danach musst du es neu eingeben.')) return;
      lsSet(LS_CONN, null);
      if (ws) { var old = ws; ws = null; old.close(); }
      S = {}; setConn('off', 'nicht verbunden'); showWelcome(true);
    });
  });

  // ---------- Ansichten ----------
  // Routen: jede Seite hat einen eigenen Eintrag im Verlauf, damit „Zurück“ in der App zur vorigen Seite geht statt sie zu schließen
  var DETAIL = { lichter: 1, fenster: 1, klima: 1 };
  var views = ['uebersicht', 'raeume', 'heizung', 'medien', 'energie', 'kameras', 'sauger', 'einkauf', 'automationen', 'system', 'detail'], current = 'uebersicht', lastView = 'uebersicht';
  function show(v) {
    if (views.indexOf(v) < 0 && !DETAIL[v]) v = 'uebersicht';
    current = v;
    var view = DETAIL[v] ? 'detail' : v;
    var needsConn = setupNeeded && v !== 'system';
    $('welcome').hidden = !needsConn;
    views.forEach(function (x) { $('view-' + x).hidden = x !== view || needsConn; });
    if (v === 'uebersicht' || v === 'raeume') lastView = v;
    // Navigation Rail: aktuelle Seite markieren (Fenster gehört zur Übersicht)
    var railV = v === 'fenster' ? 'uebersicht' : v;
    document.querySelectorAll('.rail [data-go]').forEach(function (b) { if (b.dataset.go === railV) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (DETAIL[v]) detailKey = v;
    if (v !== 'uebersicht') setArrange(false);
    if (connState === 'ok') queueRender();
  }
  function go(v) {
    if (v === current) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    try { history.pushState({ v: v, d: ((history.state && history.state.d) || 0) + 1 }, '', '#' + v); } catch (e) {}
    show(v); window.scrollTo(0, 0);
  }
  window.addEventListener('popstate', function (e) {
    show((e.state && e.state.v) || (location.hash || '').slice(1) || 'uebersicht');
  });
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
    if (e.target.closest('[data-back]')) { if (history.state && history.state.d) history.back(); else go(lastView); }
  });
  $('piLine').addEventListener('click', function () { go('system'); });

  // Bereiche der Übersicht anordnen: lange auf eine Überschrift drücken, dann ziehen oder ↑ ↓
  var board = $('board'), boardLong = false;
  (function applyBoardOrder() {
    (lsGet(LS_BOARD) || []).forEach(function (k) { var b = board.querySelector(':scope > [data-fold="' + k + '"]'); if (b) board.appendChild(b); });
    // Kästen, die neu dazukommen, stehen hinter den bekannten; Hilfselemente für den Anordnen-Modus einfügen
    board.querySelectorAll(':scope > .box').forEach(function (b) {
      var h = b.querySelector('.box-head');
      h.insertAdjacentHTML('afterbegin', '<span class="grip" aria-hidden="true">⠿</span>');
      h.insertAdjacentHTML('beforeend', '<span class="mv"><button type="button" data-mv-box="-1" aria-label="nach oben">↑</button><button type="button" data-mv-box="1" aria-label="nach unten">↓</button></span>');
    });
  })();
  function saveBoard() { lsSet(LS_BOARD, Array.prototype.map.call(board.querySelectorAll(':scope > .box'), function (b) { return b.dataset.fold; })); }
  function setArrange(on) {
    document.body.classList.toggle('arrange', on);
    $('arrangeBar').hidden = !on;
    if (on) toast('Kästen ziehen oder mit ↑ ↓ verschieben, dann „Fertig“.');
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-arrange]')) { go('uebersicht'); setArrange(true); return; }
    var mv = e.target.closest('[data-mv-box]'); if (!mv) return;
    var box = mv.closest('.box'), d = +mv.dataset.mvBox, vis = Array.prototype.filter.call(board.children, function (b) { return !b.hidden; });
    var i = vis.indexOf(box), t = vis[i + d]; if (!t) return;
    if (d < 0) board.insertBefore(box, t); else board.insertBefore(t, box);
    saveBoard(); mv.focus();
  });
  $('arrangeDone').addEventListener('click', function () { setArrange(false); });
  (function boardDrag() {
    var timer = null, drag = null, sx = 0, sy = 0;
    board.addEventListener('pointerdown', function (e) {
      var head = e.target.closest('#board > .box > .box-head'); if (!head || e.target.closest('button, a, select, input')) return;
      var box = head.parentNode; sx = e.clientX; sy = e.clientY;
      if (document.body.classList.contains('arrange')) { startDrag(box, e); return; }
      timer = setTimeout(function () { boardLong = true; setArrange(true); if (navigator.vibrate) navigator.vibrate(15); }, 550);
    });
    function startDrag(box, e) {
      drag = { box: box, y: e.clientY, id: e.pointerId };
      box.classList.add('dragging');
      try { box.querySelector('.box-head').setPointerCapture(e.pointerId); } catch (x) {}
    }
    document.addEventListener('pointermove', function (e) {
      if (timer && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) { clearTimeout(timer); timer = null; }
      if (!drag) return;
      e.preventDefault();
      var dy = e.clientY - drag.y;
      drag.box.style.transform = 'translateY(' + dy + 'px)';
      // am Nachbarn vorbeigezogen? Dann im DOM tauschen und Versatz zurücksetzen
      var vis = Array.prototype.filter.call(board.children, function (b) { return !b.hidden; });
      var i = vis.indexOf(drag.box), r = drag.box.getBoundingClientRect(), mid = r.top + r.height / 2;
      var prev = vis[i - 1], next = vis[i + 1];
      if (prev && mid < prev.getBoundingClientRect().top + prev.getBoundingClientRect().height / 2) { board.insertBefore(drag.box, prev); drag.y = e.clientY; drag.box.style.transform = ''; }
      else if (next && mid > next.getBoundingClientRect().top + next.getBoundingClientRect().height / 2) { board.insertBefore(next, drag.box); drag.y = e.clientY; drag.box.style.transform = ''; }
    }, { passive: false });
    function end() {
      clearTimeout(timer); timer = null;
      if (!drag) return;
      drag.box.classList.remove('dragging'); drag.box.style.transform = ''; drag = null; saveBoard();
    }
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  })();

  (function tick() {
    var d = new Date();
    $('clock').textContent = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
      + ' · ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (connState === 'ok' && d.getSeconds() % 30 === 0) queueRender(); // „seit … min“ aktuell halten
    // Nachtlicht-Countdown sekundengenau, ohne alles neu zu zeichnen
    document.querySelectorAll('[data-until]').forEach(function (el) { var r = +el.dataset.until - Date.now(); el.textContent = (el.hasAttribute('data-short') ? '' : 'noch ') + mmss(r); });
    document.querySelectorAll('[data-ring]').forEach(function (el) { var p = el.dataset.ring.split('|'); el.setAttribute('stroke-dashoffset', (p[2] * (1 - Math.max(0, Math.min(1, (p[0] - Date.now()) / p[1])))).toFixed(1)); });
    setTimeout(tick, 1000 - d.getMilliseconds());
  })();

  var start = (location.hash || '').slice(1) || 'uebersicht';
  try { history.replaceState({ v: start, d: 0 }, '', '#' + start); } catch (e) {}
  show(start);
  connect();
})();

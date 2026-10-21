/* Zuhause – Dashboard für Home Assistant
   Spricht direkt mit der HA-WebSocket-API (über Tailscale serve). Räume, Lampen, Sensoren und Kameras werden
   aus den HA-Registern gelesen, nicht fest eingetragen: neue Geräte erscheinen automatisch im richtigen Raum.
   Adresse und Token liegen nur im localStorage dieses Geräts ('zuhause-ha'), nie im Repo. */
(function () {
  'use strict';

  var DEFAULT_URL = 'https://homeassistant.taildd4a66.ts.net';
  var LS_CONN = 'zuhause-ha', LS_FAV = 'zuhause-fav-scenes';

  // Reihenfolge und Symbole der Räume (HA-Bereichsnamen); unbekannte Bereiche kommen alphabetisch dahinter
  var ROOM_ORDER = ['wohnzimmer', 'küche', 'schlafzimmer', 'büro', 'badezimmer', 'flur', 'toilette', 'keller'];
  var ROOM_ICON = { 'wohnzimmer': '🛋️', 'küche': '🍳', 'schlafzimmer': '🛏️', 'büro': '💻', 'badezimmer': '🛁', 'bad': '🛁', 'flur': '🧥', 'toilette': '🚽', 'keller': '📦' };
  var SVC_ICON = { homeassistant: '🏠', hue: '💡', zha: '📡', blink: '📷', alexa_media: '🔵', google_drive: '☁️', backup: '💾', tailscale: '🔐',
    adguard: '🛡️', matter: '🧩', thread: '🧵', systemmonitor: '📊', met: '🌦️', sun: '☀️', shopping_list: '🛒', radio_browser: '📻', mobile_app: '📱',
    google_translate: '🗣️', hassio: '🧰', go2rtc: '🎥', backup_google_drive: '☁️' };
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
    document.querySelector('meta[name="theme-color"]').content = dark ? '#000000' : '#b45309';
  }
  $('themeBtn').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme')
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('overall-theme', next); } catch (e) {}
    themeColor();
  });
  themeColor();

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
    return send({ type: 'subscribe_events', event_type: eventType }).then(function () { subs[msgId] = cb; });
  }
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
    if (document.visibilityState === 'visible' && (!ws || ws.readyState > 1) && lsGet(LS_CONN)) { retry = 0; connect(); }
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
        queueRender();
      });
      ['area_registry_updated', 'device_registry_updated', 'entity_registry_updated'].forEach(function (t) {
        subscribe(t, function () { clearTimeout(loadAll.t); loadAll.t = setTimeout(loadRegistries, 1500); });
      });
      loadHistory();
    }).catch(function (e) { toast('Laden fehlgeschlagen: ' + e.message); });
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
      roomMap[id] = { id: id, name: a.name, icon: ROOM_ICON[a.name.toLowerCase()] || '🚪', lights: [], temps: [], hums: [], contacts: [], motions: [], cams: [], scenes: [], echos: [], buttons: {} };
    });
    var m = { rooms: [], lights: [], contacts: [], cams: [], alarms: [], scenes: [], echos: [], batteries: {}, lqi: {}, updates: [], backup: null, sys: {} };

    Object.keys(S).forEach(function (id) {
      var s = S[id], dom = id.split('.')[0], e = reg(id), r = roomMap[areaOf(id)] || null;
      if (e.platform === 'systemmonitor') m.sys[id] = s;
      if (dom === 'sensor' && dc(s) === 'battery' && visible(id) && e.device) m.batteries[e.device] = s;
      if (dom === 'sensor' && /_lqi$/.test(id) && e.device) m.lqi[e.device] = s;
      if (dom === 'update' && s.state === 'on' && visible(id)) m.updates.push(s);
      if (e.platform === 'backup' && dc(s) === 'timestamp' && /automatic|automatisch/.test(id)) m.backup = s;
      if (!primary(id)) return;
      if (dom === 'light') {
        if (s.attributes.is_hue_group || (s.attributes.entity_id && s.attributes.entity_id.length)) return; // Hue-Räume/Zonen und Gruppen weglassen
        var l = { s: s, room: r }; m.lights.push(l); if (r) r.lights.push(l);
      } else if (dom === 'sensor' && dc(s) === 'temperature') { if (r) r.temps.push(s); }
      else if (dom === 'sensor' && dc(s) === 'humidity') { if (r) r.hums.push(s); }
      else if (dom === 'binary_sensor' && /^(door|window|garage_door|opening)$/.test(dc(s))) { var c = { s: s, room: r }; m.contacts.push(c); if (r) r.contacts.push(c); }
      else if (dom === 'binary_sensor' && /^(motion|occupancy|presence)$/.test(dc(s)) && e.platform !== 'blink') { if (r) r.motions.push(s); }
      else if (dom === 'camera') { var cam = { s: s, room: r }; m.cams.push(cam); if (r) r.cams.push(cam); }
      else if (dom === 'alarm_control_panel') m.alarms.push(s);
      else if (dom === 'scene') { var sc = { s: s, room: r }; m.scenes.push(sc); if (r) r.scenes.push(sc); }
      else if (dom === 'media_player' && e.platform === 'alexa_media') { var ec = { s: s, room: r }; m.echos.push(ec); if (r) r.echos.push(ec); }
      else if (dom === 'event' && e.device && r) {
        // Taster (Hue Dimmer usw.): letzter Druck = jüngstes Event des Geräts
        var b = r.buttons[e.device];
        if (!b || (s.state > b.state && !unavailable(s))) r.buttons[e.device] = s;
      }
    });

    var order = function (n) { var i = ROOM_ORDER.indexOf(n.toLowerCase()); return i < 0 ? 99 : i; };
    m.rooms = Object.keys(roomMap).map(function (k) { return roomMap[k]; }).sort(function (a, b) {
      return order(a.name) - order(b.name) || a.name.localeCompare(b.name, 'de');
    });
    m.rooms.forEach(function (r) {
      r.temp = r.temps.filter(function (s) { return !unavailable(s); })[0] || r.temps[0] || null;
      r.hum = r.hums.filter(function (s) { return !unavailable(s); })[0] || r.hums[0] || null;
    });
    var byRoom = function (a, b) {
      var ra = a.room ? order(a.room.name) : 100, rb = b.room ? order(b.room.name) : 100;
      return ra - rb || name(a.s).localeCompare(name(b.s), 'de');
    };
    m.lights.sort(byRoom); m.contacts.sort(byRoom); m.cams.sort(byRoom); m.scenes.sort(byRoom); m.echos.sort(byRoom);
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
    _model = null;
    if (connState !== 'ok' && !Object.keys(S).length) return;
    var m = model();
    renderOverview(m); renderRooms(m); renderCams(m); renderSystem(m);
  }

  function lightInfo(s) {
    var on = s.state === 'on', a = s.attributes || {};
    var lvl = on ? (a.brightness != null ? Math.max(1, Math.round(a.brightness / 2.55)) : 100) : 0;
    var col = a.rgb_color ? 'rgb(' + a.rgb_color.join(',') + ')' : '#fcd34d';
    return { on: on, lvl: lvl, col: col, off: unavailable(s) };
  }

  function lightBtn(l, small) {
    var s = l.s, i = lightInfo(s);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'light' + (i.on ? ' on' : '') + (small ? ' small' : '') + (i.off ? ' off-line' : '');
    b.style.setProperty('--lc', i.col);
    b.setAttribute('aria-pressed', i.on);
    b.dataset.entity = s.entity_id;
    b.innerHTML = '<div class="top"><span class="bulb">💡</span><span class="lvl">' + (i.off ? 'offline' : i.on ? i.lvl + ' %' : 'Aus') + '</span></div>'
      + '<div><div class="name">' + esc(small && l.room ? shortName(s, l.room.name) : name(s)) + '</div>' + (small || !l.room ? '' : '<div class="room">' + esc(l.room.name) + '</div>') + '</div>'
      + '<div class="bar"><div style="width:' + i.lvl + '%"></div></div>';
    return b;
  }

  // Tippen = umschalten, lange drücken / Rechtsklick = Helligkeit & Farbe
  (function lightInput() {
    var timer = null, longFired = false, startX = 0, startY = 0;
    document.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('.light'); if (!b) return;
      longFired = false; startX = e.clientX; startY = e.clientY;
      timer = setTimeout(function () { longFired = true; openLight(b.dataset.entity); }, 500);
    });
    document.addEventListener('pointermove', function (e) { if (timer && (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8)) { clearTimeout(timer); timer = null; } });
    ['pointerup', 'pointercancel'].forEach(function (t) { document.addEventListener(t, function () { clearTimeout(timer); timer = null; }); });
    document.addEventListener('contextmenu', function (e) { var b = e.target.closest('.light'); if (b) { e.preventDefault(); if (!longFired) openLight(b.dataset.entity); longFired = true; } });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('.light'); if (!b) return;
      if (longFired) { longFired = false; return; }
      var s = S[b.dataset.entity]; if (!s || unavailable(s)) { toast('Lampe ist gerade nicht erreichbar.'); return; }
      b.classList.add('busy');
      callService('light', 'toggle', {}, { entity_id: s.entity_id }).catch(function () {}).then(function () { b.classList.remove('busy'); });
    });
  })();

  function renderOverview(m) {
    var el = $('lights'); el.innerHTML = '';
    m.lights.forEach(function (l) { el.appendChild(lightBtn(l, false)); });
    if (!m.lights.length) el.innerHTML = '<div class="empty">Keine Lampen gefunden.</div>';

    var on = m.lights.filter(function (l) { return l.s.state === 'on'; }).length;
    var temps = m.rooms.map(function (r) { return num(r.temp); }).filter(function (v) { return v != null; });
    var hums = m.rooms.map(function (r) { return num(r.hum); }).filter(function (v) { return v != null; });
    var open = m.contacts.filter(function (c) { return c.s.state === 'on'; });
    var avg = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; };
    $('sLights').textContent = on + '/' + m.lights.length;
    $('sTemp').textContent = temps.length ? fmt1(avg(temps)) + '°' : '–';
    $('sHum').textContent = hums.length ? Math.round(avg(hums)) + ' %' : '–';
    $('sOpen').textContent = m.contacts.length ? open.length : '–';
    $('sOpenBox').classList.toggle('warn', open.length > 0);

    var st = $('status');
    if (open.length) {
      st.className = 'status alert';
      st.innerHTML = '<span class="big">🪟</span><div><b>' + esc(open.map(function (c) { return name(c.s); }).join(', ')) + ' offen</b><small>'
        + esc(open.map(function (c) { return 'seit ' + timeText(c.s.last_changed) + ' · ' + ago(c.s.last_changed) + (c.room && c.room.temp && num(c.room.temp) != null ? ' · ' + fmt1(num(c.room.temp)) + ' °C' : ''); }).join(' · ')) + '</small></div>';
    } else if (m.contacts.length) {
      st.className = 'status';
      st.innerHTML = '<span class="big">🔒</span><div><b>Alles zu</b><small>' + esc(m.contacts.map(function (c) { return name(c.s); }).join(', ')) + ' geschlossen</small></div>';
    } else {
      var lastMotion = m.rooms.reduce(function (acc, r) { return acc.concat(r.motions); }, []).sort(function (a, b) { return a.last_changed < b.last_changed ? 1 : -1; })[0];
      st.className = 'status';
      st.innerHTML = '<span class="big">🏡</span><div><b>Alles ruhig</b><small>' + (lastMotion ? esc(name(lastMotion)) + ': ' + (lastMotion.state === 'on' ? 'Bewegung jetzt' : 'zuletzt ' + timeText(lastMotion.last_changed)) + ' · ' : '')
        + 'Tür-/Fenstersensoren folgen</small></div>';
    }

    // Hinweise
    var notes = [];
    open.forEach(function (c) {
      var r = c.room, t = r && num(r.temp), h = r && r.temp && tempHist[r.temp.entity_id];
      if (t != null && h && h.length && h[0][1] - t > 0.8)
        notes.push({ cls: 'crit', t: r.name + ': kühlt aus', d: name(c.s) + ' offen, ' + fmt1(h[0][1] - t) + ' °C kälter als vor 12 Stunden.' });
    });
    m.rooms.forEach(function (r) {
      var h = num(r.hum);
      if (h != null && h >= 65) notes.push({ cls: '', t: r.name + ': ' + Math.round(h) + ' % Luftfeuchte', d: 'Lüften, damit sich kein Schimmel bildet.' });
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
    $('noteCount').textContent = warnCount ? warnCount + ' offen' : 'nichts zu tun';

    // Szenen: Favoriten dieses Geräts + „Alles aus“
    var fav = lsGet(LS_FAV) || [];
    var favScenes = fav.map(function (id) { return S[id] ? { s: S[id] } : null; }).filter(Boolean);
    $('scenes').innerHTML = favScenes.map(function (sc) {
      return '<button class="scene" type="button" data-scene="' + esc(sc.s.entity_id) + '"><i>' + sceneIcon(name(sc.s)) + '</i>' + esc(name(sc.s)) + '</button>';
    }).join('') + '<button class="scene" type="button" data-scene="__off"><i>🌙</i>Alles aus</button>';
    $('favBtn').hidden = !m.scenes.length;

    // Durchsage (erscheint, sobald Alexa Media Player eingerichtet ist)
    $('sayBox').hidden = !m.echos.length;
    if (m.echos.length) {
      var t = $('targets'), cur = t.dataset.sel || 'alle';
      t.innerHTML = [{ id: 'alle', n: 'Alle Echos' }].concat(m.echos.map(function (e) { return { id: e.s.entity_id, n: e.room ? e.room.name : name(e.s) }; }))
        .map(function (x) { return '<button class="chip" type="button" data-t="' + esc(x.id) + '" aria-pressed="' + (x.id === cur) + '">' + esc(x.n) + '</button>'; }).join('');
    }
  }

  function sceneIcon(n) {
    n = n.toLowerCase();
    if (/morgen|wach|energ|konzentr|hell/.test(n)) return '☀️';
    if (/abend|entspann|gemüt/.test(n)) return '🌆';
    if (/film|kino|tv/.test(n)) return '🎬';
    if (/nacht|schlaf|nachtlicht/.test(n)) return '🌙';
    if (/lesen/.test(n)) return '📖';
    return '✨';
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
    var el = $('rooms'); el.innerHTML = '';
    m.rooms.forEach(function (r) {
      var c = document.createElement('section');
      var anyOpen = r.contacts.some(function (x) { return x.s.state === 'on'; });
      var bare = !r.lights.length && !r.temp && !r.contacts.length && !r.motions.length && !r.cams.length && !Object.keys(r.buttons).length && !r.echos.length;
      c.className = 'box room-card' + (anyOpen ? ' alert' : '') + (bare ? ' bare' : '');
      var html = '<div class="room-head"><h2><span aria-hidden="true">' + r.icon + '</span>' + esc(r.name) + '</h2>'
        + (r.echos.length ? '<span class="pill info">🔵 Echo</span>' : '') + '</div>';
      if (bare) { c.innerHTML = html + '<div class="noclim">Noch keine Geräte</div>'; el.appendChild(c); return; }

      var t = num(r.temp), h = num(r.hum);
      if (t != null) {
        var k = t >= 23 ? 'warm' : t < 19 ? 'cold' : '';
        var col = k === 'warm' ? 'var(--p1)' : k === 'cold' ? 'var(--cool)' : 'var(--mute)';
        var hist = tempHist[r.temp.entity_id];
        html += '<div class="clim ' + k + '"><div><div class="t">' + fmt1(t) + '<small> °C</small></div>'
          + (h != null ? '<div class="h">💧 ' + Math.round(h) + ' %' + (h >= 65 ? ' · Lüften' : '') + '</div>' : '') + '</div>'
          + (hist && hist.length > 1 ? '<div style="color:' + col + '">' + spark(hist) + '</div><div class="axis"><span>vor 12 h · ' + fmt1(hist[0][1]) + '°</span><span>jetzt</span></div>' : '<div></div>')
          + '</div>';
      } else if (r.temp) {
        html += '<div class="noclim">🌡️ ' + esc(name(r.temp)) + ': nicht erreichbar</div>';
      }
      r.contacts.forEach(function (ct) {
        var s = ct.s, isOpen = s.state === 'on', off = unavailable(s);
        var b = num(m.batteries[reg(s.entity_id).device]);
        html += '<div class="contact' + (isOpen ? ' open' : '') + '"><span aria-hidden="true">' + (dc(s) === 'window' ? '🪟' : '🚪') + '</span><div class="txt"><b>' + esc(name(s)) + '</b><small>'
          + (off ? 'nicht erreichbar' : (isOpen ? 'offen seit ' + timeText(s.last_changed) + ' · ' + ago(s.last_changed) : 'zu seit ' + timeText(s.last_changed))) + '</small></div>'
          + (b != null ? '<span class="batt' + (b < 20 ? ' low' : '') + '">🔋 ' + Math.round(b) + ' %</span>' : '')
          + '<span class="pill ' + (off ? 'warn' : isOpen ? 'open' : 'ok') + '">' + (off ? '?' : isOpen ? 'Offen' : 'Zu') + '</span></div>';
      });
      r.motions.forEach(function (s) {
        var on = s.state === 'on';
        html += '<div class="contact' + (on ? ' active' : '') + '"><span aria-hidden="true">🚶</span><div class="txt"><b>' + esc(name(s)) + '</b><small>'
          + (unavailable(s) ? 'nicht erreichbar' : on ? 'Bewegung seit ' + timeText(s.last_changed) : 'zuletzt ' + timeText(s.last_changed) + ' · vor ' + ago(s.last_changed)) + '</small></div>'
          + '<span class="pill ' + (on ? 'warn' : 'ok') + '">' + (on ? 'Bewegung' : 'ruhig') + '</span></div>';
      });
      Object.keys(r.buttons).forEach(function (d) {
        var s = r.buttons[d];
        html += '<div class="noclim">🎛️ ' + esc(devName(d)) + (unavailable(s) ? '' : ' · zuletzt ' + timeText(s.state)) + '</div>';
      });
      if (r.cams.length) html += '<div class="noclim">📷 ' + esc(r.cams.map(function (x) { return name(x.s); }).join(', ')) + '</div>';
      if (r.scenes.length) html += '<div class="chips">' + r.scenes.map(function (sc) { return '<button class="chip" type="button" data-scene="' + esc(sc.s.entity_id) + '">' + esc(shortName(sc.s, r.name)) + '</button>'; }).join('') + '</div>';
      c.innerHTML = html;
      if (r.lights.length) {
        var g = document.createElement('div'); g.className = 'room-lights';
        r.lights.forEach(function (l) { g.appendChild(lightBtn(l, true)); });
        c.appendChild(g);
      } else {
        c.insertAdjacentHTML('beforeend', '<div class="noclim">Keine Lampe</div>');
      }
      el.appendChild(c);
    });
    if (!m.rooms.length) el.innerHTML = '<div class="box empty">Keine Bereiche in Home Assistant gefunden.</div>';
  }

  // ---------- Kameras (Blink) ----------
  var camStamp = {};
  function renderCams(m) {
    var conf = lsGet(LS_CONN) || {}, base = (conf.url || '').replace(/\/+$/, '');
    $('alarms').innerHTML = m.alarms.map(function (a) {
      var armed = /^armed/.test(a.state), off = unavailable(a);
      return '<section class="box arm"><span style="font-size:1.6rem" aria-hidden="true">' + (armed ? '🛡️' : '💤') + '</span><div class="txt"><b>' + esc(name(a)) + '</b><small>'
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
      n.className = 'box cam'; n.dataset.cam = id;
      var img = n.querySelector('img');
      var meta = '<div class="txt"><b>' + esc(name(s)) + '</b><small>' + esc(c.room ? c.room.name : '') + (off ? ' · nicht erreichbar' : '')
        + (motion && !unavailable(motion) ? ' · Bewegung ' + (motion.state === 'on' ? 'jetzt' : timeText(motion.last_changed)) : '') + '</small></div>'
        + '<button class="btn ghost small" type="button" data-snap="' + esc(id) + '"' + (off ? ' disabled' : '') + '>📸 Neues Bild</button>';
      if (!keep[id]) n.innerHTML = '<div class="img">Kein Bild</div><div class="meta"></div>';
      n.querySelector('.meta').innerHTML = meta;
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
      var id = snap.dataset.snap; snap.disabled = true; snap.textContent = '⏳ Moment …';
      callService('blink', 'trigger_camera', {}, { entity_id: id }).then(function () {
        toast('Kamera macht ein neues Bild …');
        setTimeout(function () { camStamp[id] = Date.now(); queueRender(); }, 6000);
      }).catch(function () {}).then(function () { setTimeout(queueRender, 6500); });
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
    $('piLine').textContent = meters.length ? meters.map(function (x) { var v = num(x[1]); return short[x[0]] + (v == null ? '–' : Math.round(v) + (x[2] === '°C' ? ' °C' : ' %')); }).join(' · ') + ' ›' : 'Raspberry Pi 4 · System-Infos ›';
    var boot = find(/last_boot|letzter_start|uptime|betriebszeit/);
    if (boot && isNaN(new Date(boot.state))) boot = null;
    $('piHint').textContent = meters.length
      ? (boot ? 'Läuft seit ' + ago(boot.state) + ' · ' : '') + 'Home Assistant OS auf USB-SSD · LAN an der Fritzbox'
      : 'Für CPU, Speicher und SSD in HA die Integration „System Monitor“ hinzufügen (Einstellungen → Geräte & Dienste → Integration hinzufügen).';

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
      return '<div class="row"><span class="ico">📡</span><div class="txt"><b>' + esc(d.n) + '</b><small>' + esc(d.d) + (d.off ? ' · nicht erreichbar' : '') + '</small></div>'
        + (d.q != null ? bars(Math.max(1, Math.min(4, Math.ceil(d.q / 64)))) : '')
        + (d.b != null ? '<span class="batt' + (d.b < 20 ? ' low' : '') + '">🔋 ' + Math.round(d.b) + ' %</span>' : '') + '</div>';
    }).join('') || '<div class="empty">Keine Zigbee-Geräte gefunden.</div>';
  }

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
  $('allOff').addEventListener('click', allOff);

  $('targets').addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    this.dataset.sel = b.dataset.t;
    this.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', c === b); });
  });
  $('sayForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var inp = $('sayText'), txt = inp.value.trim();
    if (!txt) { toast('Schreib erst, was die Echos sagen sollen.'); inp.focus(); return; }
    var sel = $('targets').dataset.sel || 'alle';
    var target = sel === 'alle' ? model().echos.map(function (x) { return x.s.entity_id; }) : [sel];
    callService('notify', 'alexa_media', { message: txt, target: target, data: { type: 'announce' } })
      .then(function () { toast('Durchsage gesendet.'); inp.value = ''; }).catch(function () {});
  });

  $('favBtn').addEventListener('click', function () {
    var fav = lsGet(LS_FAV) || [], m = model(), groups = {};
    m.scenes.forEach(function (sc) { var g = sc.room ? sc.room.name : 'Ohne Raum'; (groups[g] = groups[g] || []).push(sc); });
    $('favList').innerHTML = Object.keys(groups).map(function (g) {
      return '<h3>' + esc(g) + '</h3>' + groups[g].map(function (sc) {
        var id = sc.s.entity_id;
        return '<label><input type="checkbox" value="' + esc(id) + '"' + (fav.indexOf(id) > -1 ? ' checked' : '') + '>' + esc(name(sc.s)) + '</label>';
      }).join('');
    }).join('');
    $('favDlg').showModal();
  });
  $('favList').addEventListener('change', function () {
    var ids = []; this.querySelectorAll('input:checked').forEach(function (i) { ids.push(i.value); });
    // Reihenfolge der bisherigen Favoriten beibehalten, neue hinten anhängen
    var old = (lsGet(LS_FAV) || []).filter(function (id) { return ids.indexOf(id) > -1; });
    ids.forEach(function (id) { if (old.indexOf(id) < 0) old.push(id); });
    lsSet(LS_FAV, old); queueRender();
  });

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
  var views = ['uebersicht', 'raeume', 'kameras', 'system'], current = 'uebersicht', lastView = 'uebersicht';
  function show(v) {
    if (views.indexOf(v) < 0) v = 'uebersicht';
    current = v;
    var needsConn = setupNeeded && v !== 'system';
    $('welcome').hidden = !needsConn;
    views.forEach(function (x) { $('view-' + x).hidden = x !== v || needsConn; });
    if (v !== 'system') lastView = v;
    document.querySelectorAll('.tab').forEach(function (t) { t.setAttribute('aria-selected', t.dataset.view === v); });
    $('sysBtn').setAttribute('aria-pressed', v === 'system');
    try { history.replaceState(null, '', '#' + v); } catch (e) {}
  }
  document.querySelector('.tabs').addEventListener('click', function (e) {
    var t = e.target.closest('.tab'); if (!t) return;
    show(t.dataset.view); window.scrollTo(0, 0);
  });
  // System-Infos: dezent über ⚙️ oben und die Pi-Zeile unten
  $('sysBtn').addEventListener('click', function () { show(current === 'system' ? lastView : 'system'); window.scrollTo(0, 0); });
  $('piLine').addEventListener('click', function () { show('system'); window.scrollTo(0, 0); });
  $('sysBack').addEventListener('click', function () { show(lastView); window.scrollTo(0, 0); });

  (function tick() {
    var d = new Date();
    $('clock').textContent = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
      + ' · ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    if (connState === 'ok') queueRender(); // „seit … min“ aktuell halten
    setTimeout(tick, 30000);
  })();

  show((location.hash || '').slice(1));
  connect();
})();

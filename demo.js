/* Zuhause – Demo-Modus (index.html?demo)
   Ersetzt die Verbindung zu Home Assistant durch eine Attrappe mit Beispieldaten und tauscht den Grundriss
   gegen die Wohnung im EG Asberg. Alles ist bedienbar (Licht, Heizung, Szenen, Automationen), nichts ist echt.
   Wird vor app.js geladen; app.js schaut nur auf window.ZUHAUSE_DEMO. */
(function () {
  'use strict';
  var NOW = Date.now(), MIN = 60000;
  var iso = function (minAgo) { return new Date(NOW - minAgo * MIN).toISOString(); };

  // ---------- Grundriss: Koordinaten in Pixeln des Plans (EG Asberg.png), unten auf die Größe von Stefans Plan skaliert ----------
  var K = 0.68;
  var sc = function (v) { return typeof v === 'number' ? Math.round(v * K) : Array.isArray(v) ? v.map(sc) : typeof v === 'string' ? v.replace(/\d+(\.\d+)?/g, function (n) { return Math.round(n * K); }) : v; };
  var plan = {
    flur: { d: 'M548 167H707V519H1058V628H707V820H548Z', at: [628, 330], narrow: true, lamps: [[628, 240], [628, 700], [880, 575]],
      door: [{ x1: 575, y1: 167, x2: 655, y2: 167, leaf: 'M575 167 L575 247 A80 80 0 0 0 655 167 Z', lx: 575, ly: 247 }] },
    bad: { d: 'M707 167H945V519H707Z', at: [826, 280], narrow: true, lamps: [[826, 430], [880, 215]], win: [[775, 167, 888, 167]] },
    heimburo: { d: 'M945 167H1255V519H945Z', at: [1100, 280], lamps: [[1100, 430], [1200, 215]], win: [[1255, 255, 1255, 428]] },
    essen: { d: 'M1058 519H1255V948H1008V628H1058Z', at: [1132, 720], narrow: true, lamps: [[1132, 860], [1160, 575]], win: [[1255, 645, 1255, 815]] },
    kuche: { d: 'M707 628H1008V948H707Z', at: [857, 730], lamps: [[857, 850], [770, 680]],
      door: [{ x1: 908, y1: 948, x2: 828, y2: 948, leaf: 'M908 948 L908 868 A80 80 0 0 0 828 948 Z', lx: 908, ly: 868 }] },
    toilette: { d: 'M548 820H707V948H548Z', at: [600, 895], short: 'WC', narrow: true, lamps: [[668, 885]], win: [[605, 948, 655, 948]] },
    schlafzimmer: { d: 'M238 879H548V1108H238Z', at: [393, 950], lamps: [[393, 1050], [270, 1060], [516, 1060]], win: [[548, 975, 548, 1068]] },
    ankleide: { d: 'M238 640H548V879H238Z', at: [393, 720], lamps: [[320, 820], [470, 820]] },
    heimgym: { d: 'M20 640H238V1108H20Z', at: [129, 720], narrow: true, lamps: [[129, 880], [70, 1050], [190, 1050]], win: [[20, 685, 20, 810], [20, 875, 20, 1000]] }
  };
  Object.keys(plan).forEach(function (k) {
    var P = plan[k];
    ['d', 'at', 'lamps', 'win'].forEach(function (f) { if (P[f]) P[f] = sc(P[f]); });
    if (P.door) P.door = P.door.map(function (d) { var o = {}; Object.keys(d).forEach(function (f) { o[f] = sc(d[f]); }); return o; });
  });
  window.ZUHAUSE_DEMO = {
    plan: plan,
    out: [],
    idoor: sc(['M778 519H852', 'M962 519H1036', 'M1058 534V608', 'M795 628H870', 'M598 820H673', 'M548 688V762', 'M238 708V788', 'M445 879H525']),
    view: sc('5 150 1265 975')
  };

  // ---------- Beispieldaten ----------
  var AREAS = [['flur', 'Flur'], ['bad', 'Bad'], ['heimburo', 'Heimbüro'], ['essen', 'Essen'], ['kuche', 'Küche'], ['toilette', 'Toilette'],
    ['schlafzimmer', 'Schlafzimmer'], ['heimgym', 'Heimgym'], ['ankleide', 'Ankleide']];
  var S = {}, REG = [], DEV = [];
  function add(id, state, attrs, area, extra) {
    extra = extra || {};
    S[id] = { entity_id: id, state: String(state), attributes: attrs || {}, last_changed: iso(extra.ago != null ? extra.ago : 90), last_updated: iso(extra.ago != null ? extra.ago : 5) };
    REG.push({ ei: id, ai: area || null, di: extra.dev || null, pl: extra.pl || 'demo' });
  }
  function dev(id, name, area) { DEV.push({ id: id, name: name, area_id: area || null }); return id; }
  function light(id, name, area, on, pct, rgb) {
    add('light.' + id, on ? 'on' : 'off', { friendly_name: name, brightness: on ? Math.round(pct * 2.55) : null, rgb_color: rgb || null,
      supported_color_modes: rgb ? ['xy', 'color_temp'] : ['brightness'], color_mode: rgb ? 'xy' : 'brightness' }, area, { ago: on ? 40 : 300 });
  }
  light('flur_decke', 'Flur Decke', 'flur', false); light('flur_eingang', 'Flur Eingang', 'flur', false); light('flur_nachtlicht', 'Flur Nachtlicht', 'flur', false);
  light('bad_decke', 'Bad Decke', 'bad', false); light('bad_spiegel', 'Bad Spiegel', 'bad', true, 80);
  light('buro_decke', 'Heimbüro Decke', 'heimburo', false); light('schreibtisch', 'Heimbüro Schreibtischlampe', 'heimburo', true, 70);
  light('esstisch', 'Essen Esstisch', 'essen', true, 60, [255, 179, 92]); light('essen_wand', 'Essen Wandlampe', 'essen', false);
  light('kuche_decke', 'Küche Decke', 'kuche', false); light('kuche_unterbau', 'Küche Unterbau-LED', 'kuche', true, 100);
  light('wc_decke', 'Toilette Decke', 'toilette', false);
  light('schlaf_decke', 'Schlafzimmer Decke', 'schlafzimmer', false); light('nachttisch_l', 'Schlafzimmer Nachttisch links', 'schlafzimmer', false); light('nachttisch_r', 'Schlafzimmer Nachttisch rechts', 'schlafzimmer', false);
  light('ankleide_decke', 'Ankleide Decke', 'ankleide', false); light('ankleide_spiegel', 'Ankleide Spiegel', 'ankleide', false);
  light('gym_decke', 'Heimgym Decke', 'heimgym', false); light('gym_spiegel', 'Heimgym Spiegel-LED', 'heimgym', true, 45, [255, 154, 60]); light('led', 'Heimgym LED-Streifen', 'heimgym', true, 30, [122, 107, 255]);

  // Klima je Raum (Temperatur, Feuchte); im Heimbüro steht das Fenster offen, im Bad ist es nach dem Duschen feucht
  var CLIMA = { flur: [20.4, 48], bad: [22.6, 71], heimburo: [18.9, 52], essen: [21.3, 50], kuche: [21.8, 55], schlafzimmer: [18.6, 53], heimgym: [19.7, 47], ankleide: [19.2, 49] };
  Object.keys(CLIMA).forEach(function (a) {
    var n = AREAS.filter(function (x) { return x[0] === a; })[0][1], d = dev('klima_' + a, 'Klima ' + n, a);
    add('sensor.' + a + '_temperatur', CLIMA[a][0], { friendly_name: n + ' Temperatur', device_class: 'temperature', unit_of_measurement: '°C' }, a, { dev: d });
    add('sensor.' + a + '_luftfeuchte', CLIMA[a][1], { friendly_name: n + ' Luftfeuchte', device_class: 'humidity', unit_of_measurement: '%' }, a, { dev: d });
    add('sensor.' + a + '_batterie', a === 'bad' ? 14 : 80, { friendly_name: n + ' Batterie', device_class: 'battery', unit_of_measurement: '%' }, a, { dev: d });
  });
  REG.forEach(function (e) { if (/_batterie$/.test(e.ei)) e.ec = 0; });

  // Fenster und Türen
  function contact(id, name, area, cls, open, ago) { add('binary_sensor.' + id, open ? 'on' : 'off', { friendly_name: name, device_class: cls }, area, { ago: ago }); }
  contact('haustur', 'Haustür', 'flur', 'door', false, 95);
  contact('bad_fenster', 'Bad Fenster', 'bad', 'window', false, 30);
  contact('buro_fenster', 'Heimbüro Fenster', 'heimburo', 'window', true, 25);
  contact('essen_fenster', 'Essen Fenster', 'essen', 'window', false, 600);
  contact('terrassentur', 'Küche Terrassentür', 'kuche', 'door', false, 200);
  contact('wc_fenster', 'Toilette Fenster', 'toilette', 'window', false, 900);
  contact('schlaf_fenster', 'Schlafzimmer Fenster', 'schlafzimmer', 'window', false, 480);
  contact('gym_fenster_l', 'Heimgym Fenster links', 'heimgym', 'window', false, 700);
  contact('gym_fenster_r', 'Heimgym Fenster rechts', 'heimgym', 'window', false, 700);
  add('binary_sensor.flur_bewegung', 'off', { friendly_name: 'Flur Bewegung', device_class: 'motion' }, 'flur', { ago: 12 });
  add('binary_sensor.bad_bewegung', 'off', { friendly_name: 'Bad Bewegung', device_class: 'motion' }, 'bad', { ago: 20 });

  // Heizkörperthermostate
  function heat(a, n, target, mode) {
    var cur = CLIMA[a][0];
    add('climate.' + a + '_heizung', mode, { friendly_name: n + ' Heizung', hvac_modes: ['auto', 'heat', 'off'], temperature: mode === 'off' ? null : target, current_temperature: cur,
      hvac_action: mode === 'off' ? 'off' : cur < target - 0.2 ? 'heating' : 'idle', min_temp: 5, max_temp: 28, target_temp_step: 0.5 }, a);
  }
  heat('heimgym', 'Heimgym', 19, 'auto'); heat('essen', 'Essen', 21, 'auto'); heat('kuche', 'Küche', 20, 'auto'); heat('bad', 'Bad', 23, 'heat');
  heat('heimburo', 'Heimbüro', 20.5, 'off'); heat('schlafzimmer', 'Schlafzimmer', 18, 'auto'); heat('ankleide', 'Ankleide', 18, 'auto');

  // Bewohner, Wetter, Strom, Musik, Saugroboter, Einkaufsliste, Backup
  add('person.patrick', 'home', { friendly_name: 'Patrick' }, null, { ago: 140 });
  add('weather.forecast_home', 'partlycloudy', { friendly_name: 'Zuhause', temperature: 9, humidity: 78, wind_speed: 14, wind_speed_unit: 'km/h' });
  var wm = dev('waschmaschine', 'Waschmaschine', 'bad'), pc = dev('rechner', 'Rechner', 'heimburo');
  add('switch.waschmaschine', 'on', { friendly_name: 'Waschmaschine' }, 'bad', { dev: wm });
  add('sensor.waschmaschine_leistung', 412, { friendly_name: 'Waschmaschine Leistung', device_class: 'power', unit_of_measurement: 'W' }, 'bad', { dev: wm });
  add('sensor.waschmaschine_energie', 182.43, { friendly_name: 'Waschmaschine Energie', device_class: 'energy', unit_of_measurement: 'kWh', state_class: 'total_increasing' }, 'bad', { dev: wm });
  add('switch.rechner', 'on', { friendly_name: 'Rechner' }, 'heimburo', { dev: pc });
  add('sensor.rechner_leistung', 64, { friendly_name: 'Rechner Leistung', device_class: 'power', unit_of_measurement: 'W' }, 'heimburo', { dev: pc });
  add('sensor.rechner_energie', 96.8, { friendly_name: 'Rechner Energie', device_class: 'energy', unit_of_measurement: 'kWh', state_class: 'total_increasing' }, 'heimburo', { dev: pc });
  // Echos über die Integration „Alexa Devices“ (Durchsage-Entität, nächster Timer, Nicht stören, Routine)
  var ek = dev('echo_kuche', 'Echo Küche', 'kuche'), eg = dev('echo_heimgym', 'Echo Heimgym', 'heimgym'), ax = { pl: 'alexa_devices' };
  add('media_player.echo_kuche', 'playing', { friendly_name: 'Echo Küche', volume_level: 0.3, media_title: 'Morgenshow', media_artist: 'SWR3', source: 'TuneIn' }, null, { pl: 'alexa_devices', dev: ek });
  add('media_player.echo_heimgym', 'idle', { friendly_name: 'Echo Heimgym', volume_level: 0.4 }, null, { pl: 'alexa_devices', dev: eg });
  add('notify.echo_kuche_announce', 'unknown', { friendly_name: 'Echo Küche Durchsagen' }, null, { pl: 'alexa_devices', dev: ek });
  add('notify.echo_heimgym_announce', 'unknown', { friendly_name: 'Echo Heimgym Durchsagen' }, null, { pl: 'alexa_devices', dev: eg });
  add('sensor.echo_kuche_next_timer', new Date(NOW + 12 * MIN).toISOString(), { friendly_name: 'Echo Küche Nächster Timer', device_class: 'timestamp' }, null, { pl: 'alexa_devices', dev: ek });
  add('switch.echo_heimgym_do_not_disturb', 'off', { friendly_name: 'Echo Heimgym Nicht stören' }, null, { pl: 'alexa_devices', dev: eg });
  add('button.routine_guten_morgen', 'unknown', { friendly_name: 'Guten Morgen' }, null, { pl: 'alexa_devices' });
  var vac = dev('saugroboter', 'Saugroboter');
  add('vacuum.saugroboter', 'docked', { friendly_name: 'Saugroboter', battery_level: 100, fan_speed: 'Standard', fan_speed_list: ['Leise', 'Standard', 'Stark', 'Turbo'] }, null, { dev: vac });
  var SHOP = [{ uid: '1', summary: 'Milch', status: 'needs_action' }, { uid: '2', summary: 'Kaffeebohnen', status: 'needs_action' }, { uid: '3', summary: 'Spülmaschinentabs', status: 'needs_action' }, { uid: '4', summary: 'Brot', status: 'completed' }];
  add('todo.einkaufsliste', 3, { friendly_name: 'Einkaufsliste' }, null, { pl: 'alexa_devices' });
  add('sensor.backup_automatic', iso(300), { friendly_name: 'Letztes automatisches Backup', device_class: 'timestamp' }, null, { pl: 'backup' });
  add('input_number.luftfeuchte_grenze_bad', 65, { friendly_name: 'Lüften: Feuchte-Grenze Bad', min: 40, max: 90, step: 1, unit_of_measurement: '%', mode: 'slider' });
  add('input_number.heizung_absenken', 17, { friendly_name: 'Heizung: Temperatur bei Abwesenheit', min: 12, max: 20, step: 0.5, unit_of_measurement: '°C', mode: 'slider' });

  // Szenen: welche Lampen sie wie setzen
  var SCENES = {
    training: ['Training', 'heimgym', { 'light.gym_decke': [100], 'light.gym_spiegel': [100, [255, 244, 224]], 'light.led': [80, [71, 181, 255]] }],
    abendessen: ['Abendessen', 'essen', { 'light.esstisch': [60, [255, 179, 92]], 'light.essen_wand': [40], 'light.kuche_unterbau': [50] }],
    konzentriert: ['Konzentriert', 'heimburo', { 'light.buro_decke': [100], 'light.schreibtisch': [100] }],
    gute_nacht: ['Gute Nacht', null, { '*': 0, 'light.nachttisch_l': [20, [255, 154, 60]] }]
  };
  Object.keys(SCENES).forEach(function (k) { add('scene.' + k, iso(2000), { friendly_name: SCENES[k][0] }, SCENES[k][1]); });

  // Automationen mit Beschreibung: zeigen, was die Wohnung von allein erledigt
  var AUTOS = [
    ['heizung_fenster', 'Heizung: Aus bei offenem Fenster', 'Fenster länger als 2 Minuten offen: Heizkörper im Raum aus. Fenster zu: wieder auf die alte Temperatur.', 25],
    ['heizung_abwesend_sparen', 'Heizung: Abwesend sparen', 'Niemand zu Hause: alle Räume auf 17 °C. Patrick auf dem Heimweg: Bad und Essen wieder warm.', 1500],
    ['heizung_morgens', 'Heizung: Bad morgens vorheizen', 'Werktags 6:15 Uhr Bad auf 23 °C, um 8 Uhr wieder auf 20 °C.', 800],
    ['nachtlicht', 'Licht: Nachtlicht im Flur', 'Nachts Bewegung im Flur: Nachtlicht auf 10 %, aus nach 2 Minuten Ruhe.', 600],
    ['licht_gehen', 'Licht: Alles aus beim Gehen', 'Letzte Person verlässt die Wohnung: alle Lampen und der Rechner aus.', 1500],
    ['abendlicht', 'Licht: Abendlicht bei Sonnenuntergang', 'Wenn jemand da ist: Esstisch und Küchen-LED warmweiß an.', 1100],
    ['luften', 'Lüften: Hinweis bei hoher Feuchte', 'Luftfeuchte über der Grenze: Hinweis aufs Handy und auf dem Dashboard.', 10],
    ['waschmaschine', 'Haushalt: Waschmaschine fertig', 'Leistung 5 Minuten unter 3 W: Durchsage in der Küche und Nachricht aufs Handy.', 2900],
    ['saugen', 'Haushalt: Saugen wenn niemand da ist', 'Werktags nach 9 Uhr, wenn niemand zu Hause ist: Saugroboter startet.', 1400],
    ['haustur', 'Sicherheit: Haustür offen', 'Haustür länger als 5 Minuten offen: Durchsage über die Echos.', 95]
  ];
  AUTOS.forEach(function (a) { add('automation.' + a[0], 'on', { friendly_name: a[1], id: a[0], last_triggered: iso(a[3]), current: 0 }); });

  // ---------- Verläufe ----------
  function wave(id, t) { var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997; return Math.sin(t / 36e5 * Math.PI / 12 * 2 + h) + 0.4 * Math.sin(t / 54e5 + h * 3); }
  function history(ids, startIso) {
    var out = {}, t0 = new Date(startIso).getTime(), step = Math.max(10 * MIN, (NOW - t0) / 150);
    ids.forEach(function (id) {
      var s = S[id], v = parseFloat(s && s.state); if (!isFinite(v)) return;
      var amp = /temperatur/.test(id) ? 0.8 : /luftfeuchte/.test(id) ? 6 : v * 0.4, pts = [];
      for (var t = t0; t <= NOW; t += step) {
        var x = v + amp * (wave(id, t) - wave(id, NOW));
        if (id === 'sensor.heimburo_temperatur' && t < NOW - 25 * MIN) x += 1.8; // Fenster offen: kühlt aus
        if (id === 'sensor.bad_luftfeuchte' && t < NOW - 30 * MIN) x -= 18; // vor dem Duschen
        pts.push({ lu: t / 1000, s: (Math.round(x * 10) / 10).toString() });
      }
      out[id] = pts;
    });
    return out;
  }
  function energy(ids, startIso, period) {
    var out = {}, t0 = new Date(startIso).getTime(), step = period === 'day' ? 864e5 : 36e5;
    ids.forEach(function (id) {
      var pts = [], wmach = /waschmaschine/.test(id);
      for (var t = t0; t <= NOW; t += step) {
        var hr = new Date(t).getHours(), v;
        if (period === 'day') v = wmach ? (new Date(t).getDay() % 3 === 0 ? 1.4 : 0.05) : 0.6 + 0.3 * Math.abs(wave(id, t));
        else v = wmach ? (hr >= 7 && hr <= 8 ? 0.6 : 0.002) : (hr >= 8 && hr <= 18 ? 0.06 + 0.02 * Math.abs(wave(id, t)) : 0.004);
        pts.push({ start: t, change: Math.round(v * 1000) / 1000 });
      }
      out[id] = pts;
    });
    return out;
  }
  function forecast() {
    var c = ['partlycloudy', 'rainy', 'cloudy', 'sunny', 'partlycloudy', 'rainy'];
    return c.map(function (x, i) { return { datetime: new Date(NOW + i * 864e5).toISOString(), condition: x, temperature: 11 - (i % 3), templow: 4 + (i % 2), precipitation: x === 'rainy' ? 3.2 : 0 }; });
  }

  // ---------- Dienste: verändern den Zustand wie HA es täte ----------
  var changed = [];
  function set(id, state, attrs) {
    var s = S[id]; if (!s) return;
    var old = JSON.parse(JSON.stringify(s));
    if (state != null && String(state) !== s.state) { s.state = String(state); s.last_changed = new Date().toISOString(); }
    if (attrs) Object.keys(attrs).forEach(function (k) { s.attributes[k] = attrs[k]; });
    s.last_updated = new Date().toISOString();
    changed.push({ entity_id: id, old_state: old, new_state: JSON.parse(JSON.stringify(s)) });
  }
  function ids(target) { var t = target && target.entity_id; return t ? [].concat(t) : []; }
  function lightTo(id, v) {
    if (!v) return set(id, 'off', { brightness: null });
    set(id, 'on', { brightness: Math.round((v[0] || 100) * 2.55), rgb_color: v[1] || S[id].attributes.rgb_color });
  }
  function service(dom, svc, data, target) {
    var list = ids(target);
    if (dom === 'light') list.forEach(function (id) {
      var s = S[id], on = svc === 'turn_on' || (svc === 'toggle' && s.state !== 'on');
      if (!on) return set(id, 'off', { brightness: null });
      var a = {}, b = data.brightness != null ? data.brightness : data.brightness_pct != null ? Math.round(data.brightness_pct * 2.55) : s.attributes.brightness || 255;
      a.brightness = b; if (data.rgb_color) a.rgb_color = data.rgb_color; if (data.hs_color || data.color_temp_kelvin) a.rgb_color = data.rgb_color || [255, 214, 170];
      set(id, 'on', a);
    });
    else if (dom === 'switch' || dom === 'automation' || dom === 'input_boolean') list.forEach(function (id) { set(id, svc === 'turn_on' || (svc === 'toggle' && S[id].state !== 'on') ? 'on' : 'off'); });
    else if (dom === 'scene') list.forEach(function (id) {
      var sc = SCENES[id.slice(6)]; if (!sc) return;
      if ('*' in sc[2]) Object.keys(S).forEach(function (k) { if (k.indexOf('light.') === 0 && S[k].state === 'on') set(k, 'off', { brightness: null }); });
      Object.keys(sc[2]).forEach(function (k) { if (k !== '*') lightTo(k, sc[2][k]); });
      set(id, new Date().toISOString());
    });
    else if (dom === 'climate') list.forEach(function (id) {
      var a = S[id].attributes, mode = svc === 'set_hvac_mode' ? data.hvac_mode : S[id].state, t = data.temperature != null ? data.temperature : a.temperature || 20;
      set(id, mode, { temperature: mode === 'off' ? null : t, hvac_action: mode === 'off' ? 'off' : a.current_temperature < t - 0.2 ? 'heating' : 'idle' });
    });
    else if (dom === 'vacuum') list.forEach(function (id) { set(id, { start: 'cleaning', pause: 'paused', return_to_base: 'returning', stop: 'idle' }[svc] || S[id].state, data.fan_speed ? { fan_speed: data.fan_speed } : null); });
    else if (dom === 'input_number') list.forEach(function (id) { set(id, data.value); });
    else if (dom === 'media_player') list.forEach(function (id) {
      if (svc === 'volume_set') set(id, null, { volume_level: data.volume_level });
      else if (svc === 'media_pause') set(id, 'paused'); else if (svc === 'media_play') set(id, 'playing');
    });
    else if (dom === 'todo') {
      if (svc === 'add_item') SHOP.push({ uid: String(Date.now()), summary: data.item, status: 'needs_action' });
      SHOP.forEach(function (i) { if ((i.uid === data.item || i.summary === data.item) && svc === 'update_item') i.status = data.status || i.status; });
      if (svc === 'remove_item') SHOP = SHOP.filter(function (i) { return [].concat(data.item).indexOf(i.uid) < 0; });
      if (svc === 'remove_completed_items') SHOP = SHOP.filter(function (i) { return i.status !== 'completed'; });
      set('todo.einkaufsliste', SHOP.filter(function (i) { return i.status !== 'completed'; }).length);
    }
    else if (dom === 'button' && svc === 'press') list.forEach(function (id) { set(id, new Date().toISOString()); });
  }

  // ---------- Attrappe der HA-WebSocket-API ----------
  function FakeSocket() {
    var self = this; this.readyState = 0; this.subs = [];
    setTimeout(function () { self.readyState = 1; self.emit({ type: 'auth_required' }); }, 150);
  }
  FakeSocket.prototype.emit = function (m) { var self = this; setTimeout(function () { if (self.readyState === 1 && self.onmessage) self.onmessage({ data: JSON.stringify(m) }); }, 30); };
  FakeSocket.prototype.close = function () { this.readyState = 3; };
  FakeSocket.prototype.send = function (raw) {
    var m = JSON.parse(raw), self = this, ok = function (r) { self.emit({ id: m.id, type: 'result', success: true, result: r }); };
    switch (m.type) {
      case 'auth': return this.emit({ type: 'auth_ok', ha_version: '2026.10.4' });
      case 'ping': return this.emit({ id: m.id, type: 'pong' });
      case 'get_states': return ok(Object.keys(S).map(function (k) { return S[k]; }));
      case 'config/area_registry/list': return ok(AREAS.map(function (a) { return { area_id: a[0], name: a[1] }; }));
      case 'config/device_registry/list': return ok(DEV);
      case 'config/entity_registry/list_for_display': return ok({ entities: REG, entity_categories: { 0: 'diagnostic' } });
      case 'subscribe_events': if (m.event_type === 'state_changed') this.subs.push(m.id); return ok(null);
      case 'weather/subscribe_forecast': ok(null); return this.emit({ id: m.id, type: 'event', event: { type: 'daily', forecast: forecast() } });
      case 'history/history_during_period': return ok(history(m.entity_ids, m.start_time));
      case 'recorder/statistics_during_period': return ok(m.types.indexOf('change') > -1 ? energy(m.statistic_ids, m.start_time, m.period) : {});
      case 'todo/item/list': return ok({ items: SHOP.slice() });
      case 'automation/config': var a = AUTOS.filter(function (x) { return 'automation.' + x[0] === m.entity_id; })[0]; return ok({ config: { description: a ? a[2] : '' } });
      case 'call_service':
        changed = []; service(m.domain, m.service, m.service_data || {}, m.target);
        ok({ context: {} });
        changed.forEach(function (c) { self.subs.forEach(function (sid) { self.emit({ id: sid, type: 'event', event: { event_type: 'state_changed', data: c } }); }); });
        return;
      default: return ok([]);
    }
  };
  window.WebSocket = FakeSocket;

  // Hinweis oben, damit klar ist, dass es eine Vorführung ist
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.createElement('div');
    b.textContent = 'Demo: Beispieldaten für die Wohnung im EG. Alles lässt sich antippen, nichts ist echt.';
    b.style.cssText = 'position:sticky;top:0;z-index:50;padding:6px 12px;font:500 12px/1.4 var(--font,system-ui);text-align:center;background:var(--p1,#f59e0b);color:#1c1c1e';
    document.body.insertBefore(b, document.body.firstChild);
    var w = document.querySelector('#weatherBox h2'), l = document.querySelector('#weatherBox a.ext');
    if (w) w.textContent = 'Wetter Moers';
    if (l) l.href = 'https://www.wetteronline.de/wetter/moers';
  });
})();

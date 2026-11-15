/* Evo Pixels Mini App, raise + battle + evolve. Static, localStorage only.
   Wallet connect is real (Phantom / Solflare injected provider, connect
   only, no transactions, no on-chain calls). Google / Facebook / X are
   LOCAL links only, there is no OAuth here, no client IDs, nothing is
   sent anywhere. See the Account / login section below. */
(function () {
  'use strict';

  /* ---------- Data: the 8 gallery creatures, traits as on the website.
     Full trait sets (background / wings / glow) live in the render script
     (/tmp/render_skins_v3.py); the game only needs the display traits.
     Every creature has a DIFFERENT element: 8 creatures, 8 elements. ---------- */
  var CREATURES = [
    { id: 1,  name: 'Evo #1',  file: 'creature-1.png',  body: 'Sky',    face: 'Determined',  trait: 'Red Beanie',   element: 'Gale' },
    { id: 2,  name: 'Evo #2',  file: 'creature-2.png',  body: 'Lime',   face: 'Happy',       trait: 'Bat Wings',    element: 'Leaf' },
    { id: 3,  name: 'Evo #3',  file: 'creature-3.png',  body: 'Teal',   face: 'Wink',        trait: 'Gold Glow',    element: 'Tide' },
    { id: 4,  name: 'Evo #4',  file: 'creature-4.png',  body: 'Violet', face: 'Wink',        trait: 'Silver Crown', element: 'Volt' },
    { id: 5,  name: 'Evo #5',  file: 'creature-5.png',  body: 'Mint',   face: 'Wink',        trait: 'Big Horns',    element: 'Frost' },
    { id: 8,  name: 'Evo #8',  file: 'creature-8.png',  body: 'Coral',  face: 'Mischievous', trait: 'Red Beanie',   element: 'Ember' },
    { id: 16, name: 'Evo #16', file: 'creature-16.png', body: 'Orange', face: 'Determined',  trait: 'Big Horns',    element: 'Terra' },
    { id: 17, name: 'Evo #17', file: 'creature-17.png', body: 'Pink',   face: 'Happy',       trait: 'Silver Crown', element: 'Charm' }
  ];

  /* Skins are OVERLAY KITS on the picked creature: each skin swaps only the
     accessory / wings / glow. Body, face and background stay the picked
     creature's own, the creature you picked is always the creature you
     see. "original" is the creature exactly as picked (its gallery art).
     Files are pre-rendered per creature (game/assets/skins/
     c<creatureId>-<skinId>.png, plus evo-<creatureId>.png for the one
     fixed evolved form). price in coins; minLevel gates the later ones. */
  var SKINS = [
    { id: 'original',     name: 'Original',     traits: 'Your creature, unchanged',                 price: 0,   minLevel: 1 },
    { id: 'snow-glow',    name: 'Snow Glow',    traits: 'White Glow',                               price: 0,   minLevel: 1 },
    { id: 'captain-hat',  name: 'Captain Hat',  traits: 'Top Hat',                                 price: 50,  minLevel: 1 },
    { id: 'pink-bat',     name: 'Pink Bat',     traits: 'Bat Wings · Pink Glow',                    price: 50,  minLevel: 1 },
    { id: 'party-beanie', name: 'Party Beanie', traits: 'Red Beanie · White Glow',                  price: 50,  minLevel: 1 },
    { id: 'bubble-wings', name: 'Bubble Wings', traits: 'Red Beanie · White Wings · Pink Glow',    price: 75,  minLevel: 1 },
    { id: 'rebel-horns',  name: 'Rebel Horns',  traits: 'Big Horns · Bat Wings',                    price: 100, minLevel: 1 },
    { id: 'silver-halo',  name: 'Silver Halo',  traits: 'Silver Crown · White Wings · White Glow', price: 100, minLevel: 3 },
    { id: 'night-hat',    name: 'Night Hat',    traits: 'Top Hat · Bat Wings · White Glow',        price: 150, minLevel: 3 },
    { id: 'ember-crown',  name: 'Ember Crown',  traits: 'Golden Crown · Gold Glow',                price: 150, minLevel: 4 },
    { id: 'moon-crown',   name: 'Moon Crown',   traits: 'Silver Crown · Bat Wings · White Glow',   price: 200, minLevel: 4 },
    { id: 'gold-wings',   name: 'Gold Wings',   traits: 'Golden Crown · Golden Wings · Gold Glow', price: 300, minLevel: 5 }
  ];
  /* v2 skin ids were renamed in v3 (skins became overlays, not full
     replacements). Old saves keep what they bought through this map. */
  var SKIN_ID_MAP = {
    'mint-fresh': 'snow-glow', 'sky-captain': 'captain-hat', 'pink-pop': 'pink-bat',
    'lime-party': 'party-beanie', 'bubblegum': 'bubble-wings', 'coral-rebel': 'rebel-horns',
    'violet-royal': 'silver-halo', 'midnight': 'night-hat', 'ember-king': 'ember-crown',
    'frost-knight': 'moon-crown', 'golden-legend': 'gold-wings'
  };
  function skinById(id) {
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i];
    return SKINS[0];
  }

  /* Type chart: attacker element -> defender element -> multiplier. 1.0 otherwise.
     Every element is strong against two and weak against at least one, so no
     element is a dead end and no two starters share an element. */
  var TYPE_CHART = {
    Ember: { Leaf: 1.25, Frost: 1.25, Tide: 0.8, Terra: 0.8 },
    Leaf:  { Tide: 1.25, Terra: 1.25, Ember: 0.8, Gale: 0.8, Frost: 0.8 },
    Tide:  { Ember: 1.25, Terra: 1.25, Leaf: 0.8, Volt: 0.8 },
    Volt:  { Tide: 1.25, Gale: 1.25, Terra: 0.8, Charm: 0.8 },
    Gale:  { Leaf: 1.25, Terra: 1.25, Volt: 0.8, Frost: 0.8 },
    Frost: { Leaf: 1.25, Gale: 1.25, Ember: 0.8, Charm: 0.8 },
    Charm: { Frost: 1.25, Volt: 1.25, Gale: 0.8, Terra: 0.8 },
    Terra: { Volt: 1.25, Ember: 1.25, Charm: 1.25, Leaf: 0.8, Tide: 0.8, Gale: 0.8 }
  };
  function typeMult(att, def) {
    var row = TYPE_CHART[att];
    if (row && row[def]) return row[def];
    return 1;
  }

  var SHOP = [
    { key: 'food', name: 'Food', desc: 'Feed your Evo. +18 Hunger when used.', price: 5 },
    { key: 'toy', name: 'Toy', desc: 'Play boost. +20 Happiness when used.', price: 8 },
    { key: 'gear', name: 'Battle Gear', desc: 'Use in battle. +50% attack for that battle.', price: 12 }
  ];
  var EVOLVE_LEVEL = 5;
  var DECAY_PER_HOUR = 1;

  /* ---------- Helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function creatureById(id) {
    for (var i = 0; i < CREATURES.length; i++) if (CREATURES[i].id === id) return CREATURES[i];
    /* Strict: a bad id must surface, never silently show another creature
       (the old fallback to the teal Evo #3 was the char bug). load()
       resets an unknown saved id to the picker instead of crashing. */
    throw new Error('Unknown creature id: ' + id);
  }
  function xpNeeded(level) { return 30 * level; } /* XP to go from level to level+1 */
  function levelFromTotal(total) {
    var level = 1, spent = 0;
    while (total >= spent + xpNeeded(level)) { spent += xpNeeded(level); level++; }
    return { level: level, into: total - spent, needed: xpNeeded(level) };
  }
  function playerMaxHp(level, evolved) { return 50 + 14 * level + (evolved ? 25 : 0); }
  function playerAttack(level, evolved) { return 8 + 2 * level + (evolved ? 4 : 0); }
  function botMaxHp(level) { return 40 + 12 * level; }
  function botAttack(level) { return 6 + 2 * level; }

  /* ---------- Telegram ---------- */
  var TG = (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
  var IN_TELEGRAM = !!(TG && TG.initData);
  function haptic(kind) {
    try {
      if (TG && TG.HapticFeedback) {
        if (kind === 'success' || kind === 'error' || kind === 'warning') TG.HapticFeedback.notificationOccurred(kind);
        else TG.HapticFeedback.impactOccurred('light');
      }
    } catch (e) { /* haptics are best-effort */ }
  }

  /* ---------- State ---------- */
  var memoryStore = {};
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return memoryStore[k] || null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { memoryStore[k] = v; } },
    remove: function (k) { try { window.localStorage.removeItem(k); } catch (e) { delete memoryStore[k]; } }
  };
  function playerId() {
    if (TG && TG.initDataUnsafe && TG.initDataUnsafe.user && TG.initDataUnsafe.user.id) {
      return 'tg-' + TG.initDataUnsafe.user.id;
    }
    var id = store.get('evo-pixels-player');
    if (!id) { id = 'local-' + Math.random().toString(36).slice(2, 10); store.set('evo-pixels-player', id); }
    return id;
  }
  var KEY = 'evo-pixels-game:v1:' + playerId();

  function defaultState() {
    return {
      creatureId: null,
      totalXp: 0,
      coins: 0,
      hunger: 80, happiness: 80, energy: 80,
      lastSeen: Date.now(),
      lastCareDay: null,
      inventory: { food: 3, toy: 1, gear: 1 },
      wins: 0, losses: 0, cares: 0,
      evolved: false,
      skinId: 'original',
      unlockedSkins: ['original', 'snow-glow'],
      firstWinDone: false,
      account: { methods: [], dismissed: false },
      battle: null
    };
  }
  var state = defaultState();
  function save() {
    state.lastSeen = Date.now();
    try { store.set(KEY, JSON.stringify(state)); } catch (e) { /* storage full or unavailable; game keeps running in memory */ }
  }
  function load() {
    var raw = store.get(KEY);
    if (!raw) return;
    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        var fresh = defaultState();
        for (var k in fresh) if (parsed[k] !== undefined) fresh[k] = parsed[k];
        /* Unknown saved creature id: back to the picker, never the wrong creature. */
        if (fresh.creatureId !== null) {
          var known = false;
          for (var i = 0; i < CREATURES.length; i++) if (CREATURES[i].id === fresh.creatureId) known = true;
          if (!known) fresh.creatureId = null;
        }
        /* v2 skin ids were renamed in v3; keep what the player bought. */
        if (fresh.skinId && SKIN_ID_MAP[fresh.skinId]) fresh.skinId = SKIN_ID_MAP[fresh.skinId];
        if (fresh.unlockedSkins) fresh.unlockedSkins = fresh.unlockedSkins.map(function (id) { return SKIN_ID_MAP[id] || id; });
        state = fresh;
      }
    } catch (e) { /* corrupt save: start fresh */ }
  }
  function applyDecay() {
    if (!state.creatureId) return;
    var hours = Math.floor((Date.now() - (state.lastSeen || Date.now())) / 3600000);
    if (hours > 0) {
      var drop = hours * DECAY_PER_HOUR;
      state.hunger = clamp(state.hunger - drop, 0, 100);
      state.happiness = clamp(state.happiness - drop, 0, 100);
      state.energy = clamp(state.energy - drop, 0, 100);
    }
  }
  function levelInfo() { return levelFromTotal(state.totalXp); }
  /* The picked creature's own art is the base everywhere (Home, battle,
     picker). A skin only swaps the accessory / wings / glow on top of it
     (pre-rendered per creature); the evolved form is one fixed look per
     creature. This is the fix for the char bug: the old version returned
     only the skin file, so every creature showed the teal hero art. */
  function creatureArt() {
    var c = creatureById(state.creatureId);
    if (state.evolved) return 'assets/skins/evo-' + c.id + '.png';
    if (!state.skinId || state.skinId === 'original') return 'assets/' + c.file;
    return 'assets/skins/c' + c.id + '-' + state.skinId + '.png';
  }
  /* The art a skin would give the CURRENT creature (used for previews). */
  function skinArtFor(skinId) {
    var c = creatureById(state.creatureId);
    if (!skinId || skinId === 'original') return 'assets/' + c.file;
    return 'assets/skins/c' + c.id + '-' + skinId + '.png';
  }
  function addXp(n) { state.totalXp += n; }

  /* ---------- Animation helpers (transform/opacity only; the CSS gates
     them behind prefers-reduced-motion, so under reduced motion these
     classes simply do nothing) ---------- */
  function animateEl(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth; /* restart the animation */
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, ms || 600);
  }
  function floatText(container, text, cls) {
    if (!container) return;
    var span = document.createElement('span');
    span.className = 'float-text' + (cls ? ' ' + cls : '');
    span.textContent = text;
    container.appendChild(span);
    setTimeout(function () { if (span.parentNode) span.parentNode.removeChild(span); }, 1000);
  }
  function spawnSparks(container) {
    if (!container) return;
    container.innerHTML = '';
    for (var i = 0; i < 12; i++) {
      var s = document.createElement('span');
      s.className = 'spark';
      var ang = (i / 12) * Math.PI * 2 + Math.random() * 0.5;
      var dist = 55 + Math.random() * 40;
      s.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
      s.style.setProperty('--dy', Math.round(Math.sin(ang) * dist) + 'px');
      container.appendChild(s);
    }
    setTimeout(function () { container.innerHTML = ''; }, 950);
  }
  function spawnConfetti(container) {
    if (!container) return;
    for (var i = 0; i < 10; i++) {
      (function (n) {
        var s = document.createElement('span');
        s.className = 'confetti-bit';
        s.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 140) + 'px');
        container.appendChild(s);
        setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 950 + n * 40);
      })(i);
    }
  }

  /* ---------- Views ---------- */
  var currentTab = 'home';
  function showView(name) {
    ['picker', 'home', 'battle', 'items', 'quests', 'evolve', 'skins', 'login'].forEach(function (v) {
      $('view-' + v).hidden = (v !== name);
    });
    var shown = $('view-' + name);
    if (shown) {
      shown.classList.remove('view-enter');
      void shown.offsetWidth;
      shown.classList.add('view-enter');
    }
    $('tabbar').style.display = (name === 'picker' || name === 'login') ? 'none' : '';
    if (name !== 'evolve' && name !== 'login') currentTab = name;
    var tabs = document.querySelectorAll('.tab');
    /* Evolve is a moment, not a menu: no tab stays lit while it shows. */
    tabs.forEach(function (t) { t.classList.toggle('active', name !== 'evolve' && t.getAttribute('data-tab') === currentTab); });
    updateMainButton();
    window.scrollTo(0, 0);
  }
  function updateMainButton() {
    if (!TG || !TG.MainButton) return;
    try {
      if (IN_TELEGRAM && currentTab === 'home' && state.creatureId) {
        TG.MainButton.setText('Battle');
        TG.MainButton.show();
      } else {
        TG.MainButton.hide();
      }
    } catch (e) { /* MainButton is best-effort */ }
  }

  /* ---------- Picker ---------- */
  var pickedId = null;
  function renderPicker() {
    var grid = $('picker-grid');
    grid.innerHTML = '';
    CREATURES.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'picker-card' + (pickedId === c.id ? ' selected' : '');
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', pickedId === c.id ? 'true' : 'false');
      b.innerHTML = '<img src="assets/' + c.file + '" alt="' + c.name + '" width="96" height="96">' +
        '<p class="picker-name">' + c.name + '</p>' +
        '<p class="picker-traits">' + c.body + ' · ' + c.face + '<br>' + c.trait + '<br>Element: ' + c.element + '</p>';
      b.addEventListener('click', function () {
        pickedId = c.id;
        haptic('light');
        renderPicker();
        $('picker-detail').textContent = c.name + ' · ' + c.body + ' body, ' + c.face.toLowerCase() + ' face, ' + c.trait + '. Element ' + c.element + '.';
        $('picker-confirm').disabled = false;
      });
      grid.appendChild(b);
    });
  }

  /* ---------- Home ---------- */
  function renderHome() {
    var c = creatureById(state.creatureId);
    var li = levelInfo();
    $('coins-num').textContent = state.coins;
    $('home-art').src = creatureArt();
    $('home-art').alt = state.evolved ? 'Your evolved ' + c.name : 'Your ' + c.name;
    $('home-name').textContent = state.evolved ? c.name + ' (Evolved)' : c.name;
    $('home-element').textContent = c.element;
    $('home-skin').textContent = skinById(state.skinId).name;
    $('home-traits').textContent = c.body + ' · ' + c.face + ' · ' + c.trait;
    $('home-level').textContent = li.level;
    $('home-xp-text').textContent = li.into + ' / ' + li.needed + ' XP';
    $('home-xp-fill').style.width = clamp(Math.round(li.into / li.needed * 100), 0, 100) + '%';
    $('home-xp-note').textContent = state.evolved
      ? 'Evolved · ' + li.needed + ' XP to level ' + (li.level + 1) + '.'
      : li.needed - li.into + ' XP to level ' + (li.level + 1) + '. Evolves at level ' + EVOLVE_LEVEL + '.';
    $('stat-hunger-fill').style.height = state.hunger + '%';
    $('stat-hunger-num').textContent = state.hunger;
    $('stat-happy-fill').style.height = state.happiness + '%';
    $('stat-happy-num').textContent = state.happiness;
    $('stat-energy-fill').style.height = state.energy + '%';
    $('stat-energy-num').textContent = state.energy;
    $('btn-feed').disabled = state.inventory.food < 1 || state.hunger >= 100;
    $('btn-play').disabled = state.energy < 10 || state.happiness >= 100;
    $('btn-rest').disabled = state.energy >= 100;
    $('evolve-banner').hidden = !(li.level >= EVOLVE_LEVEL && !state.evolved);
    $('rec-wins').textContent = state.wins;
    $('rec-losses').textContent = state.losses;
    $('rec-cares').textContent = state.cares;
    $('daily-note').textContent = state.lastCareDay === todayKey()
      ? 'Daily care bonus already claimed today (+10 coins).'
      : 'First care action today earns a +10 coin daily bonus.';
    $('telegram-note').hidden = IN_TELEGRAM;
  }

  function dailyBonus() {
    if (state.lastCareDay !== todayKey()) {
      state.lastCareDay = todayKey();
      state.coins += 10;
      return true;
    }
    return false;
  }
  function careDone(msg) {
    state.cares++;
    var bonus = dailyBonus();
    $('care-msg').textContent = msg + (bonus ? ' Daily care bonus: +10 coins.' : '');
    haptic('light');
    save();
    renderAll();
  }
  function doFeed() {
    if (state.inventory.food < 1) { $('care-msg').textContent = 'No food left. Buy more in Items.'; return; }
    if (state.hunger >= 100) { $('care-msg').textContent = 'Hunger is already full.'; return; }
    state.inventory.food--;
    state.hunger = clamp(state.hunger + 18, 0, 100);
    addXp(8);
    animateEl($('home-disc'), 'anim-hop', 950);
    floatText($('home-disc').parentNode, '+18 Hunger', 'good');
    careDone('Fed your Evo. Hunger +18, +8 XP.');
  }
  function doPlay() {
    if (state.energy < 10) { $('care-msg').textContent = 'Not enough energy to play. Rest first.'; return; }
    if (state.happiness >= 100) { $('care-msg').textContent = 'Happiness is already full.'; return; }
    state.energy = clamp(state.energy - 10, 0, 100);
    state.happiness = clamp(state.happiness + 16, 0, 100);
    addXp(8);
    animateEl($('home-disc'), 'anim-jump', 750);
    floatText($('home-disc').parentNode, '+16 Happiness', 'good');
    careDone('Played with your Evo. Happiness +16, Energy -10, +8 XP.');
  }
  function doRest() {
    if (state.energy >= 100) { $('care-msg').textContent = 'Energy is already full.'; return; }
    state.energy = clamp(state.energy + 20, 0, 100);
    addXp(5);
    animateEl($('home-disc'), 'anim-droop', 1100);
    floatText($('home-disc').parentNode, '+20 Energy', 'good');
    setTimeout(function () { floatText($('home-disc').parentNode, 'z z', ''); }, 250);
    careDone('Your Evo rested. Energy +20, +5 XP.');
  }

  /* ---------- Battle ---------- */
  function newBattle() {
    var li = levelInfo();
    var rivals = CREATURES.filter(function (c) { return c.id !== state.creatureId; });
    var bot = rivals[Math.floor(Math.random() * rivals.length)];
    var botLevel = clamp(li.level + (Math.floor(Math.random() * 3) - 1), 1, 99);
    state.battle = {
      botId: bot.id, botLevel: botLevel,
      playerHp: playerMaxHp(li.level, state.evolved),
      botHp: botMaxHp(botLevel),
      playerDefending: false, botDefending: false,
      gearActive: false, botSpecialCd: 0,
      over: false, log: ['A wild ' + bot.name + ' (level ' + botLevel + ') appeared. Your move first.']
    };
    $('fighter-player').classList.remove('is-ko');
    $('fighter-bot').classList.remove('is-ko');
    save();
    renderBattle();
  }
  function botCreature() { return creatureById(state.battle.botId); }
  function logLine(text) {
    state.battle.log.unshift(text);
    if (state.battle.log.length > 20) state.battle.log.length = 20;
  }
  function rollDamage(atk, attEl, defEl) {
    var mult = typeMult(attEl, defEl);
    var dmg = Math.round(atk * (0.9 + Math.random() * 0.2) * mult);
    return { dmg: Math.max(1, dmg), mult: mult };
  }
  function effText(mult) { return mult > 1 ? ' Super effective.' : (mult < 1 ? ' Not very effective.' : ''); }
  function endBattle(won) {
    var b = state.battle;
    b.over = true;
    if (won) {
      state.wins++;
      state.coins += 15;
      addXp(30);
      state.firstWinDone = true;
      logLine('You won. +30 XP, +15 coins.');
      $('result-line').textContent = 'You won. +30 XP, +15 coins.';
      haptic('success');
    } else {
      state.losses++;
      addXp(10);
      logLine('You lost. +10 XP, no coins.');
      $('result-line').textContent = 'You lost. +10 XP, no coins. Train and try again.';
      haptic('error');
    }
    $('battle-result').hidden = false;
    $('battle-actions').style.display = 'none';
    $('item-picker').hidden = true;
    save();
    renderBattle();
    if (won) {
      animateEl($('fighter-player'), 'anim-celebrate', 1700);
      spawnConfetti($('fighter-player'));
      animateEl($('fighter-bot'), 'anim-ko', 700);
      $('fighter-bot').classList.add('is-ko');
    } else {
      animateEl($('fighter-player'), 'anim-ko', 700);
      $('fighter-player').classList.add('is-ko');
      animateEl($('fighter-bot'), 'anim-celebrate', 1700);
    }
  }
  function botTurn() {
    var b = state.battle;
    if (b.over) return;
    var li = levelInfo();
    var pc = creatureById(state.creatureId);
    var bc = botCreature();
    var atk = botAttack(b.botLevel);
    var action = Math.random();
    var dealt = 0;
    if (b.botSpecialCd > 0) b.botSpecialCd--;
    if (action < 0.15) {
      b.botDefending = true;
      logLine(bc.name + ' braces itself. Its next hit taken will be halved.');
    } else if (action < 0.32 && b.botSpecialCd === 0) {
      b.botSpecialCd = 3;
      var r = rollDamage(Math.round(atk * 1.6), bc.element, pc.element);
      var dmg = b.playerDefending ? Math.max(1, Math.round(r.dmg / 2)) : r.dmg;
      b.playerHp = Math.max(0, b.playerHp - dmg);
      dealt = dmg;
      logLine(bc.name + ' used Special for ' + dmg + ' damage.' + effText(r.mult) + (b.playerDefending ? ' Your Defend halved it.' : ''));
      b.playerDefending = false;
    } else {
      var r2 = rollDamage(atk, bc.element, pc.element);
      var dmg2 = b.playerDefending ? Math.max(1, Math.round(r2.dmg / 2)) : r2.dmg;
      if (b.botDefending) { /* bot defended last turn; that only affects damage it takes, not this */ }
      b.playerHp = Math.max(0, b.playerHp - dmg2);
      dealt = dmg2;
      logLine(bc.name + ' attacked for ' + dmg2 + ' damage.' + effText(r2.mult) + (b.playerDefending ? ' Your Defend halved it.' : ''));
      b.playerDefending = false;
    }
    if (dealt > 0) {
      animateEl($('fighter-bot'), 'anim-lunge-l', 500);
      animateEl($('fighter-player'), 'anim-shake', 500);
      floatText($('fighter-player'), '-' + dealt, 'hurt');
    }
    if (b.playerHp <= 0) { save(); endBattle(false); return; }
    save();
    renderBattle();
  }
  function playerAction(kind) {
    var b = state.battle;
    if (!b || b.over) return;
    var li = levelInfo();
    var pc = creatureById(state.creatureId);
    var bc = botCreature();
    var atk = playerAttack(li.level, state.evolved);
    if (state.hunger < 30) atk = Math.round(atk * 0.9);
    if (b.gearActive) atk = Math.round(atk * 1.5);

    if (kind === 'special') {
      if (state.energy < 15) { $('battle-msg').textContent = 'Not enough energy for Special (needs 15). Rest on Home first.'; return; }
      state.energy = clamp(state.energy - 15, 0, 100);
      var rs = rollDamage(Math.round(atk * 1.8), pc.element, bc.element);
      var ds = b.botDefending ? Math.max(1, Math.round(rs.dmg / 2)) : rs.dmg;
      b.botHp = Math.max(0, b.botHp - ds);
      logLine('Your ' + pc.name + ' used Special for ' + ds + ' damage.' + effText(rs.mult) + (b.botDefending ? ' The rival was defending, so it was halved.' : ''));
      b.botDefending = false;
      animateEl($('fighter-player'), 'anim-lunge-r', 500);
      animateEl($('fighter-bot'), 'anim-shake', 500);
      floatText($('fighter-bot'), '-' + ds, 'hurt');
    } else if (kind === 'defend') {
      b.playerDefending = true;
      logLine('Your ' + pc.name + ' braces itself. The next hit taken will be halved.');
    } else if (kind === 'attack') {
      var ra = rollDamage(atk, pc.element, bc.element);
      var da = b.botDefending ? Math.max(1, Math.round(ra.dmg / 2)) : ra.dmg;
      b.botHp = Math.max(0, b.botHp - da);
      logLine('Your ' + pc.name + ' attacked for ' + da + ' damage.' + effText(ra.mult) + (b.botDefending ? ' The rival was defending, so it was halved.' : ''));
      b.botDefending = false;
      animateEl($('fighter-player'), 'anim-lunge-r', 500);
      animateEl($('fighter-bot'), 'anim-shake', 500);
      floatText($('fighter-bot'), '-' + da, 'hurt');
    }
    $('battle-msg').textContent = '';
    if (b.botHp <= 0) { save(); endBattle(true); return; }
    save();
    renderBattle();
    /* Let the player's hit read before the rival answers. */
    setTimeout(function () { if (state.battle && !state.battle.over) botTurn(); }, 650);
  }
  function renderBattle() {
    var b = state.battle;
    $('battle-lobby').hidden = !!b;
    $('battle-arena').hidden = !b;
    if (!b) return;
    var li = levelInfo();
    var pc = creatureById(state.creatureId);
    var bc = botCreature();
    var pMax = playerMaxHp(li.level, state.evolved);
    var bMax = botMaxHp(b.botLevel);
    $('battle-player-art').src = creatureArt();
    $('battle-player-name').textContent = pc.name;
    $('battle-player-element').textContent = pc.element;
    $('battle-player-level').textContent = li.level;
    $('battle-player-hp').textContent = b.playerHp + ' / ' + pMax;
    $('battle-player-hp-fill').style.width = clamp(Math.round(b.playerHp / pMax * 100), 0, 100) + '%';
    $('battle-bot-art').src = 'assets/' + bc.file;
    $('battle-bot-name').textContent = bc.name;
    $('battle-bot-element').textContent = bc.element;
    $('battle-bot-level').textContent = b.botLevel;
    $('battle-bot-hp').textContent = b.botHp + ' / ' + bMax;
    $('battle-bot-hp-fill').style.width = clamp(Math.round(b.botHp / bMax * 100), 0, 100) + '%';
    $('battle-player-status').textContent = (b.playerDefending ? 'Defending. ' : '') + (b.gearActive ? 'Gear active (+50% attack).' : '');
    $('battle-bot-status').textContent = b.botDefending ? 'Defending.' : '';
    var notes = [];
    if (state.hunger < 30) notes.push('Hungry: your attack is 10% weaker. Feed on Home.');
    if (state.energy < 15) notes.push('Energy under 15: Special is unavailable.');
    $('battle-note').textContent = notes.join(' ');
    $('btn-special').disabled = b.over || state.energy < 15;
    $('btn-attack').disabled = b.over;
    $('btn-defend').disabled = b.over;
    $('btn-item').disabled = b.over;
    $('battle-actions').style.display = b.over ? 'none' : '';
    $('battle-result').hidden = !b.over;
    var log = $('battle-log');
    log.innerHTML = '';
    b.log.forEach(function (line) {
      var liEl = document.createElement('li');
      liEl.textContent = line;
      log.appendChild(liEl);
    });
    $('arena-note').textContent = '';
  }

  /* ---------- Evolve ---------- */
  function renderEvolve() {
    var c = creatureById(state.creatureId);
    var li = levelInfo();
    $('evolve-art').src = creatureArt();
    $('evolve-name').textContent = c.name + (state.evolved ? ' (Evolved)' : '');
    $('evolve-traits').textContent = state.evolved
      ? 'Evolved · Level ' + li.level
      : 'Gen 1 · Level ' + li.level + ' · Ready to evolve';
    $('evolve-before').hidden = state.evolved;
    $('evolve-after').hidden = !state.evolved;
    if (state.evolved) {
      $('evolve-after-text').textContent = 'Your ' + c.name + ' evolved into its final form. Max HP +25, attack +4, permanently.';
    }
  }
  /* Evolution is a form change only: no roll, no tiers, every creature
     evolves into the same kind of final form (fierce face, gold crown,
     white wings, gold glow). */
  function doEvolve() {
    if (state.evolved) return;
    state.evolved = true;
    haptic('success');
    save();
    renderEvolve();
    renderAll();
  }

  /* ---------- Items: the shelf ---------- */
  function renderItems() {
    $('items-coins').textContent = state.coins;
    var shelf = $('inventory-list');
    shelf.innerHTML = '';
    var rows = [
      { key: 'food', name: 'Food', desc: 'Feed your Evo. +18 Hunger when used.', usable: true },
      { key: 'toy', name: 'Toy', desc: 'Play boost. +20 Happiness when used.', usable: true },
      { key: 'gear', name: 'Battle Gear', desc: 'Use it from the Battle screen. +50% attack for that battle.', usable: false }
    ];
    rows.forEach(function (row) {
      var count = state.inventory[row.key] || 0;
      var tile = document.createElement('div');
      tile.className = 'shelf-tile';
      tile.innerHTML = '<p class="shelf-name">' + row.name + '</p>' +
        '<p class="shelf-desc">' + row.desc + '</p>' +
        '<span class="shelf-count num">x' + count + '</span>';
      if (row.usable) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'item-btn';
        btn.textContent = 'Use';
        btn.disabled = count < 1;
        btn.addEventListener('click', function () { useItem(row.key); });
        tile.appendChild(btn);
      }
      shelf.appendChild(tile);
    });
    var shop = $('shop-list');
    shop.innerHTML = '';
    SHOP.forEach(function (item) {
      var liEl = document.createElement('li');
      liEl.className = 'shop-row';
      liEl.innerHTML = '<div class="shop-info"><p class="shop-name">' + item.name + '</p>' +
        '<p class="shop-desc">' + item.desc + '</p></div>' +
        '<span class="shop-price num">' + item.price + ' <small>coins</small></span>';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'item-btn';
      btn.textContent = 'Buy';
      btn.disabled = state.coins < item.price;
      btn.addEventListener('click', function () {
        if (state.coins < item.price) return;
        state.coins -= item.price;
        state.inventory[item.key] = (state.inventory[item.key] || 0) + 1;
        haptic('light');
        save();
        renderAll();
      });
      liEl.appendChild(btn);
      shop.appendChild(liEl);
    });
  }
  function useItem(key) {
    if ((state.inventory[key] || 0) < 1) return;
    if (key === 'food') {
      if (state.hunger >= 100) return;
      state.inventory.food--;
      state.hunger = clamp(state.hunger + 18, 0, 100);
      addXp(8);
      state.cares++;
      dailyBonus();
    } else if (key === 'toy') {
      if (state.happiness >= 100) return;
      state.inventory.toy--;
      state.happiness = clamp(state.happiness + 20, 0, 100);
      addXp(8);
      state.cares++;
      dailyBonus();
    }
    haptic('light');
    save();
    renderAll();
  }

  /* ---------- Quests ---------- */
  function renderQuests() {
    var li = levelInfo();
    var list = $('quest-list');
    list.innerHTML = '';
    var quests = [
      {
        name: 'Daily care', desc: 'Feed and play with your creature every day.',
        done: state.lastCareDay === todayKey(),
        progress: state.lastCareDay === todayKey() ? 'Done today.' : 'Feed, play or rest once today.'
      },
      {
        name: 'First battle', desc: 'Win your first battle in the arena.',
        done: state.wins >= 1,
        progress: 'Won ' + state.wins + ' / 1 battles.'
      },
      {
        name: 'Evolution', desc: 'Evolve your creature to its final form.',
        done: state.evolved,
        progress: state.evolved ? 'Evolved.' : 'Level ' + li.level + ' / ' + EVOLVE_LEVEL + '. Evolves at level ' + EVOLVE_LEVEL + '.'
      },
      {
        name: 'Bring friends', desc: 'Invite friends to raise their own Evos.',
        done: false, soon: true,
        progress: 'Coming soon. Invite links open with the Telegram bot.'
      }
    ];
    quests.forEach(function (q) {
      var liEl = document.createElement('li');
      var status = q.done ? 'Done' : (q.soon ? 'Coming soon' : 'In progress');
      var cls = q.done ? 'done' : (q.soon ? 'soon' : 'progress');
      liEl.className = 'quest-node ' + cls;
      liEl.innerHTML = '<span class="quest-dot" aria-hidden="true"></span>' +
        '<p class="quest-name">' + q.name + ' · <span class="quest-status">' + status + '</span></p>' +
        '<p class="quest-desc">' + q.desc + '</p>' +
        '<p class="quest-progress">' + q.progress + '</p>';
      list.appendChild(liEl);
    });
  }

  /* ---------- Skins: the wardrobe ---------- */
  function equipSkin(id) {
    var s = skinById(id);
    if (!s || state.unlockedSkins.indexOf(id) === -1) return;
    state.skinId = id;
    haptic('light');
    save();
    renderAll();
  }
  function buySkin(id) {
    var s = skinById(id);
    var li = levelInfo();
    if (!s || state.unlockedSkins.indexOf(id) !== -1) return;
    if (li.level < s.minLevel || state.coins < s.price) return;
    state.coins -= s.price;
    state.unlockedSkins.push(id);
    state.skinId = id;
    haptic('success');
    save();
    renderAll();
  }
  function renderSkins() {
    var grid = $('skin-grid');
    grid.innerHTML = '';
    var li = levelInfo();
    $('skins-coins').textContent = state.coins;
    SKINS.forEach(function (s) {
      var owned = state.unlockedSkins.indexOf(s.id) !== -1;
      var equipped = state.skinId === s.id;
      var levelOk = li.level >= s.minLevel;
      var card = document.createElement('div');
      card.className = 'skin-card' + (equipped ? ' equipped' : '');
      var status = equipped ? 'Equipped' : (owned ? 'Owned' : (s.price === 0 ? 'Free' : s.price + ' coins'));
      card.innerHTML = '<img src="' + skinArtFor(s.id) + '" alt="' + s.name + ' skin on your ' + creatureById(state.creatureId).name + '" width="200" height="200">' +
        '<p class="skin-name">' + s.name + '</p>' +
        '<p class="skin-traits">' + s.traits + '</p>' +
        '<p class="skin-price' + (s.price === 0 ? ' free' : '') + '">' + status + '</p>' +
        ((!levelOk && !owned) ? '<p class="skin-lock">Needs level ' + s.minLevel + '.</p>' : '');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-care';
      if (equipped) { btn.textContent = 'Equipped'; btn.disabled = true; }
      else if (owned) {
        btn.textContent = 'Equip';
        btn.addEventListener('click', function () { equipSkin(s.id); });
      } else {
        btn.textContent = s.price === 0 ? 'Get free' : 'Buy · ' + s.price + ' coins';
        btn.disabled = !levelOk || state.coins < s.price;
        btn.addEventListener('click', function () { buySkin(s.id); });
      }
      card.appendChild(btn);
      grid.appendChild(card);
    });
  }

  /* ---------- Account / login ----------
     Wallet connects FOR REAL through the injected Phantom / Solflare
     provider (same behaviour as the website: connect only, no
     transactions, no on-chain calls). Google, Facebook and X have NO real
     OAuth here: there are no client IDs and no login endpoints exist, so
     tapping one records a LOCAL link on this device only, the login
     screen says so plainly, and the code never pretends otherwise. Real
     social sign-in is added before reward / airdrop claims; a wallet-only
     account is told that up front. The game stays playable after any
     choice, including skipping login for now. */
  var SOCIAL_METHODS = [
    { type: 'google', name: 'Google' },
    { type: 'facebook', name: 'Facebook' },
    { type: 'x', name: 'X' }
  ];
  var loginReturnTo = 'home';
  function accountMethods() { return (state.account && state.account.methods) || []; }
  function hasSocialLogin() {
    return accountMethods().some(function (m) { return m.type !== 'wallet'; });
  }
  function hasWallet() {
    return accountMethods().some(function (m) { return m.type === 'wallet'; });
  }
  function typeLabel(type) {
    if (type === 'wallet') return 'Wallet';
    if (type === 'google') return 'Google';
    if (type === 'facebook') return 'Facebook';
    if (type === 'x') return 'X';
    return type;
  }
  function shortAddress(addr) { return addr.slice(0, 4) + '...' + addr.slice(-4); }
  function methodSummary(m) {
    if (m.type === 'wallet') return 'Wallet · ' + (m.name || '') + ' ' + shortAddress(m.address || '');
    return typeLabel(m.type) + ' · local link';
  }
  function getProvider() {
    if (window.solana && window.solana.isPhantom) return { provider: window.solana, name: 'Phantom' };
    if (window.solflare && window.solflare.isSolflare) return { provider: window.solflare, name: 'Solflare' };
    if (window.solana) return { provider: window.solana, name: 'Solana wallet' };
    return null;
  }
  function linkSocial(type) {
    /* LOCAL ONLY: no OAuth, no redirect, no fake Google / Facebook / X
       popup. This records that the player linked this method on this
       device, so progress can be tied to it later. */
    var known = false;
    for (var i = 0; i < SOCIAL_METHODS.length; i++) if (SOCIAL_METHODS[i].type === type) known = true;
    if (!known) return false;
    if (!accountMethods().some(function (m) { return m.type === type; })) {
      state.account.methods.push({ type: type, at: Date.now() });
      save();
    }
    renderLogin();
    renderAccount();
    var msg = $('login-msg');
    if (msg) msg.textContent = 'Linked ' + typeLabel(type) + ' on this device (local link).';
    return true;
  }
  function connectWallet() {
    var found = getProvider();
    var msg = $('login-msg');
    if (!found) {
      if (msg) msg.textContent = 'No Solana wallet found. Install Phantom or Solflare, then try again.';
      return Promise.resolve(false);
    }
    if (msg) msg.textContent = 'Connecting...';
    return found.provider.connect().then(function (resp) {
      var addr = resp.publicKey.toString();
      state.account.methods = state.account.methods.filter(function (m) { return m.type !== 'wallet'; });
      state.account.methods.push({ type: 'wallet', name: found.name, address: addr, at: Date.now() });
      save();
      renderLogin();
      renderAccount();
      if (msg) msg.textContent = 'Wallet connected: ' + shortAddress(addr) + '.';
      return true;
    }).catch(function () {
      if (msg) msg.textContent = 'Connection cancelled or failed. Try again.';
      return false;
    });
  }
  function renderLogin() {
    var methods = accountMethods();
    var list = $('login-methods');
    list.innerHTML = '';
    methods.forEach(function (m) {
      var chip = document.createElement('span');
      chip.className = 'account-chip';
      chip.textContent = methodSummary(m);
      list.appendChild(chip);
    });
    $('login-has-account').hidden = methods.length === 0;
    $('login-welcome').hidden = methods.length !== 0;
    $('login-skip').hidden = methods.length !== 0;
    /* Wallet-only accounts are told plainly what comes later. */
    $('login-wallet-note').hidden = !(hasWallet() && !hasSocialLogin());
    $('login-back').hidden = methods.length === 0;
  }
  function renderAccount() {
    var methods = accountMethods();
    var box = $('account-methods');
    if (!box) return;
    box.innerHTML = '';
    if (!methods.length) {
      var none = document.createElement('span');
      none.className = 'account-none';
      none.textContent = 'Not logged in yet.';
      box.appendChild(none);
    } else {
      methods.forEach(function (m) {
        var chip = document.createElement('span');
        chip.className = 'account-chip';
        chip.textContent = methodSummary(m);
        box.appendChild(chip);
      });
    }
    $('account-note').hidden = !(hasWallet() && !hasSocialLogin());
    $('account-manage').textContent = methods.length ? 'Manage' : 'Log in';
  }
  function openLogin(from) {
    loginReturnTo = from || 'home';
    renderLogin();
    showView('login');
  }
  function afterLoginChoice() {
    /* After any login choice the game continues: picker if no creature yet. */
    renderAll();
    if (!state.creatureId) showView('picker');
    else showView('home');
  }

  /* ---------- Render all ---------- */
  function renderAll() {
    $('coins-num').textContent = state.coins;
    $('topbar-art').src = state.creatureId ? creatureArt() : 'assets/hero-creature.webp';
    $('topbar-art').alt = state.creatureId ? 'Your ' + creatureById(state.creatureId).name : 'Evo Pixels';
    renderLogin();
    if (!state.creatureId) { renderPicker(); return; }
    renderHome();
    renderAccount();
    renderBattle();
    renderItems();
    renderQuests();
    renderSkins();
    if (currentTab === 'evolve') renderEvolve();
  }

  /* ---------- Wire up ---------- */
  function init() {
    load();
    applyDecay();
    save();

    /* Telegram shell */
    try {
      if (TG) {
        TG.ready();
        TG.expand();
        var tp = TG.themeParams || {};
        if (tp.bg_color) document.documentElement.style.setProperty('--ground', tp.bg_color);
        if (tp.text_color) document.documentElement.style.setProperty('--text', tp.text_color);
        if (TG.MainButton) TG.MainButton.onClick(function () { showView('battle'); });
        if (TG.BackButton) TG.BackButton.onClick(function () { showView('home'); });
      }
    } catch (e) { /* Telegram shell is best-effort; the game works in a plain browser */ }

    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        showView(t.getAttribute('data-tab'));
        renderAll();
      });
    });
    $('picker-confirm').addEventListener('click', function () {
      if (!pickedId) return;
      state.creatureId = pickedId;
      haptic('success');
      save();
      renderAll();
      showView('home');
    });
    $('btn-feed').addEventListener('click', doFeed);
    $('btn-play').addEventListener('click', doPlay);
    $('btn-rest').addEventListener('click', doRest);
    $('home-disc').addEventListener('click', function () {
      animateEl($('home-disc'), 'anim-squash', 550);
      haptic('light');
    });
    $('home-skin-change').addEventListener('click', function () { showView('skins'); renderAll(); });
    $('evolve-go').addEventListener('click', function () { showView('evolve'); renderEvolve(); });
    $('btn-evolve-now').addEventListener('click', function () {
      if (state.evolved) return;
      var btn = $('btn-evolve-now');
      btn.disabled = true;
      animateEl($('evolve-disc'), 'anim-grow', 850);
      spawnSparks($('evolve-sparkles'));
      haptic('success');
      setTimeout(function () { doEvolve(); btn.disabled = false; }, 950);
    });
    $('btn-evolve-later').addEventListener('click', function () { showView('home'); });
    $('btn-evolve-home').addEventListener('click', function () { showView('home'); });
    $('btn-find-opponent').addEventListener('click', function () { haptic('light'); newBattle(); });
    $('btn-battle-again').addEventListener('click', function () { state.battle = null; save(); renderBattle(); });
    $('btn-attack').addEventListener('click', function () { playerAction('attack'); });
    $('btn-special').addEventListener('click', function () { playerAction('special'); });
    $('btn-defend').addEventListener('click', function () { playerAction('defend'); });
    $('btn-item').addEventListener('click', function () {
      $('item-picker').hidden = false;
      $('item-food-count').textContent = state.inventory.food || 0;
      $('item-gear-count').textContent = state.inventory.gear || 0;
      $('btn-item-food').disabled = (state.inventory.food || 0) < 1;
      $('btn-item-gear').disabled = (state.inventory.gear || 0) < 1 || state.battle.gearActive;
    });
    $('btn-item-cancel').addEventListener('click', function () { $('item-picker').hidden = true; });
    $('btn-item-food').addEventListener('click', function () {
      var b = state.battle;
      if (!b || b.over || (state.inventory.food || 0) < 1) return;
      state.inventory.food--;
      b.playerHp = Math.min(playerMaxHp(levelInfo().level, state.evolved), b.playerHp + 20);
      logLine('You used Food. +20 HP.');
      $('item-picker').hidden = true;
      save();
      renderBattle();
      botTurn();
    });
    $('btn-item-gear').addEventListener('click', function () {
      var b = state.battle;
      if (!b || b.over || (state.inventory.gear || 0) < 1 || b.gearActive) return;
      state.inventory.gear--;
      b.gearActive = true;
      logLine('You used Battle Gear. +50% attack for this battle.');
      $('item-picker').hidden = true;
      save();
      renderBattle();
      botTurn();
    });
    $('btn-reset').addEventListener('click', function () {
      if (window.confirm('Reset your game? Your creature, XP, coins and items will be gone.')) {
        store.remove(KEY);
        state = defaultState();
        pickedId = null;
        save();
        renderPicker();
        showView('picker');
      }
    });

    $('login-google').addEventListener('click', function () { linkSocial('google'); afterLoginChoice(); });
    $('login-facebook').addEventListener('click', function () { linkSocial('facebook'); afterLoginChoice(); });
    $('login-x').addEventListener('click', function () { linkSocial('x'); afterLoginChoice(); });
    $('login-wallet').addEventListener('click', function () { connectWallet().then(function (ok) { if (ok) afterLoginChoice(); }); });
    $('login-skip').addEventListener('click', function () {
      state.account.dismissed = true;
      save();
      afterLoginChoice();
    });
    $('login-back').addEventListener('click', function () { showView(loginReturnTo); renderAll(); });
    $('account-manage').addEventListener('click', function () { openLogin('home'); });
    $('topbar-art-btn').addEventListener('click', function () { openLogin(state.creatureId ? 'home' : 'picker'); });

    renderPicker();
    renderAll();
    if (!accountMethods().length && !state.account.dismissed) showView('login');
    else if (!state.creatureId) showView('picker');
    else showView('home');
    window.__evoReady = true;
  }

  /* Debug hook for the verification harness only (?debug=1). No cheat button in the UI. */
  if (/[?&]debug=1/.test(window.location.search)) {
    window.__evo = {
      get state() { return state; },
      get account() { return state.account; },
      get creatures() { return CREATURES; },
      linkSocial: linkSocial,
      connectWallet: connectWallet,
      grantXp: function (n) { addXp(n); save(); renderAll(); return levelInfo(); },
      setStats: function (h, ha, e) { state.hunger = h; state.happiness = ha; state.energy = e; save(); renderAll(); },
      giveCoins: function (n) { state.coins += n; save(); renderAll(); },
      equipSkin: function (id) { if (skinById(id)) { state.skinId = id; save(); renderAll(); } },
      unlockSkin: function (id) { if (skinById(id) && state.unlockedSkins.indexOf(id) === -1) { state.unlockedSkins.push(id); save(); renderAll(); } },
      reset: function () { store.remove(KEY); state = defaultState(); pickedId = null; save(); renderPicker(); showView('picker'); }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

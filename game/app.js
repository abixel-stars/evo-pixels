/* Evo Pixels Mini App — raise + battle + evolve. Static, localStorage only.
   No server, no wallet, no on-chain calls. */
(function () {
  'use strict';

  /* ---------- Data: the 8 gallery creatures, traits as on the website ---------- */
  var CREATURES = [
    { id: 1,  name: 'Evo #1',  file: 'creature-1.png',  body: 'Sky',    face: 'Determined',  trait: 'Red Beanie',   rarity: 'Common',   element: 'Gale' },
    { id: 2,  name: 'Evo #2',  file: 'creature-2.png',  body: 'Lime',   face: 'Happy',       trait: 'Bat Wings',    rarity: 'Uncommon', element: 'Leaf' },
    { id: 3,  name: 'Evo #3',  file: 'creature-3.png',  body: 'Teal',   face: 'Wink',        trait: 'Gold Glow',    rarity: 'Rare',     element: 'Tide' },
    { id: 4,  name: 'Evo #4',  file: 'creature-4.png',  body: 'Violet', face: 'Wink',        trait: 'Silver Crown', rarity: 'Rare',     element: 'Volt' },
    { id: 5,  name: 'Evo #5',  file: 'creature-5.png',  body: 'Mint',   face: 'Wink',        trait: 'Big Horns',    rarity: 'Uncommon', element: 'Frost' },
    { id: 8,  name: 'Evo #8',  file: 'creature-8.png',  body: 'Coral',  face: 'Mischievous', trait: 'Red Beanie',   rarity: 'Uncommon', element: 'Ember' },
    { id: 16, name: 'Evo #16', file: 'creature-16.png', body: 'Orange', face: 'Determined',  trait: 'Big Horns',    rarity: 'Uncommon', element: 'Ember' },
    { id: 17, name: 'Evo #17', file: 'creature-17.png', body: 'Pink',   face: 'Happy',       trait: 'Silver Crown', rarity: 'Uncommon', element: 'Charm' }
  ];
  var HERO_ART = 'hero-creature.webp';
  var EVOLVED_ART = 'evolved.webp';

  /* Type chart: attacker element -> defender element -> multiplier. 1.0 otherwise. */
  var TYPE_CHART = {
    Ember: { Leaf: 1.25, Tide: 0.8 },
    Leaf:  { Tide: 1.25, Ember: 0.8, Gale: 0.8 },
    Tide:  { Ember: 1.25, Leaf: 0.8, Volt: 0.8 },
    Volt:  { Tide: 1.25, Gale: 1.25, Leaf: 0.8 },
    Gale:  { Leaf: 1.25, Volt: 0.8, Frost: 0.8 },
    Frost: { Leaf: 1.25, Gale: 1.25, Ember: 0.8 }
    /* Charm is neutral against everything, and everything is neutral against Charm. */
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
  var RARITY_ODDS = [
    { name: 'Uncommon', max: 0.714 },
    { name: 'Rare', max: 0.958 },
    { name: 'Legendary', max: 1 }
  ];
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
    return CREATURES[2];
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
      evolved: false, rarity: null,
      firstWinDone: false,
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
  function creatureArt() { return state.evolved ? EVOLVED_ART : HERO_ART; }
  function addXp(n) { state.totalXp += n; }

  /* ---------- Views ---------- */
  var currentTab = 'home';
  function showView(name) {
    ['picker', 'home', 'battle', 'items', 'quests', 'evolve'].forEach(function (v) {
      $( 'view-' + v).hidden = (v !== name);
    });
    $('tabbar').style.display = (name === 'picker') ? 'none' : '';
    if (name !== 'evolve') currentTab = name;
    var tabs = document.querySelectorAll('.tab');
    tabs.forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-tab') === currentTab); });
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
        '<p class="picker-traits">' + c.body + ' · ' + c.face + '<br>' + c.trait + ' · ' + c.rarity + '<br>Element: ' + c.element + '</p>';
      b.addEventListener('click', function () {
        pickedId = c.id;
        haptic('light');
        renderPicker();
        $('picker-detail').textContent = c.name + ' · ' + c.body + ' body, ' + c.face.toLowerCase() + ' face, ' + c.trait + '. Element ' + c.element + '. Rarity ' + c.rarity + '.';
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
    $('home-art').src = 'assets/' + creatureArt();
    $('home-art').alt = state.evolved ? 'Your evolved ' + c.name : 'Your ' + c.name;
    $('home-name').textContent = state.evolved ? c.name + ' (Evolved)' : c.name;
    $('home-element').textContent = c.element;
    var rar = $('home-rarity');
    if (state.evolved && state.rarity) { rar.hidden = false; rar.textContent = state.rarity; }
    else rar.hidden = true;
    $('home-traits').textContent = c.body + ' · ' + c.face + ' · ' + c.trait + ' · ' + c.rarity;
    $('home-level').textContent = li.level;
    $('home-xp-text').textContent = li.into + ' / ' + li.needed + ' XP';
    $('home-xp-fill').style.width = clamp(Math.round(li.into / li.needed * 100), 0, 100) + '%';
    $('home-xp-note').textContent = state.evolved
      ? 'Evolved · ' + li.needed + ' XP to level ' + (li.level + 1) + '.'
      : li.needed - li.into + ' XP to level ' + (li.level + 1) + '. Evolves at level ' + EVOLVE_LEVEL + '.';
    $('stat-hunger-fill').style.width = state.hunger + '%';
    $('stat-hunger-num').textContent = state.hunger;
    $('stat-happy-fill').style.width = state.happiness + '%';
    $('stat-happy-num').textContent = state.happiness;
    $('stat-energy-fill').style.width = state.energy + '%';
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
    careDone('Fed your Evo. Hunger +18, +8 XP.');
  }
  function doPlay() {
    if (state.energy < 10) { $('care-msg').textContent = 'Not enough energy to play. Rest first.'; return; }
    if (state.happiness >= 100) { $('care-msg').textContent = 'Happiness is already full.'; return; }
    state.energy = clamp(state.energy - 10, 0, 100);
    state.happiness = clamp(state.happiness + 16, 0, 100);
    addXp(8);
    careDone('Played with your Evo. Happiness +16, Energy -10, +8 XP.');
  }
  function doRest() {
    if (state.energy >= 100) { $('care-msg').textContent = 'Energy is already full.'; return; }
    state.energy = clamp(state.energy + 20, 0, 100);
    addXp(5);
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
  }
  function botTurn() {
    var b = state.battle;
    if (b.over) return;
    var li = levelInfo();
    var pc = creatureById(state.creatureId);
    var bc = botCreature();
    var atk = botAttack(b.botLevel);
    var action = Math.random();
    if (b.botSpecialCd > 0) b.botSpecialCd--;
    if (action < 0.15) {
      b.botDefending = true;
      logLine(bc.name + ' braces itself. Its next hit taken will be halved.');
    } else if (action < 0.32 && b.botSpecialCd === 0) {
      b.botSpecialCd = 3;
      var r = rollDamage(Math.round(atk * 1.6), bc.element, pc.element);
      var dmg = b.playerDefending ? Math.max(1, Math.round(r.dmg / 2)) : r.dmg;
      b.playerHp = Math.max(0, b.playerHp - dmg);
      logLine(bc.name + ' used Special for ' + dmg + ' damage.' + effText(r.mult) + (b.playerDefending ? ' Your Defend halved it.' : ''));
      b.playerDefending = false;
    } else {
      var r2 = rollDamage(atk, bc.element, pc.element);
      var dmg2 = b.playerDefending ? Math.max(1, Math.round(r2.dmg / 2)) : r2.dmg;
      if (b.botDefending) { /* bot defended last turn; that only affects damage it takes, not this */ }
      b.playerHp = Math.max(0, b.playerHp - dmg2);
      logLine(bc.name + ' attacked for ' + dmg2 + ' damage.' + effText(r2.mult) + (b.playerDefending ? ' Your Defend halved it.' : ''));
      b.playerDefending = false;
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
    } else if (kind === 'defend') {
      b.playerDefending = true;
      logLine('Your ' + pc.name + ' braces itself. The next hit taken will be halved.');
    } else if (kind === 'attack') {
      var ra = rollDamage(atk, pc.element, bc.element);
      var da = b.botDefending ? Math.max(1, Math.round(ra.dmg / 2)) : ra.dmg;
      b.botHp = Math.max(0, b.botHp - da);
      logLine('Your ' + pc.name + ' attacked for ' + da + ' damage.' + effText(ra.mult) + (b.botDefending ? ' The rival was defending, so it was halved.' : ''));
      b.botDefending = false;
    }
    $('battle-msg').textContent = '';
    if (b.botHp <= 0) { save(); endBattle(true); return; }
    save();
    renderBattle();
    botTurn();
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
    $('battle-player-art').src = 'assets/' + creatureArt();
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
    $('evolve-art').src = 'assets/' + (state.evolved ? EVOLVED_ART : HERO_ART);
    $('evolve-name').textContent = c.name + (state.evolved ? ' (Evolved)' : '');
    $('evolve-traits').textContent = state.evolved
      ? 'Evolved · ' + (state.rarity || '') + ' · Level ' + li.level
      : 'Gen 1 · Level ' + li.level + ' · Ready to evolve';
    $('evolve-before').hidden = state.evolved;
    $('evolve-after').hidden = !state.evolved;
    if (state.evolved) {
      $('evolve-rarity').textContent = state.rarity || 'Uncommon';
      $('evolve-after-text').textContent = 'Your ' + c.name + ' evolved into its final form (' + (state.rarity || 'Uncommon') + '). Max HP +25, attack +4, permanently.';
    }
  }
  function doEvolve() {
    if (state.evolved) return;
    var r = Math.random();
    var rarity = 'Legendary';
    for (var i = 0; i < RARITY_ODDS.length; i++) {
      if (r <= RARITY_ODDS[i].max) { rarity = RARITY_ODDS[i].name; break; }
    }
    state.evolved = true;
    state.rarity = rarity;
    haptic('success');
    save();
    renderEvolve();
    renderAll();
  }

  /* ---------- Items ---------- */
  function renderItems() {
    $('items-coins').textContent = state.coins;
    var inv = $('inventory-list');
    inv.innerHTML = '';
    var rows = [
      { key: 'food', name: 'Food', desc: 'Feed your Evo. +18 Hunger when used.', usable: true },
      { key: 'toy', name: 'Toy', desc: 'Play boost. +20 Happiness when used.', usable: true },
      { key: 'gear', name: 'Battle Gear', desc: 'Use it from the Battle screen. +50% attack for that battle.', usable: false }
    ];
    rows.forEach(function (row) {
      var liEl = document.createElement('li');
      liEl.className = 'item-row';
      var count = state.inventory[row.key] || 0;
      liEl.innerHTML = '<div class="item-info"><p class="item-name">' + row.name + '</p>' +
        '<p class="item-desc">' + row.desc + '</p></div>' +
        '<span class="item-count num">x' + count + '</span>';
      if (row.usable) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'item-btn';
        btn.textContent = 'Use';
        btn.disabled = count < 1;
        btn.addEventListener('click', function () { useItem(row.key); });
        liEl.appendChild(btn);
      }
      inv.appendChild(liEl);
    });
    var shop = $('shop-list');
    shop.innerHTML = '';
    SHOP.forEach(function (item) {
      var liEl = document.createElement('li');
      liEl.className = 'item-row';
      liEl.innerHTML = '<div class="item-info"><p class="item-name">' + item.name + '</p>' +
        '<p class="item-desc">' + item.desc + '</p></div>' +
        '<span class="item-count num">' + item.price + ' coins</span>';
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
        progress: state.evolved ? 'Evolved (' + (state.rarity || '') + ').' : 'Level ' + li.level + ' / ' + EVOLVE_LEVEL + '. Evolves at level ' + EVOLVE_LEVEL + '.'
      },
      {
        name: 'Bring friends', desc: 'Invite friends to raise their own Evos.',
        done: false, soon: true,
        progress: 'Coming soon. Invite links open with the Telegram bot.'
      }
    ];
    quests.forEach(function (q) {
      var liEl = document.createElement('li');
      liEl.className = 'quest-row';
      var status = q.done ? 'Done' : (q.soon ? 'Coming soon' : 'In progress');
      var cls = q.done ? 'done' : (q.soon ? 'soon' : '');
      liEl.innerHTML = '<div class="quest-head"><p class="quest-name">' + q.name + '</p>' +
        '<span class="quest-status ' + cls + '">' + status + '</span></div>' +
        '<p class="quest-desc">' + q.desc + '</p>' +
        '<p class="quest-progress">' + q.progress + '</p>';
      list.appendChild(liEl);
    });
  }

  /* ---------- Render all ---------- */
  function renderAll() {
    $('coins-num').textContent = state.coins;
    if (!state.creatureId) { renderPicker(); return; }
    renderHome();
    renderBattle();
    renderItems();
    renderQuests();
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
    $('evolve-go').addEventListener('click', function () { showView('evolve'); renderEvolve(); });
    $('btn-evolve-now').addEventListener('click', doEvolve);
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

    renderPicker();
    renderAll();
    if (!state.creatureId) showView('picker');
    else showView('home');
    window.__evoReady = true;
  }

  /* Debug hook for the verification harness only (?debug=1). No cheat button in the UI. */
  if (/[?&]debug=1/.test(window.location.search)) {
    window.__evo = {
      get state() { return state; },
      get creatures() { return CREATURES; },
      grantXp: function (n) { addXp(n); save(); renderAll(); return levelInfo(); },
      setStats: function (h, ha, e) { state.hunger = h; state.happiness = ha; state.energy = e; save(); renderAll(); },
      giveCoins: function (n) { state.coins += n; save(); renderAll(); },
      reset: function () { store.remove(KEY); state = defaultState(); pickedId = null; save(); renderPicker(); showView('picker'); }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

(function () {
  'use strict';
  const G = window.ShiftfrontGame;
  const R = window.ShiftfrontRender;
  const $ = id => document.getElementById(id);
  const canvas = $('arena');
  const ctx = R.createContext ? R.createContext(canvas) : canvas.getContext('2d', { alpha: false });
  const mini = $('minimap');
  const miniCtx = mini.getContext('2d');
  let selected = 0;
  let match = null;
  let backdrop = new G.Match('coder');
  let overlay = null;
  let sound = true;
  let audio = null;
  let last = 0;
  let lastHud = 0;
  let lastMini = 0;
  let lastPortrait = 0;
  let toastUntil = 0;
  let pointer = null;
  let aimPointer = null;
  const held = new Set();
  const skillButtons = [0, 1, 2].map(i => $('skill-' + i));
  const directedSkills = {
    coder: [true, true, true], medic: [false, true, false], rider: [true, false, false],
    builder: [false, false, true], chef: [false, false, true], teacher: [true, false, true]
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (R.resize) R.resize(canvas, dpr);
    mini.width = Math.round(mini.clientWidth * dpr);
    mini.height = Math.round(mini.clientHeight * dpr);
    requestAnimationFrame(portraits);
  }

  function portraits() {
    document.querySelectorAll('.roster-entry canvas').forEach(el => R.avatar(el, el.dataset.hero));
    R.avatar($('portrait'), G.HEROES[selected].id);
    if (match) R.avatar($('hud-avatar'), match.player.heroId);
  }

  function roster() {
    const root = $('roster');
    root.innerHTML = '';
    G.HEROES.forEach((hero, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'roster-entry' + (index === selected ? ' active' : '');
      button.style.setProperty('--role-color', hero.color);
      button.innerHTML = '<canvas data-hero="' + hero.id + '" aria-hidden="true"></canvas><strong>' + hero.name + '</strong><small>' + hero.job + '</small>';
      button.addEventListener('click', () => select(index));
      root.appendChild(button);
    });
    requestAnimationFrame(portraits);
  }

  function select(index) {
    selected = index;
    const hero = G.HEROES[index];
    document.querySelectorAll('.roster-entry').forEach((button, i) => button.classList.toggle('active', i === index));
    $('hero-name').textContent = hero.name;
    $('hero-job').textContent = hero.job;
    $('hero-job').style.color = hero.color;
    $('hero-skills').innerHTML = hero.skills.map(skill => '<div class="hero-skill" title="' + skill.detail + '"><b>' + skill.icon + '</b><span>' + skill.name + '</span></div>').join('');
    requestAnimationFrame(() => R.avatar($('portrait'), hero.id));
  }

  function beep(frequency = 470, duration = .08, volume = .065, wave = 'sine') {
    if (!sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      osc.type = wave; osc.frequency.setValueAtTime(frequency, audio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(frequency * .7, audio.currentTime + duration);
      amp.gain.setValueAtTime(volume, audio.currentTime);
      amp.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
      osc.connect(amp).connect(audio.destination);
      osc.start(); osc.stop(audio.currentTime + duration);
    } catch (_) { /* Audio is optional in older WebViews. */ }
  }

  function start() {
    match = new G.Match(G.HEROES[selected].id);
    R.setAim?.(null);
    $('selection').classList.add('hidden');
    $('hud').classList.remove('hidden');
    resize();
    $('hud-name').textContent = match.player.name;
    skillButtons.forEach((button, i) => {
      const skill = G.HEROES[selected].skills[i];
      button.querySelector('.skill-icon').textContent = skill.icon;
      button.querySelector('.skill-name').textContent = skill.name;
      button.title = skill.name + ' · ' + skill.detail;
    });
    R.avatar($('hud-avatar'), match.player.heroId);
    updateHud();
    beep(630, .16);
    toast('对局开始');
  }

  function home() {
    hideOverlay();
    R.setAim?.(null);
    aimPointer = null;
    $('result').classList.add('hidden');
    $('hud').classList.add('hidden');
    $('selection').classList.remove('hidden');
    $('respawn').classList.add('hidden');
    $('notice').classList.add('hidden');
    match = null;
    backdrop = new G.Match(G.HEROES[selected].id);
    pointer = null;
    held.clear();
    requestAnimationFrame(portraits);
  }

  function toast(message) {
    $('notice').textContent = message;
    $('notice').classList.remove('hidden');
    toastUntil = performance.now() + 2200;
  }

  function showOverlay(id) {
    if (!match || match.result !== null) return;
    if (overlay) $(overlay).classList.add('hidden');
    overlay = id;
    match.input.attack = false;
    R.setAim?.(null);
    aimPointer = null;
    match.input.x = match.input.y = 0;
    resetStick();
    if (id === 'shop') shop();
    if (id === 'scoreboard') scoreboard();
    $(id).classList.remove('hidden');
  }

  function hideOverlay() {
    if (overlay) $(overlay).classList.add('hidden');
    overlay = null;
  }

  function shop() {
    $('shop-gold').textContent = Math.floor(match.player.gold);
    $('shop-items').innerHTML = '';
    G.ITEMS.forEach((item, index) => {
      const owned = match.player.inventory.includes(index);
      const button = document.createElement('button');
      button.className = 'shop-item';
      button.type = 'button';
      button.disabled = owned || match.player.gold < item.price || !match.player.alive;
      const info = document.createElement('div');
      const icon = document.createElement('span');
      icon.textContent = item.icon;
      info.innerHTML = '<b>' + item.name + '</b><small>' + item.desc + '</small><strong>' + (owned ? '已拥有' : item.price + ' ◈') + '</strong>';
      button.append(icon, info);
      button.onclick = () => { if (match.buy(index)) { beep(820, .12); shop(); updateHud(); } };
      $('shop-items').appendChild(button);
    });
  }

  function scoreboard() {
    const root = $('score-rows');
    root.innerHTML = '';
    for (const team of [0, 1]) {
      const title = document.createElement('div');
      title.className = 'team-heading' + (team ? ' red' : '');
      title.innerHTML = '<span>' + (team ? '截止阵营' : '晨会阵营') + '</span><span>击败 / 阵亡</span>';
      root.appendChild(title);
      match.entities.filter(e => e.kind === 'hero' && e.team === team).forEach(e => {
        const row = document.createElement('div');
        row.className = 'score-row';
        row.innerHTML = '<span>' + (e === match.player ? '★ ' : '') + e.name + ' · Lv.' + e.level + '</span><span>' + e.kills + '</span><span>' + e.deaths + '</span>';
        root.appendChild(row);
      });
    }
  }

  function updateHud() {
    if (!match) return;
    const p = match.player;
    $('hud-level').textContent = 'LV ' + p.level;
    $('hp-fill').style.width = (100 * p.hp / p.maxHp) + '%';
    $('energy-fill').style.width = (100 * p.energy / p.maxEnergy) + '%';
    $('gold').textContent = Math.floor(p.gold);
    $('score-blue').textContent = match.score[0];
    $('score-red').textContent = match.score[1];
    $('match-time').textContent = formatTime(match.time);
    skillButtons.forEach((button, i) => {
      const locked = i === 2 && p.level < 4;
      const cd = p.abilities[i];
      const skill = G.HEROES.find(h => h.id === p.heroId).skills[i];
      button.classList.toggle('locked', locked || !p.alive || p.energy < skill.cost);
      const badge = button.querySelector('.cooldown');
      badge.classList.toggle('hidden', !locked && cd <= .03);
      badge.textContent = locked ? '4级' : Math.ceil(cd);
    });
    $('respawn').classList.toggle('hidden', p.alive);
    if (!p.alive) $('respawn').textContent = Math.ceil(p.respawnAt - match.time) + ' 秒后重返战场';
  }

  function formatTime(seconds) {
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
  }

  function endGame(winner) {
    hideOverlay();
    $('result').classList.remove('hidden');
    $('result-caption').textContent = winner === 0 ? '晨会阵营 · 基地夺取成功' : '截止阵营 · 基地失守';
    $('result-title').textContent = winner === 0 ? '胜利' : '失败';
    $('result-title').style.color = winner === 0 ? '#9fe7bd' : '#f2a28d';
    $('result-kills').textContent = match.player.kills;
    $('result-deaths').textContent = match.player.deaths;
    $('result-duration').textContent = formatTime(match.time);
    beep(winner === 0 ? 790 : 245, .4);
  }

  function events() {
    for (const event of match.events.splice(0)) {
      if (event.type === 'strike') { beep(250, .065, .025, 'triangle'); $('attack').classList.add('fired'); setTimeout(() => $('attack').classList.remove('fired'), 125); }
      if (event.type === 'hurt') beep(155, .11, .038, 'sawtooth');
      if (event.type === 'kill') { toast(event.team === 1 ? '对手被击败' : '队友被击败'); beep(event.team === 1 ? 610 : 280); }
      if (event.type === 'tower') { toast(event.team === 1 ? '敌方防线告破' : '我方防线失守'); beep(490, .25); }
      if (event.type === 'level') { toast('晋升至 ' + event.level + ' 级'); beep(850, .18); }
      if (event.type === 'respawn') toast('重新投入战场');
      if (event.type === 'result') endGame(event.winner);
    }
  }

  function cameraFor(scene) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = dpr * Math.min(canvas.clientWidth / 1000, canvas.clientHeight / 550);
    const visibleW = canvas.width / scale;
    const visibleH = canvas.height / scale;
    const focus = match ? scene.player : { x: 1150, y: 800 };
    return { scale, x: Math.max(0, Math.min(G.WIDTH - visibleW, focus.x - visibleW / 2)), y: Math.max(0, Math.min(G.HEIGHT - visibleH, focus.y - visibleH / 2)) };
  }

  function frame(timestamp) {
    const elapsed = last ? Math.max(0, Math.min((timestamp - last) / 1000, .25)) : 0;
    last = timestamp;
    const scene = match || backdrop;
    if (match && !overlay && match.result === null && !document.hidden) {
      const dx = Number(held.has('d') || held.has('arrowright')) - Number(held.has('a') || held.has('arrowleft'));
      const dy = Number(held.has('s') || held.has('arrowdown')) - Number(held.has('w') || held.has('arrowup'));
      if (dx || dy) { match.input.x = dx; match.input.y = dy; }
      else if (pointer === null) { match.input.x = 0; match.input.y = 0; }
      match.input.attack = attackPointer !== null || held.has('j') || held.has(' ');
      let remaining = elapsed;
      while (remaining > .0001 && scene.result === null) {
        const step = Math.min(remaining, .05);
        scene.update(step);
        remaining -= step;
      }
      events();
    }
    R.draw(ctx, scene, canvas, cameraFor(scene));
    if (!match && R.mode?.() === 'webgl' && timestamp - lastPortrait > 125) {
      R.avatar($('portrait'), G.HEROES[selected].id);
      lastPortrait = timestamp;
    }
    if (match && timestamp - lastMini > 180) { R.minimap(miniCtx, match, mini); lastMini = timestamp; }
    if (match && timestamp - lastHud > 100) { updateHud(); lastHud = timestamp; }
    if (toastUntil && timestamp > toastUntil) { $('notice').classList.add('hidden'); toastUntil = 0; }
    requestAnimationFrame(frame);
  }

  function stickMove(event) {
    if (pointer !== event.pointerId || !match) return;
    const bounds = $('joystick').getBoundingClientRect();
    const x = event.clientX - (bounds.left + bounds.width / 2);
    const y = event.clientY - (bounds.top + bounds.height / 2);
    const max = bounds.width * .33;
    const dist = Math.max(max, Math.hypot(x, y));
    $('joystick-thumb').style.transform = 'translate(' + x / dist * max + 'px,' + y / dist * max + 'px)';
    match.input.x = x / dist;
    match.input.y = y / dist;
  }

  function resetStick() {
    pointer = null;
    $('joystick-thumb').style.transform = 'translate(0,0)';
    if (match) match.input.x = match.input.y = 0;
  }

  let attackPointer = null;
  $('joystick').addEventListener('pointerdown', event => {
    if (!match || overlay || !match.player.alive) return;
    event.preventDefault();
    pointer = event.pointerId;
    $('joystick').setPointerCapture(pointer);
    stickMove(event);
  });
  $('joystick').addEventListener('pointermove', stickMove);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('joystick').addEventListener(type, event => { if (event.pointerId === pointer) resetStick(); });
  $('attack').addEventListener('pointerdown', event => {
    if (!match || overlay || !match.player.alive) return;
    event.preventDefault();
    attackPointer = event.pointerId;
    $('attack').setPointerCapture(attackPointer);
    match.input.attack = true;
    match.attack(match.player, match.targetFor(match.player));
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('attack').addEventListener(type, event => {
    if (event.pointerId === attackPointer) { attackPointer = null; if (match) match.input.attack = false; }
  });
  skillButtons.forEach((button, index) => {
    let directed = null;
    let requiresDirection = false;
    button.addEventListener('pointerdown', event => {
      if (!match || overlay || !match.player.alive) return;
      const skill = G.HEROES[selected].skills[index];
      if (match.player.abilities[index] > 0 || match.player.energy < skill.cost || (index === 2 && match.player.level < 4)) return;
      event.preventDefault();
      aimPointer = event.pointerId;
      directed = null;
      requiresDirection = directedSkills[match.player.heroId][index];
      button.setPointerCapture(event.pointerId);
      R.setAim?.({ slot: index, angle: match.player.facing, self: !requiresDirection });
    });
    button.addEventListener('pointermove', event => {
      if (event.pointerId !== aimPointer || !match || !requiresDirection) return;
      const rect = button.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      if (Math.hypot(dx, dy) < 12) return;
      directed = Math.atan2(dy, dx);
      R.setAim?.({ slot: index, angle: directed });
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, event => {
      if (event.pointerId !== aimPointer) return;
      aimPointer = null;
      R.setAim?.(null);
      if (type === 'pointerup' && match && !overlay && match.cast(index, match.player, requiresDirection ? directed : null)) {
        beep(480 + index * 130, .15);
        updateHud();
      }
    });
  });

  $('start').onclick = start;
  $('shop-toggle').onclick = () => showOverlay('shop');
  $('score-toggle').onclick = () => showOverlay('scoreboard');
  $('pause-toggle').onclick = () => showOverlay('pause');
  document.querySelectorAll('[data-close]').forEach(button => button.onclick = hideOverlay);
  $('resume').onclick = hideOverlay;
  $('leave').onclick = home;
  $('sound-toggle').onclick = () => { sound = !sound; $('sound-toggle').textContent = '音效：' + (sound ? '开启' : '关闭'); };
  $('replay').onclick = () => { $('result').classList.add('hidden'); start(); };
  $('home').onclick = home;

  window.shiftfrontBack = () => {
    if (overlay) hideOverlay();
    else if (match && match.result === null) showOverlay('pause');
    else if (match) home();
  };

  window.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(key)) event.preventDefault();
    if (event.repeat) return;
    held.add(key);
    if (!match) { if (key === 'enter') start(); return; }
    if (key === 'escape') { window.shiftfrontBack(); return; }
    if (overlay) { if (key === 'b' && overlay === 'shop') hideOverlay(); return; }
    if (key === 'b') showOverlay('shop');
    if (key === 'tab') showOverlay('scoreboard');
    const slot = { k: 0, l: 1, u: 2, '1': 0, '2': 1, '3': 2 }[key];
    if (slot !== undefined && match.cast(slot)) beep(480 + slot * 130, .15);
    if (key === 'j' || key === ' ') match.attack(match.player, match.targetFor(match.player));
  });
  window.addEventListener('keyup', event => { held.delete(event.key.toLowerCase()); if (match && !held.has('j') && !held.has(' ') && attackPointer === null) match.input.attack = false; });
  window.addEventListener('blur', () => { held.clear(); resetStick(); if (match) match.input.attack = false; });
  window.addEventListener('resize', resize);
  roster();
  select(0);
  resize();
  requestAnimationFrame(frame);
})();

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShiftfrontGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const WIDTH = 2400;
  const HEIGHT = 1600;
  const BASES = [{ x: 205, y: 1390 }, { x: 2195, y: 210 }];
  const LANES = [
    [BASES[0], { x: 235, y: 220 }, BASES[1]],
    [BASES[0], BASES[1]],
    [BASES[0], { x: 2165, y: 1380 }, BASES[1]]
  ];
  const HEROES = [
    { id: 'coder', name: '工程师', job: '科技 · 远程输出', color: '#5cc9d2', accent: '#b9f1ef', hp: 660, damage: 53, range: 225, speed: 205, rate: .72, skills: [
      { name: '热修复', icon: '⌁', detail: '发射穿透性的代码脉冲', cd: 6, cost: 20 },
      { name: '自动化', icon: '▣', detail: '部署持续射击的工作站', cd: 14, cost: 30 },
      { name: '系统重启', icon: '✦', detail: '大范围爆发并减速敌人', cd: 30, cost: 55 }
    ] },
    { id: 'medic', name: '急诊医师', job: '医疗 · 治疗辅助', color: '#7bd0a1', accent: '#d6ffe6', hp: 780, damage: 37, range: 205, speed: 197, rate: .85, skills: [
      { name: '紧急救护', icon: '+', detail: '治疗周围友方单位', cd: 8, cost: 24 },
      { name: '镇静注射', icon: '✳', detail: '伤害并减速目标', cd: 10, cost: 30 },
      { name: '生命通道', icon: '✚', detail: '持续恢复全队生命', cd: 34, cost: 58 }
    ] },
    { id: 'rider', name: '骑手', job: '物流 · 高机动突袭', color: '#f5b963', accent: '#ffebba', hp: 700, damage: 59, range: 122, speed: 245, rate: .61, skills: [
      { name: '准时送达', icon: '➜', detail: '向前冲刺并撞击敌人', cd: 7, cost: 18 },
      { name: '争分夺秒', icon: '»', detail: '短时间提升移速和攻速', cd: 12, cost: 28 },
      { name: '全城急送', icon: '✺', detail: '周围连续三次范围打击', cd: 31, cost: 55 }
    ] },
    { id: 'builder', name: '建筑工长', job: '建筑 · 前排防护', color: '#d6ad75', accent: '#f8dfb0', hp: 1050, damage: 49, range: 115, speed: 188, rate: .85, skills: [
      { name: '重锤开工', icon: '◆', detail: '重击身边的敌方单位', cd: 7, cost: 20 },
      { name: '安全第一', icon: '⬡', detail: '获得护盾并保护附近队友', cd: 13, cost: 30 },
      { name: '现场支援', icon: '▥', detail: '召唤一座临时防御塔', cd: 35, cost: 60 }
    ] },
    { id: 'chef', name: '主厨', job: '餐饮 · 近战爆发', color: '#e98b78', accent: '#ffd1ba', hp: 810, damage: 67, range: 128, speed: 204, rate: .7, skills: [
      { name: '翻锅', icon: '◉', detail: '范围攻击并灼烧敌人', cd: 7, cost: 21 },
      { name: '员工餐', icon: '♡', detail: '为自己和附近队友回血', cd: 12, cost: 29 },
      { name: '烈焰厨房', icon: '✹', detail: '创造持续伤害的火焰区', cd: 33, cost: 57 }
    ] },
    { id: 'teacher', name: '教师', job: '教育 · 远程控制', color: '#b5a6e2', accent: '#e4dafa', hp: 695, damage: 47, range: 215, speed: 201, rate: .78, skills: [
      { name: '划重点', icon: '✎', detail: '向前投出高伤害粉笔', cd: 6, cost: 21 },
      { name: '集体备课', icon: '✧', detail: '鼓舞周围队友并增加攻速', cd: 13, cost: 31 },
      { name: '期末考试', icon: '◎', detail: '范围攻击并定住对手', cd: 34, cost: 59 }
    ] }
  ];
  const ITEMS = [
    { name: '加班咖啡', icon: '☕', price: 180, desc: '攻击 +18', stat: 'damage', amount: 18 },
    { name: '通勤跑鞋', icon: '➤', price: 210, desc: '移速 +28', stat: 'speed', amount: 28 },
    { name: '工牌护盾', icon: '⬡', price: 230, desc: '最大生命 +240', stat: 'hp', amount: 240 },
    { name: '绩效奖金', icon: '✦', price: 290, desc: '攻击 +30', stat: 'damage', amount: 30 },
    { name: '急救背包', icon: '✚', price: 270, desc: '最大生命 +300', stat: 'hp', amount: 300 }
  ];
  const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const random = (min, max) => min + Math.random() * (max - min);

  function pathPoint(lane, fraction) {
    const p = LANES[lane];
    if (fraction <= 0) return { x: p[0].x, y: p[0].y };
    if (fraction >= 1) return { x: p[p.length - 1].x, y: p[p.length - 1].y };
    const one = length(p[0], p[1]);
    const two = p.length > 2 ? length(p[1], p[2]) : 0;
    const at = clamp(fraction, 0, 1) * (one + two);
    const a = at < one || !two ? p[0] : p[1];
    const b = at < one || !two ? p[1] : p[2];
    const t = at < one || !two ? at / one : (at - one) / two;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  function pathLength(lane) {
    const p = LANES[lane];
    return length(p[0], p[1]) + (p.length > 2 ? length(p[1], p[2]) : 0);
  }

  class Match {
    constructor(heroId = 'coder') {
      this.time = 0;
      this.score = [0, 0];
      this.result = null;
      this.lastHurtAt = -Infinity;
      this.nextId = 1;
      this.entities = [];
      this.projectiles = [];
      this.effects = [];
      this.events = [];
      this.waveAt = 0;
      this.input = { x: 0, y: 0, attack: false };
      this.base = [];
      this.towers = [];
      this.initMap();
      this.player = this.spawnHero(0, heroId, 1, false);
      for (let team = 0; team <= 1; team++) {
        for (let i = 0; i < (team ? 5 : 4); i++) {
          const lane = team ? [0, 0, 1, 2, 2][i] : [0, 0, 2, 2][i];
          this.spawnHero(team, HEROES[(i + team * 2 + (team ? 0 : 1)) % HEROES.length].id, lane, true);
        }
      }
      this.spawnCamps();
      this.spawnWave();
      this.waveAt = 14;
    }

    add(entity) {
      entity.id = this.nextId++;
      entity.alive = true;
      entity.cooldown = 0;
      this.entities.push(entity);
      return entity;
    }

    initMap() {
      for (let team = 0; team < 2; team++) {
        this.base[team] = this.add({ kind: 'base', team, x: BASES[team].x, y: BASES[team].y, radius: 65, hp: 4100, maxHp: 4100, damage: 58, range: 200, rate: 1.2 });
      }
      for (let lane = 0; lane < 3; lane++) {
        for (let team = 0; team < 2; team++) {
          for (let tier = 0; tier < 2; tier++) {
            const progress = team === 0 ? (tier ? .26 : .42) : (tier ? .74 : .58);
            const pos = pathPoint(lane, progress);
            this.towers.push(this.add({ kind: 'tower', team, lane, tier, progress, x: pos.x, y: pos.y, radius: 34, hp: tier ? 1400 : 1150, maxHp: tier ? 1400 : 1150, damage: 48, range: 170, rate: 1.15 }));
          }
        }
      }
    }

    spawnHero(team, heroId, lane, bot) {
      const archetype = HEROES.find(h => h.id === heroId) || HEROES[0];
      const progress = bot ? (team ? .9 : .1) : (team ? .965 : .035);
      const spawn = pathPoint(lane, progress);
      return this.add({ kind: 'hero', team, heroId: archetype.id, name: archetype.name, lane, bot,
        x: spawn.x + random(-22, 22), y: spawn.y + random(-22, 22), radius: 23,
        hp: archetype.hp, maxHp: archetype.hp, shield: 0, energy: 100, maxEnergy: 100,
        damage: archetype.damage, range: archetype.range, speed: archetype.speed, rate: archetype.rate,
        level: 1, xp: 0, gold: bot ? 0 : 220, kills: 0, deaths: 0, respawnAt: 0,
        progress, abilities: [0, 0, 0], inventory: [], buffUntil: 0, slowUntil: 0, stunUntil: 0,
        facing: team ? Math.PI * .8 : -Math.PI * .2, walk: 0 });
    }

    spawnWave() {
      for (let lane = 0; lane < 3; lane++) {
        for (let team = 0; team < 2; team++) {
          for (let i = 0; i < 4; i++) {
            const progress = team ? .964 + i * .004 : .036 - i * .004;
            const p = pathPoint(lane, progress);
            this.add({ kind: 'minion', team, lane, progress, x: p.x + random(-12, 12), y: p.y + random(-12, 12),
              radius: i === 3 ? 16 : 12, hp: i === 3 ? 260 : 172, maxHp: i === 3 ? 260 : 172,
              damage: i === 3 ? 26 : 19, range: i >= 2 ? 125 : 47, rate: i === 3 ? 1.3 : 1.0, speed: 106, walk: 0 });
          }
        }
      }
      this.events.push({ type: 'wave' });
    }

    spawnCamps() {
      for (const p of [{ x: 720, y: 380 }, { x: 810, y: 1290 }, { x: 1590, y: 310 }, { x: 1670, y: 1170 }]) {
        this.add({ kind: 'creep', team: 2, x: p.x, y: p.y, homeX: p.x, homeY: p.y,
          radius: 25, hp: 650, maxHp: 650, damage: 34, range: 85, rate: 1.6, respawnAt: 0 });
      }
    }

    canHit(target) {
      if (!target.alive) return false;
      if (target.kind === 'tower' && target.tier === 1) {
        return !this.towers.some(t => t.team === target.team && t.lane === target.lane && t.tier === 0 && t.alive);
      }
      if (target.kind === 'base') {
        return [0, 1, 2].some(lane => this.towers.every(t => t.team !== target.team || t.lane !== lane || !t.alive));
      }
      return true;
    }

    nearby(source, radius, predicate) {
      return this.entities.filter(e => e !== source && e.alive && length(source, e) <= radius + e.radius && predicate(e));
    }

    targetFor(source, radius = source.range) {
      const candidates = this.nearby(source, radius, e => e.team !== source.team && this.canHit(e) && (source.team !== 2 || e.kind === 'hero' || e.kind === 'minion'));
      candidates.sort((a, b) => {
        const priority = e => e.kind === 'hero' ? 0 : e.kind === 'minion' ? 1 : e.kind === 'creep' ? 2 : 3;
        return priority(a) - priority(b) || length(source, a) - length(source, b);
      });
      return candidates[0] || null;
    }

    move(unit, dx, dy, dt) {
      if (unit.stunUntil > this.time) return;
      const n = Math.hypot(dx, dy);
      if (n < .001) return;
      const speed = unit.speed * (unit.slowUntil > this.time ? .62 : 1) * (unit.buffUntil > this.time ? 1.25 : 1);
      unit.x = clamp(unit.x + dx / n * speed * dt, 40, WIDTH - 40);
      unit.y = clamp(unit.y + dy / n * speed * dt, 40, HEIGHT - 40);
      unit.facing = Math.atan2(dy, dx);
      unit.walk += dt * 9;
    }

    attack(source, target) {
      if (!target || source.cooldown > 0 || source.stunUntil > this.time) return false;
      source.cooldown = source.rate * (source.buffUntil > this.time ? .7 : 1);
      if (source === this.player) this.events.push({ type: 'strike' });
      source.facing = Math.atan2(target.y - source.y, target.x - source.x);
      if (source.range > 100 || source.kind === 'tower' || source.kind === 'base' || source.kind === 'deploy') {
        this.projectiles.push({ x: source.x, y: source.y, target, source, damage: source.damage,
          speed: source.kind === 'hero' ? 575 : 435, color: source.team === 0 ? '#83dddb' : '#ff9d83', radius: source.kind === 'hero' ? 6 : 8 });
      } else {
        this.hit(source, target, source.damage);
        this.effects.push({ kind: 'slash', x: target.x, y: target.y, radius: 45, team: source.team, until: this.time + .18, started: this.time });
      }
      return true;
    }

    hit(source, target, amount) {
      if (!target.alive || !this.canHit(target)) return;
      if (target.shield > 0) {
        const blocked = Math.min(amount, target.shield);
        target.shield -= blocked;
        amount -= blocked;
      }
      target.hp -= amount;
      target.flashUntil = this.time + .12;
      if (amount > 0) this.effects.push({ kind: 'damage', x: target.x, y: target.y,
        amount: Math.round(amount), team: source.team, started: this.time, until: this.time + .72 });
      if (target === this.player && this.time > this.lastHurtAt + .35) {
        this.lastHurtAt = this.time;
        this.events.push({ type: 'hurt' });
      }
      if (target.hp > 0) return;
      target.hp = 0;
      target.alive = false;
      if (target.kind === 'hero') {
        target.deaths++;
        target.respawnAt = this.time + 7 + target.level * 2;
        this.score[source.team === 2 ? 1 - target.team : source.team]++;
        const killer = source.kind === 'hero' ? source : source.owner;
        if (killer && killer.kind === 'hero' && killer.team !== target.team) killer.kills++;
        this.events.push({ type: 'kill', name: target.name, team: target.team });
      }
      if (target.kind === 'tower') this.events.push({ type: 'tower', team: target.team, lane: target.lane });
      if (target.kind === 'base') {
        this.result = 1 - target.team;
        this.events.push({ type: 'result', winner: this.result });
      }
      if (target.kind === 'creep') target.respawnAt = this.time + 45;
      const reward = target.kind === 'hero' ? 115 : target.kind === 'tower' ? 90 : target.kind === 'creep' ? 80 : 16;
      const xp = target.kind === 'hero' ? 105 : target.kind === 'tower' ? 75 : target.kind === 'creep' ? 70 : 27;
      for (const ally of this.entities) {
        if (ally.kind !== 'hero' || !ally.alive || ally.team !== source.team || length(ally, target) > 420) continue;
        ally.gold += reward + (ally === source ? 35 : 0);
        ally.xp += xp;
        while (ally.xp >= ally.level * 95 && ally.level < 15) {
          ally.xp -= ally.level * 95;
          ally.level++;
          ally.maxHp += 68;
          ally.hp = Math.min(ally.maxHp, ally.hp + 160);
          ally.damage += 5;
          if (ally === this.player) this.events.push({ type: 'level', level: ally.level });
        }
      }
    }

    area(source, x, y, radius, damage, options = {}) {
      for (const enemy of this.entities) {
        if (!enemy.alive || enemy.team === source.team || !this.canHit(enemy) || length({ x, y }, enemy) > radius + enemy.radius) continue;
        this.hit(source, enemy, damage);
        if (options.slow) enemy.slowUntil = this.time + options.slow;
        if (options.stun) enemy.stunUntil = this.time + options.stun;
      }
      this.effects.push({ kind: options.kind || 'ring', x, y, radius, team: source.team, until: this.time + .5, started: this.time });
    }

    heal(source, radius, amount) {
      for (const unit of [source, ...this.nearby(source, radius, e => e.team === source.team && e.kind === 'hero')]) {
        unit.hp = Math.min(unit.maxHp, unit.hp + amount);
      }
      this.effects.push({ kind: 'heal', x: source.x, y: source.y, radius, team: source.team, until: this.time + .55, started: this.time });
    }

    cast(slot, unit = this.player, aimAngle = null) {
      if (!unit.alive || unit.stunUntil > this.time || unit.abilities[slot] > 0 || (slot === 2 && unit.level < 4)) return false;
      const hero = HEROES.find(h => h.id === unit.heroId);
      const skill = hero.skills[slot];
      if (unit.energy < skill.cost) return false;
      unit.energy -= skill.cost;
      unit.abilities[slot] = skill.cd;
      const target = this.targetFor(unit, slot === 2 ? 290 : 280);
      const aim = Number.isFinite(aimAngle) ? aimAngle : target ? Math.atan2(target.y - unit.y, target.x - unit.x) : unit.facing;
      const ahead = distance => ({ x: clamp(unit.x + Math.cos(aim) * distance, 40, WIDTH - 40), y: clamp(unit.y + Math.sin(aim) * distance, 40, HEIGHT - 40) });
      const blast = (distance, radius, damage, options) => { const p = ahead(distance); this.area(unit, p.x, p.y, radius, damage, options); };
      if (unit.heroId === 'coder') {
        if (slot === 0) blast(115, 125, 115 + unit.level * 10, { kind: 'pulse' });
        if (slot === 1) this.deploy(unit, ahead(90), 'drone');
        if (slot === 2) blast(105, 260, 260 + unit.level * 18, { slow: 2.5, kind: 'pulse' });
      } else if (unit.heroId === 'medic') {
        if (slot === 0) this.heal(unit, 230, 185 + unit.level * 20);
        if (slot === 1) blast(95, 115, 105 + unit.level * 11, { slow: 3 });
        if (slot === 2) this.effects.push({ kind: 'regen', x: unit.x, y: unit.y, radius: 265, source: unit, ticks: 7, nextTick: this.time, until: this.time + 7, started: this.time });
      } else if (unit.heroId === 'rider') {
        if (slot === 0) { const p = ahead(155); unit.x = p.x; unit.y = p.y; this.area(unit, p.x, p.y, 100, 145 + unit.level * 9, { kind: 'slash' }); }
        if (slot === 1) { unit.buffUntil = this.time + 6; this.effects.push({ kind: 'buff', x: unit.x, y: unit.y, radius: 100, until: this.time + .55, started: this.time, team: unit.team }); }
        if (slot === 2) this.effects.push({ kind: 'storm', x: unit.x, y: unit.y, radius: 195, source: unit, ticks: 3, nextTick: this.time, until: this.time + 1.8, started: this.time });
      } else if (unit.heroId === 'builder') {
        if (slot === 0) this.area(unit, unit.x, unit.y, 155, 125 + unit.level * 10, { slow: 1.5 });
        if (slot === 1) { for (const ally of [unit, ...this.nearby(unit, 140, e => e.kind === 'hero' && e.team === unit.team)]) ally.shield += 190 + unit.level * 18; this.effects.push({ kind: 'shield', x: unit.x, y: unit.y, radius: 155, team: unit.team, until: this.time + .6, started: this.time }); }
        if (slot === 2) this.deploy(unit, ahead(90), 'sentry');
      } else if (unit.heroId === 'chef') {
        if (slot === 0) this.area(unit, unit.x, unit.y, 160, 140 + unit.level * 10, { kind: 'fire' });
        if (slot === 1) this.heal(unit, 145, 135 + unit.level * 17);
        if (slot === 2) { const p = ahead(80); this.effects.push({ kind: 'firezone', x: p.x, y: p.y, radius: 190, source: unit, ticks: 8, nextTick: this.time, until: this.time + 7, started: this.time }); }
      } else {
        if (slot === 0) blast(110, 125, 130 + unit.level * 12, { kind: 'pulse' });
        if (slot === 1) { for (const ally of [unit, ...this.nearby(unit, 190, e => e.kind === 'hero' && e.team === unit.team)]) ally.buffUntil = this.time + 6; this.effects.push({ kind: 'buff', x: unit.x, y: unit.y, radius: 200, team: unit.team, until: this.time + .6, started: this.time }); }
        if (slot === 2) blast(100, 230, 195 + unit.level * 12, { stun: 2.1, kind: 'pulse' });
      }
      this.events.push({ type: 'cast', hero: unit.heroId, slot });
      return true;
    }

    deploy(unit, p, type) {
      this.add({ kind: 'deploy', team: unit.team, owner: unit, x: p.x, y: p.y, radius: 19,
        hp: type === 'sentry' ? 540 : 280, maxHp: type === 'sentry' ? 540 : 280,
        damage: type === 'sentry' ? 60 : 42, range: type === 'sentry' ? 220 : 205,
        rate: type === 'sentry' ? .8 : .55, expires: this.time + (type === 'sentry' ? 15 : 12), type });
    }

    buy(index) {
      const item = ITEMS[index];
      if (!item || !this.player.alive || this.player.gold < item.price || this.player.inventory.includes(index)) return false;
      this.player.gold -= item.price;
      this.player.inventory.push(index);
      if (item.stat === 'hp') { this.player.maxHp += item.amount; this.player.hp += item.amount; }
      else this.player[item.stat] += item.amount;
      this.events.push({ type: 'purchase', name: item.name });
      return true;
    }

    update(dt) {
      if (this.result !== null) return;
      dt = clamp(dt, 0, .05);
      this.time += dt;
      if (this.time >= this.waveAt) { this.spawnWave(); this.waveAt += 14; }
      for (const e of this.entities) {
        if (!e.alive) {
          if (e.kind === 'hero' && e.respawnAt <= this.time) {
            e.alive = true;
            e.hp = e.maxHp;
            e.energy = e.maxEnergy;
            e.shield = 0;
            e.x = BASES[e.team].x;
            e.y = BASES[e.team].y;
            e.progress = e.team ? .965 : .035;
            if (e === this.player) this.events.push({ type: 'respawn' });
          }
          if (e.kind === 'creep' && e.respawnAt <= this.time) { e.alive = true; e.hp = e.maxHp; e.x = e.homeX; e.y = e.homeY; }
          continue;
        }
        e.cooldown = Math.max(0, e.cooldown - dt);
        if (e.kind === 'hero') {
          e.hp = Math.min(e.maxHp, e.hp + dt * 2.6);
          e.energy = Math.min(e.maxEnergy, e.energy + dt * 7.8);
          e.abilities = e.abilities.map(cd => Math.max(0, cd - dt));
          if (e.bot) this.updateBot(e, dt);
          else { this.move(e, this.input.x, this.input.y, dt); if (this.input.attack) this.attack(e, this.targetFor(e)); }
        } else if (e.kind === 'minion') this.updateMinion(e, dt);
        else if (e.kind === 'creep') {
          if (length(e, { x: e.homeX, y: e.homeY }) > 125) this.move(e, e.homeX - e.x, e.homeY - e.y, dt);
          this.attack(e, this.targetFor(e));
        } else if (e.kind === 'deploy') {
          if (this.time >= e.expires) e.alive = false;
          else this.attack(e, this.targetFor(e));
        } else this.attack(e, this.targetFor(e));
      }
      for (const p of this.projectiles) {
        if (!p.target.alive || !this.canHit(p.target)) { p.done = true; continue; }
        const d = length(p, p.target);
        if (d <= p.speed * dt + p.target.radius) { this.hit(p.source, p.target, p.damage); p.done = true; }
        else { p.x += (p.target.x - p.x) / d * p.speed * dt; p.y += (p.target.y - p.y) / d * p.speed * dt; }
      }
      this.projectiles = this.projectiles.filter(p => !p.done);
      for (const fx of this.effects) {
        if (fx.ticks && this.time >= fx.nextTick && this.time < fx.until && fx.source.alive) {
          if (fx.kind === 'regen') { for (const ally of [fx.source, ...this.nearby(fx.source, fx.radius, e => e.kind === 'hero' && e.team === fx.source.team)]) ally.hp = Math.min(ally.maxHp, ally.hp + 65); }
          else this.area(fx.source, fx.x, fx.y, fx.radius, fx.kind === 'storm' ? 95 : 46, { kind: fx.kind === 'storm' ? 'pulse' : 'fire' });
          fx.ticks--;
          fx.nextTick += fx.kind === 'storm' ? .55 : 1;
        }
      }
      this.effects = this.effects.filter(fx => this.time < fx.until);
      if (this.entities.length > 170) this.entities = this.entities.filter(e => e.alive || ['hero', 'base', 'tower', 'creep'].includes(e.kind));
    }

    updateMinion(e, dt) {
      const target = this.targetFor(e, e.range + 35);
      if (target && length(e, target) <= e.range + target.radius) { this.attack(e, target); return; }
      const next = clamp(e.progress + (e.team ? -1 : 1) * (e.speed * dt / pathLength(e.lane)), 0, 1);
      const p = pathPoint(e.lane, next);
      this.move(e, p.x - e.x, p.y - e.y, dt);
      if (length(e, p) < 25) e.progress = next;
    }

    updateBot(e, dt) {
      const target = this.targetFor(e, Math.max(e.range + 60, 230));
      if (target) {
        if (length(e, target) <= e.range + target.radius) {
          this.attack(e, target);
          if (target.kind === 'hero' && Math.random() < .003 && e.level >= 4) this.cast(2, e);
          else if (Math.random() < .004) this.cast(0, e);
        } else this.move(e, target.x - e.x, target.y - e.y, dt);
        return;
      }
      const lookAhead = clamp(e.progress + (e.team ? -.025 : .025), 0, 1);
      const next = pathPoint(e.lane, lookAhead);
      this.move(e, next.x - e.x, next.y - e.y, dt);
      if (length(e, next) < 25) e.progress = lookAhead;
      if (e.hp < e.maxHp * .23 && length(e, BASES[e.team]) > 250) this.move(e, BASES[e.team].x - e.x, BASES[e.team].y - e.y, dt * .8);
    }
  }

  return { Match, HEROES, ITEMS, LANES, BASES, WIDTH, HEIGHT, pathPoint, pathLength };
});

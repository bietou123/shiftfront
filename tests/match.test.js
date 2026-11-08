const test = require('node:test');
const assert = require('node:assert/strict');
const { Match, HEROES, ITEMS, pathPoint, pathLength } = require('../app/src/main/assets/game.js');

test('three lanes, both headquarters, ten heroes and first wave are present', () => {
  const m = new Match('chef');
  assert.equal(m.towers.length, 12);
  assert.equal(m.base.length, 2);
  assert.equal(m.entities.filter(e => e.kind === 'hero').length, 10);
  assert.equal(m.entities.filter(e => e.kind === 'minion').length, 24);
  assert.equal(m.player.heroId, 'chef');
  for (let lane = 0; lane < 3; lane++) {
    assert.ok(pathLength(lane) > 2000);
    assert.deepEqual(pathPoint(lane, 0), { x: 205, y: 1390 });
    assert.deepEqual(pathPoint(lane, 1), { x: 2195, y: 210 });
  }
});

test('outer defenses protect inner towers; clearing a lane unlocks the base', () => {
  const m = new Match();
  const enemy = m.towers.filter(t => t.team === 1 && t.lane === 1);
  const outer = enemy.find(t => t.tier === 0);
  const inner = enemy.find(t => t.tier === 1);
  assert.equal(m.canHit(inner), false);
  assert.equal(m.canHit(m.base[1]), false);
  outer.alive = false;
  assert.equal(m.canHit(inner), true);
  inner.alive = false;
  assert.equal(m.canHit(m.base[1]), true);
});

test('ability cooldowns, level requirement, energy and purchase limits apply', () => {
  const m = new Match('builder');
  assert.equal(m.cast(2), false);
  assert.equal(m.cast(1), true);
  assert.ok(m.player.shield > 0);
  assert.equal(m.cast(1), false);
  m.player.level = 4;
  m.player.energy = 100;
  assert.equal(m.cast(2), true);
  assert.equal(m.entities.filter(e => e.kind === 'deploy').length, 1);
  assert.equal(m.buy(0), true);
  assert.equal(m.buy(0), false);
  assert.equal(m.player.damage, HEROES.find(h => h.id === 'builder').damage + ITEMS[0].amount);
});

test('kills, respawn and headquarters victory update match state', () => {
  const m = new Match('coder');
  const foe = m.entities.find(e => e.kind === 'hero' && e.team === 1);
  foe.x = m.player.x + 20;
  foe.y = m.player.y;
  m.hit(m.player, foe, foe.hp + 1);
  assert.equal(m.score[0], 1);
  assert.equal(m.player.kills, 1);
  assert.equal(foe.alive, false);
  while (m.time < foe.respawnAt + .1) m.update(.05);
  assert.equal(foe.alive, true);
  for (const t of m.towers.filter(t => t.team === 1 && t.lane === 0)) t.alive = false;
  m.hit(m.player, m.base[1], m.base[1].hp + 1);
  assert.equal(m.result, 0);
});

test('waves continue and moving a hero changes its position', () => {
  const m = new Match('rider');
  const start = m.player.x;
  m.input.x = 1;
  for (let i = 0; i < 320; i++) m.update(.05);
  assert.ok(m.player.x > start);
  assert.ok(m.entities.filter(e => e.kind === 'minion').length > 24);
});

test('each of the six professions can cast all three distinct skills', () => {
  for (const hero of HEROES) {
    const m = new Match(hero.id);
    m.player.level = 4;
    for (let slot = 0; slot < 3; slot++) {
      m.player.energy = 100;
      assert.equal(m.cast(slot), true, `${hero.name} skill ${slot} should activate`);
      assert.ok(m.player.abilities[slot] > 0);
      assert.equal(m.cast(slot), false, `${hero.name} skill ${slot} should cool down`);
    }
  }
});

test('manual skill aim takes precedence over automatic enemy targeting', () => {
  const m = new Match('rider');
  m.player.x = 1000;
  m.player.y = 800;
  m.player.facing = 0;
  assert.equal(m.cast(0, m.player, Math.PI / 2), true);
  assert.equal(m.player.x, 1000);
  assert.equal(m.player.y, 955);
});

test('successful damage emits a temporary number without changing objective rules', () => {
  const m = new Match('coder');
  const opponent = m.entities.find(unit => unit.kind === 'hero' && unit.team === 1);
  m.hit(m.player, opponent, 47);
  assert.equal(opponent.hp, opponent.maxHp - 47);
  assert.ok(m.effects.some(effect => effect.kind === 'damage' && effect.amount === 47));
  m.update(.05);
  assert.ok(m.effects.some(effect => effect.kind === 'damage'));
});

test('a full bot match can destroy a headquarters through ordinary play', { timeout: 15000 }, () => {
  const original = Math.random;
  let state = 1;
  Math.random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  try {
    const m = new Match('coder');
    m.player.bot = true;
    for (let i = 0; i < 18000 && m.result === null; i++) m.update(.05);
    assert.notEqual(m.result, null, 'game should reach a base objective');
    assert.ok(m.score[0] + m.score[1] > 5);
    assert.equal(m.base[1 - m.result].alive, false);
  } finally { Math.random = original; }
});

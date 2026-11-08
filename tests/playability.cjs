const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');

const url = pathToFileURL(path.resolve(__dirname, '../app/src/main/assets/index.html')).href;

async function drag(client, start, end, waitMs = 350) {
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x, y: start.y, id: 11 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: end.x, y: end.y, id: 11 }] });
  await new Promise(resolve => setTimeout(resolve, waitMs));
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.evaluate(() => {
      const base = window.ShiftfrontGame.Match.prototype.spawnHero;
      window.ShiftfrontGame.Match.prototype.spawnHero = function (...params) {
        const unit = base.apply(this, params);
        if (!params[3]) window.matchUnderTest = this;
        return unit;
      };
    });
    await page.locator('.roster-entry').nth(2).tap();
    await page.locator('#start').tap();
    assert.equal(await page.locator('#hud').isVisible(), true);
    assert.equal(await page.evaluate(() => matchUnderTest.player.heroId), 'rider');
    const client = await context.newCDPSession(page);
    const stick = await page.locator('#joystick').boundingBox();
    const center = { x: stick.x + stick.width / 2, y: stick.y + stick.height / 2 };
    const before = await page.evaluate(() => matchUnderTest.player.x);
    await drag(client, center, { x: center.x + stick.width * .35, y: center.y }, 450);
    const after = await page.evaluate(() => matchUnderTest.player.x);
    assert.ok(after > before + 15, `touch joystick failed: ${before} -> ${after}`);
    console.log('Touch joystick moves the selected hero.');

    await page.evaluate(() => {
      const m = window.matchUnderTest;
      m.player.x = 1200; m.player.y = 800;
      const enemy = m.entities.find(e => e.kind === 'hero' && e.team === 1);
      enemy.x = m.player.x + 60; enemy.y = m.player.y;
      enemy.hp = 280; enemy.stunUntil = m.time + 12;
      window.targetUnderTest = enemy;
    });
    const foeHp = await page.evaluate(() => targetUnderTest.hp);
    await page.locator('#attack').tap();
    await page.waitForFunction(health => targetUnderTest.hp < health, foeHp, { timeout: 3000 });
    const foeAfter = await page.evaluate(() => targetUnderTest.hp);
    assert.ok(foeAfter < foeHp, `touch attack failed: ${foeHp} -> ${foeAfter}`);
    console.log('Touch attack damages an enemy through the normal projectile path.');

    const ability = await page.locator('#skill-0').boundingBox();
    const skillCenter = { x: ability.x + ability.width / 2, y: ability.y + ability.height / 2 };
    const beforeSkill = await page.evaluate(() => ({ x: matchUnderTest.player.x, y: matchUnderTest.player.y, energy: matchUnderTest.player.energy }));
    await drag(client, skillCenter, { x: skillCenter.x + 42, y: skillCenter.y }, 120);
    const afterSkill = await page.evaluate(() => ({ x: matchUnderTest.player.x, y: matchUnderTest.player.y,
      energy: matchUnderTest.player.energy, cd: matchUnderTest.player.abilities[0] }));
    assert.ok(afterSkill.x > beforeSkill.x + 120, `aimed dash failed: ${JSON.stringify({ beforeSkill, afterSkill })}`);
    assert.ok(afterSkill.cd > 0 && afterSkill.energy < beforeSkill.energy);
    console.log('Dragged skill applies a directed dash and spends energy.');

    await page.locator('#shop-toggle').tap();
    await page.locator('.shop-item').first().tap();
    assert.ok(await page.evaluate(() => matchUnderTest.player.inventory.includes(0)));
    await page.locator('#shop .close-button').tap();
    console.log('Touch shop purchase updates inventory.');

    await page.locator('#pause-toggle').tap();
    const paused = await page.evaluate(() => matchUnderTest.time);
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => matchUnderTest.time), paused);
    await page.locator('#resume').tap();
    await page.waitForTimeout(200);
    assert.ok(await page.evaluate(() => matchUnderTest.time) > paused);
    console.log('Pause and resume stop and restart battle time.');

    assert.deepEqual(errors, []);
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

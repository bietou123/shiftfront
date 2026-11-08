const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const url = pathToFileURL(path.join(root, 'app/src/main/assets/index.html')).href;
const output = path.join(root, 'preview');
fs.mkdirSync(output, { recursive: true });

async function scene(browser, width, height, mobile) {
  const name = mobile ? width < 700 ? 'compact' : 'mobile' : 'desktop';
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.locator('.roster-entry').first().waitFor();
  assert.equal(await page.locator('.roster-entry').count(), 6);
  const restingFrame = await page.locator('#arena').screenshot();
  await page.waitForTimeout(350);
  const movingFrame = await page.locator('#arena').screenshot();
  assert.notDeepEqual(restingFrame, movingFrame, 'the 3D arena should animate while selecting a hero');
  await page.screenshot({ path: path.join(output, `selection-${name}.png`) });
  await page.locator('.roster-entry').nth(mobile ? 2 : 1).click();
  await page.evaluate(() => {
    const previous = window.ShiftfrontGame.Match.prototype.spawnHero;
    window.ShiftfrontGame.Match.prototype.spawnHero = function (...args) {
      const unit = previous.apply(this, args);
      if (!args[3]) window.smokeMatch = this;
      return unit;
    };
  });
  await page.locator('#start').click();
  await page.waitForTimeout(950);
  assert.equal(await page.locator('#hud').isVisible(), true);
  await page.evaluate(() => {
    window.smokeFrameCount = 0;
    const previous = window.ShiftfrontRender.draw;
    window.ShiftfrontRender.draw = (...args) => { window.smokeFrameCount++; previous(...args); };
  });
  await page.waitForTimeout(850);
  const frames = await page.evaluate(() => window.smokeFrameCount);
  const scenePixels = await page.locator('#arena').evaluate(canvas => {
    const gl = canvas.getContext('webgl2');
    const c = gl ? null : canvas.getContext('2d');
    const colors = new Set();
    const rgba = new Uint8Array(4);
    for (let y = .12; y < .85; y += .12) for (let x = .12; x < .9; x += .12) {
      if (gl) gl.readPixels(Math.floor(x * canvas.width), Math.floor((1 - y) * canvas.height), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      else rgba.set(c.getImageData(Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1).data);
      colors.add(`${rgba[0]},${rgba[1]},${rgba[2]}`);
    }
    return { count: colors.size, mode: window.ShiftfrontRender.mode() };
  });
  assert.equal(scenePixels.mode, 'webgl', 'modern Chrome should render the 3D arena');
  assert.ok(scenePixels.count >= 9, `canvas should contain a map, got ${scenePixels.count} distinct sampled pixels`);
  const miniPixels = await page.locator('#minimap').evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set();
    for (let i = 0; i < data.length; i += Math.max(4, Math.floor(data.length / 120 / 4) * 4)) {
      colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    }
    return colors.size;
  });
  assert.ok(miniPixels >= 3, `minimap should contain lanes and markers, got ${miniPixels} colors`);
  await page.screenshot({ path: path.join(output, `battle-${name}.png`) });
  await page.locator('#shop-toggle').click();
  assert.equal(await page.locator('#shop').isVisible(), true);
  await page.locator('.shop-item').first().click();
  assert.match(await page.locator('.shop-item').first().innerText(), /已拥有/);
  await page.locator('#shop .close-button').click();
  await page.locator('#score-toggle').click();
  assert.equal(await page.locator('.score-row').count(), 10);
  await page.locator('#scoreboard .close-button').click();
  await page.locator('#pause-toggle').click();
  assert.equal(await page.locator('#pause').isVisible(), true);
  await page.locator('#resume').click();
  const ability = await page.locator(mobile ? '#skill-0' : '#skill-1').boundingBox();
  await page.mouse.move(ability.x + ability.width / 2, ability.y + ability.height / 2);
  await page.mouse.down();
  await page.mouse.move(ability.x + ability.width / 2 + 28, ability.y + ability.height / 2 - 32);
  await page.waitForTimeout(100);
  if (!mobile) await page.screenshot({ path: path.join(output, 'aim-desktop.png') });
  await page.mouse.up();
  assert.equal(await page.locator((mobile ? '#skill-0' : '#skill-1') + ' .cooldown').isVisible(), true);
  assert.deepEqual(errors, []);
  const hud = await page.locator('.hud-top').boundingBox();
  const mini = await page.locator('.mini-frame').boundingBox();
  const stick = await page.locator('.joystick').boundingBox();
  assert.ok(hud && mini && stick && mini.y + mini.height < stick.y, 'map and joystick must not overlap');
  const beforeMove = await page.evaluate(() => window.smokeMatch.player.x);
  await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2);
  await page.mouse.down();
  await page.mouse.move(stick.x + stick.width / 2 + stick.width * .35, stick.y + stick.height / 2);
  await page.waitForTimeout(260);
  await page.mouse.up();
  const afterMove = await page.evaluate(() => window.smokeMatch.player.x);
  assert.ok(afterMove > beforeMove + 8, `joystick should move the hero (${beforeMove} -> ${afterMove})`);
  if (!mobile) {
    await page.evaluate(() => {
      const m = window.smokeMatch;
      for (let i = 0; i < 850 && m.result === null; i++) m.update(.05);
      m.player.x = 1170; m.player.y = 800;
      m.player.alive = true; m.player.hp = m.player.maxHp;
      m.player.level = 4; m.player.energy = 100;
      m.cast(2, m.player);
    });
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(output, 'combat-desktop.png') });
  }
  await page.evaluate(() => {
    const prototype = window.ShiftfrontGame.Match.prototype;
    window.restoreMatchUpdate = prototype.update;
    prototype.update = function (dt) {
      window.restoreMatchUpdate.call(this, dt);
      if (this.result !== null) return;
      this.towers.filter(t => t.team === 1 && t.lane === 0).forEach(t => { t.alive = false; });
      this.hit(this.player, this.base[1], this.base[1].hp + 1);
    };
  });
  await page.locator('#result').waitFor();
  assert.equal(await page.locator('#result-title').innerText(), '胜利');
  if (!mobile) await page.screenshot({ path: path.join(output, 'result-desktop.png') });
  await page.evaluate(() => { window.ShiftfrontGame.Match.prototype.update = window.restoreMatchUpdate; });
  await page.locator('#replay').click();
  assert.equal(await page.locator('#result').isVisible(), false);
  await page.evaluate(() => window.shiftfrontBack());
  await page.locator('#leave').click();
  assert.equal(await page.locator('#selection').isVisible(), true);
  assert.deepEqual(errors, []);
  await context.close();
  console.log(`${width}x${height}: ${scenePixels.mode} ${scenePixels.count} colors, ~${Math.round(frames / .85)} fps, minimap ${miniPixels} colors, roster/shop/scoreboard/pause/aim/result/replay OK`);
}

async function fallbackScene(executablePath) {
  const browser = await chromium.launch({ headless: true, executablePath, args: ['--disable-webgl', '--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage({ viewport: { width: 915, height: 412 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('#start').click();
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.ShiftfrontRender.mode()), '2d');
    const alpha = await page.locator('#arena').evaluate(canvas => canvas.getContext('2d').getImageData(100, 100, 1, 1).data[3]);
    assert.equal(alpha, 255);
    assert.deepEqual(errors, []);
    console.log('WebGL disabled: 2D fallback renders');
  } finally { await browser.close(); }
}

(async () => {
  const executablePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await chromium.launch({ headless: true, executablePath, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader'] });
  try {
    await scene(browser, 1280, 720, false);
    await scene(browser, 915, 412, true);
    await scene(browser, 640, 360, true);
  } finally {
    await browser.close();
  }
  await fallbackScene(executablePath);
})().catch(error => { console.error(error); process.exitCode = 1; });

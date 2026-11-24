// Headless check of the built android/assets/index.html at a phone viewport:
// title -> gameplay (keyboard + real touch swipes) -> pause via __onBack -> game over.
// Saves PNGs to out/screens/ and fails on any console error or page error.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright'); // preinstalled globally (NODE_PATH), not a project dependency

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = resolve(root, 'out/screens');
mkdirSync(shots, { recursive: true });
const url = `${pathToFileURL(resolve(root, 'android/assets/index.html')).href}?seed=7`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const state = () => page.evaluate(() => window.__voltState());
const cdp = await context.newCDPSession(page);
async function swipe(x0, y0, x1, y1) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= 4; i++) {
    const t = i / 4;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

await page.goto(url);
await page.waitForTimeout(1500);
assert.equal(await page.evaluate(() => window.__onBack()), 'exit', '__onBack on title should return "exit"');
await page.screenshot({ path: `${shots}/01-title.png` });

await page.tap('#btn-play');
await page.waitForTimeout(600);
assert.equal((await state()).mode, 'playing');

await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(350);
assert.equal((await state()).lane, 0, 'keyboard left should move to lane 0');
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(500);
await swipe(120, 620, 260, 610); // swipe right
await page.waitForTimeout(350);
assert.equal((await state()).lane, 1, 'touch swipe right should move to lane 1');
await swipe(200, 640, 205, 520); // swipe up = jump
await page.waitForTimeout(250);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(1500);
let s = await state();
if (s.mode === 'playing') await page.screenshot({ path: `${shots}/02-gameplay.png` });
console.log('gameplay state', s);

if (s.mode === 'playing') {
  assert.equal(await page.evaluate(() => window.__onBack()), 'paused', '__onBack in play should return "paused"');
  assert.equal((await state()).mode, 'paused');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${shots}/03-pause.png` });
  await page.tap('#btn-resume');
}

// No more input: Volt eventually runs into something.
await page.waitForSelector('#over:not([hidden])', { timeout: 180_000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${shots}/04-gameover.png` });
s = await state();
console.log('final state', s);
const best = await page.evaluate(() => localStorage.getItem('voltdash.best'));
assert.equal(Number(best), s.score, 'best score should be saved to localStorage');

await browser.close();
console.log(`console/page errors: ${errors.length}`);
for (const e of errors) console.log('  ' + e);
assert.equal(errors.length, 0, 'expected zero console errors');
console.log(`screens saved to ${shots}`);

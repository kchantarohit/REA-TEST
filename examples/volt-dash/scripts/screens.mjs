// Headless check of the built android/assets/index.html at a phone viewport (390x844,
// touch, DPR 1). Walks every v2 screen, performs real purchases with seeded currency,
// runs gameplay in stage 1 and (via the debug ?stage=N param) stages 2-5, exercises
// revive + results, settings, the first-run tutorial, Back-button routing and the
// v1 -> v2 save migration. Saves PNGs to out/screens-v2/ and fails on any console or
// page error.
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright'); // preinstalled globally (NODE_PATH), not a project dependency

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = resolve(root, 'out/screens-v2');
rmSync(shots, { recursive: true, force: true });
mkdirSync(shots, { recursive: true });
const base = pathToFileURL(resolve(root, 'android/assets/index.html')).href;
const SAVE = 'voltdash.save.v2';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const saved = [];

async function newPage(viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  const cdp = await context.newCDPSession(page);
  const h = {
    page,
    context,
    state: () => page.evaluate(() => window.__voltState()),
    save: () => page.evaluate(() => window.__voltSave()),
    back: () => page.evaluate(() => window.__onBack()),
    wait: (ms) => page.waitForTimeout(ms),
    async shot(name) {
      await page.screenshot({ path: `${shots}/${name}.png` });
      saved.push(name);
    },
    async tap(sel) {
      await page.locator(sel).first().tap({ force: true }); // PLAY breathes forever, so it is never 'stable'
    },
    async swipe(x0, y0, x1, y1) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
      for (let i = 1; i <= 4; i++) {
        const t = i / 4;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t }] });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
  };
  return h;
}

/** A mid-game save: plenty of currency and one of each consumable. */
const seeded = {
  v: 2, best: 8250, cells: 24000, gems: 80, level: 7, xp: 420, tutorialDone: true, runs: 12,
  items: { headstart: 2, revive: 1, booster: 1, mystery: 1 },
  upgrades: { magnet: 1, spring: 3, shield: 2, x2: 1, hyper: 2 },
  chars: { volt: 2, moss: 1 },
  selected: 'volt',
  missions: { tier: 3, progress: [999999, 40, 2], claimed: [false, false, false] },
  daily: { last: '', streak: 0 },
};
async function seed(h, data, query = '?seed=7') {
  await h.page.goto(base + query);
  await h.page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE, JSON.stringify(data)]);
  await h.page.goto(base + query);
  await h.wait(1200);
}

// ---------- 1. v1 -> v2 migration ----------
{
  const h = await newPage();
  await h.page.goto(base);
  await h.page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('voltdash.best', '4321');
    localStorage.setItem('voltdash.cells', '987');
    localStorage.setItem('voltdash.muted', 'true');
  });
  await h.page.goto(base);
  await h.wait(1200);
  const s = await h.save();
  assert.equal(s.best, 4321, 'v1 best score must carry over');
  assert.equal(s.cells, 987, 'v1 cells must carry over');
  assert.equal(s.settings.sound, false, 'v1 mute must carry over');
  assert.equal(s.tutorialDone, true, 'v1 players skip the tutorial');
  assert.ok(await h.page.evaluate((k) => !!localStorage.getItem(k), SAVE), 'v2 save written');
  await h.page.goto(base);
  await h.wait(600);
  assert.equal((await h.save()).cells, 987, 'migration is stable across reloads');
  console.log('migration ok', { best: s.best, cells: s.cells, sound: s.settings.sound });
  await h.shot('00-migrated-home');
  await h.context.close();
}

// ---------- 2. menus, purchases, characters, missions, daily, loadout, stage 1, revive, results, settings ----------
{
  const h = await newPage();
  await seed(h, seeded);
  assert.equal(await h.back(), 'exit', 'Back on the home tab exits');
  await h.shot('01-home');

  // Shop: upgrade Magnet 1 -> 2.
  await h.tap('.nav-btn[data-tab="shop"]');
  await h.wait(400);
  const before = await h.save();
  await h.tap('[data-act="up"][data-arg="magnet"]');
  await h.wait(250);
  let s = await h.save();
  assert.equal(s.upgrades.magnet, 2, 'magnet upgraded');
  assert.equal(s.cells, before.cells - 250, 'upgrade cost charged');
  await h.wait(800);
  await h.shot('02-shop-upgrades');
  assert.equal(await h.back(), 'home', 'Back on another tab returns to home');
  await h.tap('.nav-btn[data-tab="shop"]');

  // Items: buy a Score Booster, then open the Mystery Box.
  await h.tap('[data-act="shop-tab"][data-arg="items"]');
  await h.wait(300);
  await h.tap('[data-act="item"][data-arg="booster"]');
  await h.wait(900);
  assert.equal((await h.save()).items.booster, 2, 'booster bought');
  await h.shot('03-shop-items');
  await h.tap('[data-act="open-box"]');
  await h.wait(1500);
  assert.equal((await h.save()).items.mystery, 0, 'mystery box consumed');
  await h.shot('03b-mystery-box');
  assert.equal(await h.back(), 'closed', 'Back closes a sheet first');

  // Characters: browse every model (preview must not be empty), unlock Bit, upgrade it.
  await h.tap('.nav-btn[data-tab="chars"]');
  await h.wait(500);
  for (const id of ['bit', 'moss', 'ember', 'nimbus', 'orbit']) {
    await h.tap('#char-next');
    await h.wait(700);
    await h.shot(`04-char-${id}`);
  }
  await h.tap('#char-next'); // back to Volt
  await h.tap('#char-next'); // Bit
  await h.wait(300);
  await h.tap('[data-act="char-unlock"][data-arg="bit"]');
  await h.wait(300);
  s = await h.save();
  assert.equal(s.chars.bit, 1, 'Bit unlocked');
  assert.equal(s.selected, 'bit', 'unlocking selects the character');
  await h.tap('[data-act="char-upgrade"][data-arg="bit"]');
  await h.wait(900);
  assert.equal((await h.save()).chars.bit, 2, 'Bit upgraded');
  await h.shot('04-characters');

  // Missions (first one is complete in the seed): claim it.
  await h.tap('.nav-btn[data-tab="missions"]');
  await h.wait(500);
  await h.shot('05-missions');
  const cellsBefore = (await h.save()).cells;
  await h.tap('[data-act="claim"][data-arg="0"]');
  await h.wait(300);
  s = await h.save();
  assert.equal(s.missions.claimed[0], true, 'mission claimed');
  assert.ok(s.cells > cellsBefore || s.gems > seeded.gems, 'mission reward granted');

  // Daily reward.
  await h.tap('#daily-card [data-act="daily"]');
  await h.wait(500);
  await h.shot('06-daily-reward');
  await h.tap('[data-act="claim-daily"]');
  await h.wait(400);
  s = await h.save();
  assert.equal(s.daily.streak, 1, 'daily reward claimed');
  assert.ok(s.daily.last, 'daily date stored');
  await h.tap('.layer [data-act="close"].round-btn');

  // Loadout sheet from PLAY; turn Head Start off for a normal stage-1 shot.
  await h.tap('.nav-btn[data-tab="home"]');
  await h.wait(400);
  await h.tap('#btn-play');
  await h.wait(500);
  assert.equal((await h.state()).sheet, 'loadout');
  await h.shot('07-loadout');
  await h.tap('[data-act="lo"][data-arg="headstart"]');
  await h.wait(150);
  assert.equal((await h.save()).loadout.headstart, false, 'loadout toggle saved');
  await h.tap('[data-act="go"]');
  await h.wait(600);
  let st = await h.state();
  assert.equal(st.mode, 'playing');
  assert.equal(st.stage, 1);
  assert.equal((await h.save()).items.booster, 1, 'booster consumed at run start');

  // Controls: keyboard and real touch swipes.
  await h.page.keyboard.press('ArrowLeft');
  await h.wait(300);
  assert.equal((await h.state()).lane, 0, 'keyboard left -> lane 0');
  await h.swipe(120, 620, 260, 610);
  await h.wait(300);
  assert.equal((await h.state()).lane, 1, 'swipe right -> lane 1');
  await h.swipe(200, 640, 205, 520);
  await h.wait(1200);
  st = await h.state();
  if (st.mode === 'playing') await h.shot('08-gameplay-stage1');
  if (st.mode === 'playing') {
    assert.equal(await h.back(), 'paused', 'Back in a run pauses');
    await h.wait(200);
    await h.shot('08b-pause');
    await h.tap('#btn-resume');
  }

  // No more input: crash -> revive offer (token in loadout) -> decline -> results.
  await h.page.waitForSelector('#revive:not([hidden])', { timeout: 180_000 });
  await h.wait(700);
  await h.shot('09-revive-offer');
  await h.tap('#btn-revive-token');
  await h.wait(300);
  st = await h.state();
  assert.equal(st.mode, 'playing', 'revive with a Second Chance token resumes the run');
  assert.equal((await h.save()).items.revive, 0, 'token consumed');
  await h.page.waitForSelector('#revive:not([hidden])', { timeout: 180_000 });
  await h.tap('#btn-revive-skip');
  await h.page.waitForSelector('#over:not([hidden])', { timeout: 10_000 });
  await h.wait(1600);
  await h.shot('10-game-over');
  st = await h.state();
  s = await h.save();
  console.log('run end', st, { best: s.best, cells: s.cells, level: s.level, runs: s.runs });
  assert.equal(s.runs, seeded.runs + 1, 'run banked');
  assert.ok(s.cells >= 0 && s.best >= seeded.best);

  // Results -> home via Back, then settings.
  assert.equal(await h.back(), 'home');
  await h.wait(400);
  await h.tap('#btn-settings');
  await h.wait(500);
  await h.tap('[data-act="set"][data-arg="music"]');
  await h.tap('[data-act="quality"][data-arg="low"]');
  await h.wait(300);
  s = await h.save();
  assert.equal(s.settings.music, false, 'music toggle saved');
  assert.equal(s.settings.quality, 'low', 'quality saved');
  await h.tap('[data-act="quality"][data-arg="high"]');
  await h.wait(300);
  await h.shot('11-settings');
  await h.tap('[data-act="reset"]');
  await h.wait(400);
  await h.shot('11b-reset-confirm');
  await h.tap('[data-act="close"].btn');
  await h.context.close();
}

// ---------- 3. stages 2-5 via ?stage=N (god mode keeps the hero alive for the shot) ----------
for (const n of [2, 3, 4, 5]) {
  const h = await newPage();
  await seed(h, { ...seeded, loadout: { headstart: false, revive: false, booster: false } }, `?seed=${11 + n}&stage=${n}&god=1`);
  await h.tap('#btn-play');
  await h.wait(300);
  await h.tap('[data-act="go"]');
  await h.wait(1300);
  const st = await h.state();
  assert.equal(st.stage, n, `debug param starts in stage ${n}`);
  await h.shot(`12-stage${n}-banner`);
  // Wait until this stage's new obstacle is just ahead, so the shot shows it.
  const kind = { 2: 'roller', 3: 'slider', 4: 'laser', 5: 'gap' }[n];
  await h.page.waitForFunction((k) => !window.__voltState().hyper && window.__voltState().ahead.some((o) => o.k === k && o.a > 7 && o.a < 20), kind, { timeout: 120_000, polling: 50 });
  await h.shot(`12-stage${n}-gameplay`);
  await h.context.close();
}

// ---------- 4. Hyper Dash head start + stage transition 1 -> 2 ----------
{
  const h = await newPage();
  await seed(h, { ...seeded, loadout: { headstart: true, revive: false, booster: false } }, '?seed=5&god=1');
  await h.tap('#btn-play');
  await h.wait(300);
  await h.tap('[data-act="go"]');
  await h.wait(1500);
  assert.equal((await h.state()).hyper, true, 'Head Start begins with a Hyper Dash');
  await h.shot('13-hyper-dash');
  await h.page.waitForFunction(() => window.__voltState().stage === 2, null, { timeout: 120_000 });
  await h.wait(900);
  await h.shot('13b-stage-transition');
  await h.context.close();
}

// ---------- 5. first-run tutorial on a fresh install ----------
{
  const h = await newPage();
  await h.page.goto(base + '?seed=3');
  await h.page.evaluate(() => localStorage.clear());
  await h.page.goto(base + '?seed=3');
  await h.wait(1000);
  await h.tap('#btn-play');
  await h.wait(300);
  await h.tap('[data-act="go"]');
  await h.wait(500);
  assert.equal((await h.state()).tut, 1, 'tutorial starts on first run');
  await h.shot('14-tutorial');
  await h.swipe(200, 600, 320, 600);
  await h.wait(200);
  assert.equal((await h.state()).tut, 2);
  await h.swipe(200, 640, 205, 520);
  await h.wait(200);
  assert.equal((await h.state()).tut, 3);
  await h.wait(700);
  await h.swipe(200, 520, 205, 640);
  await h.wait(200);
  assert.equal((await h.state()).tut, 0, 'tutorial finished');
  await h.context.close();
}

// ---------- 6. small and large phones ----------
for (const [w, hh] of [[360, 780], [412, 915]]) {
  const h = await newPage({ width: w, height: hh });
  await seed(h, seeded);
  await h.shot(`15-home-${w}x${hh}`);
  await h.tap('.nav-btn[data-tab="chars"]');
  await h.wait(600);
  await h.shot(`15-chars-${w}x${hh}`);
  await h.tap('.nav-btn[data-tab="shop"]');
  await h.wait(500);
  await h.shot(`15-shop-${w}x${hh}`);
  await h.context.close();
}

await browser.close();
console.log(`screens: ${saved.length} -> ${shots}`);
console.log(`console/page errors: ${errors.length}`);
for (const e of errors) console.log('  ' + e);
assert.equal(errors.length, 0, 'expected zero console errors');

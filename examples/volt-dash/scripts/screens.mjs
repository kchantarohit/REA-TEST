// Headless check of the built android/assets/index.html at a phone viewport (390x844,
// touch, DPR 1). Walks every v3 screen: v1 -> v3 and v2 -> v3 save migration, real
// purchases with seeded currency, the six couriers and an outfit purchase, the Kick
// Scooter, Clank's chase (intro, closing in after a stumble, caught), the combo popup, the
// daily word hunt, trophies + logbook, stages 1-5 (debug ?stage=N), revive + results,
// settings, the first-run tutorial and Back-button routing. Saves PNGs to out/screens-v3/
// and fails on any console or page error.
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright'); // preinstalled globally (NODE_PATH), not a project dependency

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = resolve(root, 'out/screens-v3');
rmSync(shots, { recursive: true, force: true });
mkdirSync(shots, { recursive: true });
const base = pathToFileURL(resolve(root, 'android/assets/index.html')).href;
const SAVE3 = 'voltdash.save.v3';
const SAVE2 = 'voltdash.save.v2';
const d = new Date();
const TODAY = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const saved = [];

async function newPage(viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  const cdp = await context.newCDPSession(page);
  return {
    page,
    context,
    state: () => page.evaluate(() => window.__voltState()),
    save: () => page.evaluate(() => window.__voltSave()),
    back: () => page.evaluate(() => window.__onBack()),
    dbg: (fn, arg) => page.evaluate(([f, a]) => window.__voltDebug[f](a), [fn, arg]),
    wait: (ms) => page.waitForTimeout(ms),
    async shot(name) {
      await page.screenshot({ path: `${shots}/${name}.png` });
      saved.push(name);
    },
    async tap(sel) {
      await page.locator(sel).first().tap({ force: true }); // the road button arrow nudges forever, so it is never 'stable'
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
}

/** A mid-game v3 save: plenty of currency, one of each supply, some stats and trophies. */
const seeded = {
  v: 3, best: 8250, cells: 24000, gems: 80, level: 7, xp: 420, tutorialDone: true, runs: 12,
  items: { headstart: 2, revive: 1, booster: 1, mystery: 1, scooter: 2 },
  upgrades: { magnet: 1, spring: 3, shield: 2, x2: 1, hyper: 2 },
  chars: { rio: 2, tomas: 1 },
  selected: 'rio',
  missions: { tier: 3, progress: [999999, 40, 2], claimed: [false, false, false] },
  daily: { last: '', streak: 0 },
  word: { day: TODAY, got: [true, true, false, false, false], claimed: false },
  stats: { runs: 12, meters: 6400, bestMeters: 1320, sparks: 2310, gems: 9, jumps: 260, rolls: 140, bestCombo: 11, escapes: 4, caught: 1, scooters: 2, words: 1, stage: 3 },
  ach: ['first', 'onfire', 'swept'],
};
const quiet = { headstart: false, revive: false, booster: false, scooter: false };
async function seed(h, data, query = '?seed=7&debug=1') {
  await h.page.goto(base + query);
  await h.page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE3, JSON.stringify(data)]);
  await h.page.goto(base + query);
  await h.wait(1300);
}
async function startRun(h) {
  await h.tap('#btn-play');
  await h.wait(350);
  await h.tap('[data-act="go"]');
}

// ---------- 1. migrations: v1 -> v3 and v2 -> v3 ----------
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
  assert.equal(s.v, 3);
  assert.equal(s.best, 4321, 'v1 best score carries over');
  assert.equal(s.cells, 987, 'v1 currency carries over');
  assert.equal(s.settings.sound, false, 'v1 mute carries over');
  assert.equal(s.tutorialDone, true, 'v1 players skip the tutorial');
  console.log('v1 -> v3 ok', { best: s.best, cells: s.cells });
  await h.context.close();
}
{
  const h = await newPage();
  const v2 = {
    v: 2, best: 8250, cells: 24000, gems: 80, level: 7, xp: 420, tutorialDone: true, runs: 12,
    items: { headstart: 2, revive: 1, booster: 1, mystery: 1 }, upgrades: { magnet: 1, spring: 3, shield: 2, x2: 1, hyper: 2 },
    chars: { volt: 2, moss: 1 }, selected: 'moss', missions: { tier: 3, progress: [999999, 40, 2], claimed: [false, false, false] },
  };
  await h.page.goto(base);
  await h.page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE2, JSON.stringify(v2)]);
  await h.page.goto(base);
  await h.wait(1300);
  const s = await h.save();
  assert.deepEqual(s.chars, { rio: 2, tomas: 1 }, 'v2 robots map to couriers with their levels');
  assert.equal(s.selected, 'tomas');
  for (const k of ['best', 'cells', 'gems', 'level', 'xp']) assert.equal(s[k], v2[k], `v2 ${k} carries over`);
  assert.deepEqual(s.upgrades, v2.upgrades);
  assert.equal(s.missions.tier, 3);
  assert.ok(await h.page.evaluate((k) => !!localStorage.getItem(k), SAVE3), 'v3 save written');
  console.log('v2 -> v3 ok', { chars: s.chars, selected: s.selected });
  await h.shot('00-migrated-from-v2');
  await h.context.close();
}

// ---------- 2. menus, purchases, crew, outfits, jobs, word, trophies ----------
{
  const h = await newPage();
  await seed(h, seeded);
  assert.equal(await h.back(), 'exit', 'Back on the home tab exits');
  await h.shot('01-home');

  // Shop: upgrade Magnet 1 -> 2, buy a Kick Scooter, open the Mystery Parcel.
  await h.tap('.nav-btn[data-tab="shop"]');
  await h.wait(400);
  const before = await h.save();
  await h.tap('[data-act="up"][data-arg="magnet"]');
  await h.wait(250);
  let s = await h.save();
  assert.equal(s.upgrades.magnet, 2, 'magnet upgraded');
  assert.equal(s.cells, before.cells - 250, 'upgrade cost charged');
  await h.wait(1200);
  await h.shot('02-shop-upgrades');
  assert.equal(await h.back(), 'home', 'Back on another tab returns home');
  await h.tap('.nav-btn[data-tab="shop"]');
  await h.tap('[data-act="shop-tab"][data-arg="items"]');
  await h.wait(300);
  await h.tap('[data-act="item"][data-arg="scooter"]');
  await h.wait(1200);
  assert.equal((await h.save()).items.scooter, 3, 'scooter bought');
  await h.shot('03-shop-supplies');
  await h.tap('[data-act="open-box"]');
  await h.wait(1500);
  assert.equal((await h.save()).items.mystery, 0, 'mystery parcel opened');
  await h.shot('03b-mystery-parcel');
  assert.equal(await h.back(), 'closed', 'Back closes a sheet first');

  // Crew: every courier, then hire Mina, train her, buy Rio an outfit.
  await h.tap('.nav-btn[data-tab="chars"]');
  await h.wait(900);
  const crew = ['rio', 'mina', 'tomas', 'esme', 'noor', 'oskar'];
  for (let i = 0; i < crew.length; i++) {
    if (i) {
      await h.tap('#char-next');
      await h.wait(900);
    }
    await h.shot(`04-crew-${i + 1}-${crew[i]}`);
  }
  await h.tap('#char-next'); // back to Rio
  await h.tap('#char-next'); // Mina
  await h.wait(300);
  await h.tap('[data-act="char-unlock"][data-arg="mina"]');
  await h.wait(300);
  s = await h.save();
  assert.equal(s.chars.mina, 1, 'Mina hired');
  assert.equal(s.selected, 'mina', 'hiring puts her on shift');
  await h.tap('[data-act="char-upgrade"][data-arg="mina"]');
  await h.wait(300);
  assert.equal((await h.save()).chars.mina, 2, 'Mina trained');
  // Outfit: preview, then buy "Ultraviolet" for Gems.
  await h.tap('[data-act="outfit"][data-arg="2"]');
  await h.wait(700);
  await h.shot('05-outfit-preview');
  const gemsBefore = (await h.save()).gems;
  await h.tap('[data-act="outfit-buy"]');
  await h.wait(1300);
  s = await h.save();
  assert.deepEqual(s.outfits.mina, { own: [0, 2], sel: 2 }, 'outfit bought and worn');
  assert.equal(s.gems, gemsBefore - 15, 'outfit charged in Gems');
  await h.shot('05b-outfit-bought');

  // Jobs: claim the finished one; daily drop; word hunt.
  await h.tap('.nav-btn[data-tab="missions"]');
  await h.wait(500);
  await h.shot('06-jobs');
  await h.tap('[data-act="claim"][data-arg="0"]');
  await h.wait(300);
  assert.equal((await h.save()).missions.claimed[0], true, 'job claimed');
  await h.tap('#daily-card [data-act="daily"]');
  await h.wait(500);
  await h.shot('07-daily-drop');
  await h.tap('[data-act="claim-daily"]');
  await h.wait(400);
  assert.equal((await h.save()).daily.streak, 1, 'daily drop claimed');
  await h.tap('.layer [data-act="close"].round-btn');
  await h.tap('.nav-btn[data-tab="home"]');
  await h.wait(400);
  await h.tap('#btn-word');
  await h.wait(600);
  assert.equal((await h.state()).sheet, 'word');
  await h.shot('08-word-hunt');
  await h.tap('.layer [data-act="close"].round-btn');

  // Trophies + logbook.
  await h.tap('.nav-btn[data-tab="trophies"]');
  await h.wait(600);
  await h.shot('09-trophies');
  await h.tap('[data-act="trophy-tab"][data-arg="stats"]');
  await h.wait(300);
  await h.shot('09b-logbook');

  // Settings.
  await h.tap('.nav-btn[data-tab="home"]');
  await h.wait(300);
  await h.tap('#btn-settings');
  await h.wait(500);
  await h.tap('[data-act="set"][data-arg="music"]');
  await h.tap('[data-act="quality"][data-arg="low"]');
  await h.wait(300);
  s = await h.save();
  assert.equal(s.settings.music, false);
  assert.equal(s.settings.quality, 'low');
  await h.tap('[data-act="quality"][data-arg="high"]');
  await h.wait(300);
  await h.shot('10-settings');
  await h.tap('[data-act="reset"]');
  await h.wait(400);
  await h.shot('10b-reset-confirm');
  await h.tap('[data-act="close"].btn');
  await h.context.close();
}

// ---------- 3. run start: loadout, Clank's intro, chase view, controls, combo ----------
{
  const h = await newPage();
  await seed(h, { ...seeded, loadout: { ...quiet } }, '?seed=7&debug=1&god=1');
  await h.tap('#btn-play');
  await h.wait(500);
  await h.shot('11-loadout');
  await h.tap('[data-act="go"]');
  await h.wait(450);
  let st = await h.state();
  assert.equal(st.mode, 'playing');
  assert.equal(st.chase, 'intro', 'Clank starts right behind');
  await h.shot('12-start-clank-intro');
  await h.wait(1200);
  st = await h.state();
  assert.equal(st.chase, 'intro');
  assert.ok(st.gap <= 2.4, 'Clank visible right behind the runner');
  await h.shot('12b-start-chase-view');
  await h.wait(1500);
  st = await h.state();
  assert.equal(st.chase, 'away', 'Clank drops back after the intro');
  // Controls: keyboard and touch swipes.
  await h.page.keyboard.press('ArrowLeft');
  await h.wait(250);
  assert.equal((await h.state()).lane, 0, 'keyboard left');
  await h.swipe(120, 620, 260, 610);
  await h.wait(250);
  assert.equal((await h.state()).lane, 1, 'swipe right');
  // Clank closes in after a stumble.
  await h.dbg('stumble');
  await h.wait(1300);
  st = await h.state();
  assert.equal(st.chase, 'close');
  assert.ok(st.gap <= 2.4, 'Clank closes the gap');
  await h.shot('13-clank-closing-in');
  await h.page.waitForFunction(() => window.__voltState().chase === 'away', null, { timeout: 10_000 });
  console.log('Clank fell back after ~6 s without stumbles');
  // Combo popup.
  await h.dbg('trick', 3);
  await h.wait(170);
  assert.equal((await h.state()).combo, 3);
  await h.shot('14-combo-nice');
  await h.dbg('trick', 3);
  await h.wait(200);
  await h.shot('14b-combo-great');
  // A daily-word letter on the road.
  await h.page.waitForFunction(() => window.__voltState().letters.some((l) => l.a > 9 && l.a < 22), null, { timeout: 120_000, polling: 50 });
  await h.shot('15-letter-token');
  assert.equal(await h.back(), 'paused', 'Back in a run pauses');
  await h.wait(200);
  await h.shot('15b-pause');
  await h.context.close();
}

// ---------- 4. scooter ride ----------
{
  const h = await newPage();
  await seed(h, { ...seeded, loadout: { ...quiet, scooter: true } }, '?seed=9&debug=1&god=1');
  await startRun(h);
  await h.wait(3600); // after Clank's intro, so the ride is in clear view
  await h.page.waitForFunction(() => {
    const s = window.__voltState();
    return !s.ahead.some((o) => o.a > -3 && o.a < 16);
  }, null, { timeout: 30_000, polling: 50 });
  const st = await h.state();
  assert.ok(st.scooter > 24, 'scooter ride running');
  assert.equal((await h.save()).items.scooter, 1, 'scooter consumed at run start');
  await h.shot('16-scooter-ride');
  await h.context.close();
}

// ---------- 5. caught by Clank -> revive offer -> results ----------
{
  const h = await newPage();
  await seed(h, { ...seeded, loadout: { ...quiet } }, '?seed=7&debug=1');
  await startRun(h);
  await h.wait(900);
  await h.dbg('stumble');
  await h.wait(400);
  await h.dbg('stumble');
  await h.wait(700);
  let st = await h.state();
  assert.equal(st.mode, 'dying');
  assert.equal(st.cause, 'caught', 'second stumble while close = caught');
  await h.shot('17-caught');
  await h.page.waitForSelector('#revive:not([hidden])', { timeout: 10_000 });
  await h.wait(500);
  await h.shot('18-revive-offer');
  await h.tap('#btn-revive-gems');
  await h.wait(300);
  st = await h.state();
  assert.equal(st.mode, 'playing', 'gem revive resumes the run');
  assert.equal(st.chase, 'away', 'Clank lets go after a revive');
  await h.page.waitForSelector('#revive:not([hidden])', { timeout: 180_000 });
  await h.tap('#btn-revive-skip');
  await h.page.waitForSelector('#over:not([hidden])', { timeout: 10_000 });
  await h.wait(1700);
  await h.shot('19-game-over');
  const s = await h.save();
  assert.equal(s.runs, seeded.runs + 1, 'run banked');
  assert.ok(s.stats.caught >= 2, 'caught stat counted');
  assert.equal(await h.back(), 'home');
  await h.context.close();
}

// ---------- 6. stages 1-5 (debug ?stage=N; god mode keeps the courier alive for the shot) ----------
for (const n of [1, 2, 3, 4, 5]) {
  const h = await newPage();
  await seed(h, { ...seeded, loadout: { ...quiet } }, `?seed=${11 + n}&stage=${n}&god=1&debug=1`);
  await startRun(h);
  await h.wait(2200);
  assert.equal((await h.state()).stage, n, `debug param starts in stage ${n}`);
  const kind = { 1: 'pod', 2: 'roller', 3: 'slider', 4: 'laser', 5: 'gap' }[n];
  await h.page.waitForFunction((k) => window.__voltState().ahead.some((o) => o.k === k && o.a > 8 && o.a < 22), kind, { timeout: 120_000, polling: 50 });
  await h.shot(`20-stage${n}`);
  await h.context.close();
}

// ---------- 7. first-run tutorial on a fresh install ----------
{
  const h = await newPage();
  await h.page.goto(base + '?seed=3');
  await h.page.evaluate(() => localStorage.clear());
  await h.page.goto(base + '?seed=3');
  await h.wait(1000);
  await startRun(h);
  await h.wait(500);
  assert.equal((await h.state()).tut, 1, 'tutorial starts on first run');
  await h.shot('21-tutorial');
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

// ---------- 8. small and large phones ----------
for (const [w, hh] of [[360, 780], [412, 915]]) {
  const h = await newPage({ width: w, height: hh });
  await seed(h, seeded);
  await h.shot(`22-home-${w}x${hh}`);
  await h.tap('.nav-btn[data-tab="chars"]');
  await h.wait(800);
  await h.shot(`22-crew-${w}x${hh}`);
  await h.tap('.nav-btn[data-tab="shop"]');
  await h.wait(500);
  await h.shot(`22-shop-${w}x${hh}`);
  await h.tap('.nav-btn[data-tab="trophies"]');
  await h.wait(500);
  await h.shot(`22-trophies-${w}x${hh}`);
  // every visible button meets the 44px target
  const small = await h.page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => {
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && b.offsetParent && (r.width < 44 || r.height < 44);
  }).map((b) => b.id || b.className || b.textContent.trim()));
  assert.deepEqual(small, [], `buttons under 44px at ${w}x${hh}: ${small.join(', ')}`);
  await h.context.close();
}

await browser.close();
console.log(`screens: ${saved.length} -> ${shots}`);
console.log(`console/page errors: ${errors.length}`);
for (const e of errors) console.log('  ' + e);
assert.equal(errors.length, 0, 'expected zero console errors');

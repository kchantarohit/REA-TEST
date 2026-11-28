// Render the original Volt Dash launcher icon (courier Rio Vance on the dusk highway) to PNGs
// with headless Chromium. Legacy icons go to mipmap-*dpi; the adaptive icon layers
// (Android 8+) go to mipmap-xxxhdpi and are referenced from mipmap-anydpi-v26.
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright'); // preinstalled globally (NODE_PATH)
const res = resolve(dirname(fileURLToPath(import.meta.url)), '../android/res');

const defs = `
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#140a22"/><stop offset=".55" stop-color="#43235f"/><stop offset="1" stop-color="#ff7a5a"/>
  </linearGradient>`;

// Dusk highway behind the courier: our signature palette, no glow filters.
const background = `
  <rect width="512" height="512" fill="url(#sky)"/>
  <circle cx="256" cy="360" r="150" fill="#ffc46b" opacity=".55"/>
  <rect x="0" y="360" width="512" height="152" fill="#22113a"/>
  <g stroke-linecap="round">
    <path d="M256 360 L70 512 M256 360 L442 512" stroke="#3ee6f0" stroke-width="8"/>
    <path d="M256 360 L-60 512 M256 360 L572 512" stroke="#ff4f7b" stroke-width="10"/>
  </g>`;

// Rio Vance: twists, headphones, teal dispatch jacket with an amber collar.
const face = `
  <g stroke="#26122f" stroke-width="10" stroke-linejoin="round" stroke-linecap="round">
    <path d="M96 520 C104 420 170 372 256 372 C342 372 408 420 416 520 Z" fill="#1fb3b0"/>
    <path d="M204 380 L256 438 L308 380" fill="none" stroke="#ffc46b" stroke-width="18"/>
    <rect x="222" y="318" width="68" height="70" rx="20" fill="#8d5a3b"/>
    <path d="M150 214 C150 132 196 92 256 92 C316 92 362 132 362 214 C362 300 316 352 256 352 C196 352 150 300 150 214 Z" fill="#8d5a3b"/>
    <path d="M146 210 C140 120 196 74 256 74 C316 74 372 120 366 210 C346 170 306 150 256 150 C206 150 166 170 146 210 Z" fill="#1c1210"/>
    ${[166, 196, 226, 256, 286, 316, 346].map((x, i) => `<rect x="${x - 13}" y="${44 + Math.abs(i - 3) * 9}" width="26" height="62" rx="13" fill="#1c1210"/>`).join('')}
    <path d="M136 230 C136 120 188 70 256 70 C324 70 376 120 376 230" fill="none" stroke="#ff4f7b" stroke-width="22"/>
    <rect x="112" y="200" width="52" height="88" rx="24" fill="#ff4f7b"/>
    <rect x="348" y="200" width="52" height="88" rx="24" fill="#ff4f7b"/>
  </g>
  <g fill="#26122f">
    <ellipse cx="214" cy="228" rx="13" ry="16"/><ellipse cx="298" cy="228" rx="13" ry="16"/>
    <path d="M190 196 Q214 184 236 194" fill="none" stroke="#1c1210" stroke-width="10" stroke-linecap="round"/>
    <path d="M276 194 Q298 184 322 196" fill="none" stroke="#1c1210" stroke-width="10" stroke-linecap="round"/>
  </g>
  <path d="M220 290 Q256 318 292 290" fill="#fff1dc" stroke="#26122f" stroke-width="9" stroke-linejoin="round"/>
  <path d="M248 238 Q244 262 258 266" fill="none" stroke="#5e3a26" stroke-width="8" stroke-linecap="round"/>`;

const svg = (body, size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}"><defs>${defs}` +
  `<clipPath id="round"><rect width="512" height="512" rx="104"/></clipPath></defs>${body}</svg>`;

const targets = [
  // Legacy launcher icon: rounded square, full art.
  ...[['mdpi', 48], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]].map(([dpi, size]) => ({
    file: `mipmap-${dpi}/ic_launcher.png`,
    size,
    body: `<g clip-path="url(#round)">${background}${face}</g>`,
  })),
  // Adaptive layers (432px = 108dp at xxxhdpi); the face is scaled into the 72dp safe zone.
  { file: 'mipmap-xxxhdpi/ic_launcher_bg.png', size: 432, body: background },
  { file: 'mipmap-xxxhdpi/ic_launcher_fg.png', size: 432, body: `<g transform="translate(256 262) scale(.66) translate(-256 -256)">${face}</g>` },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(t.body, t.size)}</body></html>`);
  const out = resolve(res, t.file);
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  console.log(`icon ${t.file} (${t.size}px)`);
}
await browser.close();

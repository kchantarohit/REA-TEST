// Render the original Volt Dash launcher icon (Volt's face on a neon dusk road) to PNGs
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
    <stop offset="0" stop-color="#140834"/><stop offset=".55" stop-color="#4a1670"/><stop offset="1" stop-color="#ff5a8a"/>
  </linearGradient>
  <radialGradient id="shell" cx=".38" cy=".3" r=".78">
    <stop offset="0" stop-color="#ffffff"/><stop offset=".62" stop-color="#e3e7f3"/><stop offset="1" stop-color="#8f98bb"/>
  </radialGradient>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`;

const background = `
  <rect width="512" height="512" fill="url(#sky)"/>
  <circle cx="256" cy="372" r="170" fill="#ff9a5a" opacity=".45"/>
  <rect x="0" y="368" width="512" height="144" fill="#1a0f36"/>
  <g stroke-linecap="round" filter="url(#glow)">
    <path d="M256 368 L60 512 M256 368 L452 512" stroke="#45f3ff" stroke-width="7"/>
    <path d="M256 368 L-80 512 M256 368 L592 512" stroke="#ff4fd8" stroke-width="9"/>
    <path d="M0 368 H512" stroke="#ff4fd8" stroke-width="4" opacity=".8"/>
  </g>`;

const face = `
  <g stroke-linecap="round">
    <line x1="298" y1="128" x2="322" y2="66" stroke="#d6dbee" stroke-width="12"/>
    <circle cx="324" cy="58" r="22" fill="#ff4fd8" filter="url(#glow)"/>
    <circle cx="108" cy="282" r="32" fill="#ff8a2b"/><circle cx="96" cy="282" r="12" fill="#ff4fd8"/>
    <circle cx="404" cy="282" r="32" fill="#ff8a2b"/><circle cx="416" cy="282" r="12" fill="#ff4fd8"/>
    <circle cx="256" cy="270" r="150" fill="url(#shell)"/>
    <path d="M132 352 Q256 424 380 352" fill="none" stroke="#ff8a2b" stroke-width="18"/>
    <rect x="130" y="198" width="252" height="104" rx="52" fill="#141a30"/>
    <rect x="162" y="232" width="188" height="36" rx="18" fill="#45f3ff" filter="url(#glow)"/>
  </g>`;

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
  { file: 'mipmap-xxxhdpi/ic_launcher_fg.png', size: 432, body: `<g transform="translate(256 266) scale(.72) translate(-256 -256)">${face}</g>` },
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

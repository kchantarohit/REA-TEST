// Inline the bundled game script and the local font files into the HTML template -> one
// self-contained file (the APK works fully offline).
// Usage: node scripts/inline.mjs <template.html> <bundle.js> <out.html>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [template, bundle, out] = process.argv.slice(2);
if (!out) throw new Error('usage: inline.mjs <template.html> <bundle.js> <out.html>');

let html = readFileSync(template, 'utf8');
// url(fonts/x.woff2) -> data URI, so no font is ever fetched at runtime.
html = html.replace(/url\((fonts\/[\w.-]+\.woff2)\)/g, (_, rel) => {
  const b64 = readFileSync(resolve(dirname(template), rel)).toString('base64');
  return `url(data:font/woff2;base64,${b64})`;
});
if (/url\(fonts\//.test(html)) throw new Error('a font reference was not inlined');
if (!html.includes('<!--BUNDLE-->')) throw new Error(`${template} has no <!--BUNDLE--> marker`);
// "</script" inside the code would end the inline <script> element early.
const code = readFileSync(bundle, 'utf8').replace(/<\/script/gi, '<\\/script');
if (/<!--|<script/i.test(code)) throw new Error('bundle contains <!-- or <script, which breaks inline script parsing');

const result = html.replace('<!--BUNDLE-->', () => `<script>\n${code}</script>`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, result);
console.log(`wrote ${out} (${(Buffer.byteLength(result) / 1024).toFixed(0)} KiB)`);

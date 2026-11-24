// Inline the bundled game script into the HTML template -> one self-contained file.
// Usage: node scripts/inline.mjs <template.html> <bundle.js> <out.html>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const [template, bundle, out] = process.argv.slice(2);
if (!out) throw new Error('usage: inline.mjs <template.html> <bundle.js> <out.html>');

const html = readFileSync(template, 'utf8');
if (!html.includes('<!--BUNDLE-->')) throw new Error(`${template} has no <!--BUNDLE--> marker`);
// "</script" inside the code would end the inline <script> element early.
const code = readFileSync(bundle, 'utf8').replace(/<\/script/gi, '<\\/script');
if (/<!--|<script/i.test(code)) throw new Error('bundle contains <!-- or <script, which breaks inline script parsing');

const result = html.replace('<!--BUNDLE-->', () => `<script>\n${code}</script>`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, result);
console.log(`wrote ${out} (${(Buffer.byteLength(result) / 1024).toFixed(0)} KiB)`);

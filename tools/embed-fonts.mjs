#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONT_DIR = path.join(ROOT, 'fonts');

const FACES = [
  { file: 'LINESeedJP_OTF_Rg.woff2', weight: 400 },
  { file: 'LINESeedJP_OTF_Bd.woff2', weight: 700 },
  { file: 'LINESeedJP_OTF_Eb.woff2', weight: 800 },
];

const css = FACES.map(({ file, weight }) => {
  const b64 = fs.readFileSync(path.join(FONT_DIR, file)).toString('base64');
  return [
    '@font-face {',
    '  font-family: "LINE Seed JP";',
    '  font-style: normal;',
    `  font-weight: ${weight};`,
    '  font-display: swap;',
    `  src: url("data:font/woff2;base64,${b64}") format("woff2");`,
    '}',
  ].join('\n');
}).join('\n');

fs.writeFileSync(path.join(ROOT, 'Fonts.html'), `<style>\n${css}\n</style>\n`);
const size = fs.statSync(path.join(ROOT, 'Fonts.html')).size;
console.log('wrote Fonts.html', Math.round(size / 1024), 'KB');

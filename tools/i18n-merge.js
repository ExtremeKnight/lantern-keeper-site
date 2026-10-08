#!/usr/bin/env node
// Turns a translation written one line per text, in the order of assets/i18n/en.json, into assets/i18n/<lang>.json
// (0.30.1): node tools/i18n-merge.js <lang> <file.txt>. Refuses it when the number of lines differs, or when a line's
// tags or links aren't the same as the English one's (a translation never adds or loses markup or a link).
'use strict';
const fs = require('fs'), path = require('path');
const [lang, file] = process.argv.slice(2);
if (!lang || !file) { console.error('usage: node tools/i18n-merge.js <lang> <file.txt>'); process.exit(2); }
const en = Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'i18n', 'en.json'), 'utf8')));
const lines = fs.readFileSync(file, 'utf8').replace(/\r/g, '').split('\n'); while (lines.length && lines[lines.length - 1] === '') lines.pop();
if (lines.length !== en.length) { console.error(`${lang}: ${lines.length} lines, expected ${en.length}`); process.exit(1); }
const marks = s => [...s.matchAll(/<\/?([a-z0-9]+)|href="([^"]*)"/gi)].map(m => m[1] ? m[0].toLowerCase() : 'href=' + m[2]).sort().join(' ');
const bad = [], out = {};
en.forEach((k, i) => { const v = lines[i].trim(); if (marks(k) !== marks(v)) bad.push(`${i + 1}: ${k.slice(0, 70)}  ->  ${v.slice(0, 70)}`); out[k] = v; });
if (bad.length) { console.error(`${lang}: ${bad.length} lines with different tags or links:\n` + bad.slice(0, 30).join('\n')); process.exit(1); }
fs.writeFileSync(path.join(__dirname, '..', 'assets', 'i18n', lang + '.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`${lang}: ${en.length} texts -> assets/i18n/${lang}.json`);

#!/usr/bin/env node
// Validates that every asset required by src/config/asset-manifest.json
// (game pieces and cinematic portraits) exists under public/ and is a real
// PNG file. Exits non-zero on failure.
import { existsSync, openSync, readSync, closeSync, statSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'src/config/asset-manifest.json');
const publicDir = join(root, 'public');

const CATEGORIES = ['pieces', 'portraits'];
const SIDES = ['red', 'blue'];
const TYPES = ['general', 'advisor', 'elephant', 'rook', 'knight', 'cannon', 'pawn'];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EXPECTED_TOTAL = CATEGORIES.length * SIDES.length * TYPES.length;

function isPng(file) {
  const buf = Buffer.alloc(8);
  const fd = openSync(file, 'r');
  try {
    readSync(fd, buf, 0, 8, 0);
  } finally {
    closeSync(fd);
  }
  return buf.equals(PNG_SIGNATURE);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const problems = [];
let verified = 0;

for (const category of CATEGORIES) {
  const detected = [];
  for (const side of SIDES) {
    for (const type of TYPES) {
      const key = `${category}.${side}.${type}`;
      const url = manifest[category]?.[side]?.[type];
      const expected = `/assets/${category}/${side}/${type}.png`;
      if (!url) {
        problems.push(`manifest entry missing: ${key}`);
        continue;
      }
      if (url !== expected) {
        problems.push(`manifest entry ${key} is "${url}", expected "${expected}"`);
        continue;
      }
      const file = join(publicDir, url);
      const rel = relative(root, file);
      if (!existsSync(file)) {
        problems.push(`MISSING: ${rel}`);
      } else if (!isPng(file)) {
        problems.push(`NOT A PNG: ${rel}`);
      } else {
        detected.push(`${side.padEnd(4)} ${type.padEnd(8)} ${rel} (${statSync(file).size} bytes)`);
      }
    }
  }
  verified += detected.length;
  console.log(`${category} (${detected.length}/${SIDES.length * TYPES.length}):`);
  for (const line of detected) console.log(`  OK  ${line}`);
  console.log();
}

console.log(`Total: ${verified}/${EXPECTED_TOTAL} assets verified`);

if (problems.length) {
  console.error(`\nAsset validation FAILED (${problems.length} problem(s)):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('Asset validation PASSED: all required assets are present.');

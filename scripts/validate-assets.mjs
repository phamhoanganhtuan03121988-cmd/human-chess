#!/usr/bin/env node
// Validates that every asset required by src/config/asset-manifest.json
// exists under public/ and is a real PNG file. Exits non-zero on failure.
import { existsSync, openSync, readSync, closeSync, statSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'src/config/asset-manifest.json');
const publicDir = join(root, 'public');

const SIDES = ['red', 'blue'];
const TYPES = ['general', 'advisor', 'elephant', 'rook', 'knight', 'cannon', 'pawn'];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
const detected = [];
const problems = [];

for (const side of SIDES) {
  for (const type of TYPES) {
    const url = manifest.pieces?.[side]?.[type];
    const expected = `/assets/pieces/${side}/${type}.png`;
    if (!url) {
      problems.push(`manifest entry missing: pieces.${side}.${type}`);
      continue;
    }
    if (url !== expected) {
      problems.push(`manifest entry pieces.${side}.${type} is "${url}", expected "${expected}"`);
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

console.log(`Detected assets (${detected.length}/${SIDES.length * TYPES.length}):`);
for (const line of detected) console.log(`  OK  ${line}`);

if (problems.length) {
  console.error(`\nAsset validation FAILED (${problems.length} problem(s)):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('\nAsset validation PASSED: all required assets are present.');

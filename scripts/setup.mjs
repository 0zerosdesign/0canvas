#!/usr/bin/env node

// ZeroCanvas Setup Script
// Usage: node 0canvas/setup.mjs

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function findProjectRoot(startDir) {
  let dir = startDir;
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    dir = dirname(dir);
  }
  return null;
}

function main() {
  console.log('\n  ZeroCanvas Setup\n');
  const root = findProjectRoot(__dirname);
  if (!root) { console.log('  Error: No package.json found.'); process.exit(1); }
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const prereqs = ['react', 'react-dom'];
  let ok = true;
  for (const dep of prereqs) {
    if (allDeps[dep]) { console.log('  + ' + dep); }
    else { console.log('  x ' + dep + ' (required)'); ok = false; }
  }
  if (!ok) { console.log('\n  React is required.'); process.exit(1); }
  console.log('\n  Setup complete! Add <ZeroCanvas /> to your app.\n');
}

main();

#!/usr/bin/env node
/**
 * Hook PreToolUse — déclenché avant chaque appel Bash.
 * Si la commande contient "dist:win", incrémente automatiquement
 * la version patch dans package.json et electron/launcher.bat.
 */
const fs = require('fs');
const path = require('path');

let data = '';
process.stdin.on('data', chunk => (data += chunk));
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(data); } catch { process.exit(0); }

  const cmd = input.command || '';
  if (!cmd.includes('dist:win')) process.exit(0);

  // ── Bump patch version dans package.json ──
  const pkgPath = 'package.json';
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const [major, minor, patch] = pkg.version.split('.');
  const newVersion = `${major}.${minor}.${parseInt(patch, 10) + 1}`;
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  // ── Bump version dans launcher.bat ──
  const batPath = path.join('electron', 'launcher.bat');
  let bat = fs.readFileSync(batPath, 'utf-8');
  bat = bat.replace(/set "VERSION=[\d.]+"/, `set "VERSION=${newVersion}"`);
  fs.writeFileSync(batPath, bat);

  process.stderr.write(`[hook] Version auto-bump → ${newVersion}\n`);
  process.exit(0);
});

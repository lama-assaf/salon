#!/usr/bin/env node
// pre-write must warn on AI-tone content when salon is standalone, and defer
// (exit 0, no output) when an atelier install is detected.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'scripts', 'hooks', 'pre-write.js');
let fail = 0;
function check(name, cond, detail) {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { fail++; console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ' — ' + detail : ''}`); }
}
const FLAGGED_INPUT = JSON.stringify({
  tool_name: 'Write',
  tool_input: { file_path: '/tmp/x.md', content: 'We leverage synergies to unlock a seamless, game-changing paradigm. Let\'s dive in.' },
});

console.log('\npre-write deference');

// 1. standalone: warns (stderr or stdout mentions flagged content), still exit 0
{
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'salon-noatelier-'));
  const res = spawnSync(process.execPath, [HOOK], {
    input: FLAGGED_INPUT, encoding: 'utf-8',
    env: { ...process.env, HOME: home, ATELIER_ROOT: '' },
  });
  check('standalone exit 0', res.status === 0, `status ${res.status}`);
  check('standalone warns', (res.stdout + res.stderr).length > 0);
}

// 2. atelier detected via plugin dir: silent exit 0
{
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'salon-withatelier-'));
  fs.mkdirSync(path.join(home, '.claude', 'plugins', 'cache', 'atelier', 'atelier', '0.1.0'), { recursive: true });
  const res = spawnSync(process.execPath, [HOOK], {
    input: FLAGGED_INPUT, encoding: 'utf-8',
    env: { ...process.env, HOME: home, ATELIER_ROOT: '' },
  });
  check('deferred exit 0', res.status === 0, `status ${res.status}`);
  check('deferred is silent', (res.stdout + res.stderr).trim() === '', (res.stdout + res.stderr).slice(0, 120));
}

// 3. atelier detected via ATELIER_ROOT env: silent exit 0
{
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'salon-envatelier-'));
  const res = spawnSync(process.execPath, [HOOK], {
    input: FLAGGED_INPUT, encoding: 'utf-8',
    env: { ...process.env, HOME: home, ATELIER_ROOT: '/some/path' },
  });
  check('env-deferred exit 0', res.status === 0, `status ${res.status}`);
  check('env-deferred is silent', (res.stdout + res.stderr).trim() === '');
}

process.exit(fail ? 1 : 0);

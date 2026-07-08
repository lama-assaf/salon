#!/usr/bin/env node
// memory-resolution.test.js
// verifies prompt-context.js reads per-project memory from <project>/.atelier/memory/
// (shared with atelier — salon never uses its own memory namespace) and never crashes
// on missing or malformed memory.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'scripts', 'hooks', 'prompt-context.js');
let fail = 0;

function runHook(input, envOverrides) {
  // isolate from the real dev machine's HOME (which may have atelier
  // installed for real) unless a test explicitly wants to exercise that.
  const cleanHome = fs.mkdtempSync(path.join(os.tmpdir(), 'salon-cleanhome-'));
  return spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(input),
    encoding: 'utf-8',
    env: { ...process.env, HOME: cleanHome, ATELIER_ROOT: '', ...envOverrides },
  });
}

function check(name, cond, detail) {
  if (cond) {
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    fail++;
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ' — ' + detail : ''}`);
  }
}

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'salon-test-'));
}

console.log('\nmemory resolution');

// 1. project instincts are injected
{
  const proj = tmpProject();
  const memDir = path.join(proj, '.atelier', 'memory');
  fs.mkdirSync(memDir, { recursive: true });
  fs.writeFileSync(path.join(memDir, 'instincts.md'), '- unique-instinct-marker-xyz\n');
  const res = runHook({ prompt: 'hello there', cwd: proj });
  check('exit 0 with project memory', res.status === 0, `status ${res.status}`);
  check('project instincts injected', res.stdout.includes('unique-instinct-marker-xyz'), res.stdout.slice(0, 200));
  check('labeled as project memory', res.stdout.includes('.atelier/memory/instincts.md'));
}

// 2. no project memory, no keywords -> silent pass-through
//    (plugin seed instincts.md still contains the template marker, so it is skipped)
{
  const proj = tmpProject();
  const res = runHook({ prompt: 'hello there', cwd: proj });
  check('exit 0 without project memory', res.status === 0, `status ${res.status}`);
  check('no injection without memory or keywords', res.stdout.trim() === '', res.stdout.slice(0, 200));
}

// 3. malformed memory (instincts.md is a directory) -> no crash, no injection
{
  const proj = tmpProject();
  fs.mkdirSync(path.join(proj, '.atelier', 'memory', 'instincts.md'), { recursive: true });
  const res = runHook({ prompt: 'hello there', cwd: proj });
  check('exit 0 with malformed memory', res.status === 0, `status ${res.status}`);
}

// 4. nonexistent cwd -> no crash
{
  const res = runHook({ prompt: 'hello there', cwd: '/nonexistent/path/salon-xyz' });
  check('exit 0 with bogus cwd', res.status === 0, `status ${res.status}`);
}

// 5. keyword injection survives a logs-only ~/.claude/salon
//    (regression: findSalonRoot() must not accept a dir that only has logs/)
{
  const tmpHome = tmpProject();
  fs.mkdirSync(path.join(tmpHome, '.claude', 'salon', 'logs'), { recursive: true });
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ prompt: 'draft an x thread about our launch', cwd: '/nonexistent-xyz' }),
    encoding: 'utf-8',
    env: { ...process.env, HOME: tmpHome },
  });
  check('exit 0 with logs-only ~/.claude/salon', res.status === 0, `status ${res.status}`);
  check(
    'keyword reference injected despite logs-only salon root',
    res.stdout.includes('skills/x-thread/SKILL.md'),
    res.stdout.slice(0, 200)
  );
}

// 6. bogus SALON_ROOT falls back to the repo
{
  const bogusRoot = tmpProject();
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ prompt: 'draft an x thread about our launch', cwd: '/nonexistent-xyz' }),
    encoding: 'utf-8',
    env: { ...process.env, SALON_ROOT: bogusRoot },
  });
  check('exit 0 with bogus SALON_ROOT', res.status === 0, `status ${res.status}`);
  check(
    'keyword reference injected via fallback to repo root',
    res.stdout.includes('skills/x-thread/SKILL.md'),
    res.stdout.slice(0, 200)
  );
}

// 7. brand voice is injected alongside a writing-keyword skill reference
{
  const proj = tmpProject();
  const memDir = path.join(proj, '.atelier', 'memory');
  fs.mkdirSync(memDir, { recursive: true });
  fs.writeFileSync(path.join(memDir, 'voice.md'), 'voice-marker-vvv\n');
  const res = runHook({ prompt: 'write a linkedin post about hiring', cwd: proj });
  check('exit 0 with voice memory', res.status === 0, `status ${res.status}`);
  check('voice content injected', res.stdout.includes('voice-marker-vvv'), res.stdout.slice(0, 200));
  check(
    'linkedin skill reference injected alongside voice',
    res.stdout.includes('linkedin-post/SKILL.md'),
    res.stdout.slice(0, 200)
  );
}

// 8. atelier co-installed: instincts block is skipped (atelier's own hook already
//    injects it), but voice.md and the keyword skill ref still get injected
{
  const tmpHome = tmpProject();
  fs.mkdirSync(path.join(tmpHome, '.claude', 'plugins', 'cache', 'atelier', 'atelier', '0.1.0'), { recursive: true });
  const proj = tmpProject();
  const memDir = path.join(proj, '.atelier', 'memory');
  fs.mkdirSync(memDir, { recursive: true });
  fs.writeFileSync(path.join(memDir, 'instincts.md'), '- unique-instinct-marker-xyz\n');
  fs.writeFileSync(path.join(memDir, 'voice.md'), 'voice-marker-vvv\n');
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ prompt: 'write a linkedin post about hiring', cwd: proj }),
    encoding: 'utf-8',
    env: { ...process.env, HOME: tmpHome, ATELIER_ROOT: '' },
  });
  check('exit 0 with atelier co-installed', res.status === 0, `status ${res.status}`);
  check(
    'instincts marker NOT injected when atelier is co-installed',
    !res.stdout.includes('unique-instinct-marker-xyz'),
    res.stdout.slice(0, 200)
  );
  check('voice content still injected', res.stdout.includes('voice-marker-vvv'), res.stdout.slice(0, 200));
  check(
    'linkedin skill reference still injected',
    res.stdout.includes('linkedin-post/SKILL.md'),
    res.stdout.slice(0, 200)
  );
}

if (fail > 0) {
  console.log(`\n${fail} failure(s)`);
  process.exit(1);
}
console.log('\nall memory-resolution checks passed');
process.exit(0);

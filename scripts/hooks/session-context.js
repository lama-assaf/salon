#!/usr/bin/env node
// session-context.js
// session-start hook. injects the project's instincts.md once, when a session starts
// (and again after /clear or compaction, which begin a fresh context).
//
// note: per-project memory (instincts.md, voice.md) is shared with atelier — it lives
// under <project>/.atelier/memory/, not .salon/. only root-candidate paths and env vars
// use the salon name.
//
// replaces prompt-context.js (user-prompt-submit), which re-sent instincts.md with
// every prompt and pasted whole skill files when a keyword appeared anywhere in the
// prompt. claude code already loads skills on demand from their descriptions, and the
// writing skills read .atelier/memory/voice.md themselves, so neither needs a hook.
//
// install:
//   {
//     "hooks": [{ "type": "command", "command": "node /path/to/salon/scripts/hooks/session-context.js" }]
//   }
//   under hooks.SessionStart in your claude code settings.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { readHookInput } = require('./lib/io');
const { atelierInstalled } = require('./lib/atelier');

function isSalonRoot(p) {
  try {
    return fs.existsSync(path.join(p, 'skills')) && fs.existsSync(path.join(p, 'memory'));
  } catch (e) {
    return false;
  }
}

function findSalonRoot() {
  // env override, then ~/.claude/salon — but only if they actually contain
  // plugin content (the logs dir alone also lives under ~/.claude/salon)
  if (process.env.SALON_ROOT && isSalonRoot(process.env.SALON_ROOT)) {
    return process.env.SALON_ROOT;
  }
  const claudeSalon = path.join(os.homedir(), '.claude', 'salon');
  if (isSalonRoot(claudeSalon)) return claudeSalon;
  // fall back to two dirs up from this script (scripts/hooks/ -> root)
  return path.resolve(__dirname, '..', '..');
}

function findProjectDir(input) {
  const candidates = [];
  if (input && typeof input.cwd === 'string' && input.cwd) candidates.push(input.cwd);
  if (process.env.CLAUDE_PROJECT_DIR) candidates.push(process.env.CLAUDE_PROJECT_DIR);
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
    } catch (e) {
      // unreadable candidate — try the next one
    }
  }
  return null;
}

function readRelative(root, relPath) {
  try {
    const full = path.join(root, relPath);
    if (!fs.existsSync(full)) return null;
    const stat = fs.statSync(full);
    if (!stat.isFile()) return null;
    const text = fs.readFileSync(full, 'utf-8');
    // truncate huge files to first ~6000 chars
    return text.length > 6000 ? text.slice(0, 6000) + '\n\n[...truncated]' : text;
  } catch (e) {
    return null;
  }
}

function main() {
  // one family, one guard: atelier's own session hook injects the same instincts.md
  if (atelierInstalled()) process.exit(0);

  const input = readHookInput() || {};

  // resolve instincts.md: per-project memory (.atelier/memory/instincts.md) first,
  // falling back to the plugin's seed copy (memory/instincts.md) if the project has
  // none. either way, skip it if it's still the unedited template —
  // heuristic: contains "delete these once you have your own".
  const projectDir = findProjectDir(input);
  let instinctsRel = null;
  let instinctsContent = null;
  if (projectDir) {
    const projInstincts = readRelative(projectDir, path.join('.atelier', 'memory', 'instincts.md'));
    if (projInstincts) {
      instinctsContent = projInstincts;
      instinctsRel = '.atelier/memory/instincts.md (project memory)';
    }
  }
  if (!instinctsContent) {
    instinctsContent = readRelative(findSalonRoot(), 'memory/instincts.md');
    if (instinctsContent) instinctsRel = 'memory/instincts.md (salon defaults)';
  }
  if (!instinctsContent) process.exit(0);
  const edited =
    !instinctsContent.includes('delete these once you have your own') ||
    // file has been edited substantially even if some example text remains
    instinctsContent.length > 1500;
  if (!edited) process.exit(0);

  const payload = {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `# salon reference: ${instinctsRel}\n\n${instinctsContent}`,
    },
  };
  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

try {
  main();
} catch (err) {
  process.exit(0);
}

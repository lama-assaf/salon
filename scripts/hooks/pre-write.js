#!/usr/bin/env node
// pre-write.js
// pre-tool-use hook for Write and Edit. scans content for banned ai-tone, corporate filler,
// and rhythm flatness. emits warnings as additional context. does not block by default.
//
// claude code hooks reference: https://docs.claude.com/en/docs/claude-code/hooks
//
// install (add to your settings.json under hooks):
//   {
//     "matcher": "Write|Edit|MultiEdit",
//     "hooks": [{ "type": "command", "command": "node /path/to/salon/scripts/hooks/pre-write.js" }]
//   }
//
// exit codes:
//   0 = allow, hook output (stdout JSON) may add context
//   1 = soft error (logged but doesn't block)
//   2 = block (we never use this by default; set SALON_HOOK_STRICT=1 to block — unless
//       an atelier install is detected, in which case deference always wins)
//
// interop: when atelier is co-installed, its identical pre-write guard already covers
// the write, so salon defers silently (exit 0, no output) rather than double-warn.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { readHookInput, extractWriteContent, warn, emit } = require('./lib/io');
const { scanText } = require('./lib/checks');

function atelierInstalled() {
  if (process.env.ATELIER_ROOT) return true;
  try {
    const cacheDir = path.join(os.homedir(), '.claude', 'plugins', 'cache');
    if (!fs.existsSync(cacheDir)) return false;
    for (const marketplace of fs.readdirSync(cacheDir)) {
      const p = path.join(cacheDir, marketplace, 'atelier');
      if (fs.existsSync(p)) return true;
    }
  } catch (e) { /* detection must never break the hook */ }
  return false;
}

function shouldSkip(path) {
  if (!path || typeof path !== 'string') return false;
  // skip binary, lock files, generated output, the rules themselves (avoid feedback loop)
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|otf|eot|pdf|zip|tar|gz|tgz)$/i.test(path)) return true;
  if (/package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock/i.test(path)) return true;
  if (/\/rules\/brand\/banned-words\.md$|\/rules\/copy\/anti-ai-tone\.md$|\/rules\/social\/ai-tells\.md$/i.test(path)) return true;
  if (/\/node_modules\/|\/\.git\//i.test(path)) return true;
  return false;
}

function main() {
  // one family, one guard: defer to atelier's identical pre-write when co-installed
  if (atelierInstalled()) process.exit(0);

  const input = readHookInput();
  if (!input) {
    process.exit(0);
  }

  const extracted = extractWriteContent(input);
  if (!extracted) {
    process.exit(0);
  }

  const { text, path: filePath } = extracted;

  if (shouldSkip(filePath)) {
    process.exit(0);
  }

  const result = scanText(text);

  // only flag prose-like content. heuristic: skip if file is clearly code (very few sentences relative to length)
  const isCode = filePath && /\.(js|ts|jsx|tsx|py|rb|go|rs|java|c|h|cpp|hpp|cs|swift|kt|sh|bash|zsh|fish|json|yaml|yml|toml)$/i.test(filePath);
  if (isCode && result.bannedTone.length === 0) {
    // for code files, only flag obvious tone issues (none in this case)
    process.exit(0);
  }

  const messages = [];

  if (result.bannedTone.length > 0) {
    const grouped = {};
    for (const hit of result.bannedTone) {
      const key = `${hit.category}:${hit.phrase.toLowerCase()}`;
      grouped[key] = grouped[key] || { phrase: hit.phrase, category: hit.category, count: 0, lines: [] };
      grouped[key].count++;
      if (grouped[key].lines.length < 3) grouped[key].lines.push(hit.line);
    }
    const lines = Object.values(grouped).map(
      (g) => `  - "${g.phrase}" (${g.category}) ×${g.count} on line(s) ${g.lines.join(', ')}`
    );
    messages.push(`tone flags (${result.bannedTone.length} total):\n${lines.join('\n')}`);
  }

  if (result.rhythm.flag) {
    messages.push(
      `rhythm flat: ${result.rhythm.sentenceCount} sentences, mean ${result.rhythm.mean} words, stddev ${result.rhythm.variance}. consider varying length.`
    );
  }

  if (result.emDash.length > 0) {
    messages.push(`em-dash filler: ${result.emDash.length} occurrence(s). long em-dash interjections often read as ai-written.`);
  }

  if (messages.length === 0) {
    process.exit(0);
  }

  const summary = `salon rules flagged the content being written:\n\n${messages.join('\n\n')}\n\n(this is a non-blocking warning. set SALON_HOOK_STRICT=1 to block on flags.)`;

  // strict mode: write to stderr and exit 2 to block. deference to atelier (handled
  // above) always wins over strict mode — if atelier is installed we never reach here.
  if (process.env.SALON_HOOK_STRICT === '1') {
    warn(summary);
    process.exit(2);
  }

  // default: emit as additional context, allow the write
  emit(summary, true);
  process.exit(0);
}

try {
  main();
} catch (err) {
  // never let a hook crash the harness
  warn(`pre-write hook error: ${err && err.message ? err.message : 'unknown'}`);
  process.exit(0);
}

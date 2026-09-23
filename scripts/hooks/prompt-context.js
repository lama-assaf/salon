#!/usr/bin/env node
// prompt-context.js
// user-prompt-submit hook. inspects the user's prompt and surfaces the most relevant
// salon skill/agent/rule files as additional context.
//
// note: per-project memory (instincts.md, voice.md) is shared with atelier — it lives
// under <project>/.atelier/memory/, not .salon/. only root-candidate paths and env vars
// use the salon name.
//
// install:
//   {
//     "hooks": [{ "type": "command", "command": "node /path/to/salon/scripts/hooks/prompt-context.js" }]
//   }
//   under hooks.UserPromptSubmit in your claude code settings.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { readHookInput } = require('./lib/io');

// one family, one guard: when atelier is co-installed, its own UserPromptSubmit
// hook already injects instincts.md, so salon skips that block here to avoid
// surfacing the same reference twice. voice.md and keyword skill refs are
// salon-only and still get injected regardless. mirrors pre-write.js's guard.
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

// keyword to category map. very intentional, very small. larger map = more noise.
const KEYWORDS = {
  // writing
  'thread': ['skills/x-thread/SKILL.md', 'rules/social/platform-limits.md'],
  'tweet': ['skills/x-thread/SKILL.md', 'rules/social/platform-limits.md'],
  'linkedin': ['skills/linkedin-post/SKILL.md', 'rules/social/platform-limits.md'],
  'discord announcement': ['skills/discord-announcement/SKILL.md'],
  'announcement': ['skills/discord-announcement/SKILL.md'],
  'telegram': ['skills/telegram-broadcast/SKILL.md'],
  'broadcast': ['skills/telegram-broadcast/SKILL.md'],
  'hook': ['skills/hook-writing/SKILL.md'],
  'viral': ['skills/hook-writing/SKILL.md', 'skills/adversarial-refinement/SKILL.md'],
  'post audit': ['skills/post-audit/SKILL.md', 'rules/social/ai-tells.md'],

  // engagement
  'engagement': ['skills/engagement-monitor/SKILL.md', 'skills/comment-strategy/SKILL.md'],
  'comment': ['skills/comment-strategy/SKILL.md', 'rules/social/engagement-ethics.md'],
  'reply': ['skills/reply-playbook/SKILL.md'],
  'replies': ['skills/reply-playbook/SKILL.md'],
  'community': ['skills/community-health/SKILL.md'],
  'just posted': ['skills/launch-window/SKILL.md'],
  'golden hour': ['skills/launch-window/SKILL.md'],

  // strategy + insights
  'campaign': ['skills/campaign-brief/SKILL.md'],
  'content calendar': ['skills/content-calendar/SKILL.md'],
  'retro': ['skills/campaign-retro/SKILL.md'],
  'trending': ['skills/social-listening/SKILL.md'],
  'social listening': ['skills/social-listening/SKILL.md'],

  // theme engine (facts-and-themes)
  'theme engine': ['skills/theme-listening/SKILL.md', 'skills/engine-dashboard/SKILL.md'],
  'theme listening': ['skills/theme-listening/SKILL.md'],
  'listener signals': ['skills/theme-listening/SKILL.md'],
  'theme post': ['skills/theme-post/SKILL.md', 'skills/claim-gate/SKILL.md'],
  'claim gate': ['skills/claim-gate/SKILL.md'],
  'publish to the website': ['skills/website-publish/SKILL.md', 'skills/claim-gate/SKILL.md'],
  'dashboard': ['skills/engine-dashboard/SKILL.md'],
};

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

function getLogDir() {
  if (process.env.SALON_LOG_DIR) return process.env.SALON_LOG_DIR;
  return path.join(os.homedir(), '.claude', 'salon', 'logs');
}

function logActivation(prompt, matchedKeywords, refs) {
  try {
    const dir = getLogDir();
    fs.mkdirSync(dir, { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    const logFile = path.join(dir, `activations-${today}.log`);
    const ts = new Date().toISOString();
    // truncate prompt to keep log entries reasonable
    const promptSnippet = prompt.length > 200 ? prompt.slice(0, 200) + '...' : prompt;
    const line = JSON.stringify({
      ts,
      keywords: matchedKeywords,
      refs,
      prompt: promptSnippet,
    }) + '\n';
    fs.appendFileSync(logFile, line);
  } catch (e) {
    // never let logging break anything
  }
}

function main() {
  const input = readHookInput();
  if (!input) {
    process.exit(0);
  }

  const prompt = (input.prompt || input.user_message || '').toString().toLowerCase();
  if (!prompt) process.exit(0);

  const matched = new Set();
  const matchedKeywords = [];
  for (const [kw, refs] of Object.entries(KEYWORDS)) {
    if (prompt.includes(kw)) {
      matchedKeywords.push(kw);
      for (const r of refs) matched.add(r);
    }
  }

  const root = findSalonRoot();

  // resolve instincts.md: per-project memory (.atelier/memory/instincts.md) first,
  // falling back to the plugin's seed copy (memory/instincts.md) if the project has
  // none. either way, skip surfacing it if it's still the unedited template —
  // heuristic: contains "delete these once you have your own".
  //
  // note: instincts.md (and voice.md, below) live under .atelier/memory/ — this
  // memory store is shared with the atelier plugin, not salon-specific.
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
    instinctsContent = readRelative(root, 'memory/instincts.md');
    if (instinctsContent) instinctsRel = 'memory/instincts.md (salon defaults)';
  }
  let hasInstincts = false;
  if (instinctsContent && !instinctsContent.includes('delete these once you have your own')) {
    hasInstincts = true;
  } else if (instinctsContent && instinctsContent.length > 1500) {
    // file has been edited substantially even if some example text remains
    hasInstincts = true;
  }

  // when atelier is co-installed, its own hook already surfaces instincts.md —
  // skip that block here so the same reference doesn't get injected twice.
  // voice.md and keyword skill refs stay salon's job either way.
  if (atelierInstalled()) hasInstincts = false;

  // brand voice: inject when a writing keyword matched
  const WRITING_KEYS = ['thread', 'tweet', 'linkedin', 'announcement', 'discord announcement', 'broadcast', 'telegram', 'hook', 'viral', 'post audit'];
  let voiceContent = null;
  if (projectDir && matchedKeywords.some(k => WRITING_KEYS.includes(k))) {
    voiceContent = readRelative(projectDir, path.join('.atelier', 'memory', 'voice.md'));
  }

  if (matched.size === 0 && !hasInstincts) process.exit(0);
  if (matched.size > 6) {
    // too noisy, skip context injection (but still load instincts if present)
    if (!hasInstincts) process.exit(0);
    matched.clear();
    matchedKeywords.length = 0;
  }

  const blocks = [];

  if (hasInstincts) {
    blocks.push(`# salon reference: ${instinctsRel}\n\n${instinctsContent}`);
  }

  if (voiceContent) {
    blocks.push(`# salon reference: .atelier/memory/voice.md (project brand voice)\n\n${voiceContent}`);
  }

  for (const rel of matched) {
    const content = readRelative(root, rel);
    if (content) {
      blocks.push(`# salon reference: ${rel}\n\n${content}`);
    }
  }

  if (blocks.length === 0) process.exit(0);

  // log this activation for later analysis
  const surfacedRefs = [];
  if (hasInstincts) surfacedRefs.push(instinctsRel);
  if (voiceContent) surfacedRefs.push('.atelier/memory/voice.md');
  for (const r of matched) surfacedRefs.push(r);
  logActivation(prompt, matchedKeywords, surfacedRefs);

  const payload = {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: `salon loaded ${blocks.length} relevant reference(s) based on your prompt:\n\n${blocks.join('\n\n---\n\n')}`,
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

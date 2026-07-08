# salon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `salon`, the social-campaign operator plugin (X/LinkedIn/Discord/Telegram) for the atelier marketplace, with shared `.atelier/memory/`, atelier-identical guardrails, and an 11-server opt-in MCP catalog.

**Architecture:** Sibling of atelier: markdown skills/agents/commands + a small Node hook runtime ported from `/Users/zilliqa/Desktop/workhere/atelier` (on disk — read it, copy files, apply rename tables). Original prose skills encode the grep-verified mechanics from the spec's Research Annex.

**Tech Stack:** Plain Node.js (no npm dependencies), markdown content, Claude Code plugin manifest.

## Global Constraints

- Repo root: `/Users/zilliqa/Desktop/workhere/salon`. Sibling source to port from: `/Users/zilliqa/Desktop/workhere/atelier` (read-only — NEVER modify atelier in this plan except Task 11's marketplace entry).
- Spec (binding, includes Research Annex mechanics table and full MCP JSON): `docs/superpowers/specs/2026-07-08-salon-design.md`.
- Plugin name exactly `salon`; version `0.1.0`; repo `lama-assaf/salon` (private).
- Manifest schema rules: `author` object `{name,url}`; NO `agents/skills/commands/hooks` fields in plugin.json (auto-discovered); no `_comment` key in hooks/hooks.json.
- Shared memory: per-project dir is `.atelier/memory/` (literally — there is NO `.salon/` dir). salon adds `voice.md` and `campaigns/` into it.
- Guardrails: `rules/brand/banned-words.md` and `rules/copy/anti-ai-tone.md` are byte-identical copies of atelier's. Expected SHA-256: banned-words `a45cdd757d91dda71a1e38d123b13130e164d5eb80b0ddce527866c1d71ee1bb`, anti-ai-tone `e16b23256c8e67ae3dd838459ab06ac9412d5cf66e246b1e0054348c4d2834ad`.
- Env vars: `SALON_ROOT`, `SALON_LOG_DIR`, `SALON_HOOK_STRICT`; logs `~/.claude/salon/logs`. Hooks must never block a session (missing/malformed anything → exit 0).
- Skills are ORIGINAL prose. Mechanics from unlicensed sources (ColdIQ, aaaronmiller, social-ai-team) are restated facts, never copied sentences. MIT/Apache sources may inform structure; credit lives in README only.
- Every skill/command/agent .md starts with `---\nname: <slug>\ndescription: <one line>\n---` frontmatter (the test runner validates this).
- Commit style: lowercase, imperative, no exclamation marks, trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- After every task: `npm test` exits 0.
- Pushes that touch `.github/` need `env -u GITHUB_TOKEN git push` (env PAT lacks workflow scope). salon ships no workflows in v1, so plain push is fine unless that changes.

---

### Task 1: Scaffold, manifest, license, test runner port

**Files:**
- Create: `.claude-plugin/plugin.json`, `package.json`, `LICENSE`, `VERSION`, `.gitignore`
- Create: `tests/run-all.js` (ported), `scripts/hooks/lib/io.js` (ported)
- Test: `node tests/run-all.js`

**Interfaces:**
- Produces: the repo skeleton every later task fills; `npm test` entrypoint; `readHookInput()/extractWriteContent()/warn()/emit()` from `scripts/hooks/lib/io.js` (same signatures as atelier's `scripts/hooks/lib/io.js`).

- [ ] **Step 1: Create manifest and package files**

`.claude-plugin/plugin.json` (exactly):

```json
{
  "name": "salon",
  "version": "0.1.0",
  "description": "social campaign operator for X, LinkedIn, Discord and Telegram. strategy, platform-native content, engagement and comment playbooks, insight-driven listening.",
  "author": {
    "name": "lama-assaf",
    "url": "https://github.com/lama-assaf"
  },
  "homepage": "https://github.com/lama-assaf/salon",
  "repository": "https://github.com/lama-assaf/salon",
  "license": "MIT",
  "keywords": ["social-media", "campaigns", "engagement", "community", "per-project-memory"]
}
```

`package.json`:

```json
{
  "name": "salon",
  "version": "0.1.0",
  "description": "social campaign operator for X, LinkedIn, Discord and Telegram",
  "scripts": {
    "test": "node tests/run-all.js && node tests/memory-resolution.test.js && node tests/guardrail-sync.test.js"
  },
  "author": { "name": "lama-assaf", "url": "https://github.com/lama-assaf" },
  "license": "MIT",
  "homepage": "https://github.com/lama-assaf/salon",
  "repository": { "type": "git", "url": "https://github.com/lama-assaf/salon.git" }
}
```

(The two extra test files arrive in Tasks 2-3; until then create them as stubs that `process.exit(0)` with a `// filled in by later task` comment so npm test runs green from Task 1 on.)

`VERSION`: `0.1.0` + newline. `.gitignore`: `node_modules/\n.superpowers/\n`. `LICENSE`: MIT text, `Copyright (c) 2026 lama-assaf`.

- [ ] **Step 2: Port the io helper verbatim**

Copy `/Users/zilliqa/Desktop/workhere/atelier/scripts/hooks/lib/io.js` → `scripts/hooks/lib/io.js`, changing only the warn prefix line to:

```js
process.stderr.write(`[salon:hook] ${message}\n`);
```

- [ ] **Step 3: Port and adapt the test runner**

Copy `/Users/zilliqa/Desktop/workhere/atelier/tests/run-all.js` → `tests/run-all.js`, then adapt (read the file top to bottom and apply):

| atelier concern | salon adaptation |
|---|---|
| `atelier` identity strings, tmp paths `/tmp/atelier-*` | `salon`, `/tmp/salon-*` |
| env vars `ATELIER_*` in hook-exec tests | `SALON_*` |
| doc list `['README.md','ATELIER.md','SOUL.md','DISCLAIMER.md','LICENSE','CHANGELOG.md']` | `['README.md','DISCLAIMER.md','LICENSE']` (salon has no ATELIER.md/SOUL.md/CHANGELOG yet) |
| adapter install-script checks section | DELETE (salon has no adapters/) |
| dashboard build + log-viewer + drift-guard sections | DELETE (salon has no dashboard in v1) |
| safety-guard spawn test | DELETE (salon has no safety-guard; README attribution is checked by a simple inline regex test instead — add one: README must match `/\[Dragoon0x\]\(https:\/\/github\.com\/Dragoon0x\)/` is NOT required here; instead require the credits section header `## credits` to exist once README lands — make the check tolerate a missing README until Task 10 by skipping when the file is absent) |
| post-write hook test | DELETE (salon ships no post-write hook) |
| skills-dir check "exactly SKILL.md" | KEEP (salon uses skill dirs with SKILL.md) |
| frontmatter checks over agents/skills/commands | KEEP — must tolerate the dirs being empty (skip-with-ok when a dir doesn't exist yet) so Task 1 is green before content lands |

Keep the JSON-parse-all-files check and cross-reference logic if it ports cleanly; if the reference checker relies on atelier's `scripts/util/check-references.js`, do NOT port that script — delete the section instead (YAGNI for v1).

- [ ] **Step 4: Verify and commit**

Run: `npm test`
Expected: exit 0 (runner passes with empty content dirs; stub tests exit 0).

```bash
git add -A
git commit -m "scaffold salon plugin: manifest, license, ported test runner

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Guardrail rules + sync test

**Files:**
- Create: `rules/brand/banned-words.md`, `rules/copy/anti-ai-tone.md` (byte copies from atelier)
- Create: `rules/social/platform-limits.md`, `rules/social/engagement-ethics.md`, `rules/social/ai-tells.md` (original)
- Create: `tests/guardrail-sync.test.js` (replaces stub)

**Interfaces:**
- Consumes: atelier rule files on disk.
- Produces: rule paths the pre-write hook (Task 3) and skills reference: `rules/brand/banned-words.md`, `rules/copy/anti-ai-tone.md`, `rules/social/platform-limits.md`, `rules/social/engagement-ethics.md`, `rules/social/ai-tells.md`.

- [ ] **Step 1: Byte-copy the shared guardrails**

```bash
mkdir -p rules/brand rules/copy rules/social
cp /Users/zilliqa/Desktop/workhere/atelier/rules/brand/banned-words.md rules/brand/banned-words.md
cp /Users/zilliqa/Desktop/workhere/atelier/rules/copy/anti-ai-tone.md rules/copy/anti-ai-tone.md
```

- [ ] **Step 2: Write the sync test (replaces the Task-1 stub)**

`tests/guardrail-sync.test.js`:

```js
#!/usr/bin/env node
// guardrail-sync.test.js
// salon's shared guardrails must be byte-identical to the atelier versions they
// were ported from. If atelier's rules evolve, re-copy the files and update the
// hashes here in the same commit — the two plugins must never drift silently.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EXPECTED = {
  'rules/brand/banned-words.md': 'a45cdd757d91dda71a1e38d123b13130e164d5eb80b0ddce527866c1d71ee1bb',
  'rules/copy/anti-ai-tone.md': 'e16b23256c8e67ae3dd838459ab06ac9412d5cf66e246b1e0054348c4d2834ad',
};

let fail = 0;
console.log('\nguardrail sync');
for (const [rel, want] of Object.entries(EXPECTED)) {
  const full = path.resolve(__dirname, '..', rel);
  if (!fs.existsSync(full)) {
    fail++; console.log(`  \x1b[31m✗\x1b[0m ${rel} missing`);
    continue;
  }
  const got = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
  if (got === want) console.log(`  \x1b[32m✓\x1b[0m ${rel} matches atelier fixture`);
  else { fail++; console.log(`  \x1b[31m✗\x1b[0m ${rel} drifted (got ${got.slice(0, 12)}…)`); }
}
process.exit(fail ? 1 : 0);
```

Run: `node tests/guardrail-sync.test.js` — Expected: PASS (2 ✓).

- [ ] **Step 3: Write the three original social rules**

Each starts with frontmatter (`name`, `description`). Content requirements:

`rules/social/platform-limits.md` — a table per platform: X (280 chars/post; threads: every post must stand alone; links → first reply, never body; no `1/` numbering; don't edit within 30 min — delete and repost), LinkedIn (hook inside first 210 chars before the fold; 900-1,300 char sweet spot; lines ≤55 chars, blank line between lines; 0-2 hashtags at end; external links → first comment, body links cost roughly half reach or worse), Discord (embed title/description limits 256/4096; @everyone only for genuinely-everyone news; announcements structured: what/why-it-matters/what-to-do), Telegram (4096-char message cap; forward-friendly: self-contained messages; pin discipline: one pinned campaign message at a time).

`rules/social/engagement-ethics.md` — hard rules: no astroturfing or sockpuppets; no engagement pods or coordinated inauthentic amplification; disclose paid or affiliated promotion; comments must add value the thread didn't have (never bare "great post"); web3 example: no price talk that reads as financial advice, no shilling claims about tokens that resemble unregistered-security promotion; respect community raid etiquette — arrive with substance, never brigade.

`rules/social/ai-tells.md` — salon's additive AI-tell taxonomy, three tiers (this extends the shared anti-ai-tone rule, does not replace it): **forensic** (always flag): em-dash density 3+ per 200 words, "Here's the wild part:", "Let's dive in", paragraph-initial "However,"/"Moreover,", perfectly parallel triads in consecutive sentences; **strict** (flag by default): leverage, utilize, delve, harness, foster, robust, seamless, landscape, ecosystem, game-changer, revolutionary, "I'm excited to share"; **aesthetic** (opt-in): single em dash, rule-of-three, colon-led openers. Close with: engagement-bait tells ("Drop a 🔥", "Tag someone who needs this") are forensic-tier.

- [ ] **Step 4: Verify and commit**

Run: `npm test` — Expected: exit 0 (frontmatter checks cover the three new rules; sync test green).

```bash
git add rules tests/guardrail-sync.test.js
git commit -m "add shared guardrails with sync test and social rules

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Hook runtime — prompt-context on shared memory (TDD)

**Files:**
- Create: `scripts/hooks/prompt-context.js` (ported + adapted)
- Create: `hooks/hooks.json`
- Create: `tests/memory-resolution.test.js` (replaces stub)

**Interfaces:**
- Consumes: `scripts/hooks/lib/io.js` (Task 1). Hook stdin: `{prompt, cwd}`.
- Produces: injected context blocks labeled `# salon reference: <rel>`; shared-memory convention `.atelier/memory/{instincts.md,voice.md}`; `findSalonRoot()` / `findProjectDir(input)` / `isSalonRoot(p)` used verbatim by Task 4's tests.

- [ ] **Step 1: Write the failing tests (replaces the Task-1 stub)**

`tests/memory-resolution.test.js` — port `/Users/zilliqa/Desktop/workhere/atelier/tests/memory-resolution.test.js` and adapt:

| atelier | salon |
|---|---|
| `.atelier/memory` paths in test setup | UNCHANGED (shared memory — keep `.atelier/memory`) |
| `atelier-test-` tmp prefixes | `salon-test-` |
| prompt `'design review of the header'` (keyword case) | `'draft an x thread about our launch'` (expects `skills/x-thread/SKILL.md` injected) |
| label check `.atelier/memory/instincts.md` | UNCHANGED |
| ATELIER_ROOT bogus-root case | `SALON_ROOT` |
| logs-only `~/.claude/atelier` HOME case | logs-only `~/.claude/salon` |

Add one NEW case: voice injection — create `.atelier/memory/voice.md` containing `voice-marker-vvv` in the temp project, prompt `'write a linkedin post about hiring'`, expect stdout to include BOTH `voice-marker-vvv` and `linkedin-post/SKILL.md`.

Run: `node tests/memory-resolution.test.js`
Expected: FAIL — `scripts/hooks/prompt-context.js` doesn't exist yet (spawn error → non-zero status on every check).

- [ ] **Step 2: Port and adapt prompt-context.js**

Copy `/Users/zilliqa/Desktop/workhere/atelier/scripts/hooks/prompt-context.js` → `scripts/hooks/prompt-context.js`. Apply:

1. Identity: `atelier` → `salon` in function names (`findAtelierRoot`→`findSalonRoot`, `isAtelierRoot`→`isSalonRoot`), env vars (`ATELIER_ROOT`→`SALON_ROOT`, `ATELIER_LOG_DIR`→`SALON_LOG_DIR`), `~/.claude/atelier`→`~/.claude/salon` (root candidate AND log dir), block label `# atelier reference:`→`# salon reference:`, summary line `atelier loaded`→`salon loaded`.
2. Memory paths: KEEP `.atelier/memory/instincts.md` (shared). Label stays `.atelier/memory/instincts.md (project memory)`; seed fallback label becomes `memory/instincts.md (salon defaults)`.
3. Replace the KEYWORDS map entirely with:

```js
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
};
```

4. Voice injection: after the instincts block resolution, add (mirroring the instincts pattern — `projectDir` and `readRelative` already exist):

```js
  // brand voice: inject when a writing keyword matched
  const WRITING_KEYS = ['thread', 'tweet', 'linkedin', 'announcement', 'discord announcement', 'broadcast', 'telegram', 'hook', 'viral', 'post audit'];
  let voiceContent = null;
  if (projectDir && matchedKeywords.some(k => WRITING_KEYS.includes(k))) {
    voiceContent = readRelative(projectDir, path.join('.atelier', 'memory', 'voice.md'));
  }
```

and push it into `blocks` (after the instincts block) as:

```js
  if (voiceContent) {
    blocks.push(`# salon reference: .atelier/memory/voice.md (project brand voice)\n\n${voiceContent}`);
  }
```

and include `.atelier/memory/voice.md` in `surfacedRefs` when injected.

- [ ] **Step 3: Create `hooks/hooks.json`** (no `_comment` key — schema-pure):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/prompt-context.js" }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          { "type": "command", "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/pre-write.js" }
        ]
      }
    ]
  }
}
```

(pre-write.js lands in Task 4; until then the runner must not execute it — check the ported run-all.js hook-exec section only tests files that exist, or defer enabling that check to Task 4.)

- [ ] **Step 4: Seed placeholder skills for the two keyword-test targets**

The memory test expects `skills/x-thread/SKILL.md` and `skills/linkedin-post/SKILL.md` to exist (content lands in Task 6). Create minimal valid versions now (frontmatter + one-line body `full content lands in the writing-skills task.`) so injection works.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node tests/memory-resolution.test.js && npm test`
Expected: all green, including the new voice case.

- [ ] **Step 6: Commit**

```bash
git add scripts/hooks/prompt-context.js hooks/hooks.json tests/memory-resolution.test.js skills
git commit -m "port prompt-context hook onto shared atelier memory with voice injection

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: pre-write hook with atelier deference (TDD)

**Files:**
- Create: `scripts/hooks/pre-write.js` (ported + deference)
- Create: `tests/prewrite-deference.test.js`
- Modify: `package.json` (append `&& node tests/prewrite-deference.test.js` to the test script)

**Interfaces:**
- Consumes: `lib/io.js` helpers; rule files from Task 2.
- Produces: deference contract — salon pre-write exits 0 silently when atelier is co-installed.

- [ ] **Step 1: Write the failing test**

`tests/prewrite-deference.test.js`:

```js
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
```

Run: `node tests/prewrite-deference.test.js` — Expected: FAIL (hook file missing).

- [ ] **Step 2: Port and adapt pre-write.js**

Copy `/Users/zilliqa/Desktop/workhere/atelier/scripts/hooks/pre-write.js` → `scripts/hooks/pre-write.js`. Apply: identity renames (`atelier rules flagged` → `salon rules flagged`, `ATELIER_HOOK_STRICT` → `SALON_HOOK_STRICT`, header comments); if it loads rule files by path, keep the same relative paths (`rules/brand/banned-words.md`, `rules/copy/anti-ai-tone.md` — identical in salon) and ALSO load `rules/social/ai-tells.md` forensic/strict entries if the ported architecture reads rule files (if the checks are inline lists rather than file-driven, leave the inline lists as-is — do not rebuild the checker). Then add the deference gate at the very top of `main()`, before any content scanning:

```js
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
```

and in `main()`:

```js
  // one family, one guard: defer to atelier's identical pre-write when co-installed
  if (atelierInstalled()) process.exit(0);
```

(Ensure `os` is required; atelier's version already requires it — verify.)

- [ ] **Step 3: Run tests, wire into npm test, commit**

Run: `node tests/prewrite-deference.test.js` — Expected: PASS (6 ✓).
Edit `package.json` test script to: `node tests/run-all.js && node tests/memory-resolution.test.js && node tests/guardrail-sync.test.js && node tests/prewrite-deference.test.js`.
Run: `npm test` — Expected: exit 0. (If run-all's hook-exec section was deferred in Task 3, enable it now and re-run.)

```bash
git add scripts/hooks/pre-write.js tests/prewrite-deference.test.js package.json
git commit -m "port pre-write guard with atelier deference

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Memory seeds + the atelier-trio commands

**Files:**
- Create: `memory/instincts.md`, `memory/lessons.md`, `memory/voice.md`, `memory/campaigns/README.md`, `memory/README.md`
- Create: `commands/memory-init.md`, `commands/remember.md`, `commands/mcp-setup.md`

**Interfaces:**
- Consumes: shared-memory convention from Task 3; atelier's command files at `/Users/zilliqa/Desktop/workhere/atelier/commands/{memory-init,remember,mcp-setup}.md` as the base text.
- Produces: `.atelier/memory/` extension contract used by all strategy/engagement skills: `voice.md`, `campaigns/<slug>.md`.

- [ ] **Step 1: Write the seed files**

`memory/instincts.md`: salon-flavored template mirroring atelier's shape — heading, "this file is a template" note INCLUDING the exact literal line `(delete these once you have your own.)` (the hook's template-skip heuristic matches that substring — required), and 4-6 example instincts (e.g. posting windows, comment-first discipline, banned topics). `memory/lessons.md`: same format as atelier's (dated entries). `memory/voice.md`: template with sections — voice summary, 5 adjective sliders (e.g. playful↔formal), vocabulary do/don't lists, 3 sample posts in-voice, per-platform register notes; template marker line `(replace this template with your real voice profile.)`. `memory/campaigns/README.md`: explains one file per campaign with the lifecycle sections (brief → calendar → engager ledger → retro). `memory/README.md`: explains the SHARED `.atelier/memory/` model, that atelier owns the base files and salon adds voice.md + campaigns/, and points at `/salon:memory-init`.

- [ ] **Step 2: Write the three commands**

Base each on the atelier file (read it first), adapted:

`commands/memory-init.md` (name: memory-init): steps — 1. find project root; 2. if `.atelier/memory/` exists, ADD only missing salon files (`voice.md`, `campaigns/README.md`) from `${CLAUDE_PLUGIN_ROOT}/memory/`, never touching existing files, and report what was added; 3. if it doesn't exist, create the full shared base (instincts.md, lessons.md from salon seeds) plus salon files; 4. explain commit-vs-gitignore and that atelier (if installed) reads the same directory.

`commands/remember.md` (name: remember): identical mechanics to atelier's (`$ARGUMENTS`, `--instinct` flag), targeting the SHARED `.atelier/memory/lessons.md` / `instincts.md`.

`commands/mcp-setup.md` (name: mcp-setup): atelier's mechanics (read catalog at `${CLAUDE_PLUGIN_ROOT}/mcp-configs/mcp-servers.json`, present servers with env tokens, `$ARGUMENTS` may preselect, merge into project `.mcp.json` creating `{"mcpServers":{}}` if absent, NEVER overwrite same-name entries, strip `_comment` keys, list env vars to set, remind to run /mcp) — plus salon specifics: mention the cost flag on x-api, the ToS flag on linkedin-unofficial (require explicit confirmation before adding it), and telegram's one-time `auth` subcommand.

- [ ] **Step 3: Verify and commit**

Run: `npm test` — Expected: exit 0 (frontmatter checks pass on the three commands).

```bash
git add memory commands
git commit -m "add shared-memory seeds and memory-init, remember, mcp-setup commands

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Writing skills (7)

**Files:**
- Create: `skills/x-thread/SKILL.md` (replace Task-3 placeholder), `skills/linkedin-post/SKILL.md` (replace placeholder), `skills/discord-announcement/SKILL.md`, `skills/telegram-broadcast/SKILL.md`, `skills/hook-writing/SKILL.md`, `skills/post-audit/SKILL.md`, `skills/adversarial-refinement/SKILL.md`

**Interfaces:**
- Consumes: rules paths from Task 2; `.atelier/memory/voice.md` convention from Task 5.
- Produces: skill paths referenced by the Task-3 keyword map (names must match exactly).

Each SKILL.md: frontmatter (`name` = dir name, `description` = one action-oriented line stating when to use it), then sections `## when to use`, `## workflow` (numbered steps), `## rules` (the platform mechanics), `## checklist` (pre-ship gate). Every writing skill's workflow step 1 is: read `.atelier/memory/voice.md` if present and conform to it; step 2: check `.atelier/memory/instincts.md` for overrides. All prose ORIGINAL. Mechanics each must encode (from the spec's Research Annex — restate, don't copy):

- [ ] **Step 1: `x-thread`** — thread arc (hook post → escalation → payoff → CTA-as-command); every post stands alone; 280-char budget per post with counting discipline; links in first reply only; no `1/` numbering; no edits within 30 min (delete-and-repost); replies-received and dwell time are the top ranking signals so the thread should open loops that invite replies; stay online 30 min after posting (hand off to launch-window skill).

- [ ] **Step 2: `linkedin-post`** — hook inside first 210 chars; 900-1,300 char sweet spot; line length ≤55 chars with blank lines; framework menu (PAS/AIDA/BAB/STAR/SLAY) with when-to-use table; 0-2 hashtags at end; links in first comment (body links ≈0.3-0.6x reach); save/meaningful-comment/share are the high-value signals to design for; first-comment as content type (seed a substantive first comment).

- [ ] **Step 3: `discord-announcement`** (original white space — no upstream source) — announcement anatomy: headline line, what happened, why members should care, what to do next, one link max; embed limits (title 256, description 4096); @everyone/@here etiquette ladder (everyone = affects all members; here = time-critical only; role pings preferred); event promo runbook (T-7/T-1/T-0 messages); AMA runbook (announce → collect questions thread → live thread → recap); role-gated reveal pattern; web3 example: listing/partnership announcements need compliance-checked wording — no price promises.

- [ ] **Step 4: `telegram-broadcast`** (original white space) — broadcast anatomy: first line is the whole story (notification preview), body ≤4096 chars, forward-friendly (no "as I said above"); one pinned campaign message at a time, unpin superseded; button/CTA conventions (inline keyboard for one primary action); cadence guard (broadcasts are interruptions — batch news); cross-post discipline from Discord (adapt, don't mirror).

- [ ] **Step 5: `hook-writing`** — the 210-char/mobile-fold rule; 2-line hook format (line 1 punchy statement ≤40 chars, line 2 contrast/reframe); 6 fixed angle drill (number-led, contrarian, personal transformation, authority steal, admission, future shock) — generate all 6, pick by campaign goal; formula families with the measured-multiplier insight (specific odd numbers outperform round; paid-vs-free reversals and category-obituary frames measured strongest; failure-in-first-3-lines beats polish); never hedge, never open with a question on X.

- [ ] **Step 6: `post-audit`** — pre-publish gate combining: platform-limits rule check; AI-tell scan across the three tiers of `rules/social/ai-tells.md` + shared anti-ai-tone; link placement check; claim check (every number sourced, every promise kept); engagement-design check (what signal is this post built to earn: replies? saves? shares?); verdict format PASS/FLAG list with fix suggestions.

- [ ] **Step 7: `adversarial-refinement`** — five-pass persona protocol (restated originally): skeptic (why care?), expert (is it accurate?), scroller (would I stop?), competitor (could anyone else post this?), editor (cut 20%); three depth tiers (quick = passes 1/3/5; standard = all 5 + revise; deep = all 5 + revise + 24h cooling period); closer must be a command not a question.

- [ ] **Step 8: Verify and commit**

Run: `npm test` — Expected: exit 0 (frontmatter + skill-dir checks over 7 skills).

```bash
git add skills
git commit -m "add writing skills: platform-native content, hooks, audit, adversarial refinement

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Engagement skills (5)

**Files:**
- Create: `skills/comment-strategy/SKILL.md`, `skills/reply-playbook/SKILL.md`, `skills/engagement-monitor/SKILL.md`, `skills/community-health/SKILL.md`, `skills/launch-window/SKILL.md`

**Interfaces:**
- Consumes: `.atelier/memory/campaigns/<slug>.md` convention (engager ledger lives inside the campaign file, section `## engager ledger`).
- Produces: skill paths matching the Task-3 keyword map.

Same structure/frontmatter contract as Task 6. Mechanics to encode (restated originally):

- [ ] **Step 1: `comment-strategy`** — commenting on OTHERS' posts as a growth channel: target selection (niche-relevant accounts larger than yours; posts <30 min old for top positioning); 7 comment shapes with when-to-use (missing-piece concession — the highest measured author-reply shape; answer-the-closing-question; data-point-first; practitioner observation; agree-then-push counter with concession; quotable reframe <12 words; sharper follow-up question); mechanics: ≥15 words per comment, 10-20 meaningful comments/day, react → pause a beat → comment (human pacing), never LIKE-react a counter-argument comment; every comment must pass `rules/social/engagement-ethics.md`.

- [ ] **Step 2: `reply-playbook`** — replies on YOUR posts: triage matrix (amplify / answer / redirect / defuse / ignore+hide criteria); reply shapes (answer-their-question, concede-then-sharpen, extend-their-thesis, lived-experience, ask-back); platform mechanics (LinkedIn flattens threads to 2 levels — always reply to the top-level comment; X replies boost ranking, reply to every substantive comment in hour 1); de-escalation script for hostile replies; community-raid etiquette (web3): welcome raiders with substance, redirect energy to a pinned thread.

- [ ] **Step 3: `engagement-monitor`** — engagement-weight ladder for prioritization (saves ≈5x > meaningful comments (>15 words) ≈4x > shares-with-commentary ≈3-4x > short comments ≈2x > likes ≈1x — likes alone mean almost nothing); engager ICP tiers (peer / aspirational / prospect / other) with per-post % breakdown; engager ledger maintenance in the campaign file (`## engager ledger`: handle, tier, posts engaged, suggested next action — follow/DM/comment-back); weekly review cadence.

- [ ] **Step 4: `community-health`** — Discord/Telegram health signals: lurker ratio, new-member first-message rate, churn signals (leaves after announcements? silence in threads?), response-time SLA for member questions; re-engagement plays (call-out threads, member spotlights, low-stakes polls); 3-tier escalation ladder with concrete triggers (tier 1 CM handles: routine negativity; tier 2 → marketing lead within 2h: negative comment gaining traction, e.g. 10+ reactions; tier 3 → leadership immediately: viral negative content, coordinated brigading); mod-team cadence (daily sweep, weekly retro item).

- [ ] **Step 5: `launch-window`** — golden-hour routine as a timed checklist: T+0 post live → T+0-5 min reply to every early comment → T+5-15 engage 5-10 adjacent posts in-niche → T+15-30 recheck and reply → T+1-2h final pass; rationale: first 60-90 min determine the bulk of distribution (feed models seed to ~8-15% of followers and extend on early engagement); stay online 30 min minimum after posting on X; judgment discipline: do NOT evaluate performance before the 48-72h plateau — schedule the retro check then, not day-of.

- [ ] **Step 6: Verify and commit**

Run: `npm test` — Expected: exit 0.

```bash
git add skills
git commit -m "add engagement skills: comments, replies, monitoring, community health, launch window

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Strategy + insight skills (5) and agents (3)

**Files:**
- Create: `skills/campaign-brief/SKILL.md`, `skills/content-calendar/SKILL.md`, `skills/campaign-retro/SKILL.md`, `skills/social-listening/SKILL.md`, `skills/trend-to-content/SKILL.md`
- Create: `agents/campaign-strategist.md`, `agents/engagement-manager.md`, `agents/community-manager.md`

**Interfaces:**
- Consumes: campaign-file convention (`.atelier/memory/campaigns/<slug>.md`), MCP keys from Task 9's catalog (referenced by name only: reddit, hacker-news, brave-search, telegram, discord).
- Produces: campaign file section contract used by commands: `## brief`, `## calendar`, `## engager ledger`, `## retro`.

- [ ] **Step 1: `campaign-brief`** — brief shape: objectives + audience (with ICP notes) → message house (core claim, 3 support pillars, proof points) → channel strategy split owned/earned/paid across the four platforms → week-by-week calendar skeleton with dependencies → success metrics with benchmark bands (good/great/excellent per metric, set at brief time). Writes/updates `## brief` in `.atelier/memory/campaigns/<slug>.md` (create file from `memory/campaigns/README.md` conventions if absent). Web3 example: token-related campaigns get a compliance-review checkpoint in the calendar.

- [ ] **Step 2: `content-calendar`** — pillar × format matrix: 8 format columns (actionable, motivational, analytical, contrarian, observation, x-vs-y, present-vs-future, listicle) × 3-5 content pillars; every cell must be a concrete headline, not a theme; pillar mix guard (≈authority 40-50% / narrative 30-40% / community 20-30%, optional product ≤15%); per-platform cadence guard (LinkedIn 3-5/wk, X daily+, Discord/Telegram news-driven — sustainable only if comment volume holds); writes `## calendar` into the campaign file; consumes `## retro`'s best-performers list from prior campaigns as an input when present.

- [ ] **Step 3: `campaign-retro`** — the readout: per-platform engagement-rate math (`(reactions+comments+saves+shares)/impressions`, exclude paid amplification from organic benchmarks); benchmark-band scoring against the brief's bands; top-3/bottom-3 with the WHY (hook type, format, topic, timing); flop discipline — a post is a flop only if ALL of click-rate, follower-ratio, engagement-rate, and conversion missed; never judge before the 48-72h plateau; outputs `## retro` in the campaign file + distills 1-3 durable lessons into `.atelier/memory/lessons.md` and updates a best-performers list the next calendar consumes.

- [ ] **Step 4: `social-listening`** — MCP-driven listening loop: reddit + hacker-news + brave-search for niche trend/conversation discovery, telegram/discord reads for community sentiment; output format: finding → evidence links → conversation-entry opportunity (which post/thread to join, which comment shape from comment-strategy) → content opportunity (hand to trend-to-content); MUST degrade gracefully — when no MCP is connected, emit the manual research checklist instead of failing; never auto-post anything.

- [ ] **Step 5: `trend-to-content`** — turn one listening finding into: platform-fit assessment (which of the 4 platforms this trend lives on), 2-3 angle options using hook-writing's 6-angle drill, freshness deadline (trends decay — state a post-by date/time), and a slot suggestion in the current calendar.

- [ ] **Step 6: The three agents** — each `agents/<name>.md` with frontmatter (`name`, `description` stating delegation trigger) + body defining: mission, which skills it drives (campaign-strategist → campaign-brief, content-calendar, campaign-retro, trend-to-content; engagement-manager → comment-strategy, reply-playbook, engagement-monitor, launch-window; community-manager → community-health, discord-announcement, telegram-broadcast), memory contract (always read `.atelier/memory/instincts.md` + relevant campaign file first; write back what changed), and hard rules (never publish/post via MCP without explicit user confirmation; engagement-ethics rules bind everything).

- [ ] **Step 7: Verify and commit**

Run: `npm test` — Expected: exit 0.

```bash
git add skills agents
git commit -m "add strategy and insight skills plus the three operator agents

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: MCP catalog + platform/campaign commands (10)

**Files:**
- Create: `mcp-configs/mcp-servers.json`, `mcp-configs/README.md`
- Create: `commands/campaign.md`, `commands/thread.md`, `commands/linkedin.md`, `commands/announce.md`, `commands/broadcast.md`, `commands/comment.md`, `commands/engage.md`, `commands/launch.md`, `commands/listen.md`, `commands/retro.md`

**Interfaces:**
- Consumes: skills from Tasks 6-8 (each command names its skill); catalog consumed by Task 5's mcp-setup command.
- Produces: the complete command surface.

- [ ] **Step 1: Write `mcp-configs/mcp-servers.json`**

Copy the JSON block VERBATIM from the spec section "## MCP catalog — opt-in only, honestly flagged" in `docs/superpowers/specs/2026-07-08-salon-design.md` (the fenced json block containing keys `x-api`, `twitter-community`, `discord`, `telegram`, `reddit`, `hacker-news`, `brave-search`, `postiz`, `typefully`, `buffer`, `linkedin-unofficial`), wrapped as `{ "mcpServers": { ...those keys... } }`. Validate: `node -e "JSON.parse(require('fs').readFileSync('mcp-configs/mcp-servers.json','utf-8')); console.log('ok')"`.

- [ ] **Step 2: Write `mcp-configs/README.md`** — quick start (`/salon:mcp-setup`), the flags table from the spec (cost on x-api, ToS on linkedin-unofficial and telegram, plan limits on schedulers), the avoid-list from the spec (cookie X scrapers, Discord self-bots, Bot-API-only Telegram, fragile Trends scrapers) with one-line reasons.

- [ ] **Step 3: Write the 10 commands** — each is a thin dispatcher: frontmatter + "invoke the <skill> workflow with $ARGUMENTS as the subject; consult the campaign file first" + any command-specific notes: `campaign` (runs campaign-brief then offers content-calendar); `thread`→x-thread (then offer post-audit); `linkedin`→linkedin-post (then offer post-audit); `announce`→discord-announcement; `broadcast`→telegram-broadcast; `comment`→comment-strategy (argument = post URL/topic); `engage`→reply-playbook (argument = the replies to triage, or instruct user to paste them / read via connected MCP); `launch`→launch-window (argument = link to the just-published post); `listen`→social-listening; `retro`→campaign-retro (argument = campaign slug).

- [ ] **Step 4: Verify and commit**

Run: `npm test` — Expected: exit 0 (frontmatter over 13 total commands; JSON check covers the catalog).

```bash
git add mcp-configs commands
git commit -m "add mcp catalog and the ten campaign commands

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: README + DISCLAIMER

**Files:**
- Create: `README.md`, `DISCLAIMER.md`

- [ ] **Step 1: `README.md`** — sections: title + one-liner; install fenced block (`/plugin marketplace add lama-assaf/atelier` → `/plugin install salon@atelier`; note repo is private → GitHub access needed; commands namespaced `/salon:*`); "works with atelier" section (shared `.atelier/memory/`, same guardrails, deference — a co-install is the intended setup); per-project onboarding (`/salon:memory-init`, edit voice.md, `/salon:mcp-setup`); what's inside (17 skills by group, 3 agents, 13 commands, rules, hooks, 11 MCP templates with the cost/ToS flags called out); campaign lifecycle walkthrough (brief → calendar → content → launch-window → engage → retro); `## credits` section — adapt-directly credits (sergebulaev/linkedin-skills, charlie947/social-media-skills, alirezarezvani/claude-skills, mohitagw15856/pm-claude-skills, Hao0321/claude-skill-social-post, anthropics/knowledge-work-plugins, coreyhaines31/marketingskills, all linked) and concept-reference acknowledgments (ColdIQ, create-viral-content, social-ai-team); license (MIT) + disclaimer pointer; experimental/DYOR footer paragraph (no warranty, operator owns output, no affiliation with X/LinkedIn/Discord/Telegram/Reddit or any listed MCP vendor).
- [ ] **Step 2: `DISCLAIMER.md`** — long form: experimental status; DYOR; no warranty; operator owns all published content; platform ToS responsibility sits with the operator (especially the flagged linkedin-unofficial scraper and telegram user-session servers — salon documents risk flags but the operator makes the call); engagement ethics are binding defaults; not legal/financial advice (web3 wording examples are illustrations, not compliance guidance); no affiliation with any referenced platform or vendor.
- [ ] **Step 3: Verify and commit** — Run: `npm test` (the Task-1 README credits check now activates). Expected: exit 0.

```bash
git add README.md DISCLAIMER.md
git commit -m "add readme with credits and full disclaimer

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: E2E verify + publish + marketplace entry

**Files:**
- No salon source changes expected (fix-forward if verification finds issues).
- Modify: `/Users/zilliqa/Desktop/workhere/atelier/.claude-plugin/marketplace.json` (the ONE permitted atelier change).

- [ ] **Step 1: Full local verification**

```bash
npm test && claude plugin validate .
```

Expected: all suites green; validation passes.

- [ ] **Step 2: Hook e2e simulation**

```bash
SP=$(mktemp -d /tmp/salon-e2e-XXXX)
mkdir -p "$SP/proj/.atelier/memory"
printf -- '- **cadence**: e2e-instinct-zzz\n' > "$SP/proj/.atelier/memory/instincts.md"
printf -- 'voice: dry, precise. e2e-voice-yyy\n' > "$SP/proj/.atelier/memory/voice.md"
echo "{\"prompt\":\"draft an x thread about our launch\",\"cwd\":\"$SP/proj\"}" | node scripts/hooks/prompt-context.js
```

Expected: single JSON line whose additionalContext contains `e2e-instinct-zzz`, `e2e-voice-yyy`, and x-thread skill content — instincts + voice + keyword refs compose.

- [ ] **Step 3: Create and push the private repo**

```bash
gh repo create lama-assaf/salon --private --source . --push --description "social campaign operator for X, LinkedIn, Discord and Telegram — claude code plugin sharing atelier's memory and guardrails"
```

(If push is rejected for token scopes, retry with `env -u GITHUB_TOKEN git push -u origin main`.)

- [ ] **Step 4: Add salon to the atelier marketplace**

In `/Users/zilliqa/Desktop/workhere/atelier` on a branch `add-salon-plugin`: edit `.claude-plugin/marketplace.json`, appending to the `plugins` array:

```json
    {
      "name": "salon",
      "source": {
        "source": "github",
        "repo": "lama-assaf/salon"
      },
      "description": "social campaign operator: strategy, platform-native content, engagement and comment playbooks for X, LinkedIn, Discord and Telegram"
    }
```

Run atelier's own suite (`npm test` in the atelier repo — JSON checks cover the file), commit (`add salon plugin to marketplace`), merge to main, `env -u GITHUB_TOKEN git push`.

- [ ] **Step 5: Live install check (user-interactive)**

Ask the user to run: `/plugin marketplace update atelier` then `/plugin install salon@atelier`; in a project: `/salon:memory-init`, put a real line in `.atelier/memory/voice.md`, prompt "draft an x thread about <topic>", and confirm the "salon loaded … reference(s)" injection appears with voice content. Report results back.

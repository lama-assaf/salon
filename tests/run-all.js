#!/usr/bin/env node
// run-all.js
// salon test runner. validates every part of the repo:
//   - all JSON files parse
//   - every agent/skill/command has valid markdown frontmatter
//   - every skill folder has exactly SKILL.md
//   - hooks scripts run cleanly on representative inputs
//   - no broken cross-references between skills/commands/rules
//
// ported from atelier's tests/run-all.js and adapted for salon: content
// sections (agents/skills/commands/rules/hooks) tolerate missing or empty
// directories so this runner is green on a freshly scaffolded repo, and
// sections that depend on atelier-only infra (adapters, dashboard,
// safety-guard, check-references.js, post-write hook) were removed — see
// task-1-brief.md's adaptation table for the full rationale.
//
// usage: node tests/run-all.js [--verbose]
// exit 0 = all pass, 1 = failures

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');

let pass = 0;
let fail = 0;
const failures = [];

function ok(name) {
  pass++;
  if (VERBOSE) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
}

function err(name, detail) {
  fail++;
  failures.push({ name, detail });
  console.log(`  \x1b[31m✗\x1b[0m ${name}`);
  if (detail) console.log(`      ${detail}`);
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

function walkFiles(dir, pattern) {
  const out = [];
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && pattern.test(ent.name)) out.push(full);
    }
  }
  walk(dir);
  return out;
}

function parseFrontmatter(text, filePath) {
  if (!text.startsWith('---\n')) {
    return { ok: false, error: 'no frontmatter delimiter at start' };
  }
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) {
    return { ok: false, error: 'no closing frontmatter delimiter' };
  }
  const block = text.slice(4, end);
  const fields = {};
  const lines = block.split('\n');
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const k = line.slice(0, colon).trim();
    const v = line.slice(colon + 1).trim();
    fields[k] = v;
  }
  return { ok: true, fields, body: text.slice(end + 5) };
}

// ============================================================
// 1. JSON files parse
// ============================================================
section('JSON files');

const jsonFiles = walkFiles(ROOT, /\.json$/).filter((p) => !p.includes('node_modules'));
for (const f of jsonFiles) {
  try {
    JSON.parse(fs.readFileSync(f, 'utf-8'));
    ok(`parse ${path.relative(ROOT, f)}`);
  } catch (e) {
    err(`parse ${path.relative(ROOT, f)}`, e.message);
  }
}

// ============================================================
// 2. plugin.json has required fields
// ============================================================
section('plugin manifest');

try {
  const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin/plugin.json'), 'utf-8'));
  for (const field of ['name', 'version', 'description', 'author']) {
    if (plugin[field]) ok(`plugin.json has ${field}`);
    else err(`plugin.json has ${field}`, `missing required field`);
  }
} catch (e) {
  err('plugin.json readable', e.message);
}

// ============================================================
// 3. agents: frontmatter + required fields
// (tolerant: skip-with-ok when agents/ doesn't exist yet)
// ============================================================
section('agents');

const agentsDir = path.join(ROOT, 'agents');
if (!fs.existsSync(agentsDir)) {
  ok('agents/ not yet present, skipping');
} else {
  const agentFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'));
  ok(`agent count = ${agentFiles.length}`);

  for (const af of agentFiles) {
    const full = path.join(agentsDir, af);
    const text = fs.readFileSync(full, 'utf-8');
    const fm = parseFrontmatter(text, full);
    if (!fm.ok) {
      err(`agent ${af}`, fm.error);
      continue;
    }
    const expected = ['name', 'description', 'tools', 'model'];
    const missing = expected.filter((k) => !fm.fields[k]);
    if (missing.length === 0) ok(`agent ${af} frontmatter complete`);
    else err(`agent ${af} frontmatter`, `missing: ${missing.join(', ')}`);

    // name in frontmatter matches filename
    const expectedName = af.replace(/\.md$/, '');
    if (fm.fields.name === expectedName) ok(`agent ${af} name matches filename`);
    else err(`agent ${af} name`, `frontmatter name "${fm.fields.name}" != filename "${expectedName}"`);

    // body is non-trivial
    if (fm.body.trim().length > 200) ok(`agent ${af} has substantive body`);
    else err(`agent ${af} body`, `body too short: ${fm.body.trim().length} chars`);
  }
}

// ============================================================
// 4. skills: each is a directory with SKILL.md, valid frontmatter
// (tolerant: skip-with-ok when skills/ doesn't exist yet)
// ============================================================
section('skills');

const skillsDir = path.join(ROOT, 'skills');
if (!fs.existsSync(skillsDir)) {
  ok('skills/ not yet present, skipping');
} else {
  const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  ok(`skill count = ${skillDirs.length}`);

  for (const sd of skillDirs) {
    const skillFile = path.join(skillsDir, sd, 'SKILL.md');
    if (!fs.existsSync(skillFile)) {
      err(`skill ${sd}`, 'missing SKILL.md');
      continue;
    }
    const text = fs.readFileSync(skillFile, 'utf-8');
    const fm = parseFrontmatter(text, skillFile);
    if (!fm.ok) {
      err(`skill ${sd}/SKILL.md`, fm.error);
      continue;
    }
    if (fm.fields.name && fm.fields.description) {
      ok(`skill ${sd} frontmatter complete`);
    } else {
      err(`skill ${sd} frontmatter`, `missing name or description`);
    }
    if (fm.fields.name === sd) {
      ok(`skill ${sd} name matches dir`);
    } else {
      err(`skill ${sd} name`, `frontmatter name "${fm.fields.name}" != dir "${sd}"`);
    }
    if (fm.body.trim().length > 300) ok(`skill ${sd} has substantive body`);
    else err(`skill ${sd} body`, `body too short: ${fm.body.trim().length} chars`);
  }
}

// ============================================================
// 5. commands: frontmatter with name + description
// (tolerant: skip-with-ok when commands/ doesn't exist yet)
// ============================================================
section('commands');

const commandsDir = path.join(ROOT, 'commands');
if (!fs.existsSync(commandsDir)) {
  ok('commands/ not yet present, skipping');
} else {
  const commandFiles = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'));
  ok(`command count = ${commandFiles.length}`);

  for (const cf of commandFiles) {
    const full = path.join(commandsDir, cf);
    const text = fs.readFileSync(full, 'utf-8');
    const fm = parseFrontmatter(text, full);
    if (!fm.ok) {
      err(`command ${cf}`, fm.error);
      continue;
    }
    if (fm.fields.name && fm.fields.description) {
      ok(`command ${cf} frontmatter complete`);
    } else {
      err(`command ${cf} frontmatter`, `missing name or description`);
    }
    const expectedName = cf.replace(/\.md$/, '');
    if (fm.fields.name === expectedName) {
      ok(`command ${cf} name matches filename`);
    } else {
      err(`command ${cf} name`, `frontmatter name "${fm.fields.name}" != filename "${expectedName}"`);
    }
  }
}

// ============================================================
// 6. rules: every file has body content
// (tolerant: skip-with-ok when rules/ doesn't exist yet)
// ============================================================
section('rules');

const rulesDir = path.join(ROOT, 'rules');
if (!fs.existsSync(rulesDir)) {
  ok('rules/ not yet present, skipping');
} else {
  const ruleFiles = walkFiles(rulesDir, /\.md$/);
  ok(`rule file count = ${ruleFiles.length}`);
  for (const rf of ruleFiles) {
    const text = fs.readFileSync(rf, 'utf-8');
    const rel = path.relative(ROOT, rf);
    if (text.trim().length > 100) {
      ok(`rule ${rel} non-trivial`);
    } else {
      err(`rule ${rel}`, `body too short: ${text.trim().length} chars`);
    }
  }
}

// ============================================================
// 7. hook scripts: pre-write / prompt-context execute cleanly on
// representative inputs. salon ships no post-write hook (deleted from
// the ported suite). tolerant: skip-with-ok when a hook file doesn't
// exist yet (pre-write.js lands in Task 4, prompt-context.js in Task 3).
// ============================================================
section('hooks');

const HOOKS_DIR = path.join(ROOT, 'scripts/hooks');
const preWritePath = path.join(HOOKS_DIR, 'pre-write.js');
const promptContextPath = path.join(HOOKS_DIR, 'prompt-context.js');

for (const hookFile of ['pre-write.js', 'prompt-context.js']) {
  const p = path.join(HOOKS_DIR, hookFile);
  if (!fs.existsSync(p)) {
    ok(`hook ${hookFile} not yet present, skipping`);
    continue;
  }
  ok(`hook ${hookFile} exists`);
  // check first line is shebang
  const first = fs.readFileSync(p, 'utf-8').split('\n', 1)[0];
  if (first === '#!/usr/bin/env node') ok(`hook ${hookFile} shebang ok`);
  else err(`hook ${hookFile} shebang`, `first line was: ${first}`);
}

if (fs.existsSync(preWritePath)) {
  // isolate HOME so these standalone-behavior checks aren't skewed by atelier
  // being co-installed on the machine running the tests (deference is tested
  // separately in tests/prewrite-deference.test.js).
  const cleanHome = fs.mkdtempSync(path.join(os.tmpdir(), 'salon-runall-home-'));
  const standaloneEnv = { ...process.env, HOME: cleanHome, ATELIER_ROOT: '' };

  // run pre-write with empty stdin (should exit 0 silently)
  {
    const r = spawnSync('node', [preWritePath], { input: '', encoding: 'utf-8', env: standaloneEnv });
    if (r.status === 0 && r.stdout.length === 0) ok('pre-write: empty input → silent exit 0');
    else err('pre-write empty input', `status=${r.status}, stdout="${r.stdout}", stderr="${r.stderr}"`);
  }

  // run pre-write with banned content
  {
    const input = JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: 'test.md', content: 'leverage cutting-edge synergies to elevate our robust offering.' },
    });
    const r = spawnSync('node', [preWritePath], { input, encoding: 'utf-8', env: standaloneEnv });
    if (r.status === 0 && r.stdout.includes('tone flags')) ok('pre-write: detects banned tone');
    else err('pre-write banned tone', `status=${r.status}, stdout=${r.stdout.slice(0,200)}`);
  }

  // run pre-write with binary file path (should skip)
  {
    const input = JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: 'image.png', content: 'robust seamless cutting-edge' },
    });
    const r = spawnSync('node', [preWritePath], { input, encoding: 'utf-8', env: standaloneEnv });
    if (r.status === 0 && r.stdout.length === 0) ok('pre-write: skips binary path');
    else err('pre-write binary path', `expected silent exit, got status=${r.status}, stdout=${r.stdout}`);
  }

  // run pre-write with strict mode + banned content (should block, exit 2)
  {
    const input = JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: 'bad.md', content: 'leverage synergies' },
    });
    const r = spawnSync('node', [preWritePath], {
      input,
      encoding: 'utf-8',
      env: { ...standaloneEnv, SALON_HOOK_STRICT: '1' },
    });
    if (r.status === 2) ok('pre-write: strict mode blocks (exit 2)');
    else err('pre-write strict', `expected exit 2, got ${r.status}`);
  }
} else {
  ok('pre-write hook-exec checks skipped (pre-write.js not yet present)');
}

if (fs.existsSync(promptContextPath)) {
  // run prompt-context with a keyword
  {
    const input = JSON.stringify({ prompt: 'draft an x thread about our launch' });
    const r = spawnSync('node', [promptContextPath], {
      input,
      encoding: 'utf-8',
      env: { ...process.env, SALON_ROOT: ROOT },
    });
    if (r.status === 0 && r.stdout.includes('x-thread')) ok('prompt-context: runs cleanly on a matching prompt');
    else err('prompt-context x-thread', `status=${r.status}, stdout=${r.stdout.slice(0,200)}`);
  }

  // prompt-context with no match
  {
    const input = JSON.stringify({ prompt: 'random unrelated question about cooking' });
    const r = spawnSync('node', [promptContextPath], {
      input,
      encoding: 'utf-8',
      env: { ...process.env, SALON_ROOT: ROOT },
    });
    if (r.status === 0 && r.stdout.length === 0) ok('prompt-context: silent on no match');
    else err('prompt-context no match', `status=${r.status}, stdout=${r.stdout.slice(0,100)}`);
  }
} else {
  ok('prompt-context hook-exec checks skipped (prompt-context.js not yet present)');
}

// ============================================================
// 8. cross-reference checks
// every skill/rule referenced in prompt-context's keyword map should exist.
// tolerant: skip-with-ok when prompt-context.js doesn't exist yet.
// ============================================================
section('cross-references');

if (fs.existsSync(promptContextPath)) {
  const promptContextSrc = fs.readFileSync(promptContextPath, 'utf-8');
  const referencedSkills = [...promptContextSrc.matchAll(/'(skills\/[a-z-]+\/SKILL\.md)'/g)].map((m) => m[1]);
  const uniqueRefs = [...new Set(referencedSkills)];

  // skills that land in later plan tasks; anything else missing is a typo.
  // prune entries as the real skills land — final review checks this is empty-able.
  const PENDING_SKILLS = new Set([
    'skills/comment-strategy/SKILL.md',
    'skills/reply-playbook/SKILL.md',
    'skills/engagement-monitor/SKILL.md',
    'skills/community-health/SKILL.md',
    'skills/launch-window/SKILL.md',
    'skills/campaign-brief/SKILL.md',
    'skills/content-calendar/SKILL.md',
    'skills/campaign-retro/SKILL.md',
    'skills/social-listening/SKILL.md',
  ]);

  for (const r of uniqueRefs) {
    const full = path.join(ROOT, r);
    if (fs.existsSync(full)) ok(`prompt-context ref: ${r}`);
    else if (PENDING_SKILLS.has(r)) ok(`prompt-context ref ${r} pending later task, skipping`);
    else err('prompt-context ref', `${r} referenced by KEYWORDS but missing`);
  }

  const referencedRules = [...promptContextSrc.matchAll(/'(rules\/[a-z\/-]+\.md)'/g)].map((m) => m[1]);
  for (const r of [...new Set(referencedRules)]) {
    const full = path.join(ROOT, r);
    if (fs.existsSync(full)) ok(`prompt-context ref: ${r}`);
    else err(`prompt-context ref ${r}`, 'rule file does not exist');
  }
} else {
  ok('cross-reference checks skipped (prompt-context.js not yet present)');
}

// ============================================================
// 9. checks.js unit tests
// ============================================================
section('checks.js unit tests');

const { findBannedTone, checkRhythm, scanText, checkEmDashFiller } = require(path.join(HOOKS_DIR, 'lib/checks.js'));

// banned tone hits
{
  const hits = findBannedTone('we leverage cutting-edge synergies daily.');
  if (hits.length === 3) ok('findBannedTone: 3 hits in test sentence');
  else err('findBannedTone count', `expected 3, got ${hits.length}: ${JSON.stringify(hits.map(h => h.phrase))}`);
}

// clean content has no hits
{
  const hits = findBannedTone('we built a simple thing that works.');
  if (hits.length === 0) ok('findBannedTone: 0 hits on clean text');
  else err('findBannedTone clean', `expected 0, got ${hits.length}`);
}

// inflections
{
  const hits = findBannedTone('we leveraged the system and empowered the team.');
  if (hits.length === 2) ok('findBannedTone: catches -ed inflections');
  else err('findBannedTone inflections', `expected 2, got ${hits.length}`);
}

// technical context allowlist
{
  const hits = findBannedTone('the test harness validates the system.');
  if (hits.length === 0) ok('findBannedTone: allowlists "test harness"');
  else err('findBannedTone allowlist', `expected 0, got ${hits.length}: ${JSON.stringify(hits.map(h => h.phrase))}`);
}

// rhythm flatness detected
{
  const r = checkRhythm('this is a sentence. this is another sentence. this is one more sentence. this is yet another sentence. this is the final.');
  if (r.flag === true) ok('checkRhythm: detects flat rhythm');
  else err('checkRhythm flat', `expected flag=true, got ${JSON.stringify(r)}`);
}

// rhythm varied
{
  const r = checkRhythm('short. then a medium one. now a really long sentence that goes on and on with many words. ok. done.');
  if (r.flag === false) ok('checkRhythm: passes varied rhythm');
  else err('checkRhythm varied', `expected flag=false, got ${JSON.stringify(r)}`);
}

// empty input
{
  const r = checkRhythm('');
  if (r.flag === false && r.sentenceCount === 0) ok('checkRhythm: handles empty');
  else err('checkRhythm empty', JSON.stringify(r));
}

// scanText returns combined result
{
  const r = scanText('we leverage synergies. we leverage synergies. we leverage synergies.');
  if (r.summary.toneHits > 0) ok('scanText: combined banned tone');
  else err('scanText combined', JSON.stringify(r.summary));
}

// em-dash filler
{
  const r = checkEmDashFiller('this is a sentence — with em dash filler — that goes on.');
  if (r.length === 1) ok('checkEmDashFiller: detects pattern');
  else err('checkEmDashFiller', `expected 1, got ${r.length}`);
}

// ============================================================
// 10. docs substantive + README credits section
// tolerant: each doc is skipped (not failed) while absent, since README
// and DISCLAIMER only land in Task 10. LICENSE exists from Task 1 on.
// ============================================================
section('docs');

for (const doc of ['README.md', 'DISCLAIMER.md', 'LICENSE']) {
  const p = path.join(ROOT, doc);
  if (!fs.existsSync(p)) {
    ok(`${doc} not yet present, skipping`);
    continue;
  }
  const len = fs.statSync(p).size;
  if (len > 500) ok(`${doc} substantive (${len} bytes)`);
  else err(`${doc}`, `too short: ${len} bytes`);
}

// README must have a "## credits" section once it lands (Task 10).
// tolerant: skip-with-ok while README.md is absent.
{
  const readmePath = path.join(ROOT, 'README.md');
  if (!fs.existsSync(readmePath)) {
    ok('README credits section check skipped (README.md not yet present)');
  } else {
    const text = fs.readFileSync(readmePath, 'utf-8');
    if (/^## credits/m.test(text)) ok('README.md has "## credits" section');
    else err('README.md credits section', 'missing "## credits" header');
  }
}

// ============================================================
// summary
// ============================================================
console.log(`\n\x1b[1msummary\x1b[0m`);
console.log(`  passed: \x1b[32m${pass}\x1b[0m`);
console.log(`  failed: ${fail > 0 ? '\x1b[31m' + fail + '\x1b[0m' : '\x1b[32m0\x1b[0m'}`);

if (fail > 0) {
  console.log(`\n\x1b[31mFAILURES:\x1b[0m`);
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.detail || ''}`);
  }
  process.exit(1);
}

console.log(`\n\x1b[32mall good.\x1b[0m`);
process.exit(0);

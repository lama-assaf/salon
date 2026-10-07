#!/usr/bin/env node
// publisher-gates.test.js
// The publisher-gates skill script must pass a known good draft, hold a known
// bad one with every rule it breaks named, and gate engagement entries the
// same way the Publisher does. Runs the script the way a person would.
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.resolve(__dirname, '..', 'skills', 'publisher-gates', 'scripts', 'publisher_gates.py');
const FIXTURES = path.resolve(__dirname, 'fixtures', 'publisher-gates');
let fail = 0;
function check(name, cond, detail) {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { fail++; console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ' — ' + detail : ''}`); }
}
function run(args, input) {
  const res = spawnSync('python3', [SCRIPT, '--json', ...args], { input, encoding: 'utf-8' });
  let json = null;
  try { json = JSON.parse(res.stdout); } catch (e) { /* reported by the caller */ }
  return { status: res.status, json, stderr: res.stderr, stdout: res.stdout };
}
const has = (reasons, needle) => reasons.some((r) => r.includes(needle));

console.log('\npublisher gates');

// 1. a known passing draft: exit 0, every gate passes
{
  const res = run(['draft', path.join(FIXTURES, 'passing.md'), '--others', FIXTURES]);
  check('passing draft exit 0', res.status === 0, `status ${res.status} ${res.stderr}`);
  check('passing draft parsed', !!res.json, res.stdout.slice(0, 200));
  if (res.json) {
    check('passing draft status pass', res.json.status === 'pass', res.json.reasons.join('; '));
    for (const gate of ['record', 'article', 'teaser:linkedin', 'teaser:x', 'compliance']) {
      check(`passing draft gate ${gate} present and pass`, res.json.gates[gate] && res.json.gates[gate].status === 'pass');
    }
  }
}

// 2. a known failing draft: exit 1, every rule it breaks is named
{
  const res = run(['draft', path.join(FIXTURES, 'failing.md'), '--others', FIXTURES]);
  check('failing draft exit 1', res.status === 1, `status ${res.status} ${res.stderr}`);
  check('failing draft parsed', !!res.json, res.stdout.slice(0, 200));
  if (res.json) {
    const r = res.json.reasons;
    check('failing draft status hold', res.json.status === 'hold');
    check('record: claim_gate pending', has(r, 'record: claim_gate pending'), r.join('; '));
    check('article: under 450 words', has(r, 'article:') && has(r, 'words, under 450'), r.join('; '));
    check('article: too few paragraphs', has(r, 'article: only') && has(r, 'paragraphs'), r.join('; '));
    check('article: editorial voice', has(r, 'article: editorial voice'), r.join('; '));
    check('article: metadata lines', has(r, 'article: metadata lines in the body'), r.join('; '));
    check('article: raw URL', has(r, 'article: raw URL in the body'), r.join('; '));
    check("article: banned word 'certified'", has(r, "article: banned word 'certified'"), r.join('; '));
    check('teaser:linkedin: editorial voice or stage direction', has(r, 'teaser:linkedin: editorial voice or stage direction'), r.join('; '));
    check('teaser:linkedin: sentence copied from the article', has(r, 'teaser:linkedin: sentence copied from the article'), r.join('; '));
    check('teaser:x: over 280 characters', has(r, 'teaser:x:') && has(r, 'characters exceeds 280'), r.join('; '));
    check('teaser:x: link inside the body', has(r, 'teaser:x: link inside the body'), r.join('; '));
    check('compliance: stealth topic', has(r, 'compliance: article: stealth topic'), r.join('; '));
    check('compliance: price or token talk', has(r, 'compliance: article: price, token or investment talk'), r.join('; '));
    check('compliance: claim about Zilliqa', has(r, 'compliance: article: claim about Zilliqa'), r.join('; '));
    check('compliance: settlement without disclosure', has(r, 'compliance: piece: touches settlement infrastructure'), r.join('; '));
  }
}

// 3. engagement entries: the first passes, the rest hold for the reason the Publisher gives
{
  const res = run(['engagement', path.join(FIXTURES, 'engagement.json')]);
  check('engagement exit 1', res.status === 1, `status ${res.status} ${res.stderr}`);
  check('engagement parsed', !!res.json && Array.isArray(res.json.results), res.stdout.slice(0, 200));
  if (res.json && res.json.results) {
    const [good, bare, link, excluded, settlement] = res.json.results;
    check('well-formed comment passes', good.status === 'pass', good.reasons.join('; '));
    check('bare agreement holds', has(bare.reasons, 'engagement: bare agreement') && has(bare.reasons, 'comment under 15 words'), bare.reasons.join('; '));
    check('link in a reply holds', has(link.reasons, 'engagement: link in the text'), link.reasons.join('; '));
    check('excluded target topic holds', has(excluded.reasons, 'engagement: target post on an excluded topic'), excluded.reasons.join('; '));
    check('settlement without disclosure holds', has(settlement.reasons, 'compliance: touches settlement infrastructure'), settlement.reasons.join('; '));
  }
}

// 4. free text from stdin, and a rules override
{
  const res = run(['text', '--kind', 'comment', '--platform', 'X'], 'Great point, agree!');
  check('stdin bare agreement holds', res.status === 1 && res.json && has(res.json.reasons, 'engagement: bare agreement'));
  const ok = run(['text', '--kind', 'comment', '--platform', 'LinkedIn'],
    'The register answers the admission question once; the transaction question needs a credential presented at the moment of the instruction, checkable by the relying party.');
  check('stdin well-formed comment passes', ok.status === 0 && ok.json && ok.json.status === 'pass', ok.json ? ok.json.reasons.join('; ') : ok.stderr);
  const missing = run(['draft', path.join(FIXTURES, 'does-not-exist.md')]);
  check('missing input exits 2', missing.status === 2, `status ${missing.status}`);
}

process.exit(fail ? 1 : 0);

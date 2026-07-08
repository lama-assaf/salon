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

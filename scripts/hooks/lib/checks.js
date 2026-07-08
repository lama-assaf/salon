// checks.js
// the actual scanning logic. pure functions, no I/O.

'use strict';

const {
  BANNED_AI_TONE,
  CORPORATE_FILLER,
  HOLLOW_OPENERS,
  TECHNICAL_CONTEXT_ALLOWLIST,
  EM_DASH_FILLER,
} = require('./patterns');

/**
 * escape a string for use inside a regex.
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * build a single word-boundary regex from a list of phrases.
 * sorted longest-first so multi-word phrases match before single words.
 */
function buildPatternRegex(phrases) {
  const sorted = [...phrases].sort((a, b) => b.length - a.length).map(escapeRegex);
  // word boundaries are imperfect across hyphens; we use a wrapper that allows start/end of word or whitespace/punctuation
  return new RegExp(`(?<![\\w-])(${sorted.join('|')})(?![\\w-])`, 'gi');
}

const AI_REGEX = buildPatternRegex(BANNED_AI_TONE);
const CORP_REGEX = buildPatternRegex(CORPORATE_FILLER);
const OPENER_REGEX = buildPatternRegex(HOLLOW_OPENERS);

/**
 * find banned-tone hits in text.
 * returns array of { phrase, index, line, category, severity }
 */
function findBannedTone(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return [];
  }

  const hits = [];

  function scan(regex, category, severity) {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(text)) !== null) {
      const phrase = m[0];
      const idx = m.index;

      // skip if in an allowlisted technical context
      const phraseLower = phrase.toLowerCase();
      const allowlist = TECHNICAL_CONTEXT_ALLOWLIST[phraseLower];
      if (allowlist) {
        const window = text.slice(Math.max(0, idx - 40), Math.min(text.length, idx + phrase.length + 40)).toLowerCase();
        if (allowlist.some((ctx) => window.includes(ctx))) {
          continue;
        }
      }

      const line = (text.slice(0, idx).match(/\n/g) || []).length + 1;
      hits.push({ phrase, index: idx, line, category, severity });
    }
  }

  scan(AI_REGEX, 'ai-tone', 'warning');
  scan(CORP_REGEX, 'corporate-filler', 'warning');
  scan(OPENER_REGEX, 'hollow-opener', 'warning');

  return hits;
}

/**
 * check sentence rhythm: are all sentences roughly the same length?
 * returns { variance, sentenceCount, flag }
 */
function checkRhythm(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { variance: 0, sentenceCount: 0, flag: false };
  }

  // strip markdown code blocks
  const stripped = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');

  const sentences = stripped
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  if (sentences.length < 4) {
    return { variance: 0, sentenceCount: sentences.length, flag: false };
  }

  const wordCounts = sentences.map((s) => s.split(/\s+/).filter((w) => w.length > 0).length);
  const mean = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
  const variance = wordCounts.reduce((a, b) => a + (b - mean) ** 2, 0) / wordCounts.length;
  const stddev = Math.sqrt(variance);

  // flag flatness: stddev under 3 words across 4+ sentences is suspicious.
  return {
    variance: Number(stddev.toFixed(2)),
    sentenceCount: sentences.length,
    flag: stddev < 3,
    mean: Number(mean.toFixed(1)),
  };
}

/**
 * check for em-dash filler (long em-dash interjections that often signal ai writing).
 */
function checkEmDashFiller(text) {
  if (typeof text !== 'string') return [];
  const hits = [];
  const re = /\s—\s[^—\n]+\s—\s/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const line = (text.slice(0, m.index).match(/\n/g) || []).length + 1;
    hits.push({ phrase: m[0].slice(0, 40) + '...', index: m.index, line, category: 'em-dash-filler', severity: 'info' });
  }
  return hits;
}

/**
 * full scan combining all checks.
 */
function scanText(text) {
  const tone = findBannedTone(text);
  const rhythm = checkRhythm(text);
  const dashes = checkEmDashFiller(text);
  return {
    bannedTone: tone,
    rhythm,
    emDash: dashes,
    summary: {
      toneHits: tone.length,
      rhythmFlag: rhythm.flag,
      emDashHits: dashes.length,
    },
  };
}

module.exports = {
  findBannedTone,
  checkRhythm,
  checkEmDashFiller,
  scanText,
  buildPatternRegex,
  escapeRegex,
};

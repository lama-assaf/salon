// patterns.js
// banned-word and anti-ai-tone patterns. derived from rules/brand/banned-words.md and rules/copy/anti-ai-tone.md.
// hooks read this to flag content without re-parsing markdown.

'use strict';

// case-insensitive word/phrase matches. order doesn't matter; longer phrases are checked first by the runner.
const BANNED_AI_TONE = [
  'delve',
  'delves',
  'delved',
  'delving',
  'delve into',
  'delving into',
  'navigate the complexities',
  "in today's fast-paced world",
  "in today's rapidly evolving",
  "in today's digital age",
  'leverage',
  'leverages',
  'leveraged',
  'leveraging',
  'robust',
  'robustness',
  'seamless',
  'seamlessly',
  'elevate',
  'elevates',
  'elevated',
  'elevating',
  'empower',
  'empowers',
  'empowered',
  'empowering',
  'harness',
  'harnesses',
  'harnessed',
  'harnessing',
  'tapestry',
  'rich tapestry',
  'realm of',
  'foster',
  'fosters',
  'fostered',
  'fostering',
  'meticulous',
  'meticulously',
  'cutting-edge',
  'state-of-the-art',
  'groundbreaking',
  'revolutionary',
  'game-changing',
  'unparalleled',
];

const CORPORATE_FILLER = [
  'circle back',
  'touch base',
  'synergies',
  'synergistic',
  'at the end of the day',
  'low-hanging fruit',
  'move the needle',
  'value-add',
  'best-in-class',
  'world-class',
  'best-of-breed',
];

const HOLLOW_OPENERS = [
  'we listened to your feedback',
  'exciting news',
  "we're thrilled to announce",
  'we are thrilled to announce',
  'welcome to the future of',
];

// allowlist: legitimate technical uses where the word is OK.
// the runner can downgrade flags when a context match is found.
const TECHNICAL_CONTEXT_ALLOWLIST = {
  leverage: ['financial leverage', 'leverage ratio', 'debt leverage'],
  robust: ['load-tested', 'fault tolerance', 'mtbf'],
  harness: ['test harness', 'wire harness', 'agent harness'],
};

// detects double em dashes used as filler (per copy rules)
const EM_DASH_FILLER = /\s—\s.*?\s—\s/;

module.exports = {
  BANNED_AI_TONE,
  CORPORATE_FILLER,
  HOLLOW_OPENERS,
  TECHNICAL_CONTEXT_ALLOWLIST,
  EM_DASH_FILLER,
};

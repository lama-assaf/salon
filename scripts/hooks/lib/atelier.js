// atelier.js
// detect a co-installed atelier plugin, so salon can defer to it instead of doing
// the same work twice (instincts injection, banned-tone scanning).

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// claude code keeps plugins under $CLAUDE_CONFIG_DIR, which defaults to ~/.claude
function claudeConfigDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function atelierInstalled() {
  if (process.env.ATELIER_ROOT) return true;
  try {
    const cacheDir = path.join(claudeConfigDir(), 'plugins', 'cache');
    if (!fs.existsSync(cacheDir)) return false;
    for (const marketplace of fs.readdirSync(cacheDir)) {
      const p = path.join(cacheDir, marketplace, 'atelier');
      if (fs.existsSync(p)) return true;
    }
  } catch (e) { /* detection must never break the hook */ }
  return false;
}

module.exports = { atelierInstalled, claudeConfigDir };

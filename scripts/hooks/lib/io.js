// io.js
// helpers for reading claude code hook inputs and writing structured outputs.
// claude code hook protocol: hook reads JSON from stdin, may write JSON to stdout, exit code 0 = allow, 2 = block.

'use strict';

const fs = require('fs');

/**
 * read all of stdin synchronously and parse as JSON.
 * returns null if stdin is empty or not parseable.
 */
function readHookInput() {
  let raw;
  try {
    raw = fs.readFileSync(0, 'utf-8');
  } catch (e) {
    return null;
  }
  if (!raw || raw.trim().length === 0) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * extract the text-like content from a tool call input.
 * handles Write (content/file_text), Edit (new_string), MultiEdit, Update.
 * returns { text, path, toolName } or null if not extractable.
 */
function extractWriteContent(hookInput) {
  if (!hookInput || typeof hookInput !== 'object') return null;

  const toolName = hookInput.tool_name || hookInput.toolName;
  const toolInput = hookInput.tool_input || hookInput.toolInput || {};

  if (!toolName) return null;

  // collect candidate text fields. preserve all so the caller can scan combined content.
  let text = '';
  let path = toolInput.file_path || toolInput.path || null;

  if (typeof toolInput.content === 'string') text += toolInput.content;
  if (typeof toolInput.file_text === 'string') text += toolInput.file_text;
  if (typeof toolInput.new_string === 'string') text += toolInput.new_string;
  if (typeof toolInput.new_str === 'string') text += toolInput.new_str;

  // multi-edit support
  if (Array.isArray(toolInput.edits)) {
    for (const ed of toolInput.edits) {
      if (ed && typeof ed.new_string === 'string') text += '\n' + ed.new_string;
    }
  }

  if (text.length === 0) return null;
  return { text, path, toolName };
}

/**
 * write a structured warning to stderr in a format claude code surfaces back to the user.
 */
function warn(message) {
  process.stderr.write(`[salon:hook] ${message}\n`);
}

/**
 * emit a hookSpecificOutput message (claude code protocol).
 * the harness will display additionalContext to the user / model.
 */
function emit(additionalContext, allow = true) {
  const payload = {
    continue: allow,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext,
    },
  };
  process.stdout.write(JSON.stringify(payload));
}

module.exports = {
  readHookInput,
  extractWriteContent,
  warn,
  emit,
};

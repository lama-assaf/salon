# salon — social campaign operator plugin for the atelier marketplace

**Date:** 2026-07-08
**Status:** Approved
**Sibling:** [atelier](https://github.com/lama-assaf/atelier) — same architecture, same marketplace.

## Goal

An original Claude Code plugin, `salon`, for running social media campaigns end to end
on Twitter/X, LinkedIn, Discord and Telegram: strategy → insight gathering → content
calendar → platform-native content → engagement & comment execution → retro.
Engagement and comment strategy are first-class, not an afterthought. Content world is
**generic but web3-aware**: domain-neutral skills with web3/crypto community patterns
as first-class examples (announcement compliance care, community-raid etiquette,
degen-vs-institutional tone switching appear as examples inside skills, not as the
plugin's identity).

Distribution: own repo `lama-assaf/salon` (private, like atelier); atelier's
`.claude-plugin/marketplace.json` gains one plugin entry pointing at it, so install is
`/plugin install salon@atelier`.

Non-goals for v1: posting automation loops (skills instruct; MCPs act only when the
user says so), non-listed platforms (Instagram/TikTok/YouTube), adapters for other
harnesses, a dashboard.

## Interop with atelier (binding requirement)

salon and atelier are one family and must work together when co-installed:

1. **Combined memory.** There is no `.salon/` directory. Both plugins share
   `<project>/.atelier/memory/` — atelier's layout is the base (instincts.md,
   lessons.md, decisions/, glossary.md) and salon adds its files into the same tree
   (`voice.md`, `campaigns/`). `/salon:memory-init` extends an existing
   `.atelier/memory/` (never overwriting), or creates it with both the shared base
   and salon's files if atelier hasn't seeded it yet. `/salon:remember` appends to
   the shared `lessons.md`/`instincts.md`. One project memory, two lenses.
2. **Same guardrails.** salon's writing guardrails are atelier's: `rules/brand/
   banned-words.md` and `rules/copy/anti-ai-tone.md` are ported verbatim from
   atelier (same content, same file paths relative to the plugin root) plus salon's
   additive rules (platform-limits, engagement-ethics). A sync test asserts salon's
   copies match atelier's current content (fixture hash committed at port time).
3. **No double-flagging.** Both plugins register a PreToolUse write guard. salon's
   `pre-write` detects a co-installed atelier (its plugin dir present under
   `~/.claude/plugins/`, or `ATELIER_ROOT` set) and exits 0 silently, deferring to
   atelier's guard — so co-installed users get one warning, standalone salon users
   still get guarded. salon's `prompt-context` always runs (its keyword map is
   salon-specific and both hooks injecting is correct behavior).
4. **One marketplace.** Both install from the atelier marketplace
   (`/plugin install atelier@atelier`, `/plugin install salon@atelier`).

## Architecture (mirrors atelier)

```
salon/
├── .claude-plugin/plugin.json     # slim, install-time-schema-valid manifest
├── skills/          16 skills (SKILL.md each) in 4 groups
├── agents/          3 agents
├── commands/        12 commands
├── rules/           social writing rules (banned ai-tone patterns, platform limits)
├── hooks/hooks.json + scripts/hooks/   ported atelier hook runtime, SALON_* env vars
├── mcp-configs/mcp-servers.json   9 opt-in templates (flagged for cost/ToS)
├── memory/          seed templates for the shared per-project .atelier/memory/
├── tests/           run-all validator + memory-resolution suite (ported)
├── docs/superpowers/  specs + plans
├── README.md, LICENSE (MIT), DISCLAIMER.md
```

### Manifest rules (learned from atelier's install failures — binding)

- `plugin.json`: `author` is an object `{name, url}`; omit `agents/skills/commands/hooks`
  fields (default paths are auto-discovered); no nonstandard keys.
- `hooks/hooks.json`: pure hooks schema, no `_comment` key, `${CLAUDE_PLUGIN_ROOT}` paths.
- atelier's `marketplace.json` needs the new plugin entry only — `owner` already exists.

## Skills (16)

Original text, MIT. Patterns adapted (with README credit) from MIT sources:
sergebulaev/linkedin-skills (engagement lifecycle), charlie947/social-media-skills
(hook formulas, copy frameworks), aaaronmiller/create-viral-content (adversarial
refinement, AI-tell lists), coreyhaines31/marketingskills. AGPL (lycfyi) and
Commons-Clause (borghei) repos are pattern references only — no text vendored.

**strategy/**
1. `campaign-brief` — turn a goal into a campaign brief: audience, message house,
   platform mix, success metrics, timeline. Writes `.atelier/memory/campaigns/<slug>.md`.
2. `content-calendar` — pillar × format grid across the four platforms; cadence rules
   per platform; outputs a dated calendar section into the campaign file.
3. `campaign-retro` — post-campaign readout: top/bottom performers, engagement-rate
   math, what to keep/kill; appends retro to the campaign file and distills lessons
   into the shared `.atelier/memory/lessons.md`.

**writing/**
4. `x-thread` — thread architecture (hook tweet, escalation, CTA), 280-char
   enforcement, quote-tweet and reply-to-self mechanics.
5. `linkedin-post` — hook formulas (adapted set), algorithm-aware structure (no
   external links in body, dwell-time formatting), comment-bait done honestly.
6. `discord-announcement` — original (white space): announcement/embed structure,
   @everyone etiquette, event promos, AMA runbooks, role-gated reveals.
7. `telegram-broadcast` — original (white space): broadcast formatting, pinned-message
   strategy, forward-friendly structure, button/CTA conventions.
8. `hook-writing` — generate + reverse-engineer opening lines; 6-variant drill;
   prediction+stakes and tribal-identity patterns.
9. `post-audit` — pre-publish check: platform algorithm rules, AI-tell scan
   (vocabulary list lives in `rules/`), claim-check prompt, link/media hygiene.
10. `adversarial-refinement` — multi-persona stress test (skeptic, scroller,
    competitor, compliance reviewer) before anything ships.

**engagement/** (the core)
11. `comment-strategy` — drafting comments on *others'* posts to build presence:
    target selection, value-add comment shapes, timing, never-shill rules.
12. `reply-playbook` — handling replies on your own posts: triage (amplify/answer/
    redirect/ignore), platform thread mechanics, de-escalation, community-raid
    etiquette (web3 example).
13. `engagement-monitor` — track who engages, score by ICP fit, maintain an
    engager ledger in the campaign file, surface who to DM/follow up.
14. `community-health` — Discord/Telegram: lurker detection, churn signals,
    re-engagement plays, mod-team cadence.

**insights/**
15. `social-listening` — drive the insight MCPs (reddit, hacker-news, brave-search,
    telegram/discord reads): what's trending in the niche, which conversations to
    join, competitor share-of-voice; degrade gracefully to instructing manual
    research when no MCP is connected.
16. `trend-to-content` — turn a listening finding into platform-specific content
    angles with a freshness deadline.

## Agents (3)

- `campaign-strategist` — owns brief/calendar/retro; consults campaign memory.
- `engagement-manager` — owns comment-strategy, reply-playbook, engagement-monitor.
- `community-manager` — owns Discord/Telegram health + announcement cadence.

## Commands (12)

`/salon:campaign` (brief → calendar wizard), `/salon:thread`, `/salon:linkedin`,
`/salon:announce` (discord), `/salon:broadcast` (telegram), `/salon:comment`
(comment-strategy on a given post/topic), `/salon:engage` (triage + reply drafts),
`/salon:listen`, `/salon:retro`, plus the atelier trio: `/salon:memory-init`,
`/salon:remember [--instinct]`, `/salon:mcp-setup`.

## Per-project memory = campaign state (shared with atelier)

```
<project>/.atelier/memory/          # SHARED tree — atelier owns the base layout
├── instincts.md      # standing rules, auto-injected by both plugins' hooks
├── lessons.md        # dated takeaways (both plugins append)
├── decisions/        # (atelier)
├── glossary.md       # (atelier)
├── voice.md          # salon: brand voice profile; salon writers must consult
└── campaigns/        # salon: one file per campaign: brief → calendar → engager ledger → retro
```

Hook resolution identical to atelier's mechanism, pointed at the shared dir:
project `.atelier/memory/instincts.md` first (from hook `cwd`, fallback
`CLAUDE_PROJECT_DIR`), salon's plugin seed as fallback, template-marker skip
heuristic, never blocks (missing/malformed → exit 0). salon's prompt-context also
surfaces `voice.md` when a writing keyword matches. `/salon:memory-init` extends an
existing `.atelier/memory/` or creates it (shared base + salon files); it never
overwrites any existing file.

## Hooks

Ported from atelier's runtime (our code):
- `prompt-context` (UserPromptSubmit): social keyword map ("thread", "engagement",
  "content calendar", "announcement", "reply", …) → salon skill/rule files; injects
  shared project instincts + voice.md when writing keywords match. Root-candidate
  validation (`isSalonRoot` checks `skills/` + `memory/`) — the logs-dir bug class
  from atelier is designed out from day one.
- `pre-write` (PreToolUse on Write|Edit|MultiEdit): AI-tone/banned-phrase and
  platform-limit warnings when writing social copy, using the atelier-identical rule
  files. **Defers to atelier when co-installed** (see Interop §3): exits 0 silently
  if an atelier plugin install is detected, so users never see duplicate warnings.
  Non-blocking; `SALON_HOOK_STRICT=1` to block (standalone mode only).
- Env vars `SALON_ROOT`, `SALON_LOG_DIR`, `SALON_HOOK_STRICT`; logs in
  `~/.claude/salon/logs`. No post-write hook in v1 (YAGNI).

## MCP catalog — opt-in only, honestly flagged

Nothing bundles or auto-starts. `/salon:mcp-setup` merges chosen entries into the
project's `.mcp.json` (never overwriting existing servers, stripping `_comment`s),
and lists required env tokens. Catalog (researched 2026-07-08; exact configs below
go into `mcp-configs/mcp-servers.json` verbatim):

| key | server | flag |
|---|---|---|
| twitter | @enescinar/twitter-mcp (official X API v2) | COST: X reads pay-per-use (~$0.005/read); posting cheap |
| discord | mcp-discord (bot token) | none |
| telegram | @chaindead/telegram-mcp (MTProto user session) | soft ToS: user-session automation; one-time interactive auth |
| reddit | reddit-mcp-server | none (anonymous mode works) |
| hacker-news | mcp-hacker-news | none, zero-config |
| brave-search | @brave/brave-search-mcp-server | free key ~2k queries/mo; trend/listening fallback |
| postiz | official remote URL | scheduling; free self-host or cloud |
| typefully | official remote URL | scheduling/drafting; paid plan |
| linkedin-unofficial | stickerdaniel/linkedin-mcp-server (uvx) | **ToS RISK: scraper, account-ban possible; only way to read LinkedIn; low-stakes account advised** |

```json
{
  "twitter": {
    "_comment": "official X API v2. github.com/EnesCinr/twitter-mcp. post + search. NOTE: X API read access is pay-per-use (~$0.005/read, no free tier for new devs); posting is cheap. Keys from developer.x.com.",
    "command": "npx",
    "args": ["-y", "@enescinar/twitter-mcp"],
    "env": {
      "API_KEY": "${TWITTER_API_KEY}",
      "API_SECRET_KEY": "${TWITTER_API_SECRET_KEY}",
      "ACCESS_TOKEN": "${TWITTER_ACCESS_TOKEN}",
      "ACCESS_TOKEN_SECRET": "${TWITTER_ACCESS_TOKEN_SECRET}"
    }
  },
  "discord": {
    "_comment": "bot-token Discord server. github.com/barryyip0625/mcp-discord. read/send/search messages, members, reactions, forums, webhooks. Create a bot at discord.com/developers and invite it to your guild.",
    "command": "npx",
    "args": ["-y", "mcp-discord", "--config", "${DISCORD_BOT_TOKEN}"]
  },
  "telegram": {
    "_comment": "MTProto user-session server (github.com/chaindead/telegram-mcp). Reads full channel/group history + dialogs, sends drafts. Get TG_APP_ID/TG_API_HASH at my.telegram.org, then run once: npx -y @chaindead/telegram-mcp auth --app-id <ID> --api-hash <HASH> --phone <NUM>. Logs in as YOUR account — see repo's ToS note.",
    "command": "npx",
    "args": ["-y", "@chaindead/telegram-mcp"],
    "env": { "TG_APP_ID": "${TG_APP_ID}", "TG_API_HASH": "${TG_API_HASH}" }
  },
  "reddit": {
    "_comment": "community-insight source. github.com/jordanburke/reddit-mcp-server. Browse/search subreddits, comments, trending. Works anonymously at low rate; add free Reddit app creds (reddit.com/prefs/apps) for 60-100 req/min and write ops.",
    "command": "npx",
    "args": ["-y", "reddit-mcp-server"],
    "env": {
      "REDDIT_CLIENT_ID": "${REDDIT_CLIENT_ID}",
      "REDDIT_CLIENT_SECRET": "${REDDIT_CLIENT_SECRET}",
      "REDDIT_USER_AGENT": "salon-mcp/1.0"
    }
  },
  "hacker-news": {
    "_comment": "zero-config tech-community insight source via official HN Firebase API. github.com/paabloLC/mcp-hacker-news. No auth.",
    "command": "npx",
    "args": ["-y", "mcp-hacker-news"]
  },
  "brave-search": {
    "_comment": "trend/social-listening fallback when no platform MCP is connected. Official Brave server (@brave scope — the @modelcontextprotocol one is archived). Free BRAVE_API_KEY ~2k queries/mo from brave.com/search/api.",
    "command": "npx",
    "args": ["-y", "@brave/brave-search-mcp-server"],
    "env": { "BRAVE_API_KEY": "${BRAVE_API_KEY}" }
  },
  "postiz": {
    "_comment": "official Postiz MCP (docs.postiz.com/mcp/setup). Cross-platform scheduling/publishing to X, LinkedIn, Mastodon, etc. API key from Settings > Developers. Self-hosters: swap host for your backend URL.",
    "type": "url",
    "url": "https://api.postiz.com/mcp/${POSTIZ_API_KEY}"
  },
  "typefully": {
    "_comment": "official Typefully MCP. Draft/schedule across X, LinkedIn, Threads, Bluesky, Mastodon; view queue. Requires a Typefully plan; key from typefully.com settings.",
    "type": "url",
    "url": "https://mcp.typefully.com/mcp?TYPEFULLY_API_KEY=${TYPEFULLY_API_KEY}"
  },
  "linkedin-unofficial": {
    "_comment": "RISK-FLAGGED: browser-session scraper (github.com/stickerdaniel/linkedin-mcp-server, 2.7k stars). Reads feed/profiles — impossible via LinkedIn's partnership-gated official API. Violates LinkedIn ToS; use a low-stakes account. Requires uv (not npx). One-time login on first run.",
    "command": "uvx",
    "args": ["mcp-server-linkedin@latest"],
    "env": { "UV_HTTP_TIMEOUT": "300" }
  }
}
```

Avoid-list (documented in mcp-configs/README.md): cookie-based X scrapers
(suspension risk, stale), Discord self-bots (bans), Bot-API-only Telegram servers
(can't read history), the lone Google Trends scraper (fragile), community Mixpost
MCP (1★). Buffer's official remote MCP is a documented alternative scheduler.

## Rules

`rules/` carries:
- `rules/brand/banned-words.md` and `rules/copy/anti-ai-tone.md` — **verbatim ports
  of atelier's files** (same relative paths; sync test asserts content identity so
  the two plugins' guardrails cannot drift apart silently).
- `rules/social/platform-limits.md` — char limits, media specs, link handling per
  platform.
- `rules/social/engagement-ethics.md` — no astroturfing, no engagement pods, no
  undisclosed promotion; web3: no shilling unregistered-security-adjacent claims.

## Error handling

- Hooks never block a session (identical guarantees + tests as atelier).
- Skills that use MCPs must degrade to manual-research instructions when the MCP
  isn't connected — never fail a workflow because a server is missing.
- `mcp-setup` never overwrites existing `.mcp.json` entries.
- `memory-init` never overwrites any existing file in `.atelier/memory/`.

## Testing

- `tests/run-all.js` ported from atelier: JSON validity, frontmatter checks on all
  skills/agents/commands, hook execution edge cases, cross-reference check.
- `tests/memory-resolution.test.js` ported and adapted to the shared
  `.atelier/memory/`, including the root-candidate validation regression cases
  (logs-only ~/.claude/salon, bogus SALON_ROOT) and a voice.md injection case.
- Guardrail sync test: salon's `rules/brand/banned-words.md` and
  `rules/copy/anti-ai-tone.md` hash-match the committed atelier fixtures.
- Pre-write deference test: with a fake atelier install dir present, salon's
  pre-write exits 0 with no output on flagged content; without it, it warns.
- `claude plugin validate .` must pass; e2e: local hook simulation, push, marketplace
  update, live install `/plugin install salon@atelier`.

## Attribution

MIT LICENSE (lama-assaf). README credits pattern inspirations: sergebulaev/
linkedin-skills, charlie947/social-media-skills, aaaronmiller/create-viral-content,
coreyhaines31/marketingskills (all MIT). No vendored text from AGPL or
Commons-Clause repos.

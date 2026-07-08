# mcp-configs

salon bundles no MCP servers by default and starts nothing on its own. run
`/salon:mcp-setup` to pick servers from `mcp-servers.json` and merge them
into the current project's `.mcp.json`. existing entries are never
overwritten, and `_comment` keys are stripped on copy.

## quick start

```
/salon:mcp-setup discord telegram
```

or run `/salon:mcp-setup` with no arguments to see the full catalog and
choose interactively.

## catalog

| key | server | env / setup | flag |
|---|---|---|---|
| x-api | official X hosted MCP (xurl OAuth bridge) | `X_CLIENT_ID`, `X_CLIENT_SECRET` | COST: requires an X dev app on the Pay-per-use Production plan, not free |
| twitter-community | @enescinar/twitter-mcp (raw v1.1-style keys) | `TWITTER_API_KEY` + 3 more | community, stale ~1yr |
| discord | mcp-discord | `DISCORD_TOKEN` | none |
| telegram | @chaindead/telegram-mcp (MTProto user session) | `TG_APP_ID`, `TG_API_HASH` | ToS: user-session automation; requires a one-time interactive `auth` subcommand before first use |
| reddit | reddit-mcp-server | reads: none; writes: `REDDIT_USERNAME`/`REDDIT_PASSWORD` | none |
| hacker-news | mcp-hacker-news | none | none, zero-config; unmaintained ~1yr, API stable |
| brave-search | @brave/brave-search-mcp-server | `BRAVE_API_KEY` | free tier ~2k queries/mo |
| postiz | official remote MCP | `POSTIZ_API_KEY` (in URL) | scheduling; plan limits apply |
| typefully | official remote MCP | `TYPEFULLY_API_KEY` (query param) | scheduling/drafting; paid plan; API-key auth only, not OAuth |
| buffer | official remote MCP (`mcp.buffer.com`) | `BUFFER_API_KEY` (Bearer header) | scheduling; plan limits apply, don't assume free tier |
| linkedin-unofficial | uvx mcp-server-linkedin@latest | interactive browser login, no env-var auth | **ToS RISK: unofficial scraper; requires explicit confirmation to add** |

## avoid-list

these were considered and rejected during the 2026-07-08 research pass:

- **cookie-based X scrapers** — suspension risk, and the ones surveyed are
  stale.
- **Discord self-bots** — automate a user account instead of a bot account;
  banned by Discord's terms.
- **Bot-API-only Telegram servers** — can't read channel/group history, only
  send; not useful for the listening or engagement workflows here.
- **the lone Google Trends scraper found** — fragile, breaks on layout
  changes, no maintenance signal.
- **community Mixpost MCP** — 1 star, no adoption signal; Buffer's official
  remote MCP is the documented scheduler alternative.

## notes

- `mcp-setup` reads this catalog from `${CLAUDE_PLUGIN_ROOT}/mcp-configs/mcp-servers.json`
  (or the repo checkout path when that env var is unset).
- nothing here auto-connects. servers only start once merged into a
  project's `.mcp.json` and the session restarts or reconnects.

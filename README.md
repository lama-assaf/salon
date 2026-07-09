# salon

social campaign operator for X, LinkedIn, Discord and Telegram. strategy, platform-native content, engagement and comment playbooks, insight-driven listening, none of it sounding like a bot wrote it.

## install

```
/plugin marketplace add lama-assaf/atelier
/plugin install salon@atelier
```

the atelier marketplace repo is currently private under `lama-assaf`, so you'll need GitHub access to that org/repo before either command will resolve. once installed, every skill, command, and agent in this plugin is namespaced under `/salon:*` (for example `/salon:campaign`, `/salon:thread`).

## works with atelier

salon is built to sit next to [atelier](https://github.com/lama-assaf/atelier), and a co-install is the intended setup, not an edge case.

- **shared memory.** both plugins read and write the same `<project>/.atelier/memory/` tree. atelier owns `instincts.md`, `lessons.md`, `decisions/`, and `glossary.md`; salon adds `voice.md` and `campaigns/` into that tree. neither plugin edits the other's files.
- **same guardrails.** salon's brand and copy rules (`rules/brand/banned-words.md`, `rules/copy/anti-ai-tone.md`) are byte-identical copies of atelier's, checked by a sync test on every run. one anti-AI-tone standard, not two that can drift apart.
- **one warning, not two.** salon's pre-write hook scans drafts for banned tone and filler before they save. when atelier is also installed, salon defers to atelier's own pre-write hook and stays silent, so you get a single warning instead of a duplicate.

standalone works too: salon runs its own guardrail checks and seeds its own memory tree when atelier isn't present.

## per-project onboarding

run these once per project, in order:

1. `/salon:memory-init`: seeds or extends `.atelier/memory/` with whatever salon-owned files (`voice.md`, `campaigns/README.md`) are missing. never overwrites a file atelier or a prior run already wrote.
2. edit `voice.md`: replace the template with how this brand actually sounds. skills read this file before drafting anything.
3. `/salon:mcp-setup`: pick which optional MCP servers to wire up for this project, from the catalog in `mcp-configs/mcp-servers.json`.

## what's inside

**17 skills**, grouped by job:

- *strategy*: campaign-brief, content-calendar, campaign-retro
- *writing*: x-thread, linkedin-post, discord-announcement, telegram-broadcast, hook-writing, post-audit, adversarial-refinement
- *engagement*: comment-strategy, reply-playbook, engagement-monitor, community-health, launch-window
- *insights*: social-listening, trend-to-content

**3 agents**: campaign-strategist, engagement-manager, community-manager.

**13 commands**: campaign, thread, linkedin, announce, broadcast, comment, engage, launch, listen, retro, memory-init, remember, mcp-setup.

**rules**: shared brand/copy guardrails plus social-specific ones, platform character and format limits, engagement ethics, and a list of AI writing tells to avoid.

**hooks**: a prompt-context hook that injects project memory and voice automatically, and a pre-write hook that scans drafts for banned tone before they save (and defers to atelier when it's co-installed, see above).

**13 MCP server templates**, none wired up or started by default: `/salon:mcp-setup` merges the ones you pick into the project's `.mcp.json`:

x-api, twitter-community, discord, telegram, reddit, hacker-news, brave-search, postiz, typefully, buffer, linkedin-unofficial, apify-social-listening (hosted + local: cookieless X/LinkedIn listening via pinned Apify actors, pay-per-result).

a few of these carry real cost or ToS flags, called out in `mcp-configs/README.md`:

- **x-api** requires an X developer app on the paid Pay-per-use Production plan, not free.
- **telegram** runs over an MTProto user session and needs a one-time interactive `auth` step before first use.
- **postiz**, **typefully**, and **buffer** are scheduling services with their own plan limits; don't assume a free tier.
- **linkedin-unofficial** is an unofficial scraper against LinkedIn's terms. adding it requires explicit confirmation during setup.
- **apify-social-listening** is pay-per-result on your Apify account; its actors are cookieless but scraping X/LinkedIn still carries platform-ToS exposure (see "cookieless is not ToS-less" in mcp-configs/README.md).

### where keys go

catalog entries reference tokens as `${VAR}` placeholders, and claude code
expands those from your environment when it starts the server. put each token
in your shell profile, not in `.mcp.json`: that file is usually committed, and
the placeholder exists so the secret never lands in the repo.

apify example (one token covers all five pinned actors; there are no
per-actor keys):

1. get the token at [console.apify.com](https://console.apify.com) under
   settings > API & integrations > personal API tokens. the free plan's
   monthly usage credit is enough to trial with; heavier listening needs
   billing enabled on the apify account.
2. `export APIFY_TOKEN="apify_api_..."` in `~/.zshrc` (or equivalent), then
   restart the shell so claude code inherits it.
3. `/salon:mcp-setup apify-social-listening` in the project, then `/mcp` to
   connect (or restart the session).

the same pattern applies to every other keyed entry (`DISCORD_TOKEN`,
`TG_APP_ID`/`TG_API_HASH`, `BRAVE_API_KEY`, `POSTIZ_API_KEY`, and so on):
export the var, run `/salon:mcp-setup <key>`, reconnect.

## campaign lifecycle walkthrough

a full run through salon, start to finish:

1. `/salon:campaign`: turn a goal into a campaign brief (campaign-brief skill), then offers to build the calendar.
2. content-calendar: lay out the pillar-by-format grid and posting cadence.
3. draft the content: `/salon:thread`, `/salon:linkedin`, `/salon:announce`, or `/salon:broadcast`. thread and linkedin offer a post-audit pass before shipping; announce and broadcast post via a connected MCP or hand back the draft.
4. `/salon:launch`: the golden-hour engagement checklist for the first hours after a post goes live.
5. `/salon:engage` and `/salon:comment`: reply-playbook for comments on your own posts, comment-strategy for warming up other people's.
6. `/salon:retro`: score results against the brief's benchmark bands and write down what actually worked.

listening runs alongside all of it: `/salon:listen` surfaces trends and conversations worth joining, and trend-to-content turns a finding into a platform-fit plan before the moment passes.

## credits

salon's skills and rules were built by adapting patterns and structure from several open-source collections. direct credit to the ones we pulled from most closely:

- [sergebulaev/linkedin-skills](https://github.com/sergebulaev/linkedin-skills)
- [charlie947/social-media-skills](https://github.com/charlie947/social-media-skills)
- [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills)
- [mohitagw15856/pm-claude-skills](https://github.com/mohitagw15856/pm-claude-skills)
- [Hao0321/claude-skill-social-post](https://github.com/Hao0321/claude-skill-social-post)
- [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins)
- [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills)

and acknowledgment to work we referenced for concepts and framing without adapting code or text directly: ColdIQ, create-viral-content, social-ai-team, [lycfyi/community-agent-plugin](https://github.com/lycfyi/community-agent-plugin) (AGPL-3.0), and [borghei/Claude-Skills](https://github.com/borghei/Claude-Skills) (MIT + Commons Clause).

## license

MIT, see [LICENSE](LICENSE). read [DISCLAIMER.md](DISCLAIMER.md) before you connect this to real accounts.

## experimental, use your judgment

this is an experimental plugin. it ships with no warranty of any kind, and everything it drafts or posts is published under your judgment, not ours; the operator owns the output. salon is not affiliated with, endorsed by, or sponsored by X, LinkedIn, Discord, Telegram, Reddit, Hacker News, Brave Search, Postiz, Typefully, Buffer, Apify, or any other vendor referenced in its MCP templates. check each platform's and vendor's own terms before you connect an account.

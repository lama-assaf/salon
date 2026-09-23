---
name: theme-listening
description: Run the per-hashtag listening loop of a facts-and-themes engine. Scores mentions per theme for relevance and sentiment, writes the signal store and the run report, and queues content proposals. Use whenever the user asks for a theme listening pass, listener signals per theme, a signals report, or the listening step of a scheduled engine run.
---

# theme-listening

## when to use

Use when the brand publishes insight under a fixed dictionary of theme hashtags
and someone wants to know what the community is saying on each one: mentions,
relevance, sentiment, and what to do about it. This is the scheduled listener of
the engine. It produces a scored signal store and proposals; it never acts.

Use `social-listening` for an open-ended "what's trending in our niche" pass.
Use this skill when the question is "what is happening on our eight themes".

## inputs

1. `.atelier/memory/themes.md` — the theme dictionary: hashtag, what it is, why
   it is different, the fact it links back to, the partner tags, and the
   introduction post status. Only hashtags in this file are listened for.
2. `.atelier/memory/instincts.md` — banned topics, stealth-listed names, claim
   rules. Stealth-listed hashtags and names are excluded from the pass entirely.
3. `.atelier/memory/handles.md` — company and partner handles; a mention by one
   of these is amplification, not a new conversation.
4. `Engine/signals.json` from the previous run — the baseline for trend and
   sentiment movement.
5. Whatever listening sources are connected: hacker-news, reddit, brave-search,
   twitterapi-io (X mentions and search), apify-social-listening (X and
   LinkedIn keyword search), telegram or discord reads. Check before querying.

## workflow

1. Load the theme dictionary and build one query set per theme: the hashtag
   itself, two or three plain-language phrasings of the theme, and the brand's
   own handle. Add the partner handles once, not per theme.
2. Confirm which listening sources are connected. For every connected source,
   run the query set for the last 7 days (first run) or since the previous run.
   For every missing source, note it in `sources.missing` and substitute the
   manual research checklist from `social-listening` for that source's coverage.
   Call fast sources first (hacker-news, the X tweet scraper) and the LinkedIn
   post-search actor once, last, with the smallest query set: it is slow and
   sometimes hangs. Never wait on it before writing the signal store; record it
   as `timed out` under `sources.missing` when it has not answered.
   If the run has a Browser Agent or MCP agent, delegate the fetching to it and
   score what comes back.
3. Deduplicate what came back by URL. Drop anything that names a stealth-listed
   term. Keep the rest as candidate mentions.
4. Grade every candidate on the two ladders below. Discard `off-topic`.
5. Roll candidates up per theme: mention count, share of high relevance,
   sentiment balance, and movement against the previous run (`up`, `flat`,
   `down`, `new`). A theme with no mentions is reported as quiet, not omitted:
   silence on a theme is a finding.
6. Pick the signals. A signal is a mention or cluster with `high` relevance and
   evidence links, written in the finding format below. Three to eight signals
   per run is normal. Zero is allowed and is reported as zero.
7. For each signal decide the route:
   - content-shaped → run `trend-to-content` and append a proposal to
     `Engine/queue.json` with `status: proposed`;
   - conversation-shaped → an interaction proposal with a named comment shape
     from `comment-strategy`, stored on the signal, not sent;
   - partner mention → an amplification note for the engager ledger.
8. Write `Engine/signals.json` (replace) and `Engine/runs/<YYYY-MM-DD>.md`
   (append a run section). Then hand off to `engine-dashboard`.

## relevance ladder

| grade | meaning |
|---|---|
| high | discusses the theme's mechanism or the brand by name; a reply from the brand would be on-topic |
| medium | adjacent: the same problem, different vocabulary; useful as content inspiration |
| low | keyword collision or passing mention |
| off-topic | discard |

## sentiment ladder

Score the stance toward the theme's position, not toward the brand's mood.

| grade | meaning |
|---|---|
| supportive | argues the theme's position or cites it approvingly |
| neutral | reports, asks, or weighs without taking a side |
| sceptical | argues against the theme's position with reasons |
| hostile | dismisses without argument, or attacks the brand or a partner |

Report the per-theme balance as counts across the four grades. Never collapse
it to one number without also showing the counts.

## finding format

Every signal has all six parts:

1. **theme** — exactly one hashtag from the dictionary.
2. **finding** — what is happening, stated plainly.
3. **evidence** — the specific posts, threads or pages, as links with titles.
4. **relevance / sentiment** — the two grades.
5. **route** — `content`, `conversation` or `amplification`, with the proposal
   id or the comment shape.
6. **freshness** — how fast this conversation is moving, as a post-by date.

## signal store format

`Engine/signals.json`:

```json
{
  "generated_at": "2026-09-07T06:00:00Z",
  "run_id": "2026-09-07",
  "window": {"from": "2026-08-31", "to": "2026-09-07"},
  "sources": {"connected": ["hacker-news"], "missing": ["apify-social-listening"], "mode": "mcp+manual"},
  "themes": [
    {"hashtag": "#IdentityRoot", "mentions": 4, "relevance": {"high": 2, "medium": 1, "low": 1},
     "sentiment": {"supportive": 1, "neutral": 3, "sceptical": 0, "hostile": 0},
     "movement": "up", "summary": "one sentence", "top_signal": "S3"}
  ],
  "signals": [
    {"id": "S3", "theme": "#IdentityRoot", "finding": "...",
     "evidence": [{"title": "...", "url": "https://..."}],
     "relevance": "high", "sentiment": "neutral",
     "route": "content", "proposal_id": "P2", "comment_shape": null,
     "freshness": "2026-09-10"}
  ]
}
```

## rules

- Only hashtags in `themes.md` are themes. Do not invent, merge or rename one
  inside a listening pass; a theme change is a human decision.
- Check source connection before querying; degrade per missing source and say
  so in `sources.missing`. Never present manual research as MCP output.
- Every stored signal has evidence links. No links, no signal.
- Sentiment is reported as counts per grade, compared with the previous run.
- Quiet themes are reported, not dropped.
- Nothing is posted, replied, followed or DMed from this skill.
- Proposals are appended with `status: proposed`; existing queue items are
  never modified here.

## checklist

- [ ] Theme dictionary loaded; stealth list applied
- [ ] Sources checked; missing ones substituted and named
- [ ] Every candidate graded on both ladders
- [ ] Per-theme roll-up includes quiet themes and movement vs. previous run
- [ ] Every signal has all six parts
- [ ] Content-shaped signals queued as proposals; nothing acted on
- [ ] `Engine/signals.json` replaced, `Engine/runs/<date>.md` appended
- [ ] Handed off to `engine-dashboard`

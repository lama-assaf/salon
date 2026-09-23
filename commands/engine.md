---
name: engine
description: run one pass of the facts-and-themes communication engine: listen on the theme hashtags, queue proposals, draft what Alpha approved, gate every claim, render the dashboard, publish what Alpha released
---

# /engine

one scheduled pass of the theme engine, in order. $ARGUMENTS may narrow it:
`listen`, `draft`, `publish`, or `dashboard` run only that step; empty runs all
four.

## steps

1. **listen** — run `theme-listening` for every hashtag in
   `.atelier/memory/themes.md`. it writes `Engine/signals.json`, appends
   `Engine/runs/<date>.md`, and appends proposals to `Engine/queue.json` as
   `proposed`. it degrades per missing listening MCP and says which.
2. **draft** — for every queue item with `status: approved`, run `theme-post`
   (website post, LinkedIn teaser, X teaser, tags, CTA, fact link), then
   `post-audit` and `claim-gate`. items land at `ready` or `blocked`.
3. **publish** — for every `ready` item carrying `alpha.decision: publish`,
   run `website-publish`. website first; teasers wait for the URL. if the
   website MCP is not connected, report and stop this step.
4. **dashboard** — run `engine-dashboard` and report the page path plus the
   headline numbers: themes moving, proposals awaiting decision, blocked.

## what this command never does

- publish, schedule, reply or follow without a per-item human decision
  recorded on the queue item.
- draft or publish a fact. facts have their own approval flow.
- invent a theme. a hashtag not in `themes.md` is ignored.

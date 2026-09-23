---
name: engine-dashboard
description: Render the one-page dashboard of a facts-and-themes engine from the signal store and the content queue, so the human can read listener signals per theme, pending proposals, drafts awaiting approval and what was published. Use whenever the user asks for the engine dashboard, a listening dashboard, the state of the content queue, or at the end of any engine run.
---

# engine-dashboard

## when to use

Use at the end of every engine run, and whenever someone asks to see the state
of the engine. The dashboard is the surface Alpha reads to make decisions: which
themes are moving, what the listener proposes, what is waiting for approval,
what is blocked at the claim gate, and what went out. It is a static page
rendered from files, so it is always as fresh as the last run and never more.

## inputs

1. `Engine/signals.json` — the signal store written by `theme-listening`.
2. `Engine/queue.json` — the content queue (proposals, drafts, decisions).
3. `Engine/publish-log.json` — what was pushed to the website, if anything.
4. `Engine/engine.json` — engine metadata: brand, space, schedule, trigger
   prompt, listening and publishing sources, and their connection state.
5. `.atelier/memory/themes.md` — for the theme definitions shown on the cards.

## workflow

1. Run the renderer that ships with this skill:

   ```bash
   python3 <skill dir>/scripts/build_dashboard.py --space <space root>
   ```

   It reads the five inputs from the space root, inlines the data, and writes
   `Engine/dashboard/index.html` plus `Engine/dashboard/data.json`. The
   script is installed with this skill (look for `build_dashboard.py` under
   the skill's `scripts/` folder); run it, do not write the HTML by hand.
   Then save the rendered page once more through the file write tool
   (`write_to_file` with the file's own content) so the app records it as an
   output file of the run; files written only through the shell are not
   listed next to the run.
2. Show it in the app. The rendered page is self-contained, and the app's
   Files view previews HTML files inline, so the reader opens
   `Engine/dashboard/index.html` from the Files panel of the space. Only if
   the run's web deploy tool is available *and* reaches its service, also
   serve the page with it (`deploy_html_content`, `html_file_path` set to the
   rendered file) and report the URL it returns; if the service cannot be
   reached, say so in one line and point to the Files panel instead. Never
   let a failed deploy stop the run.
3. Check the four sections render: themes, signals, queue, published. An empty
   section shows its empty state, not a blank.
4. If the renderer fails on malformed input, fix the input file the error names
   and re-run. Do not hand-edit the HTML.
5. Report where to open the page (Files panel → `Engine/dashboard/index.html`,
   plus the served URL when there is one), the page's path relative to the
   space (never an absolute machine path), and the three headline numbers:
   themes moving, proposals awaiting decision, drafts blocked.

## page sections

| section | shows |
|---|---|
| header | brand, run id, window, sources connected and missing, source mode, schedule, next decision needed |
| themes | one card per hashtag: mentions, relevance split, sentiment counts, movement, one-line summary, introduction post status |
| signals | the run's signals with theme, finding, evidence links, grades, route and freshness |
| queue | every item by status: proposed, approved, draft, ready, blocked, published, rejected; with theme, angle, slot, fact, gate result |
| published | the publish log with URLs and approvers |
| how to decide | the three actions Alpha can take and where to record them |

## rules

- The page is rendered from files by the script; never hand-written.
- Every number on the page traces to a field in the inputs. No derived score
  without its inputs shown next to it.
- Source mode is always visible in the header: `mcp`, `manual` or `mcp+manual`.
- Empty states are rendered, not hidden.
- The page contains no secrets, no tokens and no internal counterparty terms:
  it is safe to share with anyone who may see the queue.

## checklist

- [ ] Renderer run against the space root
- [ ] Reader pointed to the Files panel (and a served URL when deploy works)
- [ ] All sections render, including empty states
- [ ] Header shows sources and source mode
- [ ] Headline numbers reported with the served URL and the relative path

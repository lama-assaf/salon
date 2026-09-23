---
name: theme-post
description: Draft the theme post set for one approved proposal in a facts-and-themes engine, the website insight post with a CTA to the blog plus LinkedIn and X teasers, each carrying the theme hashtag, partner tags and a link back to an evidenced fact. Use whenever the user asks for a theme post, an insight post under a hashtag, or teasers for a website post.
---

# theme-post

## when to use

Use when a content proposal in `Engine/queue.json` has been approved by a human
and needs to become publishable content. A theme post is opinion that claims
one theme hashtag and links back to a fact. It is the "themes build leadership"
step: facts buy trust, themes build on them, partners amplify.

Do not use this for facts (launches, certifications, partners joining). Facts
are press releases with their own approval flow and are not drafted here.

## inputs

1. The queue item: proposal id, theme, angle, the signal it came from, the
   calendar slot, and the approval record.
2. `.atelier/memory/voice.md` — register and vocabulary for the website post
   and for each teaser platform.
3. `.atelier/memory/themes.md` — the theme's definition, its "why different"
   line, the fact it links back to, the partner tags.
4. `.atelier/memory/status.md` — what is evidenced; the only source a claim may
   rest on.
5. `.atelier/memory/logics.md` if present — the argument structures to run when
   the draft is flat.

## the post set

One proposal produces four artefacts in `Engine/drafts/<id>.md`:

| artefact | shape | must carry |
|---|---|---|
| website post | 500–900 words, hook in the first line, one argument, one theme | theme hashtag as category, fact link in the body, CTA to the blog or a related post |
| LinkedIn teaser | `linkedin-post` rules: hook inside 210 characters, 900–1,300 characters, short lines | theme hashtag at the end, partner tags in the body, link to the website post in the first comment |
| X teaser | `x-thread` rules: one post or a short thread, 280 characters each, no numbering | theme hashtag, partner tag, link to the website post in the first reply |
| first comment / first reply | the link plus one sentence that adds something the post did not say | the published URL only, never a draft path |

## workflow

1. Read the queue item and the four inputs. Confirm the theme is in the
   dictionary and the approval record is present. If either is missing, stop
   and report; do not draft.
2. Name the fact the post links back to. It must be a row in `status.md` marked
   evidenced, or a published release. Write it at the top of the draft file as
   `fact:`. No fact, no post.
3. Draft the website post first. Run the chosen angle through the voice
   sliders; if it reads flat, pick a logic from `logics.md` and restructure.
4. Cut the teasers from the website post, not from the proposal: the teaser
   tells the reader why to click, it does not repeat the argument.
5. Apply the tags: exactly one theme hashtag per artefact, the partner tags from
   `themes.md` for that theme, and the CTA. Write the tag list at the top of the
   draft file so the audit can check it without reading the prose.
6. Run `post-audit` on each teaser and `claim-gate` on all four artefacts.
   Record both results on the queue item.
7. Set the item to `ready` if both pass, `blocked` with the reason if either
   fails. Never soften a failing sentence until it passes; quote it and stop.

## draft file format

```markdown
---
id: P2
theme: "#IdentityRoot"
stream: LTIN
fact: "status.md §1 — application submitted 15 Apr 2026 (evidenced)"
partner_tags: ["@GLEIF"]
cta: "https://ltin.li/insights/<slug>"
slot: "2026-09-10 LinkedIn 08:30 CET"
audit: pending
claim_gate: pending
---

## website post
...

## linkedin teaser
...

## x teaser
...

## first comment / first reply
...
```

## rules

- One theme hashtag per artefact, taken from the dictionary; two hashtags means
  two posts.
- Every artefact links back to an evidenced fact; the fact is named in the
  draft's frontmatter.
- Partner tags come from `themes.md` and `handles.md`, never from memory of who
  might be relevant. A partner not on the cleared list is not tagged.
- The CTA points at the website. Teasers carry the published URL in the first
  comment or reply, never in the body, and never a draft path.
- Website first: the teasers are not final until the website post has a URL.
- Voice, banned words and anti-AI-tone rules bind every artefact.
- This skill drafts; it does not publish or schedule.

## checklist

- [ ] Approval record present on the queue item
- [ ] Fact named in frontmatter and traceable to `status.md` or a release
- [ ] Website post drafted first; teasers cut from it
- [ ] One hashtag, partner tags and CTA on every artefact, listed in frontmatter
- [ ] `post-audit` run on both teasers
- [ ] `claim-gate` run on all four artefacts, result recorded
- [ ] Queue item set to `ready` or `blocked` with the quoted reason

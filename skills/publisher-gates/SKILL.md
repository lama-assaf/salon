---
name: publisher-gates
description: Run the Publisher's gates on a draft or an engagement entry with the script that ships here, so a person checks a draft with the same article, teaser, engagement and compliance rules the hourly Publisher applies before it syncs or sends. Use whenever the user asks why the Publisher holds an item, wants a draft gated before it reaches the queue, or wants a reply or comment checked before the next pass.
---

# publisher-gates

## when to use

Use on a finished draft (`Engine/drafts/<id>.md`) before it is handed to the
queue, on an engagement queue (`Engine/engagement/queue.json`) before the next
Publisher pass, or on any single text that is about to go public. The gates
are the only brake in a loop with no human approval: an item that holds here
is never synced to the calendar and never sent, and the reason printed is the
reason the Publisher's run summary and the Notion Incidents row carry.

This is a gate, not an editor. It passes or holds with the failing rule named
and the offending text quoted. Rewriting stays with the drafter.

## inputs

1. The draft file, with its frontmatter (`id`, `title`, `audit`,
   `claim_gate`) and its `## Website post`, `## LinkedIn teaser` and
   `## X teaser` sections, or the engagement queue (`{"entries": [...]}`
   with `kind`, `platform`, `target`, `text`, optional `target_text`,
   `stream`, `status`).
2. The folder of earlier drafts, for the shared-opening and shared-sentence
   checks (the draft's own folder by default; `--others` names another).
3. `Engine/queue.json`, optional (`--queue`): the item's `audit` and
   `claim_gate` fields back the frontmatter up.
4. A rules file, optional (`--rules <file.json>`): any key of the script's
   `DEFAULT_RULES` (word bounds, banned words, cleared hedges, the stealth
   list, the Zilliqa phrases, the settlement and disclosure patterns, the
   excluded target topics) can be overridden per Space without editing the
   script.

## workflow

1. Run the script that ships with this skill (look for `publisher_gates.py`
   under the skill's `scripts/` folder):

   ```bash
   python3 <skill dir>/scripts/publisher_gates.py draft Engine/drafts/P13.md --queue Engine/queue.json
   python3 <skill dir>/scripts/publisher_gates.py engagement Engine/engagement/queue.json --ready-only
   printf '%s' "<text>" | python3 <skill dir>/scripts/publisher_gates.py text --kind comment --platform X
   ```

   Add `--json` for one result object (`status`, `gates`, `reasons`). The
   exit status is 0 when everything passes, 1 when any gate holds, 2 when
   an input cannot be read. Standard library only; no keys, no network.
2. Read the result gate by gate. Each line is `pass` or `hold` followed by
   the reasons, in the Publisher's own wording:

   | gate | holds when |
   |---|---|
   | record | the frontmatter (or the queue item) does not carry `audit: pass` and `claim_gate: pass` |
   | article | under 450 or over 950 words; fewer than five paragraphs; editorial voice ("this draft", "the LTIN line", "no draft should"); metadata lines (`CTA:`, `Evidence link:`, `Fact:`) in the body; a raw URL; a banned word stated in the bare positive ("certified", "accredited", "seamless", ...); the opening paragraph or a sentence shared with an earlier item; a sentence repeated inside the article |
   | teaser:linkedin, teaser:x | empty; X over 280 characters; a link in the body; editorial voice or a stage direction ("first comment has the link"); a sentence copied from the article instead of cut from it |
   | engagement | unknown kind or platform; no target post; empty text; X over 280 characters; a link; editorial voice; a comment under 15 words; bare agreement ("Great point"); a banned word; a stream other than LTIN or Both; a comment whose target post is on an excluded topic (hacks, enforcement actions, condolences, politics) |
   | compliance | a stealth topic; price, token or investment talk; a paragraph naming Zilliqa without one of the cleared forms (flagship deployment, shareholder, the partnership, the jointly-developed foundations, the release); settlement infrastructure mentioned without a disclosure sentence ("LTIN does not settle", "a specified design", "plans to provide", ...), which for a draft may sit anywhere in the piece (the teasers point at the article) and for a reply or comment must be in the text itself |

3. Hand every hold back to the drafter with the quoted reason. Do not edit
   the draft or the entry, and do not change the rules to make a text pass;
   a rules file is for a Space's own stealth list and hedges, agreed with the
   owner.
4. Re-run after the redraft. An item is ready for the queue only when every
   gate passes; the Publisher re-runs the same script on its next pass and
   holds anything that regressed.

## used by the Publisher

The hourly Publisher workflow imports the same module (`check_draft`,
`check_entry`, `article_gate`, `teaser_gate`, `engagement_gate`,
`compliance_gate`) and applies it to every draft it syncs and every entry it
sends, so a draft that passes here passes there. The voice check against
`voice.md` and the explanation of a hold are judgement calls the Publisher
hands to an agent; this script never makes them.

## rules

- The gate reads the draft as the Publisher will: the website post is the
  `## Website post` section with meta-sentences cut, the teasers are their
  sections with stage directions cut. What the script reports is what the
  Publisher will do.
- Every hold names the rule and quotes the text. A hold without a reason is
  a script error, not a result.
- The script never edits a file and never calls a network. It reads the
  draft, the sibling drafts and, when given, the queue and the rules file.
- A pass is a pass against the rules of that run; a later rules change or a
  later sibling draft can re-open it, which is why the Publisher re-checks
  every pass.

## checklist

- [ ] Script run on the draft with its folder of earlier drafts (and the queue when it exists)
- [ ] Every gate read: record, article, both teasers, compliance
- [ ] Engagement entries checked with `engagement` before a pass that sends
- [ ] Holds handed back quoted, nothing edited, rules unchanged
- [ ] Re-run after the redraft until every gate passes

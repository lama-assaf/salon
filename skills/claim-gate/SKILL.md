---
name: claim-gate
description: Check a draft for claims of live or deployed capability ahead of delivery, partner names presented as confirmed, and dates or statuses the evidence does not carry. Use whenever the user asks for a claim check, a fact check against the evidenced status, a compliance pass before publishing, or when a facts-and-themes engine moves a draft toward publish.
---

# claim-gate

## when to use

Use on any draft before it moves to `ready`. The gate enforces one key result:
**zero claims of live or deployed capability ahead of delivery.** It also
catches the two failures that travel with it: a pitch presented as a partner,
and a date or status the evidence cannot source.

This is a gate, not an editor. It passes or blocks with the failing sentence
quoted. Rewriting is the drafter's job.

## inputs

1. The draft (all artefacts in the draft file).
2. `.atelier/memory/status.md` — what is evidenced, in tiers.
3. `.atelier/memory/instincts.md` — the banned words, the cleared hedge forms,
   the cleared-names list, the stealth list.
4. `.atelier/memory/partners.md` if present — the counterparty register.

## workflow

1. Extract every sentence that asserts a state of the world: a verb in the
   present tense about the brand, a partner, a certification, a date, a number,
   or a capability. Ignore sentences about the theme's argument that make no
   claim about the brand.
2. For each extracted sentence, classify it:
   - **shipped** — `status.md` marks it evidenced → pass.
   - **in progress** — evidenced as underway → pass only if the sentence uses a
     cleared hedge form from `instincts.md` (for example "is in the process of
     obtaining", "plans to provide", "intend to jointly develop").
   - **design property** — specified but not deployed → pass only if the
     sentence says so ("specified", "designed to"), never in the bare present.
   - **not evidenced** — block, quote the sentence, name the tier it needs.
3. Check every proper noun against the cleared-names list. A name not on the
   list, or on the stealth list, blocks the draft. A cleared name graded "in
   discussion" needs the footer "in discussion — participation not confirmed"
   if it is presented as a relationship.
4. Check every number for a source in the text. A statistic ships with its
   citation or it does not ship.
5. Check every date. A date must exist in `status.md`; a retired date is not
   replaced with a new one.
6. Scan for the banned words on certification and accreditation status and for
   any present-tense statement of an unshipped layer.
7. Write the result on the queue item and in the draft frontmatter:
   `claim_gate: pass` or `claim_gate: blocked` followed by the quoted sentences
   and the tier each one needs.

## result format

```
claim_gate: blocked
- "LTIN operates the certified issuer" → not evidenced; needs tier "in progress"
  with the cleared hedge "is in the process of obtaining the GLEIF accreditation"
- "checks every transaction before it settles" → design property stated in the
  bare present; say "is specified to check"
- "@PartnerX" → not on the cleared-names list
```

## rules

- The gate reads `status.md` as the authority. Where strategy documents and
  `status.md` disagree, `status.md` wins.
- Every block quotes the exact sentence and names the tier it needs. A block
  without a quoted sentence is not a result.
- Cleared hedge forms are the only approved way to state something underway.
  The gate does not invent new hedges.
- A pass is recorded with the date and the `status.md` revision it was checked
  against, so a later status change can re-open it.
- The gate never edits the draft.

## checklist

- [ ] Every state-asserting sentence extracted and classified
- [ ] Proper nouns checked against cleared and stealth lists
- [ ] Numbers carry sources; dates exist in `status.md`
- [ ] Banned status words absent; no bare-present unshipped capability
- [ ] Result written on the queue item and in the draft frontmatter

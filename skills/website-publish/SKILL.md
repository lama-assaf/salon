---
name: website-publish
description: Push an approved website post from the content queue to the brand's website through its connected content MCP (Notion for a Notion-backed site), record the publish log, and hand the published URL to the teasers. Use whenever the user asks to publish a ready post to the website, push to ltin.li, or run the website step of the engine.
---

# website-publish

## when to use

Use when a queue item is `ready`, a human has recorded a publish decision on
that specific item, and the website's content MCP is connected. This is the
"website first" step: everything publishes on the website before any other
channel, and traffic there is the ignition for amplification.

## inputs

1. The queue item with `alpha.decision: publish`, its draft file, and the
   passing `audit` and `claim_gate` results.
2. `Engine/publish-targets.json` — the website target: MCP server name, the
   Notion database or data source id (or the CMS collection), and the property
   map from draft frontmatter to CMS fields.
3. The connected MCP. For a Notion-backed site, the `notion` server from the
   catalog with `NOTION_TOKEN` set. If the server is not connected, stop and
   report; do not fall back to another channel.

## workflow

1. Re-check the item: status `ready`, `audit: pass`, `claim_gate: pass`,
   `alpha.decision: publish` with a name and a timestamp. Any of the four
   missing means stop and report which one.
2. Confirm the website MCP is connected and the target in
   `Engine/publish-targets.json` resolves (a database query returns). If not,
   stop and report; nothing is published.
3. Map the draft to the CMS record using the property map: title, body
   (website post section only), theme hashtag as the category, the `fact`
   field, the register label (`insight`), the date, and `status` as the
   target's draft or review state — never straight to live unless the target
   says the site publishes on creation.
4. Create the record through the MCP. Capture the returned page id and URL.
5. Write `Engine/publish-log.json`: append `{id, target, page_id, url,
   published_at, approved_by}`. Set the queue item to `published` with the URL,
   and copy the URL into the draft's `cta` and the teasers' first comment or
   reply.
6. Report the URL to the user and mark the teasers `ready` for scheduling.
   Scheduling teasers is a separate decision through the social scheduling MCP
   (postiz, typefully or buffer) and is not done here.

## publish targets format

`Engine/publish-targets.json`:

```json
{
  "website": {
    "mcp": "notion",
    "kind": "notion-database",
    "data_source_id": "<notion data source id for /insights>",
    "create_state": "Draft",
    "property_map": {
      "title": "Name", "theme": "Theme", "fact": "Fact", "register": "Register",
      "date": "Date", "status": "Status", "body": "page-content"
    }
  },
  "teasers": {"mcp": "typefully", "kind": "scheduler"}
}
```

## rules

- Publish only items with a human `publish` decision recorded on the item.
  A general instruction to "publish what's ready" is not a per-item decision.
- Website first. No teaser is scheduled before the website URL exists.
- The CMS record carries the `fact` field; an empty fact means the item cannot
  publish, by schema.
- Create in the target's draft or review state unless the target explicitly
  publishes on creation; say which happened in the log.
- Every publish is logged with who approved it and when.
- If the MCP is missing or the target does not resolve, stop and report. Never
  substitute another channel for the website.

## checklist

- [ ] Item is `ready`, audited, gated and carries a per-item publish decision
- [ ] Website MCP connected and target resolves
- [ ] Draft mapped through the property map, including the `fact` field
- [ ] Record created; page id and URL captured
- [ ] `Engine/publish-log.json` appended; queue item set to `published`
- [ ] URL copied into the teasers' first comment or reply

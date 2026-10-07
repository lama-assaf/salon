#!/usr/bin/env python3
"""Publisher gates: the checks a draft or an engagement entry must pass before
the Publisher moves it into the calendar or sends it.

Usage:
    python3 publisher_gates.py draft <draft.md> [--others <dir|file ...>] [--rules <rules.json>] [--json]
    python3 publisher_gates.py engagement <queue.json|entry.json> [--rules <rules.json>] [--json]
    python3 publisher_gates.py text --kind article|teaser|comment|reply --platform X|LinkedIn|Blog [<file>|-] [--json]

Gates:
    article     the website post: 450-950 words, five paragraphs, no editorial
                voice, no metadata lines, no raw URL, no banned word stated in
                the bare positive, its own opening, no sentence repeated or
                shared with an earlier item
    teaser      each LinkedIn and X teaser: present, X within 280 characters,
                no link in the body, no editorial voice or stage direction, cut
                from the article and never copied from it
    engagement  a reply or comment: known kind and platform, a target post,
                text, X within 280 characters, no link, no editorial voice,
                comments of 15 words or more, no bare agreement, no banned
                word, the LTIN stream; and the target post not on an excluded
                topic
    compliance  every public text: no stealth topic, no price, token or
                investment talk, Zilliqa named only in the cleared
                cross-reference, and a disclosure sentence whenever the text
                touches settlement infrastructure
    record      a draft's frontmatter carries `audit: pass` and
                `claim_gate: pass` (the agents' own gates), the Publisher's
                precondition for touching a draft at all

The same functions run inside the Publisher workflow; a person in Claude Code
runs the command line. Exit status 0 when everything passes, 1 when any gate
holds, 2 on a usage or input error. `--json` prints one result object with a
`status` of `pass` or `hold`, a `gates` map and a flat `reasons` list.

The rules are the ones `Engine/tools/calendar_autopilot.py` enforced (the
LTIN launchd autopilot) plus the compliance list of the LTIN automations plan
v6 section 2d. A rules file (`--rules`) overrides any of the DEFAULT_RULES
keys, so a Space can extend its stealth list or its hedges without editing
the script. Standard library only.
"""

from __future__ import annotations

import argparse
import collections
import glob
import json
import re
import sys
from pathlib import Path
from typing import Any

# ------------------------------------------------------------------ rules

DEFAULT_RULES: dict[str, Any] = {
    "min_article_words": 450,
    "max_article_words": 950,
    "min_article_paragraphs": 5,
    "x_limit": 280,
    "min_comment_words": 15,
    # Words that may only appear negated ("not certified", "never accredited").
    "banned_words": [
        "certified", "accredited", "game-changer", "revolutionary", "unlock",
        "leverage", "delve", "seamless", "cutting-edge",
    ],
    # Published hedges; the only sentences allowed to repeat across pieces.
    "cleared_hedges": [
        "in the process of obtaining the gleif accreditation",
        "intend to jointly develop the foundations",
        "plans to provide",
    ],
    # The stealth list from instincts.md: no public mention until proven.
    "stealth_terms": [
        r"alatau", r"kazakhstan", r"china[\s/–-]*eu corridor", r"x402", r"ironclaw",
        r"\bNEAR\b", r"\bSCION\b", r"\bSSFN\b", r"anapaya", r"viper project",
        r"hypernative", r"\bGSMA\b", r"simfonia",
    ],
    # Price, token or investment talk: LTIN publishes no view on these.
    "financial_terms": [
        r"token price", r"price (prediction|target|action)", r"\$ZIL\b",
        r"\bZIL\b", r"when token", r"\bairdrop\b", r"\bAPY\b", r"\bmoon(ing)?\b",
        r"investment advice", r"financial advice", r"buy (the )?(token|dip)",
        r"\bstaking rewards?\b", r"\btokenomics\b", r"\bmarket cap\b",
    ],
    # The ways LTIN may name Zilliqa (instincts.md: the subordinate
    # cross-reference, the jointly narrated relationship itself, and the
    # cleared hedge of the 2026-07-07 release). A sentence naming Zilliqa
    # with none of these is a claim about Zilliqa. Handles and hashtags
    # (@zilliqa) are tags, not sentences, and are taken out first.
    "zilliqa_cleared_phrases": [
        "flagship deployment of ltin",
        "shareholder",
        "partnership",
        "jointly develop",
        "release",
    ],
    # When any of these appear, one disclosure sentence must too.
    "settlement_terms": [
        r"\bsettlement\b", r"mediation layer", r"\bclearing\b",
        r"tokeni[sz]ed deposit", r"\bpre-settlement\b",
        r"\b(value|transaction|trade|payment)s?\b[^.]{0,40}\bsettles?\b",
        r"\bsettles?\b[^.]{0,40}\b(value|transaction|trade|payment)s?\b",
    ],
    "disclosure_patterns": [
        r"does not (settle|operate a running mediation layer)",
        r"(do|does) not (produce state|hold balances|move value)",
        r"specified design", r"not a deployed capability", r"no date for it",
        r"intend to jointly develop the foundations", r"plans to provide",
        r"is specified to", r"designed to", r"what we do not claim",
        r"publishes? no view",
    ],
    # Target posts a comment never goes under (plan v6 section 2b).
    "excluded_target_topics": [
        r"\bhack(ed|er|s)?\b", r"\bexploit(ed|s)?\b", r"\bdrained\b",
        r"enforcement action", r"\bcharged (by|with)\b", r"\bindict", r"\bsanction",
        r"\bcondolence", r"\bRIP\b", r"passed away", r"\belection\b",
        r"\bparliament\b", r"\bpolitic", r"\bminister\b", r"\bpresident\b",
    ],
    "allowed_streams": ["LTIN", "Both"],
}

LEAK_PATTERN = re.compile(
    r"no draft should|until the handle is verified|status record|per instincts|claim gate|post-audit|frontmatter|"
    r"first (comment|reply) (has|carries|contains)|in (the )?first (comment|reply)|pillar for this piece|"
    r"communications rule|this piece|this draft|the point of this post|the LTIN line|LTIN (should|must) (argue|state|keep)",
    re.I,
)
STAGE_DIRECTION = re.compile(r"[^.\n]*\b(first (comment|reply)|source note|blog CTA|CTA in|link in)\b[^.\n]*[.!]\s*", re.I)
META_SENTENCE = re.compile(
    r"[^.!?\n]*\b(pillar for this piece|this piece|this draft|this post is|the point of this post|communications rule|"
    r"no draft should|status record|per instincts|claim gate|post-audit|frontmatter|LTIN (should|must) (argue|state|keep))\b"
    r"[^.!?\n]*[.!?]\s*",
    re.I,
)
METADATA_LINE = re.compile(r"^\s*\*{0,2}(cta|evidence link|theme hashtag|partner tags|fact)\*{0,2}\s*:", re.I | re.M)
BARE_AGREEMENT = re.compile(r"^(great|nice|good|love|agree|well said|so true|this|\+1|exactly|thanks)\b[^.]{0,30}[.!]?$", re.I)
URL = re.compile(r"https?://")
NEGATION_BEFORE = re.compile(r"\b(not|never|no|neither|nor|without)\b")
SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def load_rules(path: str | Path | None) -> dict[str, Any]:
    """DEFAULT_RULES with the keys of an optional JSON file laid over them."""
    rules = json.loads(json.dumps(DEFAULT_RULES))
    if path:
        try:
            override = json.loads(Path(path).read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise GateInputError(f"{path}: cannot read rules ({exc})") from exc
        if not isinstance(override, dict):
            raise GateInputError(f"{path}: rules must be a JSON object")
        rules.update(override)
    return rules


class GateInputError(Exception):
    """The input could not be read; exit status 2."""


# ------------------------------------------------------------------ drafts


def parse_draft(text: str) -> tuple[dict[str, str], dict[str, str]]:
    """Frontmatter as a flat dict and `## heading` sections keyed in lower case."""
    meta: dict[str, str] = {}
    match = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    body = text
    if match:
        body = match.group(2)
        for line in match.group(1).splitlines():
            if ":" in line:
                key, value = line.split(":", 1)
                meta[key.strip()] = value.strip().strip("\"'")
    sections: dict[str, str] = {}
    current = None
    for line in body.splitlines():
        heading = re.match(r"^##\s+(.*)$", line)
        if heading:
            current = heading.group(1).strip().lower()
            sections[current] = ""
        elif current is not None:
            sections[current] += line + "\n"
    return meta, {key: value.strip() for key, value in sections.items()}


def section(sections: dict[str, str], *needles: str) -> str:
    for key, value in sections.items():
        if all(needle in key for needle in needles):
            return value
    return ""


def gate_value(item: dict | None, meta: dict, name: str) -> str:
    raw = (item or {}).get(name)
    value = raw.get("status") if isinstance(raw, dict) else raw
    return str(meta.get(name) or value or "").strip().lower()


def item_number(item_id: str) -> int:
    m = re.search(r"(\d+)", str(item_id))
    return int(m.group(1)) if m else 0


def earlier_only(item_id: str, others: dict[str, str]) -> dict[str, str]:
    """The later item is the one that copied; only earlier items count."""
    n = item_number(item_id)
    return {k: v for k, v in others.items() if item_number(k) < n}


def excerpt_of(article: str, title: str = "") -> str:
    """First real paragraph of the article: not the heading or title, no label."""
    for chunk in re.split(r"\n\s*\n", article.strip()):
        line = chunk.strip()
        if not line or line.startswith("#") or line.startswith("**") or line.startswith("- "):
            continue
        if title and line.rstrip(".").lower() == title.rstrip(".").lower():
            continue
        return re.sub(r"\s+", " ", line)[:300]
    return ""


def clean_article(text: str) -> str:
    """Cut sentences that talk about the piece instead of arguing it."""
    cleaned = META_SENTENCE.sub("", text)
    return re.sub(r"\n{3,}", "\n\n", cleaned).strip()


def clean_teaser(text: str) -> str:
    """Drop stage-direction sentences and collapse the blank lines they leave."""
    cleaned = STAGE_DIRECTION.sub("", text)
    return re.sub(r"\n{3,}", "\n\n", cleaned).strip()


def article_of(sections: dict[str, str]) -> str:
    return clean_article(section(sections, "website"))


def teasers_of(sections: dict[str, str]) -> dict[str, str]:
    """The LinkedIn and X teasers with stage directions cut, keyed by platform."""
    x_text = section(sections, "x teaser") or section(sections, "x ")
    return {"LinkedIn": clean_teaser(section(sections, "linkedin")), "X": clean_teaser(x_text)}


# ------------------------------------------------------------------ gates


def _banned_word(text: str, rules: dict[str, Any]) -> str | None:
    for word in rules["banned_words"]:
        for m in re.finditer(rf"\b{re.escape(word)}\b", text, re.I):
            before = text[max(0, m.start() - 60):m.start()].lower()
            if NEGATION_BEFORE.search(before):
                continue  # the hedge itself says what LTIN is not
            return word
    return None


def article_gate(article: str, title: str, others: dict[str, str] | None = None, rules: dict[str, Any] | None = None) -> list[str]:
    """Reasons an article may not go live. Empty list = passes.

    `others` maps item id -> that item's article, for the shared-opening and
    shared-sentence checks; pass only earlier items (see `earlier_only`).
    """
    rules = rules or DEFAULT_RULES
    others = others or {}
    reasons: list[str] = []
    words = len(article.split())
    if words < rules["min_article_words"]:
        reasons.append(f"{words} words, under {rules['min_article_words']}")
    if words > rules["max_article_words"]:
        reasons.append(f"{words} words, over {rules['max_article_words']}")
    paragraphs = [c.strip() for c in re.split(r"\n\s*\n", article.strip()) if c.strip() and not c.strip().startswith("#")]
    if len(paragraphs) < rules["min_article_paragraphs"]:
        reasons.append(f"only {len(paragraphs)} paragraphs")
    leak = LEAK_PATTERN.search(article)
    if leak:
        reasons.append(f"editorial voice: '{leak.group(0)}'")
    if METADATA_LINE.search(article):
        reasons.append("metadata lines in the body")
    if URL.search(article):
        reasons.append("raw URL in the body")
    banned = _banned_word(article, rules)
    if banned:
        reasons.append(f"banned word '{banned}'")
    opening = excerpt_of(article, title)
    for other_id, other in others.items():
        if other and opening and excerpt_of(other) == opening:
            reasons.append(f"opening paragraph shared with {other_id}")
            break
    cleared = [h.lower() for h in rules["cleared_hedges"]]
    sentences = [x.strip().lower() for x in SENTENCE_SPLIT.split(article)
                 if len(x.strip()) > 60 and not any(c in x.lower() for c in cleared)]
    dup = collections.Counter(sentences)
    if any(c > 1 for c in dup.values()):
        reasons.append("a sentence repeats inside the article")
    for other_id, other in others.items():
        if other and any(sent in other.lower() for sent in sentences[:12]):
            reasons.append(f"a sentence also appears in {other_id}")
            break
    return reasons


def teaser_gate(platform: str, text: str, article: str, rules: dict[str, Any] | None = None) -> list[str]:
    """Reasons a teaser may not be posted as written. Empty list = passes."""
    rules = rules or DEFAULT_RULES
    if not text:
        return ["empty"]
    reasons: list[str] = []
    if platform == "X" and len(text) > rules["x_limit"]:
        reasons.append(f"{len(text)} characters exceeds {rules['x_limit']}")
    if URL.search(text):
        reasons.append("link inside the body")
    leak = LEAK_PATTERN.search(text) or STAGE_DIRECTION.search(text)
    if leak:
        reasons.append(f"editorial voice or stage direction ('{leak.group(0).strip()[:50]}')")
    if article and any(len(x) > 60 and x in article for x in SENTENCE_SPLIT.split(text)):
        reasons.append("sentence copied from the article")
    return reasons


def disclosure_gate(text: str, rules: dict[str, Any] | None = None, context: str | None = None) -> list[str]:
    """Reason a text touches settlement infrastructure without the disclosure
    sentence, which may sit anywhere in `context` (the whole piece for a
    draft; the text itself for a reply or comment). Empty list = passes."""
    rules = rules or DEFAULT_RULES
    touches = next((m.group(0) for p in rules["settlement_terms"] if (m := re.search(p, text, re.I))), None)
    if touches and not any(re.search(p, context or text, re.I) for p in rules["disclosure_patterns"]):
        return [f"touches settlement infrastructure ('{touches}') without the disclosure sentence"]
    return []


def compliance_gate(text: str, rules: dict[str, Any] | None = None, *, disclosure: bool = True) -> list[str]:
    """Reasons a public text breaks the compliance list. Empty list = passes.

    A paragraph that names Zilliqa must carry one of the cleared forms; the
    sentence naming it is quoted. With `disclosure=False` the settlement
    check is left to `disclosure_gate` over a wider context.
    """
    rules = rules or DEFAULT_RULES
    reasons: list[str] = []
    if not text:
        return reasons
    for pattern in rules["stealth_terms"]:
        m = re.search(pattern, text, re.I)
        if m:
            reasons.append(f"stealth topic '{m.group(0)}'")
            break
    for pattern in rules["financial_terms"]:
        m = re.search(pattern, text, re.I)
        if m:
            reasons.append(f"price, token or investment talk '{m.group(0)}'")
            break
    cleared = [p.lower() for p in rules["zilliqa_cleared_phrases"]]
    for paragraph in re.split(r"\n\s*\n", re.sub(r"[@#]\w+", "", text)):
        if re.search(r"\bzilliqa\b", paragraph, re.I) and not any(p in paragraph.lower() for p in cleared):
            sentence = next((s for s in SENTENCE_SPLIT.split(paragraph) if re.search(r"\bzilliqa\b", s, re.I)), paragraph)
            reasons.append(f"claim about Zilliqa: '{re.sub(r'\\s+', ' ', sentence.strip())[:80]}'")
            break
    if disclosure:
        reasons.extend(disclosure_gate(text, rules))
    return reasons


def engagement_gate(entry: dict, rules: dict[str, Any] | None = None) -> list[str]:
    """Reasons a reply or comment may not be sent. Empty list = passes."""
    rules = rules or DEFAULT_RULES
    text = (entry.get("text") or "").strip()
    kind, platform = entry.get("kind"), entry.get("platform")
    if kind not in ("reply", "comment") or platform not in ("X", "LinkedIn"):
        return ["unknown kind or platform"]
    if not entry.get("target"):
        return ["no target post"]
    if not text:
        return ["empty text"]
    reasons: list[str] = []
    if platform == "X" and len(text) > rules["x_limit"]:
        reasons.append(f"{len(text)} characters exceeds {rules['x_limit']}")
    if URL.search(text):
        reasons.append("link in the text")
    if LEAK_PATTERN.search(text):
        reasons.append("editorial voice")
    if kind == "comment" and len(text.split()) < rules["min_comment_words"]:
        reasons.append(f"comment under {rules['min_comment_words']} words")
    if BARE_AGREEMENT.match(text):
        reasons.append("bare agreement")
    for word in rules["banned_words"]:
        if re.search(rf"\b{re.escape(word)}\b", text, re.I) and not re.search(rf"\b(not|never|no)\b[^.]{{0,40}}\b{re.escape(word)}\b", text, re.I):
            reasons.append(f"banned word '{word}'")
            break
    if entry.get("stream") not in (None, *rules["allowed_streams"]):
        reasons.append("not the LTIN stream")
    target_text = entry.get("target_text") or ""
    if kind == "comment" and target_text:
        for pattern in rules["excluded_target_topics"]:
            m = re.search(pattern, target_text, re.I)
            if m:
                reasons.append(f"target post on an excluded topic ('{m.group(0)}')")
                break
    return reasons


# ------------------------------------------------------------------ results


def _gate(name: str, reasons: list[str]) -> dict[str, Any]:
    return {"gate": name, "status": "hold" if reasons else "pass", "reasons": reasons}


def _result(subject: str, gates: list[dict[str, Any]], **extra: Any) -> dict[str, Any]:
    reasons = [f"{g['gate']}: {r}" for g in gates for r in g["reasons"]]
    return {"subject": subject, "status": "hold" if reasons else "pass",
            "gates": {g["gate"]: {"status": g["status"], "reasons": g["reasons"]} for g in gates},
            "reasons": reasons, **extra}


def check_draft(text: str, *, item: dict | None = None, others: dict[str, str] | None = None,
                rules: dict[str, Any] | None = None, subject: str = "draft") -> dict[str, Any]:
    """Every gate the Publisher runs on one draft file's text.

    `item` is the queue item (its `audit` / `claim_gate` fields back the
    frontmatter up); `others` maps item id -> article text of every other
    draft in the folder (earlier items are selected here).
    """
    rules = rules or DEFAULT_RULES
    meta, sections = parse_draft(text)
    item_id = meta.get("id") or (item or {}).get("id") or subject
    title = meta.get("title") or (item or {}).get("title") or ""
    record: list[str] = []
    for name in ("audit", "claim_gate"):
        value = gate_value(item, meta, name)
        if value != "pass":
            record.append(f"{name} {value or 'pending'}")
    article = article_of(sections)
    gates = [_gate("record", record),
             _gate("article", article_gate(article, title, earlier_only(item_id, others or {}), rules))]
    teasers = teasers_of(sections)
    for platform, teaser in teasers.items():
        gates.append(_gate(f"teaser:{platform.lower()}", teaser_gate(platform, teaser, article, rules)))
    compliance: list[str] = []
    parts = (("article", article), ("linkedin", teasers["LinkedIn"]), ("x", teasers["X"]))
    for label, body in parts:
        compliance.extend(f"{label}: {r}" for r in compliance_gate(body, rules, disclosure=False))
    # The teasers point at the article, so the disclosure may sit anywhere in the piece.
    piece = "\n\n".join(body for _, body in parts)
    compliance.extend(f"piece: {r}" for r in disclosure_gate(piece, rules, piece))
    gates.append(_gate("compliance", compliance))
    return _result(str(item_id), gates, title=title, words=len(article.split()))


def check_entry(entry: dict, *, rules: dict[str, Any] | None = None) -> dict[str, Any]:
    """The engagement and compliance gates on one reply or comment entry."""
    rules = rules or DEFAULT_RULES
    subject = f"{entry.get('platform', '?')}:{entry.get('kind', '?')}:{str(entry.get('target', ''))[-24:]}"
    gates = [_gate("engagement", engagement_gate(entry, rules)),
             _gate("compliance", compliance_gate((entry.get("text") or "").strip(), rules))]
    return _result(subject, gates, entry_status=entry.get("status"), item_id=entry.get("item_id"))


def check_text(kind: str, platform: str, text: str, *, rules: dict[str, Any] | None = None) -> dict[str, Any]:
    """One free-standing text through the gate its kind names, plus compliance."""
    rules = rules or DEFAULT_RULES
    if kind == "article":
        gates = [_gate("article", article_gate(clean_article(text), "", {}, rules))]
    elif kind == "teaser":
        gates = [_gate(f"teaser:{platform.lower()}", teaser_gate(platform, clean_teaser(text), "", rules))]
    else:
        gates = [_gate("engagement", engagement_gate({"kind": kind, "platform": platform, "target": "-", "text": text}, rules))]
    gates.append(_gate("compliance", compliance_gate(text.strip(), rules)))
    return _result(f"{platform}:{kind}", gates)


def load_others(sources: list[str], own_path: Path | None) -> dict[str, str]:
    """Item id -> article text for every other draft named by `sources`
    (directories are read as `*.md`); the draft itself is left out."""
    others: dict[str, str] = {}
    for source in sources:
        path = Path(source)
        files = sorted(path.glob("*.md")) if path.is_dir() else [path]
        for file in files:
            if own_path is not None and file.resolve() == own_path.resolve():
                continue
            try:
                meta, sections = parse_draft(file.read_text(encoding="utf-8"))
            except OSError:
                continue
            others[meta.get("id") or file.stem] = article_of(sections)
    return others


# ------------------------------------------------------------------ cli


def _print(results: list[dict[str, Any]], as_json: bool) -> None:
    if as_json:
        payload: Any = results[0] if len(results) == 1 else {"status": "hold" if any(r["status"] == "hold" for r in results) else "pass", "results": results}
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return
    for result in results:
        print(f"{result['status'].upper():4} {result['subject']}")
        for name, gate in result["gates"].items():
            line = f"  {name:16} {gate['status']}"
            print(line if not gate["reasons"] else line + " - " + "; ".join(gate["reasons"]))


def _read_text(source: str | None) -> str:
    if source in (None, "-"):
        return sys.stdin.read()
    try:
        return Path(source).read_text(encoding="utf-8")
    except OSError as exc:
        raise GateInputError(f"{source}: {exc.strerror}") from exc


def _read_json(source: str) -> Any:
    try:
        return json.loads(Path(source).read_text(encoding="utf-8"))
    except OSError as exc:
        raise GateInputError(f"{source}: {exc.strerror}") from exc
    except ValueError as exc:
        raise GateInputError(f"{source}: invalid JSON ({exc})") from exc


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0], formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rules", help="JSON file whose keys override DEFAULT_RULES")
    parser.add_argument("--json", action="store_true", help="print the result as JSON")
    # The same two options after the subcommand, so `draft x.md --json` works too.
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--rules", default=argparse.SUPPRESS)
    common.add_argument("--json", action="store_true", default=argparse.SUPPRESS)
    sub = parser.add_subparsers(dest="command", required=True)
    p_draft = sub.add_parser("draft", parents=[common], help="gate one draft file (article, teasers, compliance, record)")
    p_draft.add_argument("draft")
    p_draft.add_argument("--others", nargs="*", default=None,
                         help="draft files or folders whose earlier items the opening and sentence checks compare against (default: the draft's own folder)")
    p_draft.add_argument("--queue", help="queue.json whose item backs the audit / claim_gate record up")
    p_eng = sub.add_parser("engagement", parents=[common], help="gate an engagement queue ({\"entries\": [...]}) or one entry")
    p_eng.add_argument("source")
    p_eng.add_argument("--ready-only", action="store_true", help="only entries whose status is missing or ready")
    p_text = sub.add_parser("text", parents=[common], help="gate one text from a file or stdin")
    p_text.add_argument("source", nargs="?", default="-")
    p_text.add_argument("--kind", required=True, choices=["article", "teaser", "comment", "reply"])
    p_text.add_argument("--platform", default="LinkedIn", choices=["X", "LinkedIn", "Blog"])
    args = parser.parse_args(argv)

    try:
        rules = load_rules(args.rules)
        if args.command == "draft":
            path = Path(args.draft)
            text = _read_text(args.draft)
            others = load_others(args.others if args.others is not None else [str(path.parent)], path)
            item = None
            if args.queue:
                meta, _ = parse_draft(text)
                item = next((it for it in _read_json(args.queue).get("items", []) if it.get("id") == meta.get("id")), None)
            results = [check_draft(text, item=item, others=others, rules=rules, subject=path.stem)]
        elif args.command == "engagement":
            data = _read_json(args.source)
            entries = data.get("entries", []) if isinstance(data, dict) and "entries" in data else [data]
            if args.ready_only:
                entries = [e for e in entries if e.get("status") in (None, "ready")]
            results = [check_entry(e, rules=rules) for e in entries]
        else:
            results = [check_text(args.kind, args.platform, _read_text(args.source), rules=rules)]
    except GateInputError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    _print(results, args.json)
    return 1 if any(r["status"] == "hold" for r in results) else 0


if __name__ == "__main__":
    sys.exit(main())

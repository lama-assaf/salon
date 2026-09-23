#!/usr/bin/env python3
"""Render the facts-and-themes engine dashboard from the Engine/ files.

Usage:
    python3 build_dashboard.py --space <space root> [--out <html path>]

Reads, relative to the space root:
    Engine/engine.json        engine metadata (brand, schedule, sources)
    Engine/signals.json       signal store from the last listening pass
    Engine/queue.json         content queue
    Engine/publish-log.json   publish log (optional)
    .atelier/memory/themes.md theme dictionary (optional, for card copy)

Writes:
    Engine/dashboard/index.html   the page, data inlined
    Engine/dashboard/data.json    the merged data the page was rendered from

The page is static and self-contained: no network, no secrets, no scripts
beyond the inline renderer. Missing inputs render as empty states.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

STATUS_ORDER = [
    "proposed",
    "approved",
    "draft",
    "ready",
    "blocked",
    "published",
    "rejected",
]


def read_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        sys.exit(f"{path}: invalid JSON ({exc.msg} at line {exc.lineno})")


def parse_themes_md(path: Path) -> dict[str, dict[str, str]]:
    """Pull `| #Hashtag | what | why | fact | tags | intro |` rows from themes.md."""
    themes: dict[str, dict[str, str]] = {}
    if not path.exists():
        return themes
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.startswith("| #"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 2:
            continue
        tag = cells[0]
        themes[tag] = {
            "what": cells[1] if len(cells) > 1 else "",
            "why": cells[2] if len(cells) > 2 else "",
            "fact": cells[3] if len(cells) > 3 else "",
            "tags": cells[4] if len(cells) > 4 else "",
            "intro": cells[5] if len(cells) > 5 else "",
        }
    return themes


def esc(value) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def counts(d: dict | None, keys: list[str]) -> str:
    d = d or {}
    return " · ".join(f"{k} {int(d.get(k, 0))}" for k in keys)


def render_themes(signals: dict, dictionary: dict) -> str:
    themes = signals.get("themes") or []
    if not themes and dictionary:
        themes = [{"hashtag": tag, "mentions": 0, "movement": "quiet"} for tag in dictionary]
    if not themes:
        return '<p class="empty">No themes yet. Add the dictionary to .atelier/memory/themes.md and run the listener.</p>'
    cards = []
    for t in themes:
        tag = t.get("hashtag", "")
        meta = dictionary.get(tag, {})
        movement = t.get("movement", "quiet")
        cards.append(
            f"""
<article class="card theme">
  <header><h3>{esc(tag)}</h3><span class="pill move-{esc(movement)}">{esc(movement)}</span></header>
  <p class="what">{esc(meta.get('what') or t.get('summary') or '')}</p>
  <dl>
    <div><dt>mentions</dt><dd>{esc(t.get('mentions', 0))}</dd></div>
    <div><dt>relevance</dt><dd>{esc(counts(t.get('relevance'), ['high', 'medium', 'low']))}</dd></div>
    <div><dt>sentiment</dt><dd>{esc(counts(t.get('sentiment'), ['supportive', 'neutral', 'sceptical', 'hostile']))}</dd></div>
    <div><dt>intro post</dt><dd>{esc(meta.get('intro') or 'not yet')}</dd></div>
  </dl>
  <p class="summary">{esc(t.get('summary', ''))}</p>
</article>"""
        )
    return '<div class="grid">' + "".join(cards) + "</div>"


def render_signals(signals: dict) -> str:
    rows = signals.get("signals") or []
    if not rows:
        return '<p class="empty">No signals in the last pass. Quiet is a finding: every theme was checked and nothing crossed the relevance bar.</p>'
    out = []
    for s in rows:
        links = "".join(
            f'<li><a href="{esc(e.get("url", ""))}" target="_blank" rel="noopener">{esc(e.get("title") or e.get("url", ""))}</a></li>'
            for e in (s.get("evidence") or [])
        )
        route = s.get("route", "")
        detail = s.get("proposal_id") or s.get("comment_shape") or ""
        out.append(
            f"""
<article class="card signal">
  <header>
    <span class="mono">{esc(s.get('id', ''))}</span>
    <h3>{esc(s.get('theme', ''))}</h3>
    <span class="pill rel-{esc(s.get('relevance', ''))}">{esc(s.get('relevance', ''))}</span>
    <span class="pill sent-{esc(s.get('sentiment', ''))}">{esc(s.get('sentiment', ''))}</span>
  </header>
  <p>{esc(s.get('finding', ''))}</p>
  <ul class="evidence">{links}</ul>
  <footer>
    <span>route: <strong>{esc(route)}</strong> {esc(detail)}</span>
    <span>post by: {esc(s.get('freshness', ''))}</span>
  </footer>
</article>"""
        )
    return "".join(out)


def render_queue(queue: dict) -> str:
    items = queue.get("items") or []
    if not items:
        return '<p class="empty">The queue is empty. Proposals appear here after a listening pass.</p>'
    by_status: dict[str, list] = {}
    for it in items:
        by_status.setdefault(it.get("status", "proposed"), []).append(it)
    sections = []
    for status in STATUS_ORDER + [s for s in by_status if s not in STATUS_ORDER]:
        group = by_status.get(status)
        if not group:
            continue
        rows = []
        for it in group:
            gate = (it.get("claim_gate") or {}).get("status", "pending")
            alpha = it.get("alpha") or {}
            decision = alpha.get("decision") or "awaiting decision"
            platforms = ", ".join((it.get("platforms") or {}).keys())
            rows.append(
                f"""
<tr>
  <td class="mono">{esc(it.get('id', ''))}</td>
  <td>{esc(it.get('theme', ''))}</td>
  <td><strong>{esc(it.get('title', ''))}</strong><br><span class="muted">{esc(it.get('angle', ''))}</span></td>
  <td>{esc(it.get('fact', ''))}</td>
  <td>{esc(platforms)}</td>
  <td>{esc(it.get('slot', ''))}</td>
  <td><span class="pill gate-{esc(gate)}">{esc(gate)}</span></td>
  <td>{esc(decision)}{(' · ' + esc(alpha.get('by'))) if alpha.get('by') else ''}</td>
</tr>"""
            )
        sections.append(
            f"""
<h3 class="status">{esc(status)} <span class="count">{len(group)}</span></h3>
<div class="scroll"><table>
<thead><tr><th>id</th><th>theme</th><th>title / angle</th><th>fact</th><th>platforms</th><th>slot</th><th>claim gate</th><th>alpha</th></tr></thead>
<tbody>{''.join(rows)}</tbody></table></div>"""
        )
    return "".join(sections)


def render_published(log: dict) -> str:
    entries = log.get("entries") or []
    if not entries:
        return '<p class="empty">Nothing published by the engine yet. Website pushes appear here with their URL and approver.</p>'
    rows = "".join(
        f'<tr><td class="mono">{esc(e.get("id", ""))}</td><td>{esc(e.get("target", ""))}</td>'
        f'<td><a href="{esc(e.get("url", ""))}" target="_blank" rel="noopener">{esc(e.get("url", ""))}</a></td>'
        f'<td>{esc(e.get("published_at", ""))}</td><td>{esc(e.get("approved_by", ""))}</td></tr>'
        for e in entries
    )
    return f'<div class="scroll"><table><thead><tr><th>id</th><th>target</th><th>url</th><th>published</th><th>approved by</th></tr></thead><tbody>{rows}</tbody></table></div>'


def render_sources(engine: dict, signals: dict) -> str:
    src = signals.get("sources") or {}
    connected = src.get("connected") or []
    missing = src.get("missing") or []
    mode = src.get("mode") or "unknown"
    listen = engine.get("listening_sources") or []
    publish = engine.get("publishing_targets") or []

    def chip(name: str, state: str) -> str:
        return f'<span class="chip {state}">{esc(name)}</span>'

    parts = [chip(n, "on") for n in connected] + [chip(n, "off") for n in missing]
    if not parts:
        parts = [chip(n, "off") for n in listen]
    pub = [chip(p.get("name", ""), "on" if p.get("connected") else "off") for p in publish]
    return f"""
<div class="sources">
  <div><span class="label">listening</span> {''.join(parts) or '<span class="muted">none configured</span>'} <span class="pill mode">{esc(mode)}</span></div>
  <div><span class="label">publishing</span> {''.join(pub) or '<span class="muted">none configured</span>'}</div>
</div>"""


CSS = """
:root{--bg:#f7f7f5;--panel:#ffffff;--ink:#1f2430;--muted:#5a5f6b;--line:#d7dbe6;--accent:#192c6e;--accent-soft:#eef1f8;--good:#1f7a4d;--warn:#b8952e;--bad:#c3161c;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#111318;--panel:#1a1d24;--ink:#e8eaed;--muted:#a6adbb;--line:#2c313c;--accent:#9db0ee;--accent-soft:#1f2740}}
:root[data-theme="dark"]{--bg:#111318;--panel:#1a1d24;--ink:#e8eaed;--muted:#a6adbb;--line:#2c313c;--accent:#9db0ee;--accent-soft:#1f2740}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
main{max-width:1180px;margin:0 auto;padding:24px 20px 64px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:32px 0 12px;color:var(--accent);text-transform:uppercase;letter-spacing:.06em}
h3{font-size:15px;margin:0}.sub{color:var(--muted);margin:0 0 12px}
.meta{display:flex;flex-wrap:wrap;gap:8px 20px;color:var(--muted);font-size:13px;margin:8px 0}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:16px 0}
.kpi{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px}.kpi b{display:block;font-size:24px;color:var(--accent)}.kpi span{color:var(--muted);font-size:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-bottom:12px}
.card header{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.card .what{color:var(--muted);font-size:13px;margin:4px 0 8px}.card .summary{margin:8px 0 0;font-size:13px}
dl{display:grid;grid-template-columns:1fr;gap:4px;margin:0}dl div{display:flex;justify-content:space-between;gap:12px;font-size:12px}dt{color:var(--muted)}dd{margin:0;text-align:right}
.pill{display:inline-block;border-radius:999px;padding:1px 9px;font-size:11px;border:1px solid var(--line);background:var(--accent-soft);color:var(--ink)}
.move-up,.rel-high,.sent-supportive,.gate-pass,.chip.on{border-color:var(--good);color:var(--good)}
.move-down,.sent-hostile,.gate-blocked,.gate-fail,.chip.off{border-color:var(--bad);color:var(--bad)}
.move-new,.sent-sceptical,.gate-pending,.rel-medium{border-color:var(--warn);color:var(--warn)}
.chip{display:inline-block;border-radius:6px;padding:1px 8px;font-size:12px;border:1px solid var(--line);margin-right:6px;font-family:var(--mono)}
.sources{display:flex;flex-direction:column;gap:6px;margin:8px 0 0}.sources .label{display:inline-block;width:84px;color:var(--muted);font-size:12px}
.mono{font-family:var(--mono);font-size:12px;color:var(--muted)}.muted{color:var(--muted)}
.evidence{margin:6px 0;padding-left:18px;font-size:13px}.evidence a{color:var(--accent)}
.card footer{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:12px;color:var(--muted);margin-top:6px}
.scroll{overflow-x:auto;background:var(--panel);border:1px solid var(--line);border-radius:10px}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{color:var(--muted);font-weight:600;font-size:12px}
h3.status{margin:18px 0 8px;text-transform:capitalize}.count{color:var(--muted);font-weight:400;margin-left:6px}
.empty{color:var(--muted);background:var(--panel);border:1px dashed var(--line);border-radius:10px;padding:14px}
.how{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 18px}.how li{margin:4px 0}
code{font-family:var(--mono);font-size:12px;background:var(--accent-soft);padding:1px 5px;border-radius:4px}
"""


def build(space: Path, out: Path | None) -> Path:
    engine = read_json(space / "Engine" / "engine.json", {})
    signals = read_json(space / "Engine" / "signals.json", {})
    queue = read_json(space / "Engine" / "queue.json", {"items": []})
    log = read_json(space / "Engine" / "publish-log.json", {"entries": []})
    dictionary = parse_themes_md(space / ".atelier" / "memory" / "themes.md")

    items = queue.get("items") or []
    n_moving = sum(1 for t in (signals.get("themes") or []) if t.get("movement") in ("up", "new"))
    n_proposed = sum(1 for i in items if i.get("status") == "proposed")
    n_ready = sum(1 for i in items if i.get("status") == "ready")
    n_blocked = sum(1 for i in items if i.get("status") == "blocked")
    n_published = len(log.get("entries") or [])
    window = signals.get("window") or {}
    brand = engine.get("brand", "Engine")
    title = f"{brand} theme engine"
    rendered_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    page = f"""<title>{esc(title)}</title>
<style>{CSS}</style>
<main>
<h1>{esc(title)}</h1>
<p class="sub">{esc(engine.get('tagline', 'Facts for trust, themes build leadership, partners amplify. LTIN listens.'))}</p>
<div class="meta">
  <span>run <b class="mono">{esc(signals.get('run_id', 'none'))}</b></span>
  <span>window {esc(window.get('from', ''))} → {esc(window.get('to', ''))}</span>
  <span>schedule <code>{esc(engine.get('schedule', {}).get('cron', 'not set'))}</code> {esc(engine.get('schedule', {}).get('label', ''))}</span>
  <span>rendered {esc(rendered_at)}</span>
</div>
{render_sources(engine, signals)}
<div class="kpis">
  <div class="kpi"><b>{n_moving}</b><span>themes moving (up or new)</span></div>
  <div class="kpi"><b>{n_proposed}</b><span>proposals awaiting Alpha</span></div>
  <div class="kpi"><b>{n_ready}</b><span>drafts ready to publish</span></div>
  <div class="kpi"><b>{n_blocked}</b><span>blocked at the claim gate</span></div>
  <div class="kpi"><b>{n_published}</b><span>published by the engine</span></div>
</div>

<h2>Themes</h2>
<p class="sub">Listener signals per theme: mentions, relevance, sentiment. Quiet themes stay on the board.</p>
{render_themes(signals, dictionary)}

<h2>Signals</h2>
<p class="sub">What the listener found this run. Every signal carries evidence, two grades and a route. Nothing here was acted on.</p>
{render_signals(signals)}

<h2>Content queue</h2>
<p class="sub">Beta produces, Alpha decides. Items move proposed → approved → draft → ready → published; the claim gate can block at any step.</p>
{render_queue(queue)}

<h2>Published</h2>
{render_published(log)}

<h2>How to decide</h2>
<div class="how">
<ol>
  <li><strong>Approve a proposal</strong>: in the app, reply to the engine's message naming the proposal id, or set <code>status: approved</code> with <code>alpha.decision</code>, <code>by</code> and <code>at</code> on the item in <code>Engine/queue.json</code>. The next run drafts it.</li>
  <li><strong>Release a ready draft</strong>: set <code>alpha.decision: publish</code> on that item. The next run pushes the website post through the website MCP and records the URL here.</li>
  <li><strong>Reject or park</strong>: set <code>status: rejected</code> with a one-line reason; the listener stops re-proposing the same signal.</li>
</ol>
<p class="muted">Facts (launches, certifications, partners joining) never pass through this queue. They keep their own approval flow and manual release.</p>
</div>
</main>
"""
    out = out or (space / "Engine" / "dashboard" / "index.html")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    (out.parent / "data.json").write_text(
        json.dumps(
            {"engine": engine, "signals": signals, "queue": queue, "publish_log": log, "rendered_at": rendered_at},
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"rendered {out}")
    print(f"themes moving: {n_moving} · proposals awaiting decision: {n_proposed} · blocked: {n_blocked}")
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--space", required=True, help="space root containing Engine/ and .atelier/memory/")
    parser.add_argument("--out", help="output html path (default Engine/dashboard/index.html)")
    args = parser.parse_args()
    space = Path(args.space).expanduser().resolve()
    if not space.is_dir():
        sys.exit(f"space root not found: {space}")
    build(space, Path(args.out).expanduser().resolve() if args.out else None)


if __name__ == "__main__":
    main()

# swarm.skinny.cloud

A public agent-systems laboratory. Each experience inside it is an
evidence-gated, independently reviewable artifact — a scientific instrument,
not a dashboard.

## TRACE — Internet-Contamination Observatory

`/trace` renders a certified public bundle of contamination-lineage evidence:
a sober **forensic evidence artifact** that shows exactly what it can prove and
nothing it cannot.

- **Timeline** — claims ordered strictly by each artifact's *own* external
  timestamp (git author-date / archive / commit), never ingestion time. All
  times UTC, labeled.
- **Evidence graph** — claims are nodes; edges are directed lineage that carry
  the relationship *and its own evidence*. Deterministic layout, inline SVG.
- **Epistemic status is first-class** — every claim is visibly `VERIFIED`,
  `PLAUSIBLE`, `UNRESOLVED`, or `REFUTED`. A `VERIFIED` claim requires
  independent review **and** a valid review timestamp; any violation renders a
  visible **GATE MISMATCH**, never a green badge.
- **Methodology, not accusation** — nothing is a finding until the
  independent-review gate passes.

> The observatory currently renders **sample data** (clearly banner-marked).
> Real certified bundles drop in unchanged — the app renders any bundle that
> satisfies the frozen public data contract, with no code change.

## Architecture

Deliberately minimal, so the guarantees are checkable rather than promised:

- **Purely static, same-origin.** Hand-authored HTML + CSS + ES modules, **zero
  dependencies**, no build step, no framework, no bundler.
- **No backend, no SSR, no API calls, no analytics, no trackers, no CDN, no
  remote fonts.** The browser makes exactly **one** request:
  `fetch('./data/public-bundle.json')` — same-origin, relative.
- A strict **Content-Security-Policy** (`default-src 'none'; … connect-src
  'self'`, no `unsafe-inline`/`unsafe-eval`) turns "we checked" into "the
  browser forbids it."
- Source links open with `rel="noopener noreferrer" referrerpolicy=no-referrer`
  and are the only outbound paths — always user-initiated, never automatic.

## Run it locally

`fetch()` and ES modules require HTTP (not `file://`):

```bash
python3 -m http.server 8080 --directory trace   # then open http://localhost:8080/
```

## License

See repository settings.

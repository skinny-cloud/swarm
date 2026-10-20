/* =============================================================================
   REPRO — application entry (ES module, no bundler, no framework).
   The only network call is loadBundle() (same-origin). All bundle text is set via
   textContent; only https:// URLs ever become links.
   ============================================================================= */

import { loadBundle, AppError } from "./data.js";
import { el, icon, clear, fmtUTC, safeHref, hostOf } from "./util.js";
import { BUNDLE_PATH, VERDICT_META, VERDICTS, NON_CLAIMS, ENTRY_LIMITS } from "./config.js";

const mount = document.getElementById("app");

boot();

async function boot() {
  mount.append(el("div", { class: "skeleton", "aria-hidden": "true" }, [el("div", { class: "skel-card" }), el("div", { class: "skel-card" })]));
  let model;
  try {
    model = await loadBundle();
  } catch (err) {
    clear(mount);
    mount.append(renderMasthead(null), renderError(err));
    return;
  }
  clear(mount);
  mount.append(renderMasthead(model));
  if (model.empty) {
    mount.append(emptyState());
    return;
  }
  mount.append(renderEntries(model));
}

/* ------------------------------------------------------------- masthead --- */
function renderMasthead(model) {
  const head = el("header", { class: "masthead" }, [
    el("div", { class: "eyebrow" }, [
      el("span", { class: "eyebrow__mark", "aria-hidden": "true" }),
      "REPRO: Agent-Harness Reproduction Index · Instrument 02",
    ]),
    el("h1", { "data-testid": "repro-title" }, "Reported agent-harness defects, reproduced on a machine NXTG owns, or not."),
    model && !model.empty ? el("p", { class: "masthead__subject", "data-testid": "repro-subject" }, subjectLine(model)) : null,
    el("p", { class: "masthead__lede" },
      "For a small set of agent-runtime defects already reported on a vendor's public tracker, chosen and " +
      "pre-registered before any probe ran, NXTG tries to reproduce each one on a machine it owns and publishes what " +
      "happened, success or not. Each entry is titled by the invariant it tests, never by the vendor, and " +
      "carries its probe, raw counts per arm, counterfactual, limits and evidence."),
    el("div", { class: "disclaimer", role: "note", "data-testid": "non-claims" }, [
      icon("shield", 18),
      el("span", {}, [el("strong", {}, "Limits. "), NON_CLAIMS]),
    ]),
  ]);

  if (model && !model.empty) {
    head.append(renderProvenance(model));
    if (model.index.limits) {
      head.append(el("div", { class: "disclaimer disclaimer--muted" }, [
        icon("info", 18),
        el("span", {}, [el("strong", {}, "Edition note: "), model.index.limits]),
      ]));
    }
    if (model.warnings.length) head.append(renderIntegrity(model.warnings));
  }
  return head;
}

function subjectLine(m) {
  const n = m.entries.length;
  const parts = [];
  if (m.index.edition) parts.push(`Edition ${m.index.edition}`);
  parts.push(`${n} ${n === 1 ? "entry" : "entries"}`);
  if (m.index.run_window_closed_utc) parts.push(`run window closed ${fmtUTC(m.index.run_window_closed_utc, { withTime: true })} UTC`);
  return parts.join(" · ");
}

function renderProvenance(m) {
  const method = safeHref(m.index.method_url);
  const doi = m.index.doi ? `https://doi.org/${m.index.doi}` : null;
  return el("div", { class: "provenance" }, [
    // method_sha256 commits to the as-run method; the link may be a redacted public
    // copy, which hashes differently. Label both so a reader checks the right thing.
    el("span", {}, [
      "as-run method sha256 ",
      el("span", { class: "mono", title: m.index.method_sha256 || "" }, (m.index.method_sha256 || "?").slice(0, 12) + "…"),
      method ? [" · ", extLink(method, "public copy of the method")] : null,
    ]),
    el("span", {}, doi && safeHref(doi)
      ? ["evidence ", extLink(safeHref(doi), `doi:${m.index.doi}`)]
      : "evidence archive DOI pending"),
    el("span", {}, [
      "bundle generated ",
      el("span", { class: "mono" }, fmtUTC(m.generated_utc, { withTime: true })),
      " UTC · schema ", m.schema_version ?? "?",
    ]),
  ]);
}

/* -------------------------------------------------------------- entries --- */
function renderEntries(m) {
  const section = el("section", { class: "entries", "aria-labelledby": "entries-h" }, [
    el("div", { class: "section-head" }, [
      el("h2", { id: "entries-h" }, "Entries"),
      el("p", {}, "In the pre-registered order. Every attempt is listed, including those that did not reproduce or did not finish."),
    ]),
    renderTally(m),
  ]);
  const list = el("ol", { class: "entry-list", "data-testid": "entry-list" });
  m.entries.forEach((e) => list.append(el("li", {}, [renderEntry(e, m)])));
  section.append(list);
  return section;
}

function renderTally(m) {
  const items = [...VERDICTS, "UNKNOWN"].filter((v) => m.tally[v]).map((v) => {
    const meta = VERDICT_META[v];
    return el("span", { class: "tally__item" }, [
      el("span", { class: "mono" }, String(m.tally[v])), " ", (meta ? meta.label : "unrecognised verdict").toLowerCase(),
    ]);
  });
  const row = el("p", { class: "tally", "data-testid": "tally" });
  items.forEach((it, i) => { if (i) row.append(" · "); row.append(it); });
  return row;
}

function verdictBadge(v) {
  const meta = VERDICT_META[v];
  return el("span", {
    class: `verdict verdict--${meta ? meta.klass : "unknown"}`,
    title: meta ? meta.note : "Not a pre-registered verdict.",
    "data-testid": "verdict",
  }, meta ? meta.label : "Unrecognised verdict");
}

function renderEntry(e, m) {
  const src = safeHref(e.source_url);
  const card = el("article", { class: "entry", "data-verdict": e._verdict, "data-testid": "entry", id: `entry-${e.id}` }, [
    el("div", { class: "entry__top" }, [el("span", { class: "entry__id mono" }, e.id || "—"), verdictBadge(e._verdict)]),
    el("h3", { class: "entry__title" }, e.invariant || "(no invariant given)"),
    el("p", { class: "entry__meta" }, [
      e.vendor || "—",
      " · ",
      src ? extLink(src, shortSource(src)) : el("span", { class: "mono" }, e.source_url || "no source"),
      " · ",
      el("span", { class: "mono" }, e.affected_version || "?"),
      e.affected_version_date ? ` (pinned ${fmtUTC(e.affected_version_date)})` : null,
      e.supersession_version ? [" · later release checked: ", el("span", { class: "mono" }, e.supersession_version)] : null,
    ]),
  ]);

  if (e.verdict_reason) {
    card.append(el("div", { class: "disclaimer disclaimer--muted entry__reason" }, [
      icon("info", 16),
      el("span", {}, [el("strong", {}, "Why: "), e.verdict_reason]),
    ]));
  }

  card.append(renderArms(e));
  card.append(field("Raw result", e.raw_result));

  const details = el("details", { class: "entry__details" }, [el("summary", {}, "Method, limits and provenance")]);
  const dl = el("dl", { class: "dl" });
  addDef(dl, "Probe", e.probe);
  addDef(dl, "Counterfactual", e.counterfactual);
  addDef(dl, "Detection limits", e.detection_limits);
  addDef(dl, "Uncertainty", e.uncertainty);
  addDef(dl, "Historical supersession", e.supersession);
  if (e.run_utc.length) addDef(dl, "Runs (UTC)", e.run_utc.map((t) => fmtUTC(t, { withTime: true })).join(", "), true);
  addDef(dl, "Host", e.host);
  addDef(dl, "Container image", e.image_digest, true);
  addDef(dl, "Probe commit", e.probe_commit, true);
  addDef(dl, "Spend", e.spend);
  const doiHref = m.index.doi ? safeHref(`https://doi.org/${m.index.doi}`) : null;
  dl.append(el("dt", {}, "Evidence"), el("dd", {}, [
    doiHref ? extLink(doiHref, `doi:${m.index.doi}`) : "archive DOI pending",
    " → ", el("span", { class: "mono" }, e.evidence_path || "?"),
  ]));
  details.append(dl);
  card.append(details);

  card.append(el("p", { class: "entry__limits" }, ENTRY_LIMITS));
  return card;
}

function renderArms(e) {
  if (!e.arms.length) {
    return el("p", { class: "entry__noarms" }, "No trial ran, so there are no counts.");
  }
  const table = el("table", { class: "arms" }, [
    el("caption", { class: "visually-hidden" }, `Raw counts per arm for entry ${e.id}`),
    el("thead", {}, [el("tr", {}, ["Arm", "Version", "Role", "Valid", "Invalid", "Violations", "Threshold"].map((h) =>
      el("th", { scope: "col", class: ["Valid", "Invalid", "Violations"].includes(h) ? "num" : null }, h)))]),
  ]);
  const body = el("tbody");
  e.arms.forEach((a) => {
    body.append(el("tr", {}, [
      el("td", {}, [a.label || "—", a.notes ? el("div", { class: "arms__note" }, a.notes) : null]),
      el("td", { class: "mono" }, a.version || "—"),
      el("td", {}, a.role || "—"),
      el("td", { class: "mono num" }, String(a.valid ?? "—")),
      el("td", { class: "mono num" }, String(a.invalid ?? "—")),
      el("td", { class: "mono num" }, String(a.violations ?? "—")),
      el("td", { class: "mono" }, a.threshold || "—"),
    ]));
  });
  table.append(body);
  return el("div", { class: "arms-wrap" }, [table]);
}

/* -------------------------------------------------------------- helpers --- */
function field(label, value) {
  if (!value) return null;
  return el("div", { class: "entry__field" }, [el("span", { class: "entry__label" }, label), el("p", {}, value)]);
}

function addDef(dl, term, value, mono = false) {
  if (value === null || value === undefined || value === "") return;
  dl.append(el("dt", {}, term), el("dd", mono ? { class: "mono" } : {}, value));
}

function extLink(href, text) {
  return el("a", { href, rel: "noopener noreferrer", referrerpolicy: "no-referrer", target: "_blank" }, [text, " ", icon("link", 12)]);
}

function shortSource(href) {
  try {
    const u = new URL(href);
    return `${hostOf(href)}${u.pathname}`;
  } catch { return href; }
}

function renderIntegrity(warnings) {
  const list = el("ul", { "data-testid": "integrity-list" });
  warnings.forEach((w) => list.append(el("li", {}, w)));
  return el("div", { class: "integrity", role: "alert", "data-testid": "integrity-notice" }, [
    icon("alert", 18),
    el("div", {}, [el("strong", {}, `${warnings.length} integrity notice${warnings.length > 1 ? "s" : ""}, shown, not hidden:`), list]),
  ]);
}

function emptyState() {
  return el("div", { class: "state", "data-testid": "empty-state" }, [
    icon("empty", 32),
    el("h3", {}, "No entries published yet"),
    el("p", {}, "Entries appear here only after independent review and once their evidence archive has a citable DOI."),
  ]);
}

function renderError(err) {
  const isFetch = err instanceof AppError && (err.kind === "fetch-failed" || err.kind === "http");
  return el("div", { class: "state state--error", role: "alert", "data-testid": "load-error" }, [
    icon("alert", 32),
    el("h3", {}, "Could not load the index"),
    el("p", {}, [
      "This page reads one same-origin file: ", el("code", {}, BUNDLE_PATH), ". ",
      isFetch ? "Serve the folder over HTTP (file:// blocks module and fetch access)." : `The file loaded but could not be read: ${err.detail || err.message}.`,
    ]),
  ]);
}

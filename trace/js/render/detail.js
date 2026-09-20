/* Detail drawer content — a claim or an edge, rendered against the frozen
   schema fields only. Shows the VERIFIED review gate explicitly, the full
   provenance chronology (UTC, labeled), linked sources and lineage. */

import { el, icon, fmtUTC, hostOf, clear } from "../util.js";
import {
  statusBadge, tierBadge, reviewBadge, classBadge, redactionBadge,
  edgeTypeLabel, sourceClassMeta,
} from "../components.js";
import { TIER_META } from "../config.js";

export function fillDetail(refs, kind, id, model, onOpen) {
  clear(refs.body);
  if (kind === "claim") fillClaim(refs, model.claimById.get(id), model, onOpen);
  else fillEdge(refs, model.edgeById.get(id), model, onOpen);
}

/* ------------------------------------------------------------------ claim -- */
function fillClaim(refs, c, model, onOpen) {
  if (!c) return missing(refs, "claim");
  refs.kicker.textContent = `Claim · ${c.public_id}`;
  refs.title.textContent = c.title || "(untitled claim)";

  refs.body.append(
    metaRow([statusBadge(c), tierBadge(c.tier), classBadge(c.artifact_class), reviewBadge(c.review_state), redactionBadge(c.redaction_state)]),
    gateIndicator(c),
    block("Evidence summary", el("p", { class: "detail-summary", "data-testid": "detail-summary" }, c.evidence_summary || "—")),
    c.tier ? tierNote(c.tier) : null,
    (c.redaction_state && c.redaction_state !== "none")
      ? block("Redaction", el("p", { class: "legend-desc" }, `${c.redaction_state}${c.redaction_reason ? " — " + c.redaction_reason : ""}`))
      : null,
    chronologyBlock(c, true),
    sourcesBlock(c.source_ids, model),
    lineageBlock(c, model, onOpen),
    relatedBlock(c, model, onOpen),
  );
}

/* ------------------------------------------------------------------- edge -- */
function fillEdge(refs, e, model, onOpen) {
  if (!e) return missing(refs, "edge");
  refs.kicker.textContent = `Lineage edge · ${e.public_id}`;
  refs.title.textContent = edgeTypeLabel(e.edge_type);

  const from = model.claimById.get(e.from_id);
  const to = model.claimById.get(e.to_id);

  refs.body.append(
    metaRow([statusBadge(e), reviewBadge(e.review_state), el("span", { class: "badge badge--class" }, e.edge_type || "?")]),
    gateIndicator(e),
    block("Direction", el("div", { class: "link-list" }, [
      endpointBtn("FROM", e.from_id, from, onOpen),
      el("div", { class: "lineage__arrow", "aria-hidden": "true" }, [icon("arrow", 18)]),
      endpointBtn("TO", e.to_id, to, onOpen),
    ])),
    block("Evidence summary", el("p", { class: "detail-summary", "data-testid": "detail-summary" }, e.evidence_summary || "—")),
    methodBlock(e),
    chronologyBlock(e, false),
    sourcesBlock(e.source_ids, model),
  );
}

/* ----------------------------------------------------------------- pieces -- */
function metaRow(badges) {
  return el("div", { class: "card__meta" }, badges.filter(Boolean));
}

function block(heading, ...content) {
  return el("section", { class: "detail-block" }, [el("h3", {}, heading), ...content.filter(Boolean)]);
}

function gateIndicator(obj) {
  const gate = obj._gate;
  let cls, ic, head, body;
  if (gate === "pass") {
    cls = "gate--pass"; ic = "check"; head = "Independent-review gate: cleared";
    body = "Independently reviewed with a recorded verification time.";
  } else if (gate === "mismatch") {
    cls = "gate--mismatch"; ic = "alert"; head = "GATE MISMATCH";
    body = "Marked VERIFIED but the contract requires review_state=independently_reviewed and a verified_time. This bundle violates its own gate — surfaced, not hidden.";
  } else {
    cls = "gate--pending"; ic = "clock"; head = "Independent-review gate: not yet cleared";
    body = `Review state is "${obj.review_state || "unset"}". A claim becomes VERIFIED only after independent review with a non-derivative source.`;
  }
  return el("div", { class: `gate ${cls}`, role: "note", "data-testid": "gate-indicator", "data-gate": gate }, [
    icon(ic, 18),
    el("div", {}, [el("b", {}, head), " ", body]),
  ]);
}

function tierNote(tier) {
  const meta = TIER_META[tier];
  if (!meta) return null;
  return el("div", { class: `gate gate--pending`, "data-testid": "tier-note" }, [
    icon("info", 18),
    el("div", {}, [el("b", {}, `Tier ${tier}. `), meta.desc]),
  ]);
}

const CHRONO_FIELDS = [
  { key: "first_seen_external", label: "first_seen_external", req: true },
  { key: "occurrence_time", label: "occurrence_time" },
  { key: "published_time", label: "published_time" },
  { key: "discovered_time", label: "discovered_time" },
  { key: "verified_time", label: "verified_time" },
];

function chronologyBlock(obj, isClaim) {
  const fields = isClaim ? CHRONO_FIELDS : CHRONO_FIELDS.filter((f) => f.key === "first_seen_external" || f.key === "verified_time");
  const rows = el("div", { class: "chrono", "data-testid": "chronology" });
  let any = false;
  for (const f of fields) {
    const v = obj[f.key];
    if (!v) continue;
    any = true;
    rows.append(el("div", { class: "chrono-row" }, [
      el("div", { class: "chrono-key" }, [f.label, f.req ? el("span", { class: "req" }, " *") : null].filter(Boolean)),
      el("div", { class: "chrono-val" }, [fmtUTC(v, { withTime: true }), " UTC"]),
    ]));
  }
  if (!any) rows.append(el("p", { class: "legend-desc" }, "No timestamps recorded."));
  return block("Provenance chronology", rows,
    el("p", { class: "legend-desc" }, "* first_seen_external is the artifact's own external timestamp — never ingestion time."));
}

function methodBlock(e) {
  const dl = el("dl", { class: "dl" });
  if (e.method) dl.append(el("dt", {}, "method"), el("dd", { class: "mono" }, e.method));
  if (typeof e.confidence === "number") dl.append(el("dt", {}, "confidence"), el("dd", { class: "mono" }, String(e.confidence)));
  if (!dl.children.length) return null;
  return block("Method", dl);
}

function sourcesBlock(ids, model) {
  const list = el("div", { class: "link-list", "data-testid": "detail-sources" });
  (ids || []).forEach((sid) => {
    const src = model.sourceById.get(sid);
    if (!src) {
      list.append(el("div", { class: "src-link" }, [icon("alert", 16), el("div", { class: "src-link__body" }, [el("div", { class: "src-link__label" }, `${sid} — not found in sources[]`)])]));
      return;
    }
    const meta = sourceClassMeta(src.source_class);
    list.append(el("div", { class: "src-link" }, [
      icon("link", 16),
      el("div", { class: "src-link__body" }, [
        el("div", { class: "src-link__label" }, [
          src.label + "  ",
          el("span", { class: `class-pill ${src.source_class || ""}` }, meta.label),
        ]),
        // rel=noopener noreferrer + referrerpolicy: never leak this origin.
        el("a", { class: "src-link__url mono", href: src.public_url, target: "_blank", rel: "noopener noreferrer", referrerpolicy: "no-referrer", "data-testid": "source-link" },
          `${src.public_url}  (${hostOf(src.public_url)})`),
      ]),
    ]));
  });
  if (!list.children.length) list.append(el("p", { class: "legend-desc" }, "No sources listed."));
  return block("Provenance — sources", list);
}

function lineageBlock(claim, model, onOpen) {
  const related = model.edges.filter((e) => e.from_id === claim.public_id || e.to_id === claim.public_id);
  if (!related.length) return block("Lineage", el("p", { class: "legend-desc" }, "No edges reference this claim."));
  const list = el("div", { class: "link-list" });
  related.forEach((e) => list.append(edgeButton(e, claim.public_id, model, onOpen)));
  return block(`Lineage (${related.length})`, list);
}

function relatedBlock(claim, model, onOpen) {
  const nodes = (claim.related_node_ids || []);
  const edges = (claim.related_edge_ids || []);
  if (!nodes.length && !edges.length) return null;
  const list = el("div", { class: "link-list" });
  nodes.forEach((id) => {
    const c = model.claimById.get(id);
    list.append(el("button", { type: "button", class: "link-item", "data-testid": "related-claim", onclick: () => onOpen("claim", id) }, [
      el("span", { class: "link-item__type" }, "related claim"),
      el("div", { class: "link-item__dir mono" }, c ? c.title : `${id} (unresolved)`),
    ]));
  });
  edges.forEach((id) => {
    const e = model.edgeById.get(id);
    list.append(el("button", { type: "button", class: "link-item", "data-testid": "related-edge", onclick: () => onOpen("edge", id) }, [
      el("span", { class: "link-item__type" }, "related edge"),
      el("div", { class: "link-item__dir mono" }, e ? edgeTypeLabel(e.edge_type) : `${id} (unresolved)`),
    ]));
  });
  return block("Cross-references", list);
}

function edgeButton(e, selfId, model, onOpen) {
  const from = model.claimById.get(e.from_id);
  const to = model.claimById.get(e.to_id);
  const dir = `${labelOrId(from, e.from_id)}  →  ${labelOrId(to, e.to_id)}`;
  return el("button", { type: "button", class: "link-item", "data-testid": "lineage-edge", onclick: () => onOpen("edge", e.public_id) }, [
    el("span", { class: "link-item__type" }, edgeTypeLabel(e.edge_type)),
    el("div", { class: "link-item__dir mono" }, dir),
    el("div", { class: "link-item__sum" }, e.evidence_summary || ""),
    el("div", { class: "link-item__meta" }, [statusBadge(e), reviewBadge(e.review_state)]),
  ]);
}

function endpointBtn(role, id, claim, onOpen) {
  return el("button", { type: "button", class: "link-item", "data-testid": "endpoint", onclick: () => claim && onOpen("claim", id), disabled: !claim }, [
    el("span", { class: "link-item__type" }, role),
    el("div", { class: "link-item__dir mono" }, claim ? claim.title : `${id} — dangling (no such node)`),
  ]);
}

function labelOrId(claim, id) { return claim ? truncate(claim.title, 34) : `${id} (dangling)`; }
function truncate(s, n) { s = s || ""; return s.length > n ? s.slice(0, n - 1) + "…" : s; }

function missing(refs, kind) {
  refs.kicker.textContent = kind;
  refs.title.textContent = "Not found";
  refs.body.append(el("div", { class: "state state--error" }, [icon("alert", 28), el("h3", {}, `This ${kind} id is not in the bundle`), el("p", {}, "The reference may be stale or the bundle may have changed.")]));
}

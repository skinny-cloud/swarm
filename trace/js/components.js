/* =============================================================================
   TRACE Observatory — shared UI atoms (badges/chips), tokens-driven
   ============================================================================= */

import { el } from "./util.js";
import { STATUS_META, TIER_META, REVIEW_META, EDGE_TYPE_META, SOURCE_CLASS_META } from "./config.js";

/* DOM-free badge decision (unit-testable in node). A VERIFIED status only earns
   the reassuring green "Verified" presentation when its independent-review gate
   passed (record._gate === "pass"); a VERIFIED record whose gate is a mismatch
   is DOWNGRADED to a visible "gate failed" badge — never the green badge/tooltip.
   Accepts a claim/edge record (preferred, carries _gate) or a bare status string. */
export function badgeMeta(record) {
  const isObj = record && typeof record === "object";
  const status = isObj ? record.status : record;
  const gate = isObj ? record._gate : undefined;
  const meta = STATUS_META[status];
  if (!meta) {
    return { known: false, klass: "unknown", label: status || "unknown status", note: `unrecognized status`, gate };
  }
  if (status === "VERIFIED" && gate === "mismatch") {
    return {
      known: true, klass: "mismatch", label: "Verified — gate failed", gate,
      note: "Marked VERIFIED but the independent-review gate is not satisfied " +
            "(needs review_state=independently_reviewed and a valid verified_time). " +
            "This is not a verified finding.",
    };
  }
  return { known: true, klass: meta.klass, label: meta.label, note: meta.note, gate };
}

export function statusBadge(record) {
  const m = badgeMeta(record);
  if (!m.known) return rawChip(m.label, "status");
  return el("span", {
    class: `badge badge--${m.klass}`, title: m.note,
    "data-testid": "status-badge", "data-gate": m.gate || "",
  }, [
    el("span", { class: "badge__dot", "aria-hidden": "true" }),
    m.label,
  ]);
}

export function tierBadge(tier) {
  if (!tier) return null;
  const meta = TIER_META[tier];
  const cls = (tier || "").toLowerCase();
  return el("span", {
    class: "badge badge--tier",
    title: meta ? meta.desc : `Unknown tier: ${tier}`,
    "data-testid": "tier-badge",
  }, [
    el("span", { class: `badge__dot ${cls}`, "aria-hidden": "true" }),
    meta ? meta.label : tier,
  ]);
}

export function reviewBadge(review) {
  const meta = REVIEW_META[review];
  return el("span", { class: "badge badge--review", "data-testid": "review-badge" },
    meta ? meta.label : (review || "unknown review state"));
}

export function classBadge(artifactClass) {
  if (!artifactClass) return null;
  return el("span", { class: "badge badge--class", title: "artifact_class" }, artifactClass.replace(/_/g, " "));
}

export function redactionBadge(state) {
  if (!state || state === "none") return null;
  return el("span", { class: "badge badge--redaction", title: "redaction_state" }, `redacted: ${state}`);
}

export function edgeTypeLabel(type) {
  return EDGE_TYPE_META[type] || (type ? type.replace(/_/g, " ").toLowerCase() : "related to");
}

export function sourceClassMeta(cls) {
  return SOURCE_CLASS_META[cls] || { label: cls || "unknown", desc: "" };
}

/* Neutral raw-value chip for values outside the known enums. */
export function rawChip(value, kind) {
  return el("span", { class: "badge badge--unknown", title: `unrecognized ${kind}` }, value);
}

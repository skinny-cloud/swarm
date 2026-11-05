/* Masthead: what TRACE is, the evidence standard as a lineage bar, the
   prominent disclaimer, generation provenance, and any integrity warnings.
   No inline styles — CSP forbids them and so does the design system. */

import { el, icon, fmtUTC } from "../util.js";
import { EVIDENCE_STANDARD, TRACE_SUBJECT } from "../config.js";

export function renderHeader(mount, model) {
  const head = el("header", { class: "masthead" }, [
    el("div", { class: "eyebrow" }, [
      el("span", { class: "eyebrow__mark", "aria-hidden": "true" }),
      `TRACE — Internet Contamination Observatory · ${TRACE_SUBJECT.label} of ${TRACE_SUBJECT.total}`,
    ]),
    el("h1", { "data-testid": "trace-title" }, TRACE_SUBJECT.title),
    el("p", { class: "masthead__subject", "data-testid": "trace-subject" }, TRACE_SUBJECT.scope),
    el("p", { class: "masthead__lede" }, [
      "A ", el("span", { class: "accent" }, "methodology"), " for tracing how artifacts spread — not an accusation. ",
      "TRACE traces lineage between a disclosed origin artifact and the candidates that appear " +
      "downstream across the public internet. Every claim is a node, every edge is a sourced, " +
      "reviewable statement about descent. This trace renders a certified public bundle of that " +
      "evidence — the three planes (claims, lineage edges, provenance) kept deliberately separate.",
    ]),

    renderStandard(),
    renderDisclaimer(),

    el("div", { class: "provenance" }, [
      el("span", {}, [
        "bundle generated ",
        el("span", { class: "mono" }, fmtUTC(model.generated_utc, { withTime: true })),
        " UTC",
      ]),
      el("span", { class: "mono" },
        `schema ${model.schema_version ?? "?"}  ·  ${model.counts.claims} claims · ${model.counts.edges} edges · ${model.counts.sources} sources`),
    ]),
  ]);

  if (model.note) {
    head.append(
      el("div", { class: "disclaimer disclaimer--muted" }, [
        icon("info", 18),
        el("span", {}, [el("strong", {}, "Bundle note: "), model.note]),
      ])
    );
  }

  if (model.warnings.length) head.append(renderIntegrity(model.warnings));

  mount.append(head);
}

function renderStandard() {
  const lineage = el("div", { class: "lineage" });
  EVIDENCE_STANDARD.forEach((step, i) => {
    lineage.append(
      el("div", { class: "lineage__step" }, [
        el("span", { class: "lineage__key" }, step.key),
        el("span", { class: "lineage__text" }, step.text),
      ])
    );
    if (i < EVIDENCE_STANDARD.length - 1) {
      lineage.append(el("div", { class: "lineage__arrow", "aria-hidden": "true" }, [icon("arrow", 20)]));
    }
  });

  return el("section", { class: "standard", "aria-label": "Evidence standard" }, [
    el("div", { class: "standard__label" }, "The evidence standard — a claim earns lineage only by clearing every step"),
    lineage,
  ]);
}

function renderDisclaimer() {
  return el("div", { class: "disclaimer", role: "note", "data-testid": "disclaimer" }, [
    icon("shield", 18),
    el("span", {}, [
      el("strong", {}, "Methodology, not accusation. "),
      "Nothing here is a finding until the independent-review gate passes: a VERIFIED status requires " +
      "an independent review and a non-derivative source. Statuses below are explicit epistemic states, " +
      "not conclusions.",
    ]),
  ]);
}

function renderIntegrity(warnings) {
  const list = el("ul", { "data-testid": "integrity-list" });
  warnings.forEach((w) => list.append(el("li", {}, w)));
  return el("div", { class: "integrity", role: "alert", "data-testid": "integrity-notice" }, [
    icon("alert", 18),
    el("div", {}, [
      el("strong", {}, `${warnings.length} integrity notice${warnings.length > 1 ? "s" : ""} — surfaced, not hidden:`),
      list,
    ]),
  ]);
}

/* Timeline view — claims ordered strictly by first_seen_external (the artifact's
   OWN external timestamp, never ingestion time). Each card opens the detail
   drawer. UTC is explicit. */

import { el, icon, fmtUTC, clear } from "../util.js";
import { statusBadge, tierBadge, classBadge, redactionBadge } from "../components.js";

export function renderTimeline(mount, model, onOpen) {
  clear(mount);

  if (!model.timeline.length) {
    mount.append(emptyState("No claims in this bundle", "The claims plane is empty. When a bundle carries claims, they appear here ordered by first-seen."));
    return;
  }

  mount.append(
    el("div", { class: "section-head" }, [
      el("h2", {}, "Contamination timeline"),
      el("p", {}, "Ordered by first-seen-external — each artifact's own external timestamp (git author-date, Wayback, or HF commit), never ingestion time. All times UTC."),
    ])
  );

  const list = el("ol", { class: "timeline", "data-testid": "timeline" });
  model.timeline.forEach((c, i) => {
    const item = el("li", { class: "tl-item", dataset: { status: c.status || "", gate: c._gate || "" } });

    const card = el("button", {
      type: "button", class: "card tl-card",
      "data-testid": "timeline-card",
      "data-public-id": c.public_id,
      "aria-label": `Open claim: ${c.title}`,
      onclick: () => onOpen("claim", c.public_id),
    }, [
      el("div", { class: "tl-time" }, [
        icon("clock", 13),
        fmtUTC(c.first_seen_external, { withTime: false }),
        el("span", { class: "utc-tag" }, "UTC"),
      ]),
      el("div", { class: "card__title" }, c.title || "(untitled claim)"),
      el("div", { class: "card__meta" }, [
        statusBadge(c),
        tierBadge(c.tier),
        classBadge(c.artifact_class),
        redactionBadge(c.redaction_state),
      ].filter(Boolean)),
      el("div", { class: "card__summary" }, c.evidence_summary || ""),
      el("div", { class: "card__foot" }, [
        el("span", { class: "mono" }, c.public_id),
        el("span", { class: "chevron" }, [icon("chevron", 14)]),
      ]),
    ]);

    // Animation stagger via inline-safe CSS variable is disallowed (CSP); use a
    // data attribute the stylesheet keys off instead. Cap the stagger index.
    item.dataset.i = String(Math.min(i, 12));
    item.append(card, el("span", { class: "tl-node", "aria-hidden": "true" }));
    list.append(item);
  });

  mount.append(list);
}

function emptyState(title, body) {
  return el("div", { class: "state", "data-testid": "empty-timeline" }, [
    icon("empty", 32), el("h3", {}, title), el("p", {}, body),
  ]);
}

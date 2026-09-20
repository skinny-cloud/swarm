/* Source ledger + legends (tier / status / source-class / edge-type).
   The tier legend is honest: T2 has no descriptor in the public contract, so
   it is shown as undefined rather than invented. */

import { el, icon, hostOf, clear } from "../util.js";
import { sourceClassMeta } from "../components.js";
import { STATUS_META, TIER_META, SOURCE_CLASS_META, EDGE_TYPE_META } from "../config.js";

export function renderLedger(mount, model) {
  clear(mount);

  mount.append(
    el("div", { class: "section-head" }, [
      el("h2", {}, "Source ledger"),
      el("p", {}, "Every source backing a claim or edge, with its evidentiary class. Derivative references are discovery aids only — never the sole backing of a VERIFIED claim."),
    ])
  );

  mount.append(model.sources.length ? sourceTable(model) : emptyState());

  mount.append(el("div", { class: "legends" }, [
    tierLegend(),
    statusLegend(),
    sourceClassLegend(),
    edgeTypeLegend(),
  ]));
}

function sourceTable(model) {
  const tbody = el("tbody");
  model.sources.forEach((src) => {
    const meta = sourceClassMeta(src.source_class);
    tbody.append(el("tr", { "data-testid": "ledger-row" }, [
      el("td", { class: "src-id" }, src.source_id),
      el("td", {}, src.label || "—"),
      el("td", {}, el("span", { class: `class-pill ${src.source_class || ""}`, title: meta.desc }, meta.label)),
      el("td", {}, [
        el("a", { href: src.public_url, target: "_blank", rel: "noopener noreferrer", referrerpolicy: "no-referrer", "data-testid": "source-link" }, src.public_url),
        el("div", { class: "src-host" }, hostOf(src.public_url)),
      ]),
    ]));
  });

  return el("table", { class: "ledger", "data-testid": "source-ledger" }, [
    el("caption", {}, `${model.sources.length} source${model.sources.length === 1 ? "" : "s"}`),
    el("thead", {}, el("tr", {}, [
      el("th", { scope: "col" }, "id"),
      el("th", { scope: "col" }, "label"),
      el("th", { scope: "col" }, "class"),
      el("th", { scope: "col" }, "public url"),
    ])),
    tbody,
  ]);
}

function legendCard(title, rows) {
  return el("div", { class: "legend-card" }, [el("h3", {}, title), ...rows]);
}

function tierLegend() {
  const rows = Object.entries(TIER_META).map(([k, m]) =>
    el("div", { class: "legend-row" }, [
      el("span", { class: "legend-key" }, el("span", { class: "badge badge--tier" }, [el("span", { class: `badge__dot ${k.toLowerCase()}` }), k])),
      el("div", { class: `legend-desc ${m.defined ? "" : "undefined"}` }, m.desc),
    ])
  );
  return legendCard("Tier — evidentiary proximity", rows);
}

function statusLegend() {
  const rows = Object.entries(STATUS_META).map(([k, m]) =>
    el("div", { class: "legend-row" }, [
      el("span", { class: "legend-key" }, el("span", { class: `badge badge--${m.klass}` }, [el("span", { class: "badge__dot" }), m.label])),
      el("div", { class: "legend-desc" }, m.note),
    ])
  );
  return legendCard("Status — epistemic state", rows);
}

function sourceClassLegend() {
  const rows = Object.entries(SOURCE_CLASS_META).map(([k, m]) =>
    el("div", { class: "legend-row" }, [
      el("span", { class: "legend-key" }, el("span", { class: `class-pill ${k}` }, m.label)),
      el("div", { class: "legend-desc" }, m.desc),
    ])
  );
  return legendCard("Source class", rows);
}

function edgeTypeLegend() {
  const rows = Object.entries(EDGE_TYPE_META).map(([k, label]) =>
    el("div", { class: "legend-row" }, [
      el("span", { class: "legend-key" }, el("span", { class: "badge badge--class" }, label)),
      el("div", { class: "legend-desc mono" }, k),
    ])
  );
  return legendCard("Edge types", rows);
}

function emptyState() {
  return el("div", { class: "state", "data-testid": "empty-ledger" }, [
    icon("ledger", 32), el("h3", {}, "No sources listed"), el("p", {}, "The provenance plane is empty in this bundle."),
  ]);
}

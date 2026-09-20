/* Evidence graph — claims are nodes, edges are directed lineage (from_id → to_id).
   Deterministic layout: x = chronological rank (first_seen_external), not physics.
   Nodes and edges are keyboard-reachable; every edge's evidence_summary is also
   rendered as text below the graph (never tooltip-only). No external libraries. */

import { el, icon, fmtUTC, clear } from "../util.js";
import { edgeTypeLabel, statusBadge } from "../components.js";

const NS = "http://www.w3.org/2000/svg";
function s(tag, attrs = {}, children = []) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) node.append(c.nodeType ? c : document.createTextNode(String(c)));
  return node;
}

const M = { top: 48, bottom: 40, left: 60, right: 60 };
const COL = 210;         // horizontal spacing between chronological columns
const LANE = 74;         // vertical spacing between lanes
const R = 9;             // node radius

export function renderGraph(mount, model, onOpen) {
  clear(mount);

  mount.append(
    el("div", { class: "section-head" }, [
      el("h2", {}, "Evidence graph"),
      el("p", {}, "Claims are nodes; edges are directed, sourced lineage statements (from → to). Layout is chronological (left = earlier first-seen), not force-directed. Each edge is itself reviewable evidence — its summary is listed in full below."),
    ])
  );

  if (!model.claims.length) {
    mount.append(emptyState("No graph to draw", "The claims plane is empty, so there are no nodes to place."));
    return;
  }

  // Chronological rank per claim (columns). Ties keep bundle order.
  const rank = new Map();
  model.timeline.forEach((c, i) => rank.set(c.public_id, i));

  // Assign lanes round-robin so same-column ties don't overlap.
  const laneCount = Math.min(3, Math.max(1, model.claims.length));
  const pos = new Map();
  model.timeline.forEach((c, i) => {
    const col = rank.get(c.public_id);
    const lane = i % laneCount;
    pos.set(c.public_id, {
      x: M.left + col * COL,
      y: M.top + R + lane * LANE + LANE / 2,
    });
  });

  const cols = model.timeline.length;
  const width = Math.max(320, M.left + Math.max(0, cols - 1) * COL + M.right + 40);
  const height = M.top + laneCount * LANE + M.bottom;

  const svg = s("svg", {
    class: "graph-svg", viewBox: `0 0 ${width} ${height}`,
    role: "group", "aria-label": "Evidence lineage graph",
    "data-testid": "graph-svg",
  });

  // Arrowhead marker (self-contained). Colour via CSS class — a `fill` XML
  // attribute cannot resolve a CSS custom property.
  const defs = s("defs", {}, [
    s("marker", { id: "arrow", viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" }, [
      s("path", { class: "arrow-head", d: "M0,0 L10,5 L0,10 z" }),
    ]),
  ]);
  svg.append(defs);

  // Chronology axis line.
  svg.append(s("line", { class: "edge-line", x1: M.left - 24, y1: height - M.bottom + 8, x2: width - M.right + 4, y2: height - M.bottom + 8, "stroke-dasharray": "3 4" }));
  svg.append(s("text", { class: "graph-axis-label", x: M.left - 24, y: height - M.bottom + 24 }, "earlier first-seen"));
  svg.append(s("text", { class: "graph-axis-label", x: width - M.right + 4, y: height - M.bottom + 24, "text-anchor": "end" }, "later"));

  // Edges (skip dangling — those are surfaced in the integrity notice + list).
  const edgeLayer = s("g");
  model.edges.forEach((e) => {
    const a = pos.get(e.from_id), b = pos.get(e.to_id);
    if (!a || !b) return;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 - 30;
    const d = `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;

    const g = s("g", {
      class: "edge-group", role: "button", tabindex: "0",
      "aria-label": `Edge ${edgeTypeLabel(e.edge_type)}: ${shortId(e.from_id)} to ${shortId(e.to_id)}`,
      "data-testid": "graph-edge", "data-public-id": e.public_id,
    }, [
      s("path", { class: "edge-hit", d }),
      s("path", { class: "edge-line", d, "marker-end": "url(#arrow)" }),
      s("text", { class: "edge-label", x: mx, y: my - 4, "text-anchor": "middle" }, edgeTypeLabel(e.edge_type)),
    ]);
    g.addEventListener("click", () => onOpen("edge", e.public_id));
    g.addEventListener("keydown", (ev) => activate(ev, () => onOpen("edge", e.public_id)));
    edgeLayer.append(g);
  });
  svg.append(edgeLayer);

  // Nodes.
  const nodeLayer = s("g");
  const lastCol = cols - 1;
  model.timeline.forEach((c) => {
    const p = pos.get(c.public_id);
    // Edge-aware label anchoring: the first/last chronological columns sit against
    // the SVG frame, so a middle-anchored label there overflows the viewBox and
    // clips. Anchor the leftmost column's text to "start" and the rightmost to
    // "end" so labels always grow inward. Interior columns stay centred.
    const col = rank.get(c.public_id);
    const anchor = col === 0 ? "start" : col === lastCol ? "end" : "middle";
    const gateNote = c._gate === "mismatch" ? " Review gate NOT satisfied — not a verified finding." : "";
    const g = s("g", {
      class: "node-group", role: "button", tabindex: "0",
      "data-status": c.status || "",
      "data-gate": c._gate || "",
      "aria-label": `Claim ${c.title}. Status ${c.status || "unknown"}.${gateNote} First seen ${fmtUTC(c.first_seen_external)} UTC.`,
      "data-testid": "graph-node", "data-public-id": c.public_id,
    }, [
      s("circle", { class: "node-dot", cx: p.x, cy: p.y, r: R }),
      s("text", { class: "node-label", x: p.x, y: p.y - R - 8, "text-anchor": anchor }, truncate(c.title, 26)),
      s("text", { class: "node-id", x: p.x, y: p.y + R + 16, "text-anchor": anchor }, c.public_id),
    ]);
    g.addEventListener("click", () => onOpen("claim", c.public_id));
    g.addEventListener("keydown", (ev) => activate(ev, () => onOpen("claim", c.public_id)));
    nodeLayer.append(g);
  });
  svg.append(nodeLayer);

  const wrap = el("div", { class: "graph-wrap" }, [svg]);
  wrap.append(
    el("div", { class: "graph-legend" }, [
      legendDot("verified"),
      legendDot("plausible"),
      legendDot("unresolved"),
      legendDot("refuted"),
      el("span", {}, [icon("arrow", 14), " direction = from → to"]),
    ])
  );
  mount.append(wrap);

  // Edge ledger — every edge's evidence in full text (accessible, not tooltip).
  mount.append(renderEdgeList(model, onOpen));
}

function renderEdgeList(model, onOpen) {
  const block = el("div", { class: "detail-block", "data-testid": "edge-list" });
  block.append(el("h3", {}, `Lineage edges (${model.edges.length})`));
  if (!model.edges.length) {
    block.append(el("p", { class: "legend-desc" }, "This bundle declares no edges. Edges are optional in the contract; claims can stand alone."));
    return block;
  }
  const list = el("div", { class: "link-list" });
  model.edges.forEach((e) => {
    const from = model.claimById.get(e.from_id);
    const to = model.claimById.get(e.to_id);
    const dir = `${from ? truncate(from.title, 40) : e.from_id + " (dangling)"}  →  ${to ? truncate(to.title, 40) : e.to_id + " (dangling)"}`;
    const btn = el("button", {
      type: "button", class: "link-item",
      "data-testid": "edge-list-item", "data-public-id": e.public_id,
      onclick: () => onOpen("edge", e.public_id),
    }, [
      el("span", { class: "link-item__type" }, edgeTypeLabel(e.edge_type)),
      el("div", { class: "link-item__dir mono" }, dir),
      el("div", { class: "link-item__sum" }, e.evidence_summary || ""),
      el("div", { class: "link-item__meta" }, [
        statusBadge(e),
        typeof e.confidence === "number" ? el("span", { class: "badge badge--unknown" }, `confidence ${e.confidence}`) : null,
        e.method ? el("span", { class: "badge badge--class" }, e.method) : null,
      ].filter(Boolean)),
    ]);
    list.append(btn);
  });
  block.append(list);
  return block;
}

function legendDot(status) {
  // Class per status — no inline style (CSP style-src 'self').
  return el("span", {}, [el("i", { class: `swatch st-${status}` }), status]);
}

function truncate(str, n) { str = str || ""; return str.length > n ? str.slice(0, n - 1) + "…" : str; }
function shortId(id) { return (id || "").replace(/^pub_/, ""); }
function activate(ev, fn) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); fn(); } }

function emptyState(title, body) {
  return el("div", { class: "state", "data-testid": "empty-graph" }, [icon("graph", 32), el("h3", {}, title), el("p", {}, body)]);
}

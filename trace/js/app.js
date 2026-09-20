/* =============================================================================
   TRACE Observatory — application entry (ES module, no bundler, no framework)
   The ONLY network call in the whole app is loadBundle(), which reads the local
   same-origin bundle. Nothing else touches the network.
   ============================================================================= */

import { loadBundle, AppError } from "./data.js";
import { el, icon, clear } from "./util.js";
import { BUNDLE_PATH } from "./config.js";
import { renderBanner } from "./render/banner.js";
import { renderHeader } from "./render/header.js";
import { renderTimeline } from "./render/timeline.js";
import { renderGraph } from "./render/graph.js";
import { renderLedger } from "./render/ledger.js";
import { fillDetail } from "./render/detail.js";

const VIEWS = ["timeline", "graph", "sources"];
const NAV = [
  { id: "timeline", label: "Timeline", ic: "timeline", count: (m) => m.counts.claims },
  { id: "graph", label: "Graph", ic: "graph", count: (m) => m.counts.edges },
  { id: "sources", label: "Sources", ic: "ledger", count: (m) => m.counts.sources },
];

const dom = {
  banner: document.getElementById("sample-banner"),
  header: document.getElementById("header-mount"),
  nav: document.getElementById("view-nav"),
  panels: {
    timeline: document.getElementById("view-timeline"),
    graph: document.getElementById("view-graph"),
    sources: document.getElementById("view-sources"),
  },
  scrim: document.getElementById("scrim"),
  drawer: document.getElementById("drawer"),
  drawerRefs: {
    kicker: document.getElementById("drawer-kicker"),
    title: document.getElementById("drawer-title"),
    body: document.getElementById("drawer-body"),
  },
  closeBtn: document.getElementById("drawer-close"),
};

let MODEL = null;
let currentView = "timeline";
let lastFocused = null;
let closeTimer = null;

boot();

async function boot() {
  showSkeleton();
  try {
    MODEL = await loadBundle();
  } catch (err) {
    renderError(err);
    return;
  }

  renderBanner(dom.banner);
  clear(dom.header);
  renderHeader(dom.header, MODEL);

  buildNav();
  renderTimeline(dom.panels.timeline, MODEL, openDetail);
  renderGraph(dom.panels.graph, MODEL, openDetail);
  renderLedger(dom.panels.sources, MODEL);

  wireDrawer();
  window.addEventListener("hashchange", applyHash);
  applyHash();
}

/* ------------------------------------------------------------------ nav ---- */
function buildNav() {
  clear(dom.nav);
  NAV.forEach((n) => {
    const btn = el("button", {
      type: "button", class: "viewnav__btn", role: "tab",
      id: `tab-${n.id}`, "aria-controls": `view-${n.id}`,
      "aria-selected": String(n.id === currentView),
      "data-testid": `nav-${n.id}`,
      onclick: () => { location.hash = `#/${n.id}`; },
    }, [
      icon(n.ic, 16),
      n.label,
      el("span", { class: "viewnav__count" }, String(n.count(MODEL))),
    ]);
    dom.nav.append(btn);
  });
}

function setView(view) {
  if (!VIEWS.includes(view)) view = "timeline";
  currentView = view;
  for (const id of VIEWS) {
    dom.panels[id].hidden = id !== view;
    const tab = document.getElementById(`tab-${id}`);
    if (tab) tab.setAttribute("aria-selected", String(id === view));
  }
}

/* --------------------------------------------------------------- routing --- */
function applyHash() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (!parts.length) { setView("timeline"); closeDrawer(); return; }
  if (VIEWS.includes(parts[0])) { setView(parts[0]); closeDrawer(); return; }
  if ((parts[0] === "claim" || parts[0] === "edge") && parts[1]) { showDrawer(parts[0], decodeURIComponent(parts[1])); return; }
  setView("timeline"); closeDrawer();
}

/* onOpen handler passed to renderers — drives everything through the URL. */
function openDetail(kind, id) {
  location.hash = `#/${kind}/${encodeURIComponent(id)}`;
}

/* --------------------------------------------------------------- drawer ---- */
function wireDrawer() {
  dom.closeBtn.addEventListener("click", closeToView);
  dom.scrim.addEventListener("click", closeToView);
  document.addEventListener("keydown", (e) => {
    if (dom.drawer.dataset.open !== "true") return;
    if (e.key === "Escape") { e.preventDefault(); closeToView(); }
    if (e.key === "Tab") trapFocus(e);
  });
}

function showDrawer(kind, id) {
  if (!MODEL) return;
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; } // cancel a pending hide
  if (dom.drawer.dataset.open !== "true") lastFocused = document.activeElement;
  fillDetail(dom.drawerRefs, kind, id, MODEL, openDetail);
  dom.scrim.hidden = false;
  dom.drawer.hidden = false;
  // next frame → transition in
  requestAnimationFrame(() => {
    dom.scrim.dataset.open = "true";
    dom.drawer.dataset.open = "true";
  });
  dom.drawer.scrollTop = 0;
  dom.drawerRefs.body.scrollTop = 0;
  dom.closeBtn.focus();
}

function closeToView() { location.hash = `#/${currentView}`; }

function closeDrawer() {
  if (dom.drawer.dataset.open !== "true" && dom.drawer.hidden) return;
  dom.scrim.dataset.open = "false";
  dom.drawer.dataset.open = "false";
  const done = () => { dom.scrim.hidden = true; dom.drawer.hidden = true; closeTimer = null; };
  // Hide after the transition; cancelled if the drawer reopens first.
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = window.setTimeout(done, 340);
  if (lastFocused && document.contains(lastFocused)) { lastFocused.focus(); lastFocused = null; }
}

function trapFocus(e) {
  const focusables = dom.drawer.querySelectorAll(
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (!focusables.length) return;
  const first = focusables[0], last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ---------------------------------------------------- loading / error ------ */
function showSkeleton() {
  const sk = el("div", { class: "skeleton", "aria-hidden": "true" });
  for (let i = 0; i < 4; i++) sk.append(el("div", { class: "skel-card" }));
  clear(dom.panels.timeline);
  dom.panels.timeline.append(
    el("div", { class: "section-head" }, [el("h2", {}, "Loading evidence bundle…")]),
    sk
  );
}

function renderError(err) {
  const isFetch = err instanceof AppError && (err.kind === "fetch-failed" || err.kind === "http");
  clear(dom.panels.timeline);
  dom.panels.timeline.hidden = false;
  dom.panels.timeline.append(
    el("div", { class: "state state--error", role: "alert", "data-testid": "load-error" }, [
      icon("alert", 34),
      el("h3", {}, "Could not load the evidence bundle"),
      el("p", {}, [
        "The observatory reads a single same-origin file: ",
        el("code", {}, BUNDLE_PATH), ". ",
        isFetch
          ? "Serve the folder over HTTP (file:// blocks module + fetch access). See the README."
          : `The file loaded but could not be read: ${err.detail || err.message}.`,
      ]),
      isFetch ? el("p", {}, [el("code", {}, "python3 -m http.server 8080 --directory .")]) : null,
    ].filter(Boolean))
  );
}

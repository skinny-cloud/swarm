/* =============================================================================
   TRACE Observatory — DOM + formatting helpers (dependency-free)
   ============================================================================= */

/* Safe element factory. Text is always assigned via textContent (never innerHTML
   with data), so bundle strings can never inject markup. */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v; // ONLY used with our own trusted SVG icon strings
    else if (k === "dataset") for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

/* Inline SVG icon set — trusted, hand-authored strings only. Never data. */
const ICONS = {
  shield: '<path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5l-8-3Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  timeline: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  graph: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="9" r="2.5"/><circle cx="9" cy="18" r="2.5"/><path d="m8 7 8 1M8 16l8-7"/>',
  ledger: '<path d="M4 4h16v16H4zM4 9h16M9 4v16"/>',
  empty: '<path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7L10 4H5a2 2 0 0 0-2 2Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
};

export function icon(name, size = 16, stroke = 1.75) {
  const raw = ICONS[name] || "";
  const svg = el("span", { class: "icon", "aria-hidden": "true" });
  svg.innerHTML =
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" ` +
    `stroke-linejoin="round">${raw}</svg>`;
  return svg;
}

/* ---- Time formatting — ALWAYS UTC, explicitly labeled ---------------------
   Silent local-time conversion is a provenance error in a forensic artifact. */
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function parseTs(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* Strict RFC3339 date-time check (the contract's `format: date-time`).
   Date.parse is NOT the calendar authority — it silently rolls over impossible
   values ("2026-02-30", "2026-04-31", "24:00:00"), which the certified server
   FormatChecker (rfc3339-validator) rejects. To match that checker, validate
   the grammar AND real calendar/clock validity from the parsed components; do
   not defer to Date.parse. (CODEX O2-R1: those three vectors walked a claim
   through the VERIFIED gate under the old regex+Date.parse.) */
const RFC3339_RE =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/;

export function isRfc3339(s) {
  if (typeof s !== "string") return false;
  const m = RFC3339_RE.exec(s);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5], se = +m[6];
  // Parity target is the certified server checker (rfc3339-validator 0.1.4 behind
  // jsonschema FormatChecker), which is datetime-backed: it rejects year 0000 and
  // second 60 (no leap second). Match it exactly — the cross-runtime parity test
  // (tests/test_sanitize_gate.py) proves this against the real lib. (CODEX O2-R2.)
  if (y < 1) return false;                     // year 0000 is rejected by the checker
  if (mo < 1 || mo > 12) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  if (d < 1 || d > dim) return false;
  if (h > 23 || mi > 59 || se > 59) return false; // datetime-backed: no second 60
  if (m[7] && (+m[8] > 23 || +m[9] > 59)) return false; // numeric offset range
  return true;
}

export function fmtUTC(iso, { withTime = false } = {}) {
  const d = parseTs(iso);
  if (!d) return iso || "—";
  const y = d.getUTCFullYear();
  const mo = MONTHS[d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2, "0");
  let out = `${day} ${mo} ${y}`;
  if (withTime) {
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    out += ` ${hh}:${mm}`;
  }
  return out;
}

export function hostOf(url) {
  try { return new URL(url).host; } catch { return ""; }
}

/* Class-map helper for status/tier/review lookups with graceful unknowns. */
export function metaFor(map, key, fallback) {
  return (key && map[key]) ? map[key] : fallback;
}

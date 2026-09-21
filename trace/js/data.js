/* =============================================================================
   TRACE Observatory — data loading + LOCAL integrity checks
   Never resolves the schema $id over the network. Performs a light, local
   shape check mirroring the frozen contract's key invariants so the app
   degrades gracefully AND surfaces (never hides) integrity problems.
   ============================================================================= */

import { BUNDLE_PATH, EXPECTED_SCHEMA_VERSION } from "./config.js";
import { parseTs, isRfc3339 } from "./util.js";

const STATUS_ENUM = ["VERIFIED", "PLAUSIBLE", "UNRESOLVED", "REFUTED"];
const REVIEW_ENUM = ["pending", "in_review", "independently_reviewed"];
const TIER_ENUM = ["T1", "T2", "T3"];

/* ── O3: frozen-contract mirror (pinned to schema/public-bundle.schema.json) ───
   The browser must NEVER fetch the schema over the network, so the contract's
   key sets and size bounds are mirrored here in code. The node drift test
   (tests/observatory-selftest.mjs) reads the schema and asserts these constants
   equal it, so mirror drift becomes a test failure, not a latent hole.
   POLICY: unknown keys (additionalProperties:false) and over-bound strings are
   SURFACED as visible integrity notices (never hidden); an over-bound string is
   additionally truncated to its contract max for display so a 100k-char field
   can never render in full. The private sanitize.py build gate rejects such a
   bundle outright — this is defense-in-depth for anything that reaches a browser. */
export const ALLOWED_KEYS = {
  bundle: ["schema_version", "generated_utc", "claims", "edges", "sources", "note"],
  claim: [
    "public_id", "title", "status", "artifact_class", "tier", "first_seen_external",
    "occurrence_time", "published_time", "discovered_time", "verified_time",
    "source_ids", "review_state", "evidence_summary", "redaction_state",
    "redaction_reason", "related_node_ids", "related_edge_ids",
  ],
  edge: [
    "public_id", "edge_type", "from_id", "to_id", "status", "review_state",
    "evidence_summary", "source_ids", "method", "confidence",
    "first_seen_external", "verified_time",
  ],
  source: ["source_id", "label", "source_class", "public_url"],
};

export const SIZE_BOUNDS = {
  bundle: { note: 500 },
  claim: { title: 200, evidence_summary: 2000, redaction_reason: 300 },
  edge: { evidence_summary: 2000, method: 120 },
  source: { label: 200 },
};

// Generic defense-in-depth cap for any string field NOT explicitly bounded above
// (e.g. an enum field stuffed with 100k chars). The build sanitizer rejects such a
// bundle; this is the runtime integrity notice + display truncation.
const GENERIC_STR_MAX = 2000;

/* Enforce the frozen key set + size bounds for one object. Unknown keys become
   integrity notices; over-bound strings are noted AND truncated in place (the
   record is a fresh view-model copy by the time this runs, never the raw file). */
function auditObj(obj, kind, label, warnings) {
  if (!obj || typeof obj !== "object") return;
  const allowed = new Set(ALLOWED_KEYS[kind] || []);
  // NO underscore exemption: this runs on the fresh input copy BEFORE any
  // computed _field is attached (see the loops below), so every key here is
  // input provenance. Exempting "_"-prefixed keys let a planted `_private`
  // leak in invisibly (CODEX O3-R1). additionalProperties:false means every
  // unexpected key is surfaced, underscore or not.
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) {
      warnings.push(`${label}: unknown field "${k}" — the contract is additionalProperties:false.`);
    }
  }
  const bounded = SIZE_BOUNDS[kind] || {};
  for (const [field, max] of Object.entries(bounded)) {
    const v = obj[field];
    if (typeof v === "string" && v.length > max) {
      warnings.push(`${label}: field "${field}" is ${v.length} chars, over the contract max of ${max} — truncated for display.`);
      obj[field] = v.slice(0, max) + "…";
    }
  }
  // Generic cap on any OTHER string field (defense-in-depth for enum/pattern fields).
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && !(k in bounded) && v.length > GENERIC_STR_MAX) {
      warnings.push(`${label}: field "${k}" is ${v.length} chars, over the generic ${GENERIC_STR_MAX}-char cap — truncated for display.`);
      obj[k] = v.slice(0, GENERIC_STR_MAX) + "…";
    }
  }
}

export async function loadBundle() {
  let res;
  try {
    res = await fetch(BUNDLE_PATH, { cache: "no-store" });
  } catch (e) {
    throw new AppError("fetch-failed", BUNDLE_PATH, e.message);
  }
  if (!res.ok) throw new AppError("http", BUNDLE_PATH, `HTTP ${res.status}`);

  let raw;
  try {
    raw = await res.json();
  } catch (e) {
    throw new AppError("parse", BUNDLE_PATH, e.message);
  }
  return normalize(raw);
}

export class AppError extends Error {
  constructor(kind, resource, detail) {
    super(detail || kind);
    this.kind = kind;
    this.resource = resource;
    this.detail = detail;
  }
}

/* Build a normalized view model with lookup maps and computed integrity flags.
   Rendering reads ONLY fields present in the frozen schema. */
function normalize(raw) {
  const warnings = [];

  if (!raw || typeof raw !== "object") throw new AppError("shape", BUNDLE_PATH, "bundle is not an object");
  if (raw.schema_version !== EXPECTED_SCHEMA_VERSION) {
    warnings.push(`Bundle schema_version is "${raw.schema_version ?? "missing"}"; this renderer targets ${EXPECTED_SCHEMA_VERSION}.`);
  }

  // O3 — frozen-key audit at the top level (no mutation of the raw file).
  for (const k of Object.keys(raw)) {
    if (!ALLOWED_KEYS.bundle.includes(k)) {
      warnings.push(`bundle: unknown top-level field "${k}" — the contract is additionalProperties:false.`);
    }
  }
  let note = typeof raw.note === "string" ? raw.note : null;
  if (note !== null && note.length > SIZE_BOUNDS.bundle.note) {
    warnings.push(`bundle: field "note" is ${note.length} chars, over the contract max of ${SIZE_BOUNDS.bundle.note} — truncated for display.`);
    note = note.slice(0, SIZE_BOUNDS.bundle.note) + "…";
  }

  // Work on shallow copies so audits + truncation never mutate the parsed input.
  const claims = (Array.isArray(raw.claims) ? raw.claims : []).map((c) => ({ ...c }));
  const edges = (Array.isArray(raw.edges) ? raw.edges : []).map((e) => ({ ...e }));
  const sources = (Array.isArray(raw.sources) ? raw.sources : []).map((s) => ({ ...s }));

  if (!Array.isArray(raw.claims)) warnings.push("Required field `claims` is missing or not an array.");

  const claimById = new Map();
  const sourceById = new Map();
  const edgeById = new Map();

  for (const s of sources) {
    auditObj(s, "source", `Source ${s.source_id ?? "(no id)"}`, warnings);
    sourceById.set(s.source_id, s);
  }

  const seenPublicIds = new Set();

  for (const c of claims) {
    auditObj(c, "claim", `Claim ${c.public_id ?? "(no id)"}`, warnings);
    if (seenPublicIds.has(c.public_id)) warnings.push(`Duplicate public_id across claims/edges: ${c.public_id}`);
    seenPublicIds.add(c.public_id);
    claimById.set(c.public_id, c);
    c._kind = "claim";
    c._enumWarn = enumWarnings(c);
    c._gate = gateState(c);
    c._badSources = (c.source_ids || []).filter((id) => !sourceById.has(id));
  }

  for (const e of edges) {
    auditObj(e, "edge", `Edge ${e.public_id ?? "(no id)"}`, warnings);
    if (seenPublicIds.has(e.public_id)) warnings.push(`Duplicate public_id across claims/edges: ${e.public_id}`);
    seenPublicIds.add(e.public_id);
    edgeById.set(e.public_id, e);
    e._kind = "edge";
    e._enumWarn = enumWarnings(e);
    e._gate = gateState(e);
    e._badSources = (e.source_ids || []).filter((id) => !sourceById.has(id));
    e._danglingFrom = !claimById.has(e.from_id);
    e._danglingTo = !claimById.has(e.to_id);
  }

  // Referential-integrity warnings (mirror the private validator's spirit).
  for (const e of edges) {
    if (e._danglingFrom) warnings.push(`Edge ${e.public_id}: from_id ${e.from_id} does not resolve to a claim.`);
    if (e._danglingTo) warnings.push(`Edge ${e.public_id}: to_id ${e.to_id} does not resolve to a claim.`);
  }
  for (const c of claims) {
    for (const id of c._badSources) warnings.push(`Claim ${c.public_id}: source_id ${id} not found in sources[].`);
    if (c._gate === "mismatch") warnings.push(`Claim ${c.public_id}: VERIFIED but review/verified_time gate not satisfied.`);
  }
  for (const e of edges) {
    if (e._gate === "mismatch") warnings.push(`Edge ${e.public_id}: VERIFIED but review/verified_time gate not satisfied.`);
  }

  // Timeline order: by occurrence_time (when the event happened in the incident),
  // falling back to first_seen_external (public disclosure) when the source gives
  // no event time. Ordering by first_seen_external alone collapses to a couple of
  // disclosure dates and loses the incident chronology (dx3 go-live directive,
  // 2026-09-21: occurrence_time = incident event; first_seen_external = disclosure).
  const timeline = [...claims].sort((a, b) => {
    const ta = parseTs(a.occurrence_time || a.first_seen_external)?.getTime() ?? Infinity;
    const tb = parseTs(b.occurrence_time || b.first_seen_external)?.getTime() ?? Infinity;
    return ta - tb;
  });

  return {
    schema_version: raw.schema_version,
    generated_utc: raw.generated_utc,
    note,
    claims, edges, sources, timeline,
    claimById, sourceById, edgeById,
    warnings,
    counts: { claims: claims.length, edges: edges.length, sources: sources.length },
  };
}

function enumWarnings(obj) {
  const bad = [];
  if (obj.status && !STATUS_ENUM.includes(obj.status)) bad.push("status");
  if (obj.review_state && !REVIEW_ENUM.includes(obj.review_state)) bad.push("review_state");
  if (obj.tier && !TIER_ENUM.includes(obj.tier)) bad.push("tier");
  return bad;
}

/* VERIFIED requires review_state=independently_reviewed AND a VALID RFC3339
   verified_time. `!!verified_time` is not enough — CODEX walked a claim through
   the gate with verified_time="not-a-date"; a truthy non-timestamp must fail.
   Returns "pass" | "pending" | "mismatch". */
export function gateState(obj) {
  if (obj.status === "VERIFIED") {
    const ok = obj.review_state === "independently_reviewed" && isRfc3339(obj.verified_time);
    return ok ? "pass" : "mismatch";
  }
  return obj.review_state === "independently_reviewed" ? "pass" : "pending";
}

/* Pure, DOM-free entry for tests: build the view-model from a parsed bundle. */
export function buildModel(raw) {
  return normalize(raw);
}

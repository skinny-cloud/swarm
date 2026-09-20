/* =============================================================================
   TRACE Observatory — static configuration
   No env vars, no secrets, no external endpoints. Same-origin only.
   ============================================================================= */

/* The single line to flip at real launch. The public bundle cannot carry an
   is_sample flag (schema is additionalProperties:false), so sample mode is a
   build-time constant, not data. See README.
   2026-09-20: flipped to false — the real #62 v1 bundle is wired (dx3 export,
   sha256 488b812b…, jsonschema 0-error). It is REAL evidence, not sample data,
   so the "Sample data" banner is off; the pre-certification state is carried
   honestly by the bundle's own note and by every claim rendering in_review
   (nothing is VERIFIED-green until CODEX independent tier-cert lands). */
export const SAMPLE_MODE = false;

/* Same-origin, relative. This is the ONLY resource the app fetches. */
export const BUNDLE_PATH = "./data/public-bundle.json";

/* The frozen contract version this renderer targets. */
export const EXPECTED_SCHEMA_VERSION = "1.0.2";

/* The evidence standard, rendered as a lineage bar in the header. */
export const EVIDENCE_STANDARD = [
  { key: "SEED A", text: "A disclosed origin artifact — the first-party seed." },
  { key: "MECHANISM", text: "A concrete mechanism links the seed to a candidate." },
  { key: "B INDEPENDENT", text: "The candidate appears independently, not merely mirrored." },
  { key: "C LINEAGE", text: "A reviewed, sourced edge closes the chain of descent." },
];

/* Epistemic status — from schema enum + contract prose. */
export const STATUS_META = {
  VERIFIED:   { label: "Verified",   klass: "verified",   note: "Independently reviewed with a non-derivative source." },
  PLAUSIBLE:  { label: "Plausible",  klass: "plausible",  note: "Consistent with the pattern; ordinary origin not yet excluded." },
  UNRESOLVED: { label: "Unresolved", klass: "unresolved", note: "Insufficient evidence to classify either way." },
  REFUTED:    { label: "Refuted",    klass: "refuted",    note: "Evidence contradicts the claim." },
};

/* Review gate — from schema enum. */
export const REVIEW_META = {
  pending:                { label: "Review pending" },
  in_review:              { label: "In review" },
  independently_reviewed: { label: "Independently reviewed" },
};

/* Tier semantics. T1 and T3 are defined by the TRACE brief; T2 is intentionally
   NOT defined in the public contract or the brief — we do not invent it. */
export const TIER_META = {
  T1: { label: "T1", desc: "OpenAI-linked — first-party proximity.", defined: true },
  T2: { label: "T2", desc: "Tier descriptor not yet defined in the public contract.", defined: false },
  T3: { label: "T3", desc: "Behavioral analogue — explicitly NOT evidence of the rumor.", defined: true },
};

/* Source class — from schema description / contract addendum. */
export const SOURCE_CLASS_META = {
  first_party:            { label: "First-party",  desc: "OpenAI / Hugging Face primary disclosure (incl. alignment.openai.com)." },
  independent_investigator:{ label: "Independent", desc: "Independent investigation (e.g. METR / Redwood)." },
  derivative_reference:   { label: "Derivative",   desc: "Synthesis site — discovery aid only, never sole backing of a VERIFIED claim." },
};

/* Edge type — human labels for the schema enum. */
export const EDGE_TYPE_META = {
  DERIVES_FROM:        "derives from",
  MIRRORS:             "mirrors",
  FORK_OF:             "fork of",
  BOILERPLATE_FROM:    "boilerplate from",
  CONTAINS_MECHANISM:  "contains mechanism",
  MATCHES_SEED:        "matches seed",
  OVERLAPS_INCIDENT_ID:"overlaps incident id",
  EXACT_MATCH:         "exact match",
  FUZZY_MATCH:         "fuzzy match",
};

/* Artifact class — schema enum (rendered verbatim, no invented descriptions). */
export const ARTIFACT_CLASSES = [
  "BEACON", "MESSAGE", "DEAD_DROP_C2", "LOADER",
  "PERSISTENCE", "PROPAGATOR", "SELF_REPLICATOR",
];

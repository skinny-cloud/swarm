/* =============================================================================
   REPRO — bundle loading + LOCAL integrity checks.
   Mirrors the frozen contract's key invariants so problems are SURFACED as
   visible notices, never hidden and never "fixed" silently. The results owner's
   build gate (jsonschema) is the primary check; this is defense in depth for
   anything that reaches a browser.
   ============================================================================= */

import {
  BUNDLE_PATH, EXPECTED_SCHEMA_VERSION, CANONICAL_HOST, VERDICTS, REASON_REQUIRED,
  ARM_ROLES, ALLOWED_KEYS, DISPLAY_MAX,
} from "./config.js";
import { isRfc3339 } from "./util.js";

export class AppError extends Error {
  constructor(kind, detail) {
    super(detail || kind);
    this.kind = kind;
    this.detail = detail;
  }
}

/* Returns { empty: true } when no bundle has been published (404), else the
   normalized view model. Network and parse failures throw AppError. */
export async function loadBundle() {
  let res;
  try {
    res = await fetch(BUNDLE_PATH, { cache: "no-store" });
  } catch (e) {
    throw new AppError("fetch-failed", e.message);
  }
  if (res.status === 404) return { empty: true };
  if (!res.ok) throw new AppError("http", `HTTP ${res.status}`);
  let raw;
  try {
    raw = await res.json();
  } catch (e) {
    throw new AppError("parse", e.message);
  }
  return buildModel(raw);
}

/* Unknown keys become notices; over-long strings are noted and truncated in the
   (copied) view object, never in the parsed input. */
function audit(obj, kind, label, warnings) {
  const allowed = new Set(ALLOWED_KEYS[kind]);
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) warnings.push(`${label}: unknown field "${k}" — the contract is additionalProperties:false.`);
  }
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.length > DISPLAY_MAX) {
      warnings.push(`${label}: field "${k}" is ${v.length} chars, over the ${DISPLAY_MAX}-char display cap — truncated.`);
      obj[k] = v.slice(0, DISPLAY_MAX) + "…";
    }
  }
}

const isCount = (n) => Number.isInteger(n) && n >= 0;

/* Pure and DOM-free, so the node self-test can drive it directly. */
export function buildModel(raw) {
  const warnings = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AppError("shape", "bundle is not an object");

  for (const k of Object.keys(raw)) {
    if (!ALLOWED_KEYS.bundle.includes(k)) warnings.push(`bundle: unknown top-level field "${k}" — the contract is additionalProperties:false.`);
  }
  if (raw.schema_version !== EXPECTED_SCHEMA_VERSION) {
    warnings.push(`Bundle schema_version is "${raw.schema_version ?? "missing"}"; this renderer targets ${EXPECTED_SCHEMA_VERSION}.`);
  }
  if (!isRfc3339(raw.generated_utc)) warnings.push("bundle: generated_utc is missing or not an RFC3339 date-time.");

  const index = raw.index && typeof raw.index === "object" ? { ...raw.index } : {};
  if (!raw.index) warnings.push("bundle: required object `index` is missing.");
  audit(index, "index", "index", warnings);
  if (!/^[0-9a-f]{64}$/.test(index.method_sha256 || "")) warnings.push("index: method_sha256 is missing or not a sha256 hex digest.");
  if (!isRfc3339(index.run_window_closed_utc)) warnings.push("index: run_window_closed_utc is missing or not an RFC3339 date-time.");
  if (!index.doi) warnings.push("index: the evidence archive DOI is not set — entries are not backed by a citable archive yet.");

  if (!Array.isArray(raw.entries)) warnings.push("Required field `entries` is missing or not an array.");
  const entries = (Array.isArray(raw.entries) ? raw.entries : []).map((e) => ({ ...e }));
  const seen = new Set();

  for (const e of entries) {
    const label = `Entry ${e.id ?? "(no id)"}`;
    audit(e, "entry", label, warnings);
    if (seen.has(e.id)) warnings.push(`${label}: duplicate id.`);
    seen.add(e.id);

    if (!VERDICTS.includes(e.verdict)) {
      warnings.push(`${label}: verdict "${e.verdict ?? "missing"}" is not one of the pre-registered verdicts.`);
      e._verdict = "UNKNOWN";
    } else {
      e._verdict = e.verdict;
    }
    if (REASON_REQUIRED.includes(e.verdict) && !(typeof e.verdict_reason === "string" && e.verdict_reason.trim())) {
      warnings.push(`${label}: verdict ${e.verdict} requires a published reason, and none is given.`);
    }
    if (e.host !== CANONICAL_HOST) {
      warnings.push(`${label}: host must read "${CANONICAL_HOST}" on public files.`);
    }

    e.arms = (Array.isArray(e.arms) ? e.arms : []).map((a) => ({ ...a }));
    e.arms.forEach((a, i) => {
      const al = `${label} arm ${i + 1}`;
      audit(a, "arm", al, warnings);
      if (!ARM_ROLES.includes(a.role)) warnings.push(`${al}: role "${a.role ?? "missing"}" is not one of ${ARM_ROLES.join(", ")}.`);
      if (!isCount(a.valid) || !isCount(a.invalid) || !isCount(a.violations)) {
        warnings.push(`${al}: valid, invalid and violations must be whole counts.`);
      } else if (a.violations > a.valid) {
        warnings.push(`${al}: ${a.violations} violations exceed ${a.valid} valid trials — only valid trials can count.`);
      }
    });
    if (e.verdict === "REPRODUCED" && !e.arms.some((a) => a.role === "trial" && a.violations > 0)) {
      warnings.push(`${label}: verdict REPRODUCED but no trial arm records a violation.`);
    }
    if (e.verdict === "NOT_REPRODUCED" && e.arms.some((a) => a.role === "trial" && a.violations > 0)) {
      warnings.push(`${label}: verdict NOT_REPRODUCED but a trial arm records violations — that is OBSERVED_BELOW_THRESHOLD or REPRODUCED.`);
    }
    e.run_utc = Array.isArray(e.run_utc) ? e.run_utc : [];
    for (const t of e.run_utc) if (!isRfc3339(t)) warnings.push(`${label}: run time "${t}" is not RFC3339.`);
  }

  entries.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

  const tally = {};
  for (const e of entries) tally[e._verdict] = (tally[e._verdict] || 0) + 1;

  return {
    empty: false,
    schema_version: raw.schema_version,
    generated_utc: raw.generated_utc,
    index,
    entries,
    tally,
    warnings,
  };
}

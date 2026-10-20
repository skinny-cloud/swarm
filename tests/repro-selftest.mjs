// REPRO self-test: zero dependencies. Run: node tests/repro-selftest.mjs
// 1) Drift: the in-browser contract mirror must equal schema/repro-bundle.schema.json.
// 2) Mutation battery: every integrity rule must FIRE on a planted defect, and stay
//    silent on a clean bundle. A check that cannot fail is not a check.
// The fixture is synthetic (example.* names) and is test-only: tests/ is excluded
// from deploys by .vercelignore.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  ALLOWED_KEYS, VERDICTS, ARM_ROLES, EXPECTED_SCHEMA_VERSION, CANONICAL_HOST,
} from "../repro/js/config.js";
import { buildModel } from "../repro/js/data.js";
import { safeHref } from "../repro/js/util.js";

const here = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(join(here, "../repro/schema/repro-bundle.schema.json"), "utf8"));

let failed = 0, passed = 0;
function check(name, cond, detail = "") {
  if (cond) { passed++; } else { failed++; console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}
const sameSet = (a, b) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

/* ---- 1. drift ---------------------------------------------------------- */
const entryDef = schema.$defs.entry, armDef = schema.$defs.arm;
check("bundle keys", sameSet(ALLOWED_KEYS.bundle, Object.keys(schema.properties)));
check("index keys", sameSet(ALLOWED_KEYS.index, Object.keys(schema.properties.index.properties)));
check("entry keys", sameSet(ALLOWED_KEYS.entry, Object.keys(entryDef.properties)));
check("arm keys", sameSet(ALLOWED_KEYS.arm, Object.keys(armDef.properties)));
check("verdict enum", sameSet(VERDICTS, entryDef.properties.verdict.enum));
check("arm roles", sameSet(ARM_ROLES, armDef.properties.role.enum));
check("schema_version", schema.properties.schema_version.const === EXPECTED_SCHEMA_VERSION);
check("host const", entryDef.properties.host.const === CANONICAL_HOST);
check("additionalProperties false everywhere",
  schema.additionalProperties === false && schema.properties.index.additionalProperties === false &&
  entryDef.additionalProperties === false && armDef.additionalProperties === false);

/* ---- 2. mutation battery ------------------------------------------------ */
const clean = () => ({
  schema_version: "1.0.0",
  generated_utc: "2026-01-02T03:04:05Z",
  index: {
    edition: "v0",
    method_sha256: "0".repeat(64),
    method_url: "https://example.org/method",
    run_window_closed_utc: "2026-01-01T12:00:00Z",
    doi: "10.5281/zenodo.0000000",
    limits: "Synthetic test fixture.",
  },
  entries: [
    {
      id: "T90", order: 1, invariant: "An example invariant must hold", vendor: "Example vendor",
      source_url: "https://github.com/example/example/issues/1",
      affected_version: "example 1.0.0", affected_version_date: "2026-01-01",
      supersession_version: null, verdict: "REPRODUCED", verdict_reason: null,
      arms: [
        { label: "affected", version: "1.0.0", role: "trial", valid: 5, invalid: 0, violations: 5, threshold: "3/5", notes: null },
        { label: "counterfactual", version: "1.0.0", role: "counterfactual", valid: 2, invalid: 0, violations: 0, threshold: null, notes: null },
      ],
      probe: "synthetic", raw_result: "synthetic", counterfactual: null, detection_limits: "synthetic",
      uncertainty: "synthetic", supersession: null, run_utc: ["2026-01-01T10:00:00Z"],
      host: CANONICAL_HOST, image_digest: null, probe_commit: "abc1234", spend: null, evidence_path: "t90/",
    },
    {
      id: "T91", order: 2, invariant: "Another example invariant", vendor: "Example vendor",
      source_url: "https://github.com/example/example/issues/2",
      affected_version: "example 2.0.0", affected_version_date: "2026-01-01",
      verdict: "NOT_FINISHED", verdict_reason: "Not started before the window closed.",
      arms: [], probe: "synthetic", raw_result: "none", detection_limits: "synthetic",
      uncertainty: "synthetic", host: CANONICAL_HOST, evidence_path: "t91/",
    },
  ],
});

const base = buildModel(clean());
check("clean bundle: zero notices", base.warnings.length === 0, JSON.stringify(base.warnings));
check("clean bundle: tally", base.tally.REPRODUCED === 1 && base.tally.NOT_FINISHED === 1);

const mutants = [
  ["unknown top-level key", (b) => { b.extra = 1; }, "unknown top-level field"],
  ["unknown entry key", (b) => { b.entries[0]._private = "x"; }, 'unknown field "_private"'],
  ["unknown arm key", (b) => { b.entries[0].arms[0].secret = "x"; }, 'unknown field "secret"'],
  ["bad verdict", (b) => { b.entries[0].verdict = "VERIFIED"; }, "not one of the pre-registered verdicts"],
  ["missing reason", (b) => { b.entries[1].verdict_reason = ""; }, "requires a published reason"],
  ["machine name as host", (b) => { b.entries[0].host = "some-box-01"; }, "host must read"],
  ["violations > valid", (b) => { b.entries[0].arms[0].violations = 9; }, "exceed"],
  ["null DOI", (b) => { b.index.doi = null; }, "DOI is not set"],
  ["REPRODUCED without violation", (b) => { b.entries[0].arms[0].violations = 0; }, "no trial arm records a violation"],
  ["NOT_REPRODUCED with violations", (b) => { b.entries[0].verdict = "NOT_REPRODUCED"; }, "records violations"],
  ["bad run time", (b) => { b.entries[0].run_utc = ["2026-02-30T00:00:00Z"]; }, "not RFC3339"],
  ["bad role", (b) => { b.entries[0].arms[1].role = "baseline"; }, "is not one of"],
  ["duplicate id", (b) => { b.entries[1].id = "T90"; }, "duplicate id"],
  ["wrong schema_version", (b) => { b.schema_version = "9.9.9"; }, "this renderer targets"],
  ["bad method sha", (b) => { b.index.method_sha256 = "abc"; }, "method_sha256"],
  ["oversized string", (b) => { b.entries[0].probe = "x".repeat(5000); }, "display cap"],
];
for (const [name, mutate, needle] of mutants) {
  const b = clean(); mutate(b);
  const m = buildModel(b);
  check(`mutant fires: ${name}`, m.warnings.some((w) => w.includes(needle)), JSON.stringify(m.warnings));
}

const input = clean(); input.entries[0].probe = "x".repeat(5000);
buildModel(input);
check("parsed input never mutated", input.entries[0].probe.length === 5000);

/* ---- 3. href guard ------------------------------------------------------ */
check("https allowed", safeHref("https://github.com/a/b/issues/1") === "https://github.com/a/b/issues/1");
for (const bad of ["javascript:alert(1)", "data:text/html,x", "http://example.org", "/relative", "nonsense", null]) {
  check(`href blocked: ${bad}`, safeHref(bad) === null);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

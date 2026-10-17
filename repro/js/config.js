/* =============================================================================
   REPRO — static configuration. No env vars, no secrets, no external endpoints.
   Holds no entry content: every invariant, vendor, version and verdict arrives in
   the bundle, emitted by the results owner after review and redaction.
   ============================================================================= */

/* Same-origin, relative. The ONLY resource the app fetches. A missing file is the
   honest "nothing published yet" state, not an error. */
export const BUNDLE_PATH = "./data/repro-bundle.json";

/* The contract this renderer targets: schema/repro-bundle.schema.json. */
export const EXPECTED_SCHEMA_VERSION = "1.0.0";

/* The only host description the pre-registration allows on a public file. */
export const CANONICAL_HOST = "NXTG-owned Linux host";

/* Verdicts, in display order (pre-registration amendment A1.3). Presentation is
   deliberately outcome-neutral and shares nothing with the /trace/ epistemic
   badges: REPRODUCED means a reported defect was confirmed here, not that
   anything is "verified" or "good". */
export const VERDICT_META = {
  REPRODUCED: {
    label: "Reproduced", klass: "reproduced",
    note: "The invariant broke in at least the pre-registered threshold of valid trials.",
  },
  OBSERVED_BELOW_THRESHOLD: {
    label: "Observed below threshold", klass: "below",
    note: "The violation appeared in some valid trials, but fewer than the threshold. Reported as k of n, never as not reproduced.",
  },
  NOT_REPRODUCED: {
    label: "Not reproduced", klass: "not-reproduced",
    note: "Zero violations in at least the minimum number of valid trials. This does not show the defect is absent.",
  },
  INCONCLUSIVE: {
    label: "Inconclusive", klass: "inconclusive",
    note: "Too few valid trials, a failed environment control, or the exact version or model could not be obtained.",
  },
  NOT_ATTEMPTED: {
    label: "Not attempted", klass: "not-run",
    note: "Not run: the pre-registered per-vendor cap or stop rule was reached.",
  },
  NOT_FINISHED: {
    label: "Not finished", klass: "not-run",
    note: "Not completed inside the run window. Whatever raw output exists is published.",
  },
};
export const VERDICTS = Object.keys(VERDICT_META);
export const REASON_REQUIRED = ["INCONCLUSIVE", "NOT_ATTEMPTED", "NOT_FINISHED"];

export const ARM_ROLES = ["trial", "counterfactual", "control", "supersession"];

/* Frozen-contract mirror (additionalProperties:false at every level). The browser
   never fetches the schema; tests/repro-selftest.mjs asserts these sets equal the
   schema so drift is a test failure, not a silent hole. */
export const ALLOWED_KEYS = {
  bundle: ["schema_version", "generated_utc", "index", "entries"],
  index: ["edition", "method_sha256", "method_url", "run_window_closed_utc", "doi", "limits"],
  entry: [
    "id", "order", "invariant", "vendor", "source_url", "affected_version", "affected_version_date",
    "supersession_version", "verdict", "verdict_reason", "arms", "probe", "raw_result", "counterfactual",
    "detection_limits", "uncertainty", "supersession", "run_utc", "host", "image_digest", "probe_commit",
    "spend", "evidence_path",
  ],
  arm: ["label", "version", "role", "valid", "invalid", "violations", "threshold", "notes"],
};

/* Display cap for any string, defense in depth behind the schema's maxLength. */
export const DISPLAY_MAX = 2000;

/* Index-level non-claims, shown above the entries on every render. */
export const NON_CLAIMS =
  "Entries, not ratings. This index publishes no score, no prevalence estimate and no root-cause finding. " +
  "A reproduction shows an invariant can break on that version, in that environment; a non-reproduction " +
  "does not show the defect is absent. The candidates were fixed in advance and are few, so this is not a " +
  "vendor comparison or a coverage guarantee.";

/* Per-entry limits, repeated on every entry so an excerpt cannot drop them. */
export const ENTRY_LIMITS =
  "One host, one environment, small N. Says nothing about how often users hit this, and makes no " +
  "root-cause claim beyond quoting the report.";

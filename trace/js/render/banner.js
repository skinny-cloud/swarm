/* Sample-mode banner. Driven by the SAMPLE_MODE constant (config.js) — the one
   line to flip at real launch. Not derived from bundle data (the schema forbids
   an is_sample flag). */

import { el, icon } from "../util.js";
import { SAMPLE_MODE } from "../config.js";

export function renderBanner(mount) {
  if (!SAMPLE_MODE) { mount.hidden = true; return; }
  mount.hidden = false;
  mount.append(
    el("div", { class: "sample-banner__inner" }, [
      el("span", { class: "sample-banner__dot", "aria-hidden": "true" }),
      el("span", { role: "note", "data-testid": "sample-banner" }, [
        el("strong", {}, "Sample data"),
        " — awaiting the first published evidence bundle. Real certified bundles drop in unchanged; nothing here is a finding.",
      ]),
    ])
  );
}

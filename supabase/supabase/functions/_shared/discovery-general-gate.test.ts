import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  applyGeneralGateQuery,
  clearsGeneralGate,
  type GeneralGate,
  googleGate,
  isOperational,
  mesitaGate,
} from "./discovery-general-gate.ts";
import { DISCOVERY_DEFAULTS, normalizeDiscoveryConfig } from "./discovery-config.ts";

const OFF: GeneralGate = { requireActive: false, minReviews: 0 };
const ACTIVE_ONLY: GeneralGate = { ...OFF, requireActive: true };

Deno.test("Active is Google's OPERATIONAL, nothing else", () => {
  assert(isOperational("OPERATIONAL"));
  assert(!isOperational("CLOSED_TEMPORARILY"));
  assert(!isOperational("CLOSED_PERMANENTLY"));
  assert(!isOperational(null));
  assert(!isOperational(""));
});

Deno.test("requireActive is ON by default — a closed place is not a result", () => {
  assertEquals(DISCOVERY_DEFAULTS.general.requireActive, true);
  // The live blob predates the key; normalize has to supply the default.
  const legacy = normalizeDiscoveryConfig({ general: {} });
  assertEquals(legacy.general.requireActive, true);
  assertEquals(
    normalizeDiscoveryConfig({ general: { requireActive: false } }).general
      .requireActive,
    false,
  );
});

Deno.test("one reviews floor: general.minReviews is dropped, Google rows read map.googleMinReviews, Mesita rows none (MESITA-2702)", () => {
  const cfg = normalizeDiscoveryConfig({
    general: { requireActive: true, minReviews: 10 },
    map: { googleMinReviews: 100 },
  });
  assertEquals(cfg.general, { requireActive: true });
  assertEquals(googleGate(cfg), { requireActive: true, minReviews: 100 });
  assertEquals(mesitaGate(cfg.general), { requireActive: true, minReviews: 0 });
  assert(!clearsGeneralGate(googleGate(cfg), { businessStatus: "OPERATIONAL", reviewCount: 50 }));
  assert(clearsGeneralGate(mesitaGate(cfg.general), { businessStatus: "OPERATIONAL", reviewCount: 50 }));
  assert(!clearsGeneralGate(mesitaGate(cfg.general), { businessStatus: "CLOSED_PERMANENTLY", reviewCount: 500 }));
});

Deno.test("both knobs off admits everything, including an unknown row", () => {
  assert(clearsGeneralGate(OFF, { businessStatus: null, reviewCount: null }));
  assert(
    clearsGeneralGate(OFF, {
      businessStatus: "CLOSED_PERMANENTLY",
      reviewCount: 0,
    }),
  );
});

Deno.test("requireActive wipes closed AND unknown", () => {
  assert(clearsGeneralGate(ACTIVE_ONLY, { businessStatus: "OPERATIONAL" }));
  assert(
    !clearsGeneralGate(ACTIVE_ONLY, { businessStatus: "CLOSED_TEMPORARILY" }),
  );
  assert(
    !clearsGeneralGate(ACTIVE_ONLY, { businessStatus: "CLOSED_PERMANENTLY" }),
  );
  // Unknown does not clear it — "only active" would otherwise read
  // "active, plus the ones we couldn't check".
  assert(!clearsGeneralGate(ACTIVE_ONLY, { businessStatus: null }));
  assert(!clearsGeneralGate(ACTIVE_ONLY, {}));
});

Deno.test("minReviews asks a place to prove the count", () => {
  const floor: GeneralGate = { ...OFF, minReviews: 25 };
  assert(clearsGeneralGate(floor, { reviewCount: 25 }));
  assert(clearsGeneralGate(floor, { reviewCount: 400 }));
  assert(!clearsGeneralGate(floor, { reviewCount: 24 }));
  assert(!clearsGeneralGate(floor, { reviewCount: 0 }));
  assert(!clearsGeneralGate(floor, { reviewCount: null }));
  assert(!clearsGeneralGate(floor, {}));
  assert(!clearsGeneralGate(floor, { reviewCount: Number.NaN }));
});

Deno.test("the knobs are independent — either one alone excludes", () => {
  const both: GeneralGate = { ...OFF, requireActive: true, minReviews: 10 };
  assert(clearsGeneralGate(both, {
    businessStatus: "OPERATIONAL",
    reviewCount: 10,
  }));
  assert(!clearsGeneralGate(both, {
    businessStatus: "OPERATIONAL",
    reviewCount: 9,
  }));
  assert(!clearsGeneralGate(both, {
    businessStatus: "CLOSED_TEMPORARILY",
    reviewCount: 900,
  }));
});

Deno.test("the gate is the same question as a WHERE clause", () => {
  type Call = [string, string, unknown];
  const calls: Call[] = [];
  const q = {
    eq(col: string, val: unknown) {
      calls.push(["eq", col, val]);
      return this;
    },
    gte(col: string, val: unknown) {
      calls.push(["gte", col, val]);
      return this;
    },
    lte(col: string, val: unknown) {
      calls.push(["lte", col, val]);
      return this;
    },
  };

  applyGeneralGateQuery(q, OFF);
  assertEquals(calls, []);

  applyGeneralGateQuery(q, { ...OFF, requireActive: true, minReviews: 7 });
  assertEquals(calls, [
    ["eq", "business_state", "OPERATIONAL"],
    ["gte", "google_review_count", 7],
  ]);
});

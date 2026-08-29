import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  applyGeneralGateQuery,
  clearsGeneralGate,
  generalGateActive,
  isOperational,
  rowClearsGeneralGate,
} from "./discovery-general-gate.ts";
import {
  DISCOVERY_DEFAULTS,
  type GeneralConfig,
  normalizeDiscoveryConfig,
} from "./discovery-config.ts";

const OFF: GeneralConfig = {
  ...DISCOVERY_DEFAULTS.general,
  requireActive: false,
  minReviews: 0,
};
const ACTIVE_ONLY: GeneralConfig = { ...OFF, requireActive: true };

Deno.test("Active is Google's OPERATIONAL, nothing else", () => {
  assert(isOperational("OPERATIONAL"));
  assert(!isOperational("CLOSED_TEMPORARILY"));
  assert(!isOperational("CLOSED_PERMANENTLY"));
  assert(!isOperational(null));
  assert(!isOperational(""));
});

Deno.test("requireActive is ON by default — a closed place is not a result", () => {
  assertEquals(DISCOVERY_DEFAULTS.general.requireActive, true);
  assertEquals(DISCOVERY_DEFAULTS.general.minReviews, 0);
  // The live blob predates both keys; normalize has to supply the default.
  const legacy = normalizeDiscoveryConfig({ general: { categoryCount: 5 } });
  assertEquals(legacy.general.requireActive, true);
  assertEquals(legacy.general.minReviews, 0);
});

Deno.test("normalize clamps and coerces the two knobs", () => {
  assertEquals(
    normalizeDiscoveryConfig({ general: { requireActive: false } }).general
      .requireActive,
    false,
  );
  assertEquals(
    normalizeDiscoveryConfig({ general: { minReviews: -4 } }).general.minReviews,
    0,
  );
  assertEquals(
    normalizeDiscoveryConfig({ general: { minReviews: 12.6 } }).general
      .minReviews,
    13,
  );
  assertEquals(
    normalizeDiscoveryConfig({ general: { minReviews: 1e9 } }).general
      .minReviews,
    100_000,
  );
});

Deno.test("both knobs off admits everything, including an unknown row", () => {
  assert(!generalGateActive(OFF));
  assert(clearsGeneralGate(OFF, { businessStatus: null, reviewCount: null }));
  assert(
    clearsGeneralGate(OFF, {
      businessStatus: "CLOSED_PERMANENTLY",
      reviewCount: 0,
    }),
  );
});

Deno.test("requireActive wipes closed AND unknown", () => {
  assert(generalGateActive(ACTIVE_ONLY));
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
  const floor: GeneralConfig = { ...OFF, minReviews: 25 };
  assert(clearsGeneralGate(floor, { reviewCount: 25 }));
  assert(clearsGeneralGate(floor, { reviewCount: 400 }));
  assert(!clearsGeneralGate(floor, { reviewCount: 24 }));
  assert(!clearsGeneralGate(floor, { reviewCount: 0 }));
  assert(!clearsGeneralGate(floor, { reviewCount: null }));
  assert(!clearsGeneralGate(floor, {}));
  assert(!clearsGeneralGate(floor, { reviewCount: Number.NaN }));
});

Deno.test("the knobs are independent — either one alone excludes", () => {
  const both: GeneralConfig = { ...OFF, requireActive: true, minReviews: 10 };
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

Deno.test("a Mesita row is judged on its own columns — Active off is wiped", () => {
  // The bug Pato saw: a place the operator switched Active OFF still came
  // back from search because on-Mesita rows were waved through.
  assert(!rowClearsGeneralGate(ACTIVE_ONLY, {
    business_status: "CLOSED_TEMPORARILY",
    google_review_count: 308,
  }));
  assert(rowClearsGeneralGate(ACTIVE_ONLY, {
    business_status: "OPERATIONAL",
    google_review_count: 1,
  }));
  assert(!rowClearsGeneralGate(ACTIVE_ONLY, {}));
  assert(rowClearsGeneralGate(OFF, {}));
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
    ["eq", "business_status", "OPERATIONAL"],
    ["gte", "google_review_count", 7],
  ]);
});

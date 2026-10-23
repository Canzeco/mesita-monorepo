import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  applyGeneralGateQuery,
  clearsGeneralGate,
  isOperational,
} from "./discovery-general-gate.ts";
import {
  DISCOVERY_DEFAULTS,
  type GeneralConfig,
  normalizeDiscoveryConfig,
} from "./discovery-config.ts";

const OFF: GeneralConfig = { requireActive: false };
const ACTIVE_ONLY: GeneralConfig = { requireActive: true };

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

Deno.test("no reviews floor: general.minReviews and map.googleMinReviews are dropped (MESITA-2702, MESITA-2721)", () => {
  const cfg = normalizeDiscoveryConfig({
    general: { requireActive: true, minReviews: 10 },
    map: { googleMinReviews: 100 },
  });
  assertEquals(cfg.general, { requireActive: true });
  assertEquals("googleMinReviews" in cfg.map, false);
  assert(clearsGeneralGate(cfg.general, { businessStatus: "OPERATIONAL" }));
});

Deno.test("Active off admits everything, including an unknown row", () => {
  assert(clearsGeneralGate(OFF, { businessStatus: null }));
  assert(clearsGeneralGate(OFF, { businessStatus: "CLOSED_PERMANENTLY" }));
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

  applyGeneralGateQuery(q, ACTIVE_ONLY);
  assertEquals(calls, [["eq", "business_state", "OPERATIONAL"]]);
});

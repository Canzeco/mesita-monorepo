// _shared/config-sections.test.ts
//
// One round trip per SECTION, all ten, against a stand-in for the one
// app_config chain _shared/write-config.ts runs. Ten cases, not one case and
// nine assumptions: the whole point of MESITA-1724's registry is that the
// sections are NOT the same function ten times, so a test that exercised the
// generic path and inferred the rest would prove nothing about the four that
// carry their own validation.
//
// Each section is asserted three ways:
//   READ    the registry key resolves and hands back a config.
//   WRITE   a payload today's console actually sends lands, and the response
//           carries the section's own success shape.
//   REFUSE  a representative bad payload does not land as sent — either a 4xx
//           (the four validating sections plus reservations) or the clamp the
//           coercing sections apply instead. Every section has one; which kind
//           it is IS the section's contract.
//
// The stale-save 409 (rewards) and the enricher's ranged-knob refusal are
// pinned here explicitly: they are the two behaviours the collapse was most
// able to lose, and neither had a test that ran the handler before.

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  CONFIG_SECTION_KEYS,
  CONFIG_SECTIONS,
  readConfigSection,
  writeConfigSection,
} from "./config-sections.ts";
import { DEFAULT_PROMOS_V12 } from "./promos-normalize.ts";

const STAMP = "2026-09-09T00:00:00.000Z";
const USER = "11111111-2222-3333-4444-555555555555";

type Row = Record<string, unknown>;

function seedRow(): Row {
  return {
    controls_config: null,
    discovery_config: null,
    enrichment_config: null,
    enrichment_triggers: null,
    models_config: null,
    ojo_config: null,
    orders_config: null,
    promos_config: null,
    reservations_config: null,
    verification_config: null,
    visits_config: null,
    updated_at: STAMP,
    updated_by: null,
  };
}

/**
 * Stand-in for the two chains the config door runs plus the reservations
 * read's needs-attention feed. `update` mutates the row, so a write followed
 * by a read sees what actually landed.
 */
function fakeAdmin(row: Row): SupabaseClient {
  const pick = (columns: string): Row => {
    const out: Row = {};
    for (const c of columns.split(",").map((s) => s.trim())) out[c] = row[c];
    return out;
  };
  return {
    from(table: string) {
      if (table !== "app_config") {
        // deno-lint-ignore no-explicit-any
        const chain: any = {};
        chain.select = () => chain;
        chain.or = () => chain;
        chain.order = () => chain;
        chain.limit = () => Promise.resolve({ data: [], error: null });
        return chain;
      }
      return {
        select: (columns: string) => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: pick(columns), error: null }),
          }),
        }),
        update: (patch: Row) => {
          Object.assign(row, patch);
          return {
            eq: () => ({
              select: (columns: string) => ({
                single: () =>
                  Promise.resolve({ data: pick(columns), error: null }),
              }),
            }),
          };
        },
      };
    },
    // deno-lint-ignore no-explicit-any
  } as any as SupabaseClient;
}

async function body(res: Response): Promise<Row> {
  return await res.json() as Row;
}

/** What a bad payload must do: refuse with a status, or clamp on the way in. */
type Refusal =
  | { status: number; contains: string }
  | { clamped: (saved: Row) => void };

type SectionCase = {
  /** A payload the console sends today. */
  valid: Row;
  /** The section's own success shape, plus what must have landed. */
  assertSaved: (saved: Row, row: Row) => void;
  /** A payload that must not land as sent. */
  invalid: Row;
  refuse: Refusal;
};

const CASES: Record<string, SectionCase> = {
  controls: {
    valid: {
      config: {
        defaultHoldHours: 3,
        defaultBonusPct: 5,
        maxHoldHours: 72,
        minHoldHours: 0,
        defaultExpiryDays: 90,
        minExpiryDays: 30,
      },
    },
    assertSaved: (saved, row) => {
      assertEquals((saved.config as Row).maxHoldHours, 72);
      assertEquals((row.controls_config as Row).defaultBonusPct, 5);
    },
    // The ceiling below the floor: coerced, never stored as an empty window.
    invalid: { config: { minHoldHours: 100, maxHoldHours: 1 } },
    refuse: {
      clamped: (saved) => {
        const c = saved.config as Row;
        assert(
          (c.maxHoldHours as number) >= (c.minHoldHours as number),
          `maxHoldHours ${c.maxHoldHours} sank below minHoldHours ${c.minHoldHours}`,
        );
      },
    },
  },

  discovery: {
    valid: { config: { slotting: { enabled: true, everyNth: 4 } } },
    assertSaved: (saved) => {
      const c = saved.config as Row;
      assertEquals((c.slotting as Row).everyNth, 4);
      assert(c.weights && typeof c.weights === "object", "weights missing");
    },
    // The weights map is rebuilt from SIGNAL_KEYS, so a retired signal cannot
    // survive in jsonb — it is dropped rather than refused.
    invalid: { config: { weights: { a_signal_that_was_retired: 9 } } },
    refuse: {
      clamped: (saved) => {
        const weights = (saved.config as Row).weights as Row;
        assertEquals(weights.a_signal_that_was_retired, undefined);
      },
    },
  },

  enricher: {
    // FLAT knobs, not { config } — the one section shaped that way. Google
    // keep and Google analyze move together because the funnel lock below
    // reads BOTH the incoming keys and the stored ones.
    valid: { gatherGoogleImages: 8, analyzeGoogleImages: 8, gatherReviews: 20 },
    assertSaved: (saved, row) => {
      // The success shape spreads the config at the top level; there is no
      // `config` key and the console reads atlas* straight off the body.
      assertEquals(saved.atlasGatherGoogleImages, 8);
      assertEquals(saved.atlasGatherReviews, 20);
      assertEquals((row.enrichment_config as Row).atlasGatherGoogleImages, 8);
    },
    invalid: { gatherGoogleImages: 99 },
    refuse: { status: 400, contains: "gatherGoogleImages must be an integer 1-10" },
  },

  models: {
    valid: { config: { supabase: { model: "gpt-4o" } } },
    assertSaved: (saved, row) => {
      assertEquals(((saved.config as Row).supabase as Row).model, "gpt-4o");
      // This section alone returns no updatedAt — the console's coerce owns it.
      assertEquals("updatedAt" in saved, false);
      assertEquals((row.models_config as Row).v, 1);
    },
    invalid: { config: "not an object" },
    refuse: { status: 400, contains: "config must be an object" },
  },

  ojo: {
    valid: {
      config: { enabled: true, autoPassScore: 0.8, reviewFloorScore: 0.4 },
    },
    assertSaved: (saved) => {
      assertEquals((saved.config as Row).autoPassScore, 0.8);
      assertEquals((saved.config as Row).enabled, true);
    },
    // An inverted band would put every proof in one bucket.
    invalid: { config: { autoPassScore: 0.2, reviewFloorScore: 0.9 } },
    refuse: {
      clamped: (saved) => {
        const c = saved.config as Row;
        assert(
          (c.reviewFloorScore as number) <= (c.autoPassScore as number),
          `reviewFloorScore ${c.reviewFloorScore} rose above autoPassScore ${c.autoPassScore}`,
        );
      },
    },
  },

  orders: {
    valid: { config: { enabled: true, monthlyQuotaFree: 5, monthlyQuotaPremium: 30 } },
    assertSaved: (saved) => {
      assertEquals((saved.config as Row).monthlyQuotaPremium, 30);
      assertEquals((saved.config as Row).enabled, true);
    },
    // Premium may never allow fewer orders than Free.
    invalid: { config: { monthlyQuotaFree: 10, monthlyQuotaPremium: 1 } },
    refuse: {
      clamped: (saved) => {
        const c = saved.config as Row;
        assert(
          (c.monthlyQuotaPremium as number) >= (c.monthlyQuotaFree as number),
          `premium ${c.monthlyQuotaPremium} sank below free ${c.monthlyQuotaFree}`,
        );
      },
    },
  },

  reservations: {
    valid: {
      config: { priority: ["phone"], disabled: [], respectAdminOverride: true },
    },
    assertSaved: (saved, row) => {
      assertEquals((saved.config as Row).priority, ["phone"]);
      // attempts is fixed at 2 by protocol whatever the client sent.
      assertEquals((row.reservations_config as Row).attempts, 2);
    },
    invalid: {
      config: { priority: ["carrier-pigeon"], disabled: [], respectAdminOverride: true },
    },
    refuse: { status: 400, contains: "unknown channel" },
  },

  rewards: {
    valid: { config: DEFAULT_PROMOS_V12 },
    assertSaved: (saved, row) => {
      assertEquals((saved.config as Row).version, 12);
      const blob = row.promos_config as Row;
      assert(blob.v12 && typeof blob.v12 === "object", "v12 key not written");
      // The v13 grid/actions fallback is refreshed alongside it.
      assert(blob.grid && typeof blob.grid === "object", "grid fallback missing");
    },
    // A stale tab is showing bundled defaults, not the live rates.
    invalid: { config: { version: 11 } },
    refuse: { status: 409, contains: "out of date" },
  },

  verification: {
    // The console saves ONE switch at a time; the other two must survive.
    valid: { config: { autoVerifyAiCall: false } },
    assertSaved: (saved) => {
      const c = saved.config as Row;
      assertEquals(c.autoVerifyAiCall, false);
      assertEquals(c.autoVerifyAiEmail, true);
      assertEquals(c.createPlacesAsVerified, false);
    },
    invalid: { config: { autoVerifyAiCall: "yes" } },
    refuse: { status: 400, contains: "must be a boolean" },
  },

  visits: {
    valid: { config: { tipPresets: [10, 15, 20], defaultTipPct: 15, payCredits: true } },
    assertSaved: (saved) => {
      assertEquals((saved.config as Row).defaultTipPct, 15);
      assertEquals((saved.config as Row).payCredits, true);
    },
    // The backoff ceiling can never sit below the base interval.
    invalid: { config: { staffPollSeconds: 60, staffPollMaxSeconds: 1 } },
    refuse: {
      clamped: (saved) => {
        const c = saved.config as Row;
        assert(
          (c.staffPollMaxSeconds as number) >= (c.staffPollSeconds as number),
          `ceiling ${c.staffPollMaxSeconds} sank below base ${c.staffPollSeconds}`,
        );
      },
    },
  },
};

Deno.test("every registry key has a round-trip case — no section rides on another's proof", () => {
  assertEquals(
    CONFIG_SECTION_KEYS,
    Object.keys(CASES).sort(),
    "a section was added to the registry without a case in this file, or vice versa",
  );
});

for (const key of Object.keys(CASES).sort()) {
  const kase = CASES[key];

  Deno.test(`${key}: reads back a config`, async () => {
    const row = seedRow();
    const res = await readConfigSection(fakeAdmin(row), key);
    assertEquals(res.status, 200, `${key} read did not answer 200`);
    const payload = await body(res);
    assertEquals(payload.ok, true);
    assert("config" in payload, `${key} read returned no config key`);
  });

  Deno.test(`${key}: accepts the payload the console sends`, async () => {
    const row = seedRow();
    const res = await writeConfigSection(
      { admin: fakeAdmin(row), userId: USER, body: kase.valid },
      key,
    );
    assertEquals(
      res.status,
      200,
      `${key} refused a valid save: ${await res.clone().text()}`,
    );
    const payload = await body(res);
    assertEquals(payload.ok, true);
    assertEquals(row.updated_by, USER, `${key} did not stamp updated_by`);
    kase.assertSaved(payload, row);
  });

  Deno.test(`${key}: does not store a bad payload as sent`, async () => {
    const row = seedRow();
    const res = await writeConfigSection(
      { admin: fakeAdmin(row), userId: USER, body: kase.invalid },
      key,
    );
    const payload = await body(res);
    if ("status" in kase.refuse) {
      assertEquals(
        res.status,
        kase.refuse.status,
        `${key} answered ${res.status}, body: ${JSON.stringify(payload)}`,
      );
      assertEquals(payload.ok, false);
      assertStringIncludes(String(payload.error), kase.refuse.contains);
      return;
    }
    assertEquals(
      res.status,
      200,
      `${key} coerces rather than refuses, so this should have landed`,
    );
    kase.refuse.clamped(payload);
  });
}

// ── The two refusals the collapse was most able to lose ────────────────────

Deno.test("enricher: the image-funnel lock reads the STORED knobs, not just the sent ones", async () => {
  const row = seedRow();
  // Google keep alone, below the analyze count already on the row. The lock
  // has to compare the merged funnel or a one-knob save could quietly ask the
  // pipeline to analyze more images than it downloads.
  const res = await writeConfigSection(
    { admin: fakeAdmin(row), userId: USER, body: { gatherGoogleImages: 5 } },
    "enricher",
  );
  assertEquals(res.status, 400);
  assertStringIncludes(
    String((await body(res)).error),
    "can't exceed Google images kept",
  );
  assertEquals(row.enrichment_config, null, "a refused funnel save still wrote");
});

Deno.test("rewards: a stale save is a 409 and leaves the live blob untouched", async () => {
  const row = seedRow();
  row.promos_config = { v12: DEFAULT_PROMOS_V12, cap: 500 };
  const res = await writeConfigSection(
    { admin: fakeAdmin(row), userId: USER, body: { config: { version: 10 } } },
    "rewards",
  );
  assertEquals(res.status, 409);
  assertEquals(
    (row.promos_config as Row).v12,
    DEFAULT_PROMOS_V12,
    "a refused stale save overwrote the live rates — the exact thing the 409 exists to stop",
  );
  assertEquals(row.updated_by, null);
});

Deno.test("an unknown section is a 400 on both doors, never a silent no-op", async () => {
  const row = seedRow();
  const read = await readConfigSection(fakeAdmin(row), "sourcing");
  assertEquals(read.status, 400);
  assertStringIncludes(String((await body(read)).error), "unknown config section");

  const write = await writeConfigSection(
    { admin: fakeAdmin(row), userId: USER, body: { section: "sourcing" } },
    "sourcing",
  );
  assertEquals(write.status, 400);
  assertEquals(row.updated_by, null, "an unknown section still touched the row");
});

Deno.test("every section declares an app_config column and a normalizer", () => {
  for (const key of CONFIG_SECTION_KEYS) {
    const section = CONFIG_SECTIONS[key];
    assert(
      section.column.endsWith("_config") || section.column.endsWith("_triggers"),
      `${key} names a column that is not an app_config jsonb: ${section.column}`,
    );
    assertEquals(typeof section.normalize, "function", `${key} has no normalizer`);
  }
});

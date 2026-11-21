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

const STAMP = "2026-09-09T00:00:00.000Z";
const USER = "11111111-2222-3333-4444-555555555555";

type Row = Record<string, unknown>;

function seedRow(): Row {
  return {
    discovery_config: null,
    money_config: null,
    enrichment_config: null,
    enrichment_triggers: null,
    models_config: null,
    reservations_config: null,
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
  let writes = 0;
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
        // `.eq("updated_at", x)` makes the write conditional (MESITA-4454):
        // a filter that does not match the row writes nothing.
        update: (patch: Row) => {
          const filters: Array<[string, unknown]> = [];
          const land = () => {
            const match = filters.every(([c, v]) => c === "id" || row[c] === v);
            if (match) Object.assign(row, patch, { updated_at: `${STAMP}+${++writes}` });
            return match;
          };
          // deno-lint-ignore no-explicit-any
          const chain: any = {
            eq: (c: string, v: unknown) => (filters.push([c, v]), chain),
            select: (columns: string) => ({
              single: () => (land(), Promise.resolve({ data: pick(columns), error: null })),
              maybeSingle: () => Promise.resolve({ data: land() ? pick(columns) : null, error: null }),
            }),
          };
          return chain;
        },
      };
    },
    // The stories section's write (MESITA-4425): money_config_merge_story,
    // modelled as the SQL does it — only story_min_followers, merged over
    // the other keys, stamped, answering before and after.
    rpc(fn: string, args: Row) {
      if (fn !== "money_config_merge_story") {
        return Promise.resolve({ data: null, error: { message: `no rpc ${fn}` } });
      }
      const before = (row.money_config ?? {}) as Row;
      const patch = args.p_patch as Row;
      const after = { ...before, ...patch };
      row.money_config = after;
      row.updated_by = args.p_updated_by;
      return Promise.resolve({ data: { before, after, updated_at: STAMP }, error: null });
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
  discovery: {
    // The Catalog box's Save (MESITA-2909, MESITA-3083): the half distance,
    // the exponent, the Popularity root and the page size.
    valid: {
      config: {
        params: { proximity: { halfKm: 3, exponent: 2 }, popularity: { root: 0.5 } },
        map: { catalogPageSize: 30 },
      },
    },
    assertSaved: (saved) => {
      const c = saved.config as Row;
      assertEquals(((c.params as Row).proximity as Row).halfKm, 3);
      assertEquals(((c.params as Row).proximity as Row).exponent, 2);
      assertEquals(((c.params as Row).popularity as Row).root, 0.5);
      assertEquals((c.map as Row).catalogPageSize, 30);
      assert(c.map && typeof c.map === "object", "map missing");
    },
    // Coerced, not stored as sent: a root of 0 lands clamped at 0.1, a
    // half distance of 999 at 100, a typed bag's retired field (the reach,
    // MESITA-2703) and a top-level retired key (the linear `balance`) are
    // dropped. An untyped key under `params` (the weights table
    // `params.modes`, MESITA-2687) waits for its migration (H-2, MESITA-4454).
    invalid: {
      config: {
        params: {
          popularity: { halfReviews: 0, root: 0 },
          proximity: { reachKm: 99, halfKm: 999 },
          modes: { nearby: { proximity: 2 } },
        },
        balance: { proximity: 2 },
      },
    },
    refuse: {
      clamped: (saved) => {
        const c = saved.config as Row;
        assertEquals((c.params as Row).popularity, { root: 0.1, starsPower: 6 });
        assertEquals((c.params as Row).proximity, { halfKm: 100, exponent: 1 });
        assertEquals("modes" in (c.params as Row), true);
        assertEquals("balance" in c, false);
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
      assertEquals(saved.enrichGatherGoogleImages, 8);
      assertEquals(saved.enrichGatherReviews, 20);
      assertEquals((row.enrichment_config as Row).enrichGatherGoogleImages, 8);
    },
    invalid: { gatherGoogleImages: 99 },
    refuse: { status: 400, contains: "gatherGoogleImages must be an integer 1-10" },
  },

  models: {
    // An older console still sends the dead `supabase` / `ojo` keys
    // (MESITA-2144): the save lands, and they are not written back.
    valid: {
      config: { memo: { model: "gpt-4o" }, supabase: { model: "gpt-4o" }, ojo: { model: "gpt-4o" } },
    },
    assertSaved: (saved, row) => {
      assertEquals(((saved.config as Row).memo as Row).model, "gpt-4o");
      // This section alone returns no updatedAt — the console's coerce owns it.
      assertEquals("updatedAt" in saved, false);
      const stored = row.models_config as Row;
      assertEquals(stored.v, 1);
      assertEquals(Object.keys(stored).sort(), ["embeddings", "enricher", "memo", "v"]);
      assertEquals(stored.enricher, { model: "gpt-6-luna" });
    },
    invalid: { config: "not an object" },
    refuse: { status: 400, contains: "config must be an object" },
  },

  reservations: {
    // A deployed console may still post the retired priority / disabled /
    // attempts (MESITA-2144) and respectAdminOverride (MESITA-2424) keys: the
    // save lands, and they are not written back.
    valid: {
      config: { priority: ["phone"], disabled: [], respectAdminOverride: true, attempts: 2 },
    },
    assertSaved: (saved, row) => {
      assertEquals((saved.config as Row).reminder, { enabled: false });
      const stored = row.reservations_config as Row;
      for (const key of ["priority", "disabled", "attempts", "respectAdminOverride"]) {
        assertEquals(key in stored, false, `${key} was written back`);
      }
    },
    invalid: {
      config: { testCall: "yes" },
    },
    refuse: { status: 400, contains: "testCall must be an object" },
  },

  stories: {
    // Admin › Configurations › Stories (MESITA-4425): the follower floor.
    valid: { config: { story_min_followers: 500 } },
    assertSaved: (saved, row) => {
      assertEquals((saved.config as Row).story_min_followers, 500);
      assertEquals((row.money_config as Row).story_min_followers, 500);
    },
    // Refused, not clamped: a money rule never lands as something nobody typed.
    invalid: { config: { story_min_followers: "abc" } },
    refuse: { status: 400, contains: "story_min_followers must be a whole number" },
  },
};

Deno.test("stories: the read shows only Story keys; a save keeps every other money_config key (MESITA-4425)", async () => {
  const row = seedRow();
  row.money_config = { buying_paused: true, express_wallets: ["apple_pay"], sending_live: false, story_bonus_wait_sec: 10800 };
  const read = await body(await readConfigSection(fakeAdmin(row), "stories"));
  assertEquals(read.config, {
    story_min_followers: 1000,
    story_bonus_wait_sec: 10800,
    story_post_window_sec: 43200,
    story_emulator: false,
    story_emulator_bonus_wait_sec: 30,
    story_emulator_post_window_sec: 120,
  });
  assertEquals(typeof read.payments_live, "boolean");
  assert(["meta", "emulated", "unavailable"].includes(String(read.story_mode)));
  const saved = await writeConfigSection({ admin: fakeAdmin(row), userId: USER, body: { section: "stories", config: { story_min_followers: 0 } } }, "stories");
  assertEquals(saved.status, 200);
  assertEquals(row.money_config, { buying_paused: true, express_wallets: ["apple_pay"], sending_live: false, story_bonus_wait_sec: 10800, story_min_followers: 0 });
  for (const bad of [
    { story_min_followers: 1_000_001 }, { story_min_followers: 2.5 }, { story_min_followers: -1 }, { buying_paused: false }, {},
    // MESITA-4426: the emulator keys are typed and ranged too.
    { story_emulator: "true" }, { story_emulator_bonus_wait_sec: 9 }, { story_emulator_bonus_wait_sec: 601 },
    { story_emulator_post_window_sec: 59 }, { story_emulator_post_window_sec: 3601 },
  ]) {
    const res = await writeConfigSection({ admin: fakeAdmin(row), userId: USER, body: { section: "stories", config: bad } }, "stories");
    assertEquals(res.status, 400, JSON.stringify(bad));
  }
  assertEquals((row.money_config as Row).buying_paused, true);
});

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

Deno.test("an inherited key is unknown too, not a handler with no column", async () => {
  // `CONFIG_SECTIONS["__proto__"]` is a truthy object. A `if (!section)` guard
  // would hand it to the generic read, which would build a select on
  // `undefined` and answer 500 on a PostgREST parse error instead of saying
  // which section names are real.
  const row = seedRow();
  for (const key of ["__proto__", "constructor", "toString"]) {
    const res = await readConfigSection(fakeAdmin(row), key);
    assertEquals(res.status, 400, `${key} was not rejected as unknown`);
    assertStringIncludes(String((await body(res)).error), "unknown config section");
  }
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

// ── MESITA-4454: the Discovery write keeps what it did not send, and a stale
// page cannot overwrite a newer save ─────────────────────────────────────────

Deno.test("discovery: an old-shape save keeps params.recipes, params.mix and retired keys (H-2)", async () => {
  const row = seedRow();
  row.discovery_config = {
    params: {
      recipes: { catalogNearbyOrganic: { halfKm: 0.3, distanceExp: 4, googleExp: 0.33, premierExp: 0 } },
      mix: { adEvery: 3 },
      popularity: { root: 0.2, starsPower: 6 },
    },
    map: { popularityRoot: 0.4, placesShown: 40 },
  };
  // What a console from before the recipes sends: the old params, no
  // recipes, no mix.
  const res = await writeConfigSection(
    {
      admin: fakeAdmin(row),
      userId: USER,
      body: { config: { params: { proximity: { halfKm: 2, exponent: 1 }, popularity: { root: 0.5 } }, map: { placesShown: 30 } } },
    },
    "discovery",
  );
  assertEquals(res.status, 200);
  const stored = row.discovery_config as Row;
  const params = stored.params as Row;
  assertEquals((params.recipes as Row).catalogNearbyOrganic, { halfKm: 0.3, distanceExp: 4, googleExp: 0.33, premierExp: 0 });
  assertEquals((params.mix as Row).adEvery, 3);
  assertEquals((params.popularity as Row).root, 0.5);
  assertEquals((stored.map as Row).popularityRoot, 0.4);
  assertEquals((stored.map as Row).placesShown, 30);
  // And the answer carries what landed.
  const saved = (await body(res)).config as Row;
  assertEquals(((saved.params as Row).mix as Row).adEvery, 3);
});

Deno.test("discovery: saving one card never drops another's keys, in either order", async () => {
  const row = seedRow();
  const admin = fakeAdmin(row);
  const mixing = { config: { params: { mix: { adEvery: 2, adFloor: 0.3, temperature: { nearby: 0.1, family: 0.2, popular: 0.4 } } }, map: { catalogPageSize: 25 } } };
  const mapCard = { config: { map: { placesShown: 33, dotsShown: 120, reloadIdleSec: 2 } } };
  for (const order of [[mixing, mapCard], [mapCard, mixing]]) {
    row.discovery_config = null;
    for (const b of order) {
      const res = await writeConfigSection({ admin, userId: USER, body: b }, "discovery");
      assertEquals(res.status, 200);
    }
    const c = row.discovery_config as Row;
    assertEquals(((c.params as Row).mix as Row).adEvery, 2);
    assertEquals((c.map as Row).catalogPageSize, 25);
    assertEquals((c.map as Row).placesShown, 33);
    assertEquals((c.map as Row).dotsShown, 120);
  }
});

Deno.test("discovery: expectedUpdatedAt makes the write conditional; a stale page gets 409 config_conflict (H-3)", async () => {
  const row = seedRow();
  const admin = fakeAdmin(row);
  // Two pages load the same updatedAt.
  const loaded = String(row.updated_at);
  const first = await writeConfigSection(
    { admin, userId: USER, body: { config: { params: { mix: { adEvery: 2 } } }, expectedUpdatedAt: loaded } },
    "discovery",
  );
  assertEquals(first.status, 200);
  const firstBody = await body(first);
  assert(firstBody.updatedAt !== loaded, "the save did not move updatedAt");
  // The second page still holds the old stamp: refused, nothing written.
  const second = await writeConfigSection(
    { admin, userId: USER, body: { config: { params: { mix: { adEvery: 5 } } }, expectedUpdatedAt: loaded } },
    "discovery",
  );
  assertEquals(second.status, 409);
  const refused = await body(second);
  assertEquals([refused.ok, refused.code], [false, "config_conflict"]);
  assertEquals((((row.discovery_config as Row).params as Row).mix as Row).adEvery, 2);
  // With the fresh stamp it lands.
  const third = await writeConfigSection(
    { admin, userId: USER, body: { config: { params: { mix: { adEvery: 5 } } }, expectedUpdatedAt: firstBody.updatedAt } },
    "discovery",
  );
  assertEquals(third.status, 200);
  assertEquals((((row.discovery_config as Row).params as Row).mix as Row).adEvery, 5);
  // A non-string precondition is refused before any write.
  const bad = await writeConfigSection(
    { admin, userId: USER, body: { config: {}, expectedUpdatedAt: 12 } },
    "discovery",
  );
  assertEquals(bad.status, 400);
});

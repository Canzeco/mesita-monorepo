import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  ENRICHMENT_TRIGGERS_DEFAULTS,
  normalizeEnrichmentTriggers,
  RUN_TRIGGERS,
  stampsEnrichedAt,
  subprocessesFor,
  TRIGGER_KEYS,
  TRIGGER_META,
} from "./enrich-triggers.ts";

// THE SHIP GATE for a grid no console renders any more.
//
// It went in three steps. The Triggers TAB became a box (Pato, 2026-08-21:
// "delete the triggers shit … only one tab in that section"), rendering less
// than the tab did — no Cooldown column, emitterless rows behind a disclosure.
// Then the box went with the whole page (Pato, 2026-08-23: "Fuck this page.
// Just write it as soon"): apps/web-admin's Enrichment route is a Soon page,
// and NOTHING writes app_config.enrichment_triggers from a UI today.
//
// The gates did not move. on_update and on_reservation_failed are still LIVE
// readers whose resolved subprocess lists gate real Apify / Firecrawl /
// Perplexity spend — three independent audits said so, and deleting the console changed
// none of it. What changed is who can flip a cell: admin-web-update-enricher-
// config, called directly, is the last write door.
//
// So the whole-blob hazard is now the ONLY hazard. Every write is a full `cfg`
// post, and a key nothing renders round-trips only for as long as normalize
// keeps carrying it. These tests are what goes red if it stops.

/** A key that no surface renders — carried by normalize alone. */
const UNRENDERED_COLUMN = "cooldownHours";

Deno.test("normalize: a stored cooldownHours survives a save that renders no cooldown control", () => {
  // Exactly what a partial writer posts: the seeded blob, patched only on the
  // cells it cares about. cooldownHours rides along untouched.
  const stored = structuredClone(ENRICHMENT_TRIGGERS_DEFAULTS);
  stored.on_create.cooldownHours = 72;
  stored.on_visit.cooldownHours = 12;

  const out = normalizeEnrichmentTriggers(stored);
  assertEquals(out.on_create.cooldownHours, 72);
  assertEquals(out.on_visit.cooldownHours, 12);
});

Deno.test("normalize: an absent cooldownHours comes back at its default, never undefined", () => {
  const stripped = structuredClone(ENRICHMENT_TRIGGERS_DEFAULTS) as Record<
    string,
    Record<string, unknown>
  >;
  for (const key of Object.keys(stripped)) delete stripped[key][UNRENDERED_COLUMN];

  const out = normalizeEnrichmentTriggers(stripped) as unknown as Record<
    string,
    Record<string, unknown>
  >;
  for (const key of Object.keys(ENRICHMENT_TRIGGERS_DEFAULTS)) {
    assertEquals(
      typeof out[key][UNRENDERED_COLUMN],
      "number",
      `${key}.${UNRENDERED_COLUMN} must survive an absent read`,
    );
  }
});

Deno.test("normalize: a STAGED row's cells survive a save made while it sat behind the disclosure", () => {
  // The five emitterless rows were the ones behind the disclosure, and now no
  // row is rendered at all. Either way their cells are still stored and still
  // posted. This pins that a stored choice on one of them is not quietly reset
  // by a save driven from the live rows.
  const stored = structuredClone(ENRICHMENT_TRIGGERS_DEFAULTS);
  stored.on_reservation_failed.enabled = true;
  stored.on_reservation_failed.subprocesses.links = true;

  const out = normalizeEnrichmentTriggers(stored);
  assertEquals(out.on_reservation_failed.enabled, true);
  assertEquals(out.on_reservation_failed.subprocesses.links, true);
});

// ── the live/staged split, which outlived the console that rendered it ──────

Deno.test("TRIGGER_META: exactly the rows some code reads are marked live", () => {
  // The folded page split the grid on `staged`, which is when this flag stopped
  // being decoration. The page is gone and the flag is not: it is what tells the
  // next reader which rows are wired. `staged` means NOTHING READS THIS ROW —
  // not "this row seeds no run".
  //
  // The readers, exhaustively:
  //   on_update   — admin-web-update-place resolves it and skips the
  //                 follower refresh / the re-embed (MESITA-1188). It is the
  //                 one reader that WITHHOLDS work instead of scheduling it,
  //                 which is why it is live without being an emitter.
  //   on_reservation_failed — eleven-a1-report-outcome resolves it and runs
  //                 the Google-only refetch (_shared/google-refetch.ts,
  //                 MESITA-2420) on a "wrong_number" verdict, the one
  //                 terminal, unambiguous signal the stored channel is stale
  //                 (MESITA-1189). declined/counter_offer/confirmed mean the
  //                 channel worked; unreachable is documented as retryable.
  // on_create / on_visit / on_order / on_reservation_ok have no reader (both
  // create doors save a ready place and never seed the Enricher) and must
  // stay staged until one exists.
  const live = Object.entries(TRIGGER_META)
    .filter(([, m]) => !m.staged)
    .map(([k]) => k)
    .sort();

  assertEquals(live, [
    "on_reservation_failed",
    "on_update",
  ]);
});

// ── on_update: wired, and still forbidden from re-deriving anything ─────────
//
// MESITA-1188 made this row load-bearing. The guardrail it must never lose:
// an edit is GROUND TRUTH, so on_update may never re-derive google / reviews /
// serp / links / images / synthesis / photos. Re-scraping there would overwrite
// the person who just fixed the record — the one way this system loses
// information. lockedCell() forces those seven false and the normalizer applies
// it, so wiring the row cannot route around the lock.

Deno.test("on_update: the seven locked cells stay false even when stored true", () => {
  const hostile = structuredClone(ENRICHMENT_TRIGGERS_DEFAULTS);
  for (const key of Object.keys(hostile.on_update.subprocesses)) {
    (hostile.on_update.subprocesses as Record<string, boolean>)[key] = true;
  }

  const out = normalizeEnrichmentTriggers(hostile);

  for (
    const locked of [
      "google",
      "reviews",
      "serp",
      "links",
      "images",
      "synthesis",
      "photos",
    ]
  ) {
    assertEquals(
      (out.on_update.subprocesses as Record<string, boolean>)[locked],
      false,
      `on_update.${locked} must stay locked off — an edit is ground truth`,
    );
  }
  // The two the operator actually owns survive the same pass.
  assertEquals(out.on_update.subprocesses.social, true);
  assertEquals(out.on_update.subprocesses.embedding, true);
});

Deno.test("on_update: the matrix still offers social + embedding", () => {
  // The social cell stays in the matrix. admin-web-update-place no longer
  // buys a scrape from it (MESITA-2183): a changed URL empties that source,
  // and the Reviews tab is the only fetch. Embedding is still gated on
  // `.includes("embedding")`.
  const buys = subprocessesFor(ENRICHMENT_TRIGGERS_DEFAULTS, "on_update").sort();
  assertEquals(buys, ["embedding", "social"]);
});

Deno.test("on_update: a disabled row buys nothing, so the update path does neither side effect", () => {
  const cfg = structuredClone(ENRICHMENT_TRIGGERS_DEFAULTS);
  cfg.on_update.enabled = false;
  assertEquals(subprocessesFor(cfg, "on_update"), []);
});

Deno.test("on_update: turning one cell off leaves the other side effect alone", () => {
  const cfg = structuredClone(ENRICHMENT_TRIGGERS_DEFAULTS);
  cfg.on_update.subprocesses.social = false;
  const buys = subprocessesFor(normalizeEnrichmentTriggers(cfg), "on_update");
  assertEquals(buys.includes("social"), false);
  assertEquals(buys.includes("embedding"), true);
});

Deno.test("on_reservation_failed: buys google only, NOT links (MESITA-1189)", () => {
  // eleven-a1-report-outcome resolves this on a wrong_number verdict. Links
  // rediscovery finds website/Instagram/Facebook URLs, never a phone number
  // (enrich-channel-discovery.ts), and the reservation selector has been
  // phone-only since MESITA-842 — so a links purchase here has no causal path
  // to the failure it would react to. Only `google` can fix a stale phone.
  const buys = subprocessesFor(ENRICHMENT_TRIGGERS_DEFAULTS, "on_reservation_failed").sort();
  assertEquals(buys, ["google"]);
});

Deno.test("on_reservation_failed: default cooldown is 24h, not 0", () => {
  // A wrong number is a standing fact, not an event to re-check minutes
  // later — 0 would let a chatty guest re-fire the refetch on every retry.
  assertEquals(ENRICHMENT_TRIGGERS_DEFAULTS.on_reservation_failed.cooldownHours, 24);
});

Deno.test("subprocessesFor: a disabled live row buys nothing", () => {
  // An empty list is what admin-web-update-place reads as "withhold every
  // refresh".
  const cfg = structuredClone(ENRICHMENT_TRIGGERS_DEFAULTS);
  cfg.on_update.enabled = false;

  assertEquals(subprocessesFor(cfg, "on_update"), []);
});

Deno.test("subprocessesFor: an enabled row buys exactly its true cells", () => {
  const cfg = structuredClone(ENRICHMENT_TRIGGERS_DEFAULTS);
  const bought = subprocessesFor(cfg, "on_create");

  assert(bought.length > 0, "on_create must buy something by default");
  for (const key of bought) {
    assertEquals(
      cfg.on_create.subprocesses[key as keyof typeof cfg.on_create.subprocesses],
      true,
      `${key} was bought but its cell is not true`,
    );
  }
});

// ── The run vocabulary is pinned to a DB CHECK (MESITA-1185) ──────────────
//
// place_enrichment_runs.trigger_key carries
//   check (trigger_key in ('on_create','on_update','on_schedule','on_visit',
//                          'on_order','on_reservation_ok','on_reservation_failed','manual'))
// in migration 20260823005430. Postgres enforces it; nothing in TypeScript does,
// so an added RunTrigger would type-check, deploy, and then fail at INSERT — on
// a money-spending path, at the moment a run starts. Same idiom as
// crenup-ladder.test.ts pinning `step ~ '^S([0-9]{1,2}|X)$'` from this side.
// `on_schedule` left the code first (MESITA-2144) and the CHECK keeps it until
// the drop migration: a subset of the CHECK never fails an INSERT.
Deno.test("runs: the run vocabulary matches the DB CHECK, literal for literal", () => {
  assertEquals([...RUN_TRIGGERS], [
    "on_create",
    "on_update",
    "on_visit",
    "on_order",
    "on_reservation_ok",
    "on_reservation_failed",
    "manual",
  ]);
});

// The two vocabularies are SIBLINGS, not one list. TRIGGER_KEYS is what the
// matrix prices — six rows, six cooldowns, nine checkboxes each.
// RUN_TRIGGERS is what the history records, and it adds `manual`, which must
// never become a matrix row: the Run-now button clears `subprocesses` and
// ignores cooldown, so a grid row for it would be an unenforced config.
Deno.test("runs: `manual` is a run trigger and NOT a matrix trigger", () => {
  assertEquals(RUN_TRIGGERS.includes("manual"), true);
  assertEquals((TRIGGER_KEYS as string[]).includes("manual"), false);
  assertEquals(Object.keys(TRIGGER_META).includes("manual"), false);
  // RUN_TRIGGERS is TRIGGER_KEYS plus exactly one more.
  assertEquals(RUN_TRIGGERS.length, TRIGGER_KEYS.length + 1);
  for (const k of TRIGGER_KEYS) {
    assertEquals((RUN_TRIGGERS as readonly string[]).includes(k), true);
  }
});

// ── The Enriched stamp (MESITA-2154) ─────────────────────────────────────────
//
// `enriched_at` IS the Enriched fact: every server and app reader asks only
// "is it set". The contents stage is its one writer, and it must stamp only a
// run that paid for synthesis. The wrong-number refetch buys `google` alone;
// if it stamped, a Created place would read as Enriched after one bad phone
// number, with every other gate green.

Deno.test("stampsEnrichedAt: a run that buys everything (null) stamps", () => {
  assertEquals(stampsEnrichedAt(null), true);
  assertEquals(stampsEnrichedAt(undefined), true);
});

Deno.test("stampsEnrichedAt: a google-only run does NOT stamp", () => {
  assertEquals(stampsEnrichedAt(["google"]), false);
  assertEquals(stampsEnrichedAt([]), false);
  assertEquals(stampsEnrichedAt(["google", "photos", "embedding"]), false);
});

Deno.test("stampsEnrichedAt: any purchase that includes synthesis stamps", () => {
  assertEquals(stampsEnrichedAt(["synthesis"]), true);
  assertEquals(stampsEnrichedAt(["google", "reviews", "synthesis"]), true);
});

Deno.test("stampsEnrichedAt: the shipped wrong-number refetch never stamps; on_create does", () => {
  const cfg = ENRICHMENT_TRIGGERS_DEFAULTS;
  assertEquals(stampsEnrichedAt(subprocessesFor(cfg, "on_reservation_failed")), false);
  assertEquals(stampsEnrichedAt(subprocessesFor(cfg, "on_create")), true);
});

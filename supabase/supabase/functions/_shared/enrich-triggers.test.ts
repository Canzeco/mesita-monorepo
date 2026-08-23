import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  ENRICHMENT_TRIGGERS_DEFAULTS,
  normalizeEnrichmentTriggers,
  RUN_TRIGGERS,
  subprocessesFor,
  TRIGGER_KEYS,
  TRIGGER_META,
} from "./enrich-triggers.ts";

// THE SHIP GATE for folding the Triggers tab into the single Enrichment page
// (Pato, 2026-08-21: "delete the triggers shit … only one tab in that section").
//
// The tab could not be deleted — three independent audits confirmed on_create
// and on_schedule are LIVE emitters whose resolved subprocess list gates real
// Apify / Firecrawl / Perplexity spend, and this console is their ONLY write
// surface. So the tab became a box, and the box renders LESS than the tab did:
// the Cooldown column is gone entirely, and the emitterless rows moved behind a
// disclosure.
//
// That makes this the classic whole-blob hazard. The Triggers save posts the
// entire `cfg` object, so a knob that stops being RENDERED still round-trips —
// but only for as long as nobody "tidies" save() into rebuilding its payload
// from the rows on screen. These tests are what goes red if someone does.

/** Every key whose control the folded page no longer renders. */
const UNRENDERED_COLUMN = "cooldownHours";

Deno.test("normalize: a stored cooldownHours survives a save that renders no cooldown control", () => {
  // Exactly what the folded client posts: the seeded blob, patched only on the
  // cells it still shows. cooldownHours rides along untouched.
  const stored = structuredClone(ENRICHMENT_TRIGGERS_DEFAULTS);
  stored.on_create.cooldownHours = 72;
  stored.on_schedule.cooldownHours = 12;

  const out = normalizeEnrichmentTriggers(stored);
  assertEquals(out.on_create.cooldownHours, 72);
  assertEquals(out.on_schedule.cooldownHours, 12);
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
  // The five emitterless rows are still rendered (inside a <details>), so their
  // cells are still editable and still posted. This pins that an operator's
  // stored choice on one of them is not quietly reset by a save driven from the
  // live rows above it.
  const stored = structuredClone(ENRICHMENT_TRIGGERS_DEFAULTS);
  stored.on_reservation_failed.enabled = true;
  stored.on_reservation_failed.subprocesses.links = true;

  const out = normalizeEnrichmentTriggers(stored);
  assertEquals(out.on_reservation_failed.enabled, true);
  assertEquals(out.on_reservation_failed.subprocesses.links, true);
});

// ── the live/staged split the console now renders on ────────────────────────

Deno.test("TRIGGER_META: exactly the rows some code reads are marked live", () => {
  // The folded page splits the grid on `staged`, so this flag stopped being
  // decoration the moment it decided which table a row lands in. `staged` means
  // NOTHING READS THIS ROW — not "this row seeds no run".
  //
  // The readers, exhaustively:
  //   on_create   — create-place.ts resolves subprocessesFor(t, "on_create")
  //                 and hard-skips the first run when the row buys nothing.
  //   on_schedule — queue_due_place_enrichments() resolves it in SQL every
  //                 15 minutes and queues zero rows when it is disabled.
  //   on_update   — business-web-update-project resolves it and skips the
  //                 follower refresh / the re-embed (MESITA-1188). It is the
  //                 one reader that WITHHOLDS work instead of scheduling it,
  //                 which is why it is live without being an emitter.
  // There is no fourth. on_visit / on_order / on_reservation_* still have no
  // reader (MESITA-1189) and must stay staged until one exists.
  const live = Object.entries(TRIGGER_META)
    .filter(([, m]) => !m.staged)
    .map(([k]) => k)
    .sort();

  assertEquals(live, ["on_create", "on_schedule", "on_update"]);
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

Deno.test("on_update: what the update path is allowed to buy is exactly social + embedding", () => {
  // business-web-update-project gates on `.includes("social")` and
  // `.includes("embedding")`. If this list ever grows, that EF starts
  // re-deriving a field a human just typed.
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

Deno.test("subprocessesFor: a disabled live row buys nothing", () => {
  // An empty list is what create-place.ts turns into a hard skip of the
  // first-run pipeline, and what makes the */15 scheduler queue zero rows.
  const cfg = structuredClone(ENRICHMENT_TRIGGERS_DEFAULTS);
  cfg.on_create.enabled = false;

  assertEquals(subprocessesFor(cfg, "on_create"), []);
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
// pulse-pieces.test.ts pinning `step ~ '^S[0-9]$'` from this side.
Deno.test("runs: the run vocabulary matches the DB CHECK, literal for literal", () => {
  assertEquals([...RUN_TRIGGERS], [
    "on_create",
    "on_update",
    "on_schedule",
    "on_visit",
    "on_order",
    "on_reservation_ok",
    "on_reservation_failed",
    "manual",
  ]);
});

// The two vocabularies are SIBLINGS, not one list. TRIGGER_KEYS is what the
// matrix prices — seven rows, seven cooldowns, nine checkboxes each.
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

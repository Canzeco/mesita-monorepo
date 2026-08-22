import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  ENRICHMENT_TRIGGERS_DEFAULTS,
  normalizeEnrichmentTriggers,
  subprocessesFor,
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

Deno.test("TRIGGER_META: exactly the rows with a real emitter are marked live", () => {
  // The folded page splits the grid on `staged`, so this flag stopped being
  // decoration the moment it decided which table a row lands in.
  //
  // The emitters, exhaustively: create-place.ts calls
  // subprocessesFor(triggers, "on_create"), and queue_due_place_enrichments()
  // resolves on_schedule in SQL. There is no third.
  const live = Object.entries(TRIGGER_META)
    .filter(([, m]) => !m.staged)
    .map(([k]) => k)
    .sort();

  assertEquals(live, ["on_create", "on_schedule"]);
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

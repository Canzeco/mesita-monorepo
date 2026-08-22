import { assertEquals } from "jsr:@std/assert@1";
import {
  PULSE_PIECES,
  PULSE_TOTAL,
  completedPulsePieces,
  pulseHighWater,
} from "./pulse-pieces.ts";

const at = (n: number) => `2026-08-22T10:00:${String(n).padStart(2, "0")}Z`;
const done = (step: string, n = 0) => ({
  step_name: step,
  status: "completed",
  created_at: at(n),
});

Deno.test("pulse: the ladder fits inside the DB's single-digit step CHECK", () => {
  // place_enrichment_events.step is `check (step ~ '^S[0-9]$')`, so S9 is the
  // last value Postgres accepts. reportPulsePieces stamps `S${meta.index}`.
  //
  // A tenth rung would type-check (reportEnrichmentStep takes the open template
  // `S${number}`), be REJECTED by Postgres, and have its error swallowed by
  // enrich-pipeline.ts — the piece would never record, the meter would cap at 9
  // forever, and no surface would report a failure. This test is the only thing
  // that fails loudly first (MESITA-1219).
  assertEquals(
    PULSE_TOTAL <= 9,
    true,
    "place_enrichment_events.step is CHECK (step ~ '^S[0-9]$') — a tenth piece " +
      "stamps S10, is rejected by Postgres, and the error is swallowed. Widen " +
      "the constraint with a migration BEFORE adding a rung.",
  );
});

Deno.test("pulse: `seed` is the S0 GATE and is NOT a step", () => {
  // 0 means the seed is in place and nothing after it landed. If `seed` were a
  // member, a seeded place would read 1 and the ladder would be off by one
  // against the spec and against Map/Swipe's gate.
  assertEquals((PULSE_PIECES as readonly string[]).includes("seed"), false);
});

Deno.test("pulse: social runs BEFORE images, menu after both", () => {
  // Load-bearing order. The IG/FB gathers fill the pools the vision funnel
  // ranks, so images any earlier would rank Google photos and nothing else.
  const i = (k: string) => (PULSE_PIECES as readonly string[]).indexOf(k);
  assertEquals(i("social") < i("images"), true);
  assertEquals(i("images") < i("menu"), true);
  assertEquals(i("links") < i("menu"), true);
});

Deno.test("pulse: embeddings is LAST — it vectorizes what semantics wrote", () => {
  assertEquals(PULSE_PIECES[PULSE_PIECES.length - 1], "embeddings");
  const i = (k: string) => (PULSE_PIECES as readonly string[]).indexOf(k);
  assertEquals(i("semantics") < i("embeddings"), true);
});

Deno.test("pulse: the nine, in the decided order", () => {
  // The law: Docs › Enrichment §A. S0 seed is a GATE, not a member.
  assertEquals([...PULSE_PIECES], [
    "pulse",
    "details",
    "links",
    "social",
    "images",
    "menu",
    "reviews",
    "semantics",
    "embeddings",
  ]);
  assertEquals(PULSE_TOTAL, 9);
});

Deno.test("high water: nothing recorded is 0", () => {
  assertEquals(pulseHighWater([]), 0);
});

Deno.test("high water: a full queue is 9", () => {
  assertEquals(pulseHighWater(PULSE_PIECES.map((p, i) => done(p, i))), 9);
});

Deno.test("high water: it is HOW FAR, not how many", () => {
  // The distinction the whole model rests on. Eight pieces completed, but
  // `links` (3) never did, so the queue got to 2 — not 8. A profile built past
  // a hole is built on incomplete data, which is why the queue is linear.
  const events = PULSE_PIECES.filter((p) => p !== "links").map((p, i) =>
    done(p, i)
  );
  assertEquals(completedPulsePieces(events).length, 8);
  assertEquals(pulseHighWater(events), 2);
});

Deno.test("high water: a failed piece stops the count at the one before it", () => {
  assertEquals(
    pulseHighWater([
      done("pulse", 1),
      done("details", 2),
      { step_name: "links", status: "failed", created_at: at(3) },
      done("social", 4),
    ]),
    2,
  );
});

Deno.test("high water: a piece a run did not buy simply has no event", () => {
  // MESITA-1172 blocker 2. The matrix lets a cheap refresh buy a subset, so a
  // piece it did not run writes NOTHING and keeps whatever an earlier run
  // recorded. State accumulates across runs rather than being reset by the
  // cheapest one — here an earlier full run got to 4, and a refresh that only
  // re-ran `seed` does not knock it back down.
  const earlier = [done("pulse", 1), done("details", 2), done("links", 3), done("social", 4)];
  const refresh = [done("pulse", 9)];
  assertEquals(pulseHighWater([...earlier, ...refresh]), 4);
});

Deno.test("high water: absence is a RESULT — a place with no Instagram still reaches 9", () => {
  // The piece ran, resolved "there is nothing here", and is completed. Marking
  // it failed would punish a place for a fact about the world.
  const events = PULSE_PIECES.map((p, i) =>
    p === "social"
      ? { step_name: "social", status: "completed", created_at: at(i) }
      : done(p, i)
  );
  assertEquals(pulseHighWater(events), 9);
});

Deno.test("high water: a re-enrich that fixes a piece RAISES the number", () => {
  assertEquals(
    pulseHighWater([
      done("pulse", 1),
      { step_name: "details", status: "failed", created_at: at(2) },
      done("links", 3),
      done("details", 8), // the later, successful attempt wins
    ]),
    3,
  );
});

Deno.test("high water: a re-enrich that breaks a piece LOWERS it", () => {
  assertEquals(
    pulseHighWater([
      done("pulse", 1),
      done("details", 2),
      done("links", 3),
      { step_name: "details", status: "failed", created_at: at(9) },
    ]),
    1,
  );
});

Deno.test("high water: legacy stage beacons are not pieces", () => {
  // The rows written before any of this: gather / images / publish. `images`
  // collides with a real piece name, so a reader that did not filter would
  // read a stage beacon as pipeline progress.
  assertEquals(
    pulseHighWater([
      { step_name: "gather", status: "completed", created_at: at(1) },
      { step_name: "publish", status: "completed", created_at: at(2) },
    ]),
    0,
  );
});

Deno.test("high water: `skipped` does not advance the queue", () => {
  // Pieces are never skipped for not being bought — that writes nothing at
  // all. If a `skipped` ever reaches here it means the piece did not run, so
  // it must not count as progress.
  assertEquals(
    pulseHighWater([
      done("pulse", 1),
      { step_name: "details", status: "skipped", created_at: at(2) },
      done("links", 3),
    ]),
    1,
  );
});

Deno.test("high water: never exceeds the total, and never goes negative", () => {
  const n = pulseHighWater([...PULSE_PIECES, ...PULSE_PIECES].map((p, i) => done(p, i)));
  assertEquals(n >= 0 && n <= PULSE_TOTAL, true);
  assertEquals(n, 9);
});

// ── the guard MESITA-1209 needed ──────────────────────────────────────────
//
// The bug: supabase-cron-enrich-place-analysis wrote a STAGE beacon as
// { step_name: "images", status: "skipped" } on the "matrix did not buy the
// funnel" path. `images` is piece 7, so the high-water reader saw a
// non-completed piece and stopped at 6 — a cheap refresh knocked a complete
// place from 9 to 6 every time it ran.
//
// Nothing in TypeScript stops a beacon borrowing a piece's name, because
// step_name is just a string. This reads the stage EFs and asserts that only
// reportPulsePieces ever writes one, so the next person to add a beacon cannot
// reintroduce it silently.
Deno.test("no raw beacon may use a PULSE piece key as its step_name", async () => {
  const dir = new URL("../", import.meta.url);
  const stages = [
    "supabase-cron-enrich-place-research",
    "supabase-cron-enrich-place-analysis",
    "supabase-cron-enrich-place-contents",
  ];
  const pieces = new Set<string>(PULSE_PIECES);
  const offenders: string[] = [];

  for (const stage of stages) {
    const src = await Deno.readTextFile(new URL(`${stage}/index.ts`, dir));
    // reportEnrichmentStep(admin, id, "S_", "<step_name>", ...) — 4th argument.
    const re =
      /reportEnrichmentStep\(\s*[^,]+,\s*[^,]+,\s*"[^"]*",\s*"([^"]+)"/g;
    for (const m of src.matchAll(re)) {
      if (pieces.has(m[1])) offenders.push(`${stage}: "${m[1]}"`);
    }
  }

  assertEquals(
    offenders,
    [],
    `A raw beacon is using a piece key as step_name, which corrupts the high-water. Use reportPulsePieces, or rename the beacon.`,
  );
});

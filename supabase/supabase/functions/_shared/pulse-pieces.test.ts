import { assertEquals } from "jsr:@std/assert@1";
import {
  PULSE_EXTRAS,
  PULSE_LABELS_IN_ORDER,
  PULSE_PIECES,
  PULSE_PIECE_META,
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

Deno.test("pulse: every stamped step matches the DB's step CHECK", () => {
  // place_enrichment_events.step is `check (step ~ '^S([0-9]{1,2}|X)$')`.
  //
  // This guard earned its keep: the constraint used to be '^S[0-9]$', and the
  // tenth rung of MESITA-1230 would have type-checked (reportEnrichmentStep
  // takes the open template `S${number}`), been REJECTED by Postgres, and had
  // its error swallowed by enrich-pipeline.ts — the step would never record,
  // the meter would cap at 9 forever, and nothing would report a failure. The
  // widening migration (20260823005422) went in FIRST because this failed.
  //
  // Keep asserting the real regex, not a count: the next rung past 99, or an
  // extra key stamped as anything but SX, has to fail here and not in prod.
  const DB_CHECK = /^S([0-9]{1,2}|X)$/;
  for (const piece of PULSE_PIECES) {
    assertEquals(
      DB_CHECK.test(`S${PULSE_PIECE_META[piece].index}`),
      true,
      `step S${PULSE_PIECE_META[piece].index} (${piece}) violates the DB CHECK`,
    );
  }
  // Extras carry no rung, so reportPulsePieces stamps them SX.
  assertEquals(DB_CHECK.test("SX"), true);
  assertEquals(PULSE_EXTRAS.length > 0, true);
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

Deno.test("pulse: description CLOSES the queue, semantics sits OUTSIDE it", () => {
  assertEquals(PULSE_PIECES[PULSE_PIECES.length - 1], "description");
  // The whole point of MESITA-1230: the vector is not a rung. The On-Update
  // path fires the same machinery, so counting it would make `enriched` fall
  // when someone edits a name — which is not "how far did the queue get".
  assertEquals((PULSE_PIECES as readonly string[]).includes("semantics"), false);
  assertEquals([...PULSE_EXTRAS], ["semantics"]);
});

Deno.test("pulse: serp runs BEFORE links — it grounds the link judge", () => {
  const i = (k: string) => (PULSE_PIECES as readonly string[]).indexOf(k);
  assertEquals(i("serp") < i("links"), true);
  assertEquals(i("name") < i("serp"), true);
});

Deno.test("high water: the semantics EXTRA never counts toward the number", () => {
  // A completed extra must not advance the queue, and a FAILED one must not
  // hold it back: a place whose whole queue landed is 10 even if the vector
  // did not write.
  const full = PULSE_PIECES.map((p, i) => done(p, i));
  assertEquals(pulseHighWater(full), PULSE_TOTAL);
  assertEquals(
    pulseHighWater([
      ...full,
      { step_name: "semantics", status: "failed", created_at: at(30) },
    ]),
    PULSE_TOTAL,
  );
  // And an extra on its own is not progress.
  assertEquals(pulseHighWater([done("semantics", 1)]), 0);
});

Deno.test("pulse: the ten, in the decided order", () => {
  // The law: Docs › Enrichment §A. S0 seed is a GATE, not a member, and
  // semantics is an EXTRA, not a rung.
  assertEquals([...PULSE_PIECES], [
    "pulse",
    "details",
    "name",
    "serp",
    "links",
    "social",
    "images",
    "menu",
    "reviews",
    "description",
  ]);
  assertEquals(PULSE_TOTAL, 10);
});

Deno.test("pulse: the index is the position, and the labels ride in order", () => {
  // MESITA-1222. The index is derived from PULSE_PIECES now, so this is a
  // regression guard, not a spot-check: it fails the moment anyone reintroduces
  // hand-written literals that drift from the array. `pulseHighWater` iterates
  // the array and returns the META index, and reportPulsePieces stamps
  // `S${index}` into the DB, so a drift corrupts both the meter and the beacon.
  assertEquals(
    PULSE_PIECES.map((p) => PULSE_PIECE_META[p].index),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  // The list clients render beside the number must stay aligned with the ladder
  // itself — that alignment is the whole reason it ships from the server.
  assertEquals(PULSE_LABELS_IN_ORDER.length, PULSE_TOTAL);
  assertEquals(
    [...PULSE_LABELS_IN_ORDER],
    PULSE_PIECES.map((p) => PULSE_PIECE_META[p].label),
  );
  assertEquals(PULSE_LABELS_IN_ORDER.every((l) => l.trim() !== ""), true);
});

Deno.test("high water: nothing recorded is 0", () => {
  assertEquals(pulseHighWater([]), 0);
});

Deno.test("high water: a full queue is 10", () => {
  assertEquals(pulseHighWater(PULSE_PIECES.map((p, i) => done(p, i))), 10);
});

Deno.test("high water: it is HOW FAR, not how many", () => {
  // The distinction the whole model rests on. Nine steps completed, but
  // `links` (5) never did, so the queue got to 4 — not 9. A profile built past
  // a hole is built on incomplete data, which is why the queue is linear.
  const events = PULSE_PIECES.filter((p) => p !== "links").map((p, i) =>
    done(p, i)
  );
  assertEquals(completedPulsePieces(events).length, 9);
  assertEquals(pulseHighWater(events), 4);
});

Deno.test("high water: a failed piece stops the count at the one before it", () => {
  assertEquals(
    pulseHighWater([
      done("pulse", 1),
      done("details", 2),
      done("name", 3),
      done("serp", 4),
      { step_name: "links", status: "failed", created_at: at(5) },
      done("social", 6),
    ]),
    4,
  );
});

Deno.test("high water: a piece a run did not buy simply has no event", () => {
  // MESITA-1172 blocker 2. The matrix lets a cheap refresh buy a subset, so a
  // piece it did not run writes NOTHING and keeps whatever an earlier run
  // recorded. State accumulates across runs rather than being reset by the
  // cheapest one — here an earlier full run got to 4, and a refresh that only
  // re-ran `seed` does not knock it back down.
  const earlier = [
    done("pulse", 1),
    done("details", 2),
    done("name", 3),
    done("serp", 4),
    done("links", 5),
    done("social", 6),
  ];
  const refresh = [done("pulse", 9)];
  assertEquals(pulseHighWater([...earlier, ...refresh]), 6);
});

Deno.test("high water: absence is a RESULT — a place with no Instagram still reaches 10", () => {
  // The piece ran, resolved "there is nothing here", and is completed. Marking
  // it failed would punish a place for a fact about the world.
  const events = PULSE_PIECES.map((p, i) =>
    p === "social"
      ? { step_name: "social", status: "completed", created_at: at(i) }
      : done(p, i)
  );
  assertEquals(pulseHighWater(events), 10);
});

Deno.test("high water: a re-enrich that fixes a piece RAISES the number", () => {
  assertEquals(
    pulseHighWater([
      done("pulse", 1),
      { step_name: "details", status: "failed", created_at: at(2) },
      done("name", 3),
      done("serp", 4),
      done("details", 8), // the later, successful attempt wins
    ]),
    4,
  );
});

Deno.test("high water: a re-enrich that breaks a piece LOWERS it", () => {
  assertEquals(
    pulseHighWater([
      done("pulse", 1),
      done("details", 2),
      done("name", 3),
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
      done("name", 3),
    ]),
    1,
  );
});

Deno.test("high water: never exceeds the total, and never goes negative", () => {
  const n = pulseHighWater([...PULSE_PIECES, ...PULSE_PIECES].map((p, i) => done(p, i)));
  assertEquals(n >= 0 && n <= PULSE_TOTAL, true);
  assertEquals(n, 10);
});

// ── the guard MESITA-1209 needed ──────────────────────────────────────────
//
// The bug: supabase-cron-enrich-place-analysis wrote a STAGE beacon as
// { step_name: "images", status: "skipped" } on the "matrix did not buy the
// funnel" path. `images` is a piece key, so the high-water reader saw a
// non-completed piece mid-ladder and stopped short of it — a cheap refresh
// knocked a complete place down every time it ran. (It presented as 9 -> 6
// under the piece order of the day; `images` is rung 5 now, so the same bug
// would read 9 -> 4. The rung number was never the point.)
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

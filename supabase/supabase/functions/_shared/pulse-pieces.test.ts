import { assertEquals } from "jsr:@std/assert@1";
import {
  PULSE_EXTRAS,
  PULSE_FLOOR,
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

/** Every function above the floor, completed — what a finished queue looks like. */
const fullQueue = () =>
  PULSE_PIECES.filter((p) => p !== PULSE_FLOOR).map((p, i) => done(p, i));

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
  // Keep asserting the real regex, not a count: the next rung past 99, or a
  // semantic function stamped as anything but SX, has to fail here not in prod.
  const DB_CHECK = /^S([0-9]{1,2}|X)$/;
  for (const piece of PULSE_PIECES) {
    assertEquals(
      DB_CHECK.test(`S${PULSE_PIECE_META[piece].index}`),
      true,
      `step S${PULSE_PIECE_META[piece].index} (${piece}) violates the DB CHECK`,
    );
  }
  // Semantic functions carry no rung, so reportPulsePieces stamps them SX.
  assertEquals(DB_CHECK.test("SX"), true);
  assertEquals(PULSE_EXTRAS.length > 0, true);
});

Deno.test("pulse: the ten functions, in the decided order", () => {
  // The law: Docs › Enrichment §A. Seed is function 0 — IN the count — and the
  // two semantic functions are outside it.
  assertEquals([...PULSE_PIECES], [
    "seed",
    "pulse",
    "details",
    "serp",
    "links",
    "social",
    "images",
    "menu",
    "reviews",
    "description",
  ]);
  // NINE, not ten: `seed` occupies 0, so a complete profile tops out at 9.
  assertEquals(PULSE_TOTAL, 9);
});

Deno.test("pulse: `seed` is function 0 and is NEVER stamped or walked", () => {
  // THE regression this ladder can die of. `seed` is a member now (it was a
  // gate outside the numbering before), and the row EXISTING is the seed —
  // there is no beacon for it and there never will be for any place created
  // before one existed. So the walk must start at function 1.
  //
  // If it did not, every place in the catalog would have no `seed` event, the
  // walk would break at 0, and the whole catalog would read 0 — silently,
  // because these writes swallow their own errors.
  assertEquals(PULSE_FLOOR, "seed");
  assertEquals(PULSE_PIECES[0], "seed");
  assertEquals(PULSE_PIECE_META.seed.index, 0);

  // No seed event anywhere, and the queue still reaches 9.
  const events = fullQueue();
  assertEquals(events.some((e) => e.step_name === "seed"), false);
  assertEquals(pulseHighWater(events), 9);

  // And a stray seed beacon cannot inflate a place that has done nothing.
  assertEquals(pulseHighWater([done("seed", 1)]), 0);
});

Deno.test("pulse: `name` is a SEMANTIC function now, not rung 3", () => {
  // It was a rung until MESITA-1243. The google_name refresh is one field on
  // function 2's call, not a stage of its own; what deserves a function is the
  // Mesita Name as a VECTOR, and that cannot be a rung because the On-Update
  // path fires it whenever an operator renames a place.
  assertEquals((PULSE_PIECES as readonly string[]).includes("name"), false);
  assertEquals([...PULSE_EXTRAS], ["name", "summary"]);
});

Deno.test("pulse: rows from the PREVIOUS ladder still read correctly", () => {
  // Renumbering is survivable because the reader matches on the KEY and treats
  // the S-number as decorative. No backfill ran, so the DB still holds rows
  // this pipeline wrote under MESITA-1230's ladder. Two things must be true:
  //
  //   1. the nine keys that survived still count, at their NEW positions;
  //   2. the two that stopped being rungs — `name` (was S3) and `semantics` —
  //      fall out of the walk entirely rather than corrupting it.
  const legacy = [
    done("pulse", 1),
    done("details", 2),
    done("name", 3), // was rung 3; now a semantic function
    done("serp", 4),
    done("links", 5),
    done("semantics", 6), // was the lone extra; the key is gone
  ];
  // pulse · details · serp · links all landed, so the queue got to 4 — the old
  // `name` row neither advances it nor blocks it.
  assertEquals(pulseHighWater(legacy), 4);

  // A FAILED legacy `name` row must not hold the queue back either.
  assertEquals(
    pulseHighWater([
      ...legacy,
      { step_name: "name", status: "failed", created_at: at(7) },
    ]),
    4,
  );
});

Deno.test("pulse: social runs BEFORE images, menu after both", () => {
  // Load-bearing order. The IG/FB gathers fill the pools the vision funnel
  // ranks, so images any earlier would rank Google photos and nothing else.
  const i = (k: string) => (PULSE_PIECES as readonly string[]).indexOf(k);
  assertEquals(i("social") < i("images"), true);
  assertEquals(i("images") < i("menu"), true);
  assertEquals(i("links") < i("menu"), true);
});

Deno.test("pulse: serp runs BEFORE links — that is what serp is FOR", () => {
  // Agent Y cannot pick between five Instagram candidates on a name and a
  // city; the editorial read is what it recognises the place by. Function 9
  // reusing the same text is a second use, not the reason it exists.
  const i = (k: string) => (PULSE_PIECES as readonly string[]).indexOf(k);
  assertEquals(i("serp") < i("links"), true);
  assertEquals(i("details") < i("serp"), true);
});

Deno.test("pulse: description CLOSES the queue, semantics sits OUTSIDE it", () => {
  assertEquals(PULSE_PIECES[PULSE_PIECES.length - 1], "description");
  assertEquals(PULSE_PIECE_META.description.index, PULSE_TOTAL);
  // The whole point: a vector is not a rung. The On-Update path fires the same
  // machinery, so counting one would make `enriched` fall when someone edits a
  // name — which is not "how far did the queue get".
  for (const extra of PULSE_EXTRAS) {
    assertEquals((PULSE_PIECES as readonly string[]).includes(extra), false);
  }
});

Deno.test("high water: a semantic function never counts toward the number", () => {
  // A completed one must not advance the queue, and a FAILED one must not hold
  // it back: a place whose whole queue landed is 9 even if the vector did not
  // write.
  const full = fullQueue();
  assertEquals(pulseHighWater(full), PULSE_TOTAL);
  assertEquals(
    pulseHighWater([
      ...full,
      { step_name: "summary", status: "failed", created_at: at(30) },
      { step_name: "name", status: "failed", created_at: at(31) },
    ]),
    PULSE_TOTAL,
  );
  // And a semantic function on its own is not progress.
  assertEquals(pulseHighWater([done("summary", 1)]), 0);
});

Deno.test("pulse: the index is the position, and the labels ride in order", () => {
  // MESITA-1222. The index is derived from PULSE_PIECES, so this is a
  // regression guard, not a spot-check: it fails the moment anyone reintroduces
  // hand-written literals that drift from the array. `pulseHighWater` iterates
  // the array and returns the META index, and reportPulsePieces stamps
  // `S${index}` into the DB, so a drift corrupts both the meter and the beacon.
  assertEquals(
    PULSE_PIECES.map((p) => PULSE_PIECE_META[p].index),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
  // The labels are indexed BY FUNCTION NUMBER, so the array is one longer than
  // the top of the scale — labels[0] is Seed, labels[9] is Description. A
  // client renders labels[level] with no off-by-one.
  assertEquals(PULSE_LABELS_IN_ORDER.length, PULSE_TOTAL + 1);
  assertEquals(PULSE_LABELS_IN_ORDER[0], "Seed");
  assertEquals(PULSE_LABELS_IN_ORDER[PULSE_TOTAL], "Description");
  assertEquals(
    [...PULSE_LABELS_IN_ORDER],
    PULSE_PIECES.map((p) => PULSE_PIECE_META[p].label),
  );
  assertEquals(PULSE_LABELS_IN_ORDER.every((l) => l.trim() !== ""), true);
});

Deno.test("high water: nothing recorded is 0 — the FLOOR, not a failure", () => {
  assertEquals(pulseHighWater([]), 0);
});

Deno.test("high water: a full queue is 9", () => {
  assertEquals(pulseHighWater(fullQueue()), 9);
});

Deno.test("high water: it is HOW FAR, not how many", () => {
  // The distinction the whole model rests on. Eight functions completed, but
  // `links` (4) never did, so the queue got to 3 — not 8. A profile built past
  // a hole is built on incomplete data, which is why the queue is linear.
  const events = PULSE_PIECES
    .filter((p) => p !== PULSE_FLOOR && p !== "links")
    .map((p, i) => done(p, i));
  assertEquals(pulseHighWater(events), 3);
  // completedPulsePieces answers the OTHER question — which ones landed — and
  // always includes the floor, because a place that exists is seeded.
  const landed = completedPulsePieces(events);
  assertEquals(landed[0], PULSE_FLOOR);
  assertEquals(landed.length, 9); // the floor + the eight that ran
  assertEquals(landed.includes("links"), false);
});

Deno.test("high water: a failed function stops the count at the one before it", () => {
  assertEquals(
    pulseHighWater([
      done("pulse", 1),
      done("details", 2),
      done("serp", 3),
      { step_name: "links", status: "failed", created_at: at(4) },
      done("social", 5),
    ]),
    3,
  );
});

Deno.test("high water: a function a run did not buy simply has no event", () => {
  // MESITA-1172 blocker 2. The matrix lets a cheap refresh buy a subset, so a
  // function it did not run writes NOTHING and keeps whatever an earlier run
  // recorded. State accumulates across runs rather than being reset by the
  // cheapest one — here an earlier full run got to 5, and a refresh that only
  // re-ran `pulse` does not knock it back down.
  const earlier = [
    done("pulse", 1),
    done("details", 2),
    done("serp", 3),
    done("links", 4),
    done("social", 5),
  ];
  const refresh = [done("pulse", 9)];
  assertEquals(pulseHighWater([...earlier, ...refresh]), 5);
});

Deno.test("high water: absence is a RESULT — no Instagram still reaches 9", () => {
  // The function ran, resolved "there is nothing here", and is completed.
  // Marking it failed would punish a place for a fact about the world.
  assertEquals(pulseHighWater(fullQueue()), 9);
});

Deno.test("high water: a re-enrich that fixes a function RAISES the number", () => {
  assertEquals(
    pulseHighWater([
      done("pulse", 1),
      { step_name: "details", status: "failed", created_at: at(2) },
      done("serp", 3),
      done("links", 4),
      done("details", 8), // the later, successful attempt wins
    ]),
    4,
  );
});

Deno.test("high water: a re-enrich that breaks a function LOWERS it", () => {
  assertEquals(
    pulseHighWater([
      done("pulse", 1),
      done("details", 2),
      done("serp", 3),
      { step_name: "details", status: "failed", created_at: at(9) },
    ]),
    1,
  );
});

Deno.test("high water: legacy stage beacons are not functions", () => {
  // The rows written before any of this: gather / images / publish. `images`
  // collides with a real function name, so a reader that did not filter would
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
  // Functions are never skipped for not being bought — that writes nothing at
  // all. If a `skipped` ever reaches here it means the function did not run, so
  // it must not count as progress.
  assertEquals(
    pulseHighWater([
      done("pulse", 1),
      { step_name: "details", status: "skipped", created_at: at(2) },
      done("serp", 3),
    ]),
    1,
  );
});

Deno.test("high water: never exceeds the total, and never goes negative", () => {
  const n = pulseHighWater([...fullQueue(), ...fullQueue()]);
  assertEquals(n >= 0 && n <= PULSE_TOTAL, true);
  assertEquals(n, 9);
});

// ── the guard MESITA-1209 needed ──────────────────────────────────────────
//
// The bug: supabase-cron-enrich-place-analysis wrote a STAGE beacon as
// { step_name: "images", status: "skipped" } on the "matrix did not buy the
// funnel" path. `images` is a function key, so the high-water reader saw a
// non-completed function mid-ladder and stopped short of it — a cheap refresh
// knocked a complete place down every time it ran. (It presented as 9 -> 6
// under the order of the day; `images` is function 6 now, so the same bug would
// read 9 -> 5. The number was never the point.)
//
// Nothing in TypeScript stops a beacon borrowing a function's name, because
// step_name is just a string. This reads the stage EFs and asserts that only
// reportPulsePieces ever writes one, so the next person to add a beacon cannot
// reintroduce it silently. `seed` is a function key now too, and a beacon
// borrowing THAT one would be the worst of the family — it would put an event
// on the floor the walk deliberately skips.
Deno.test("no raw beacon may use a PULSE function key as its step_name", async () => {
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
    `A raw beacon is using a function key as step_name, which corrupts the high-water. Use reportPulsePieces, or rename the beacon.`,
  );
});

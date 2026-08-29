import { assertEquals } from "jsr:@std/assert@1";
import {
  PULSE_EXTRAS,
  PULSE_FLOOR_LABEL,
  PULSE_LABELS_IN_ORDER,
  PULSE_PIECES,
  PULSE_PIECE_META,
  PULSE_TOTAL,
  completedPulsePieces,
  pulseBlockedAt,
  pulseHighWater,
  type PulseEvent,
} from "./pulse-pieces.ts";

const at = (n: number) => `2026-08-22T10:00:${String(n).padStart(2, "0")}Z`;
const done = (step: string, n = 0) => ({
  step_name: step,
  status: "completed",
  created_at: at(n),
});

/** Every enrich function completed — what a finished queue looks like. */
const fullQueue = () => PULSE_PIECES.map((p, i) => done(p, i));

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
  // function stamped as anything but S<n>, has to fail here not in prod.
  const DB_CHECK = /^S([0-9]{1,2}|X)$/;
  for (const piece of PULSE_PIECES) {
    assertEquals(
      DB_CHECK.test(`S${PULSE_PIECE_META[piece].index}`),
      true,
      `step S${PULSE_PIECE_META[piece].index} (${piece}) violates the DB CHECK`,
    );
  }
  // Embedding is function 10, so reportPulsePieces stamps it S10.
  assertEquals(DB_CHECK.test("S10"), true);
  assertEquals(DB_CHECK.test("SX"), true);
});

Deno.test("pulse: the TEN enrich queue functions, in the decided order", () => {
  // The law: ENRICH is ten functions, 1–10. Seed is NOT among them — it is
  // step 1 of CREATE. Embedding CLOSES the queue at 10.
  assertEquals([...PULSE_PIECES], [
    "pulse",
    "details",
    "serp",
    "links",
    "social",
    "images",
    "menu",
    "reviews",
    "description",
    "embedding",
  ]);
  assertEquals(PULSE_TOTAL, 10);
});

Deno.test("pulse: `seed` is NOT an enrich function — it is step 1 of CREATE", () => {
  // MESITA-1253. The row existing IS the seed, so there is no rung below
  // pulse and nothing to stamp. THE regression this ladder can die of is
  // unchanged in substance: if a `seed` membership ever returned, every place
  // in the catalog (none of which has a seed event) would read 0 forever —
  // silently, because beacons swallow their own errors.
  assertEquals((PULSE_PIECES as readonly string[]).includes("seed"), false);
  assertEquals(PULSE_PIECES[0], "pulse");
  assertEquals(PULSE_PIECE_META.pulse.index, 1);

  // No seed event anywhere, and the queue still reaches 10.
  const events = fullQueue();
  assertEquals(events.some((e) => e.step_name === "seed"), false);
  assertEquals(pulseHighWater(events), 10);

  // And a stray seed beacon cannot inflate a place that has done nothing.
  assertEquals(pulseHighWater([done("seed", 1)]), 0);
});

Deno.test("pulse: CREATE's stamps read as 2/10 — one ladder, two callers", () => {
  // The create function runs pulse + details inline and stamps them
  // (create-place.ts), so a fresh healthy place is 2/10 the moment it exists.
  // State then accumulates: the first full enrich run continues from there.
  const created = [done("pulse", 1), done("details", 2)];
  assertEquals(pulseHighWater(created), 2);
  const b = pulseBlockedAt(created);
  assertEquals(b?.key, "serp");
  assertEquals(b?.index, 3);
  assertEquals(b?.status, "missing");
});

Deno.test("pulse: `embedding` is ONE function now, not two extras", () => {
  assertEquals((PULSE_PIECES as readonly string[]).includes("name"), false);
  assertEquals((PULSE_PIECES as readonly string[]).includes("summary"), false);
  assertEquals((PULSE_PIECES as readonly string[]).includes("semantic"), false);
  assertEquals((PULSE_PIECES as readonly string[]).includes("embedding"), true);
  assertEquals(PULSE_PIECE_META.embedding.index, 10);
  assertEquals(PULSE_PIECE_META.embedding.label, "Embedding");
  assertEquals([...PULSE_EXTRAS], []);
});

Deno.test("pulse: the RENAMED `semantic` still counts as function 10", () => {
  // §8.4 v3 renamed function 10 (Semantic → Embedding). Stored events keep
  // the old key forever (append-only log); the walk folds the rename so a
  // legacy full queue still reads 10, not blocked-at-Embedding.
  const nine = PULSE_PIECES
    .filter((p) => p !== "embedding")
    .map((p, i) => done(p, i));
  assertEquals(
    pulseHighWater([
      ...nine,
      { step_name: "semantic", status: "completed", created_at: at(30) },
    ]),
    10,
  );
  // Pre-merge extras still do NOT count on the walk.
  assertEquals(
    pulseHighWater([
      ...nine,
      { step_name: "name", status: "completed", created_at: at(30) },
    ]),
    9,
  );
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

Deno.test("pulse: Embedding CLOSES the queue at 10", () => {
  assertEquals(PULSE_PIECES[PULSE_PIECES.length - 1], "embedding");
  assertEquals(PULSE_PIECE_META.embedding.index, PULSE_TOTAL);
  assertEquals(PULSE_PIECE_META.description.index, 9);
});

Deno.test("high water: Embedding is 10 — a gap before it still reads 9", () => {
  const throughDescription = PULSE_PIECES
    .filter((p) => p !== "embedding")
    .map((p, i) => done(p, i));
  assertEquals(pulseHighWater(throughDescription), 9);
  assertEquals(pulseHighWater(fullQueue()), PULSE_TOTAL);
  assertEquals(
    pulseHighWater([
      ...throughDescription,
      { step_name: "embedding", status: "failed", created_at: at(30) },
    ]),
    9,
  );
  // And Embedding on its own is not progress — 3–9 are still a gap.
  assertEquals(pulseHighWater([done("embedding", 1)]), 0);
});

Deno.test("pulse: the index is the position, and the labels ride in order", () => {
  // MESITA-1222. The index is derived from PULSE_PIECES, so this is a
  // regression guard, not a spot-check: it fails the moment anyone reintroduces
  // hand-written literals that drift from the array. `pulseHighWater` iterates
  // the array and returns the META index, and reportPulsePieces stamps
  // `S${index}` into the DB, so a drift corrupts both the meter and the beacon.
  assertEquals(
    PULSE_PIECES.map((p) => PULSE_PIECE_META[p].index),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  // The labels are indexed BY FUNCTION NUMBER, so the array is one longer than
  // the piece list — labels[0] is the CREATED floor (not a function),
  // labels[10] is Embedding. A client renders labels[level] with no
  // off-by-one.
  assertEquals(PULSE_LABELS_IN_ORDER.length, PULSE_TOTAL + 1);
  assertEquals(PULSE_LABELS_IN_ORDER[0], PULSE_FLOOR_LABEL);
  assertEquals(PULSE_FLOOR_LABEL, "Created");
  assertEquals(PULSE_LABELS_IN_ORDER[PULSE_TOTAL], "Embedding");
  assertEquals(
    [...PULSE_LABELS_IN_ORDER],
    [PULSE_FLOOR_LABEL, ...PULSE_PIECES.map((p) => PULSE_PIECE_META[p].label)],
  );
  assertEquals(PULSE_LABELS_IN_ORDER.every((l) => l.trim() !== ""), true);
});

Deno.test("high water: nothing recorded is 0 — CREATED, not a failure", () => {
  assertEquals(pulseHighWater([]), 0);
});

Deno.test("high water: a full queue is 10", () => {
  assertEquals(pulseHighWater(fullQueue()), 10);
});

Deno.test("high water: it is HOW FAR, not how many", () => {
  // The distinction the whole model rests on. Nine functions completed, but
  // `links` (4) never did, so the queue got to 3 — not 9. A profile built past
  // a hole is built on incomplete data, which is why the queue is linear.
  const events = PULSE_PIECES
    .filter((p) => p !== "links")
    .map((p, i) => done(p, i));
  assertEquals(pulseHighWater(events), 3);
  // completedPulsePieces answers the OTHER question — which ones landed.
  const landed = completedPulsePieces(events);
  assertEquals(landed.length, 9); // the nine that ran; created is implicit
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

Deno.test("high water: absence is a RESULT — no Instagram still reaches 10", () => {
  // The function ran, resolved "there is nothing here", and is completed.
  // Marking it failed would punish a place for a fact about the world.
  assertEquals(pulseHighWater(fullQueue()), 10);
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
  assertEquals(n, 10);
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

// ── the reason beside the number (MESITA-1243 follow-up) ──────────────────
//
// Function 1 can FAIL — a place Google reports permanently closed — so the
// number 0 stopped carrying one fact and started carrying two: "seeded,
// nothing tried" and "we asked, and the listing is dead". A post-merge audit
// caught both admin surfaces asserting the first for either case. The reason
// is what makes them distinguishable, and it must be derived from the SAME
// events the walk reads or the two can disagree.

Deno.test("blocked: a fresh place is blocked at function 1, MISSING not failed", () => {
  const b = pulseBlockedAt([]);
  assertEquals(b?.key, "pulse");
  assertEquals(b?.index, 1);
  assertEquals(b?.status, "missing");
});

Deno.test("blocked: a permanently-closed place is FAILED at 1, not merely absent", () => {
  // The exact shape supabase-cron-enrich-place-research writes on
  // CLOSED_PERMANENTLY. High-water and reason must agree: 0, because pulse
  // failed — NOT 0 because nothing ran.
  const events = [{ step_name: "pulse", status: "failed", created_at: at(1) }];
  assertEquals(pulseHighWater(events), 0);
  const b = pulseBlockedAt(events);
  assertEquals(b?.key, "pulse");
  assertEquals(b?.status, "failed");
});

Deno.test("blocked: it never disagrees with the high-water", () => {
  // The invariant that keeps the cell honest at EVERY level, not just 0: the
  // blocking function is always the one immediately after the high-water.
  const cases: PulseEvent[][] = [
    [],
    [done("pulse", 1)],
    [done("pulse", 1), done("details", 2), done("serp", 3)],
    [
      done("pulse", 1),
      done("details", 2),
      { step_name: "serp", status: "failed", created_at: at(3) },
      done("links", 4),
    ],
    fullQueue(),
  ];
  for (const events of cases) {
    const hw = pulseHighWater(events);
    const b = pulseBlockedAt(events);
    if (hw === PULSE_TOTAL) {
      assertEquals(b, null, "a finished queue is blocked by nothing");
    } else {
      assertEquals(b?.index, hw + 1, `blocked index must be high-water + 1 (hw=${hw})`);
    }
  }
});

Deno.test("blocked: seed is never the blocker — it is not a function", () => {
  // If a `seed` membership ever returned, every place in the catalog would
  // read "blocked at seed · missing" forever.
  for (const events of [[], [done("pulse", 1)], fullQueue()]) {
    // The type itself now forbids "seed" (PulsePiece excludes it) — this
    // compares as strings so the test survives even a type regression.
    assertEquals((pulseBlockedAt(events)?.key as string | undefined) === "seed", false);
  }
});

Deno.test("blocked: a legacy `skipped` counts as ran-and-did-not-deliver", () => {
  // Functions are never skipped for not being bought — that writes nothing at
  // all — so a `skipped` in the log means the function ran. Reporting it as
  // "missing" would tell an operator it had never been attempted.
  const b = pulseBlockedAt([
    done("pulse", 1),
    { step_name: "details", status: "skipped", created_at: at(2) },
  ]);
  assertEquals(b?.key, "details");
  assertEquals(b?.status, "failed");
});

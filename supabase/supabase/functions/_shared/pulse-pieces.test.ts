import { assertEquals } from "jsr:@std/assert@1";
import {
  PULSE_EXTRAS,
  PULSE_FLOOR_LABEL,
  PULSE_LABELS_IN_ORDER,
  PULSE_PIECES,
  PULSE_PIECE_META,
  PULSE_RENAMES,
  PULSE_RETIRED,
  PULSE_TOTAL,
  completedPulsePieces,
  pulseBlockedAt,
  pulseHighWater,
  pulseOf,
  type PulseEvent,
} from "./pulse-pieces.ts";

const at = (n: number) => `2026-08-22T10:00:${String(n).padStart(2, "0")}Z`;
const done = (step: string, n = 0) => ({
  step_name: step,
  state: "completed",
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
  // Embedding is function 8, so reportPulsePieces stamps it S8. S10 stays
  // legal because the LOG still holds rows the ten-rung ladder wrote.
  assertEquals(DB_CHECK.test("S8"), true);
  assertEquals(DB_CHECK.test("S10"), true);
  assertEquals(DB_CHECK.test("SX"), true);
});

Deno.test("pulse: the EIGHT stamped functions, in the decided order", () => {
  // The law (MESITA-2027): ONE ladder, 0–8. Seed is function 0 and is never
  // stamped, so the array starts at Details. Embedding CLOSES the queue at 8.
  assertEquals([...PULSE_PIECES], [
    "details",
    "serp",
    "links",
    "social",
    "reviews",
    "images",
    "description",
    "embedding",
  ]);
  assertEquals(PULSE_TOTAL, 8);
});

Deno.test("pulse: `seed` is function 0 and is NEVER stamped", () => {
  // The row existing IS the seed, so there is no rung below details and
  // nothing to stamp. THE regression this ladder can die of is unchanged in
  // substance: if a `seed` membership ever returned, every place in the
  // catalog (none of which has a seed event) would read 0 forever —
  // silently, because beacons swallow their own errors.
  assertEquals((PULSE_PIECES as readonly string[]).includes("seed"), false);
  assertEquals(PULSE_PIECES[0], "details");
  assertEquals(PULSE_PIECE_META.details.index, 1);
  assertEquals(PULSE_FLOOR_LABEL, "Seed");

  // No seed event anywhere, and the queue still reaches 8.
  const events = fullQueue();
  assertEquals(events.some((e) => e.step_name === "seed"), false);
  assertEquals(pulseHighWater(events), 8);

  // And a stray seed beacon cannot inflate a place that has done nothing.
  assertEquals(pulseHighWater([done("seed", 1)]), 0);
});

Deno.test("pulse: PULSE and MENU are not functions — they are retired keys", () => {
  // MESITA-2027. Liveness is a SUBPROCESS of Details (one `fetchGoogleBasics`
  // call always served both, so the split bought a rung and no information),
  // and the menu is OPERATOR INPUT the Intaker never derived.
  //
  // They must FALL OUT of the walk, not fold into a survivor. Folding `pulse`
  // into `details` would be the dangerous kind of wrong: an old `pulse`
  // completed proves the listing was alive, NOT that the Google spine
  // persisted, so counting it would advance the queue past a function that
  // never ran.
  assertEquals((PULSE_PIECES as readonly string[]).includes("pulse"), false);
  assertEquals((PULSE_PIECES as readonly string[]).includes("menu"), false);
  assertEquals(PULSE_RENAMES.pulse, undefined);
  assertEquals(PULSE_RENAMES.menu, undefined);
  for (const key of ["pulse", "menu"]) {
    assertEquals((PULSE_RETIRED as readonly string[]).includes(key), true);
  }

  // A legacy place whose ONLY stamp is `pulse` reads 0, not 1.
  assertEquals(pulseHighWater([done("pulse", 1)]), 0);
  // And a `menu` row sitting where slot 7 used to be neither advances the
  // queue nor blocks it.
  assertEquals(
    pulseHighWater([done("details", 1), done("menu", 2)]),
    1,
  );
});

Deno.test("pulse: CREATE's stamp reads 1/8 — one ladder, two callers", () => {
  // Create runs 0, 1, 7, 8 and stamps Details inline (create-place.ts), so a
  // fresh healthy place that QUEUES enrich is 1/8 the moment it exists. It
  // used to stamp pulse + details and read 2/10; one function does both jobs
  // now. State then accumulates: the first full enrich run continues here.
  const created = [done("details", 1)];
  assertEquals(pulseHighWater(created), 1);
  const b = pulseBlockedAt(created);
  assertEquals(b?.key, "serp");
  assertEquals(b?.index, 2);
  assertEquals(b?.state, "missing");
});

Deno.test("pulse: an UN-QUEUED create jumps to 8 with 2–6 still a gap", () => {
  // The door writes Description and Embedding itself when no Enrich is
  // queued, so create stamps 1, 7 and 8. The high-water is how far the queue
  // GOT, not how many functions ran — a gap stops the count at 1.
  const doorCreate = [done("details", 1), done("description", 2), done("embedding", 3)];
  assertEquals(pulseHighWater(doorCreate), 1);
  assertEquals(completedPulsePieces(doorCreate), [
    "details",
    "description",
    "embedding",
  ]);
});

Deno.test("pulse: `embedding` is ONE function now, not two extras", () => {
  assertEquals((PULSE_PIECES as readonly string[]).includes("name"), false);
  assertEquals((PULSE_PIECES as readonly string[]).includes("summary"), false);
  assertEquals((PULSE_PIECES as readonly string[]).includes("semantic"), false);
  assertEquals((PULSE_PIECES as readonly string[]).includes("embedding"), true);
  assertEquals(PULSE_PIECE_META.embedding.index, 8);
  assertEquals(PULSE_PIECE_META.embedding.label, "Embedding");
  assertEquals([...PULSE_EXTRAS], []);
});

Deno.test("pulse: the RENAMED `semantic` still counts as function 8", () => {
  // §8.4 v3 renamed the last function (Semantic → Embedding). Stored events
  // keep the old key forever (append-only log); the walk folds the rename so
  // a legacy full queue still reads 8, not blocked-at-Embedding.
  const seven = PULSE_PIECES
    .filter((p) => p !== "embedding")
    .map((p, i) => done(p, i));
  assertEquals(
    pulseHighWater([
      ...seven,
      { step_name: "semantic", state: "completed", created_at: at(30) },
    ]),
    8,
  );
  // Pre-merge extras still do NOT count on the walk.
  assertEquals(
    pulseHighWater([
      ...seven,
      { step_name: "name", state: "completed", created_at: at(30) },
    ]),
    7,
  );
});

Deno.test("pulse: rows from the PREVIOUS ladder still read correctly", () => {
  // Renumbering is survivable because the reader matches on the KEY and treats
  // the S-number as decorative. No backfill ran, so the DB still holds rows
  // this pipeline wrote under MESITA-1230's ladder. Two things must be true:
  //
  //   1. the keys that survived still count, at their NEW positions;
  //   2. the ones that stopped being rungs — `pulse`, `menu`, `name`,
  //      `semantics` — fall out of the walk entirely rather than corrupting it.
  const legacy = [
    done("pulse", 1), // was rung 1; a subprocess of details now
    done("details", 2),
    done("name", 3), // was rung 3; folded into embedding for display only
    done("serp", 4),
    done("links", 5),
    done("semantics", 6), // was the lone extra; the key is gone
  ];
  // details · serp · links all landed, so the queue got to 3 — the old
  // `pulse` and `name` rows neither advance it nor block it.
  assertEquals(pulseHighWater(legacy), 3);

  // A FAILED legacy row on a retired key must not hold the queue back either.
  assertEquals(
    pulseHighWater([
      ...legacy,
      { step_name: "name", state: "failed", created_at: at(7) },
      { step_name: "menu", state: "failed", created_at: at(8) },
    ]),
    3,
  );
});

Deno.test("pulse: social runs BEFORE images — the gathers fill the pools", () => {
  // Load-bearing order. The IG/FB gathers fill the pools the vision funnel
  // ranks, so images any earlier would rank Google photos and nothing else.
  // Reviews sits between them (MESITA-2027) and is free to: nothing downstream
  // of it depends on it except synthesis.
  const i = (k: string) => (PULSE_PIECES as readonly string[]).indexOf(k);
  assertEquals(i("social") < i("images"), true);
  assertEquals(i("links") < i("social"), true);
  assertEquals(i("images") < i("description"), true);
});

Deno.test("pulse: the two Apify gathers sit together at 4 and 5", () => {
  // Social and Reviews are both Apify scrapes of third-party content and
  // already run concurrently — the GMaps scrape depends only on the place id,
  // so it is fired early and collected late. Grouping them costs no wall
  // clock and makes 1–6 read as one phase: the sources, in the order they can
  // be asked.
  assertEquals(PULSE_PIECE_META.social.index, 4);
  assertEquals(PULSE_PIECE_META.reviews.index, 5);
});

Deno.test("pulse: serp runs BEFORE links — that is what serp is FOR", () => {
  // The Resolver cannot pick between five Instagram candidates on a name and a
  // city; the editorial read is what it recognises the place by. Description
  // reusing the same text is a second use, not the reason it exists.
  const i = (k: string) => (PULSE_PIECES as readonly string[]).indexOf(k);
  assertEquals(i("serp") < i("links"), true);
  assertEquals(i("details") < i("serp"), true);
});

Deno.test("pulse: Embedding CLOSES the queue at 8", () => {
  assertEquals(PULSE_PIECES[PULSE_PIECES.length - 1], "embedding");
  assertEquals(PULSE_PIECE_META.embedding.index, PULSE_TOTAL);
  assertEquals(PULSE_PIECE_META.description.index, 7);
});

Deno.test("high water: Embedding is 8 — a gap before it still reads 7", () => {
  const throughDescription = PULSE_PIECES
    .filter((p) => p !== "embedding")
    .map((p, i) => done(p, i));
  assertEquals(pulseHighWater(throughDescription), 7);
  assertEquals(pulseHighWater(fullQueue()), PULSE_TOTAL);
  assertEquals(
    pulseHighWater([
      ...throughDescription,
      { step_name: "embedding", state: "failed", created_at: at(30) },
    ]),
    7,
  );
  // And Embedding on its own is not progress — 2–7 are still a gap.
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
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  // The labels are indexed BY FUNCTION NUMBER, so the array is one longer than
  // the piece list — labels[0] is Seed (function 0, never stamped),
  // labels[8] is Embedding. A client renders labels[level] with no
  // off-by-one.
  assertEquals(PULSE_LABELS_IN_ORDER.length, PULSE_TOTAL + 1);
  assertEquals(PULSE_LABELS_IN_ORDER[0], PULSE_FLOOR_LABEL);
  assertEquals(PULSE_FLOOR_LABEL, "Seed");
  assertEquals(PULSE_LABELS_IN_ORDER[PULSE_TOTAL], "Embedding");
  assertEquals(
    [...PULSE_LABELS_IN_ORDER],
    [PULSE_FLOOR_LABEL, ...PULSE_PIECES.map((p) => PULSE_PIECE_META[p].label)],
  );
  assertEquals(PULSE_LABELS_IN_ORDER.every((l) => l.trim() !== ""), true);
});

Deno.test("high water: nothing recorded is 0 — SEEDED, not a failure", () => {
  assertEquals(pulseHighWater([]), 0);
});

Deno.test("high water: a full queue is 8", () => {
  assertEquals(pulseHighWater(fullQueue()), 8);
});

Deno.test("high water: it is HOW FAR, not how many", () => {
  // The distinction the whole model rests on. Seven functions completed, but
  // `links` (3) never did, so the queue got to 2 — not 7. A profile built past
  // a hole is built on incomplete data, which is why the queue is linear.
  const events = PULSE_PIECES
    .filter((p) => p !== "links")
    .map((p, i) => done(p, i));
  assertEquals(pulseHighWater(events), 2);
  // completedPulsePieces answers the OTHER question — which ones landed.
  const landed = completedPulsePieces(events);
  assertEquals(landed.length, 7); // the seven that ran; seed is implicit
  assertEquals(landed.includes("links"), false);
});

Deno.test("high water: a failed function stops the count at the one before it", () => {
  assertEquals(
    pulseHighWater([
      done("details", 1),
      done("serp", 2),
      { step_name: "links", state: "failed", created_at: at(3) },
      done("social", 4),
    ]),
    2,
  );
});

Deno.test("high water: a function a run did not buy simply has no event", () => {
  // MESITA-1172 blocker 2. The matrix lets a cheap refresh buy a subset, so a
  // function it did not run writes NOTHING and keeps whatever an earlier run
  // recorded. State accumulates across runs rather than being reset by the
  // cheapest one — here an earlier full run got to 4, and a refresh that only
  // re-ran `details` does not knock it back down.
  const earlier = [
    done("details", 1),
    done("serp", 2),
    done("links", 3),
    done("social", 4),
  ];
  const refresh = [done("details", 9)];
  assertEquals(pulseHighWater([...earlier, ...refresh]), 4);
});

Deno.test("high water: absence is a RESULT — no Instagram still reaches 8", () => {
  // The function ran, resolved "there is nothing here", and is completed.
  // Marking it failed would punish a place for a fact about the world.
  assertEquals(pulseHighWater(fullQueue()), 8);
});

Deno.test("high water: a re-enrich that fixes a function RAISES the number", () => {
  assertEquals(
    pulseHighWater([
      { step_name: "details", state: "failed", created_at: at(2) },
      done("serp", 3),
      done("links", 4),
      done("details", 8), // the later, successful attempt wins
    ]),
    3,
  );
});

Deno.test("high water: a re-enrich that breaks a function LOWERS it", () => {
  assertEquals(
    pulseHighWater([
      done("details", 2),
      done("serp", 3),
      { step_name: "details", state: "failed", created_at: at(9) },
    ]),
    0,
  );
});

Deno.test("high water: legacy stage beacons are not functions", () => {
  // The rows written before any of this: gather / images / publish. `images`
  // collides with a real function name, so a reader that did not filter would
  // read a stage beacon as pipeline progress.
  assertEquals(
    pulseHighWater([
      { step_name: "gather", state: "completed", created_at: at(1) },
      { step_name: "publish", state: "completed", created_at: at(2) },
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
      { step_name: "details", state: "skipped", created_at: at(2) },
      done("serp", 3),
    ]),
    0,
  );
});

Deno.test("high water: never exceeds the total, and never goes negative", () => {
  const n = pulseHighWater([...fullQueue(), ...fullQueue()]);
  assertEquals(n >= 0 && n <= PULSE_TOTAL, true);
  assertEquals(n, 8);
});

// ── the guard MESITA-1209 needed ──────────────────────────────────────────
//
// The bug: supabase-cron-enrich-place-analysis wrote a STAGE beacon as
// { step_name: "images", state: "skipped" } on the "matrix did not buy the
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
//
// MESITA-2027 made this matter MORE, not less. Liveness is a subprocess of
// Details now, so function 1 has TWO ways to fail — the listing is dead, or
// the Google spine came back unusable — and the block reads `details` for
// both. Only the event's MESSAGE separates them, which is why the research EF
// writes a different one per cause.

Deno.test("blocked: a fresh place is blocked at function 1, MISSING not failed", () => {
  const b = pulseBlockedAt([]);
  assertEquals(b?.key, "details");
  assertEquals(b?.index, 1);
  assertEquals(b?.state, "missing");
});

Deno.test("blocked: a permanently-closed place is FAILED at 1, not merely absent", () => {
  // The exact shape supabase-cron-enrich-place-research writes on
  // CLOSED_PERMANENTLY. High-water and reason must agree: 0, because details
  // failed — NOT 0 because nothing ran.
  const events = [{ step_name: "details", state: "failed", created_at: at(1) }];
  assertEquals(pulseHighWater(events), 0);
  const b = pulseBlockedAt(events);
  assertEquals(b?.key, "details");
  assertEquals(b?.state, "failed");

  // A LEGACY `pulse` failure reads as nothing at all, which is correct: the
  // key is retired, so it neither blocks nor advances. The place is blocked
  // at details for being MISSING, not failed.
  const legacy = [{ step_name: "pulse", state: "failed", created_at: at(1) }];
  assertEquals(pulseHighWater(legacy), 0);
  assertEquals(pulseBlockedAt(legacy)?.state, "missing");
});

Deno.test("blocked: it never disagrees with the high-water", () => {
  // The invariant that keeps the cell honest at EVERY level, not just 0: the
  // blocking function is always the one immediately after the high-water.
  const cases: PulseEvent[][] = [
    [],
    [done("details", 1)],
    [done("details", 1), done("serp", 2), done("links", 3)],
    [
      done("details", 1),
      { step_name: "serp", state: "failed", created_at: at(2) },
      done("links", 3),
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
    { step_name: "details", state: "skipped", created_at: at(2) },
  ]);
  assertEquals(b?.key, "details");
  assertEquals(b?.state, "failed");
});

Deno.test("pulseOf: the shared reader off places.enrichment (MESITA-1598)", () => {
  assertEquals(pulseOf({ highWater: 7 }), 7);
  assertEquals(pulseOf({ highWater: 0 }), 0);
  // Malformed or absent reads the CREATED floor, never throws.
  assertEquals(pulseOf(null), 0);
  assertEquals(pulseOf(undefined), 0);
  assertEquals(pulseOf("not an object"), 0);
  assertEquals(pulseOf({}), 0);
  assertEquals(pulseOf({ highWater: "nope" }), 0);
  assertEquals(pulseOf({ highWater: -3 }), 0);
  // Clamped at PULSE_TOTAL and truncated — never a fractional or out-of-range
  // rung, whatever a stray write puts in the jsonb.
  assertEquals(pulseOf({ highWater: PULSE_TOTAL + 5 }), PULSE_TOTAL);
  assertEquals(pulseOf({ highWater: 3.9 }), 3);
});

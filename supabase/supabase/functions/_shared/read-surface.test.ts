// MESITA-1718 — two ratchets on READS of doored tables.
//
// `write-surface.test.ts` ratchets WRITERS onto the six document doors.
// Nothing did the same for READS, and MESITA-1712 is what that costs:
// `stripe-webhook-handle-event/ticket-payment-intent.ts` selected the retired
// column `project_id` off `visit_tickets` with a raw `.from().select()`,
// PostgREST answered 42703 for the whole query — and the call destructured
// `{ data }` alone, so the error vanished. A null row then read exactly like
// "already closed by the synchronous path". The Mesita Pay reliability
// backstop silently never fired.
//
// Belt 1 — THE DOOR ALLOWLIST (this issue's Shape). Mirror findWriters: every
// `.from(T).select(...)` where T has a document door is frozen. A new file
// that reads a doored table raw fails CI until someone either goes through
// the door or justifies the exception. The list only shrinks. This is the
// general form: it does not care which column was renamed, only that a raw
// read of a doored table is a new exception someone has to justify.
// `renamed-column-refs.test.ts` pins the two names that are retired TODAY
// and goes blind the moment the next rename lands.
//
// The `project_id → place_id` remap lives ONLY inside reservation-doc.ts
// (ticket-doc.ts went with the ticket functions, MESITA-2090).
// `agent-tools.ts` does `fromPlaceIdRow` by hand and is named on its
// allowlist. Everyone else on the list is today's honest baseline, not a
// claim they have been migrated.
//
// Belt 2 — SWALLOWED ERRORS. Being on the right side of the remap and being
// able to see your own failure are different properties: `ticket-check.ts`
// remapped by hand and still destructured `{ data }` alone, so a failed
// lookup behind the staff ticket page said the code was not a ticket. The
// list only shrinks. The scan flags only the destructure that omits `error`;
// `const r = await …` and the builder shape are not guessed.
//
// Scan helpers duplicated from write-surface.test.ts on purpose — that
// file's internals are regression-pinned; extracting a shared scan module
// is separate follow-up work.

import { assertEquals } from "jsr:@std/assert@1";

const FUNCTIONS_DIR = new URL("../", import.meta.url);

/** The document doors' tables, plus the `profiles` view every place read
 *  lands on. A door exists for these, which is what makes a raw read here a
 *  decision rather than the only option. */
const DOORED_TABLES = [
  "reservation_tickets",
  "place_profiles",
  "profiles",
  "places",
  "consumers",
] as const;

/** The doors themselves, and the compat shim. They read these tables because
 *  that is their job. */
const DOORS = [
  "_shared/reservation-doc.ts",
  "_shared/place-doc.ts",
  "_shared/consumer-doc.ts",
  "_shared/place-id.ts",
];

function relativeToFunctions(file: URL): string {
  const base = FUNCTIONS_DIR.pathname;
  const full = file.pathname;
  return full.startsWith(base) ? full.slice(base.length) : full;
}

async function* walk(dir: URL): AsyncGenerator<{ path: string; text: string }> {
  for await (const entry of Deno.readDir(dir)) {
    const child = new URL(entry.isDirectory ? `${entry.name}/` : entry.name, dir);
    if (entry.isDirectory) {
      yield* walk(child);
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      yield { path: relativeToFunctions(child), text: await Deno.readTextFile(child) };
    }
  }
}

async function tsSources(): Promise<Array<{ path: string; text: string }>> {
  const out: Array<{ path: string; text: string }> = [];
  for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
    if (!entry.isDirectory) continue;
    for await (const f of walk(new URL(`${entry.name}/`, FUNCTIONS_DIR))) out.push(f);
  }
  return out;
}

/** Comments describe the very shapes this scans for — the bug's own postmortem
 *  quotes `{ data }` — so the scan reads code only. */
function stripLineComments(src: string): string {
  return src.split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
}

/** Files that call `.select(` within a 2000-char forward window of `.from(T)`
 *  — same windowing as write-surface.test.ts findWriters. Deliberately
 *  imprecise: a write that returns columns via `.update().select()` counts,
 *  which is correct (it is still a raw `.from(T)`). */
async function findReaders(table: string): Promise<string[]> {
  const tablePattern = new RegExp(`\\.from\\(\\s*["']${table}["']\\s*\\)`, "g");
  const found = new Set<string>();
  for (const { path, text } of await tsSources()) {
    const src = stripLineComments(text);
    for (const m of src.matchAll(tablePattern)) {
      const window = src.slice(m.index ?? 0, (m.index ?? 0) + 2000);
      if (/\.select\s*\(/.test(window)) found.add(path);
    }
  }
  return [...found].sort();
}

function assertRatchet(table: string, found: string[], allowlist: string[]) {
  const extra = found.filter((f) => !allowlist.includes(f));
  const stale = allowlist.filter((f) => !found.includes(f));
  assertEquals(
    extra,
    [],
    `new raw reader(s) of ${table}: ${extra.join(", ")}\n\n` +
      `Go through the document door, or add the file to the allowlist with a ` +
      `comment saying why. A raw \`.from("${table}").select(...)\` does not ` +
      `run remapPlaceIdSelect / fromPlaceIdRow — that is how MESITA-1712 ` +
      `selected a retired column and heard nothing.`,
  );
  assertEquals(
    stale,
    [],
    `allowlist names a file that no longer reads ${table}: ${stale.join(", ")}\n\n` +
      `Delete these lines. An allowlist that only ever grows is the thing ` +
      `write-surface.test.ts already refuses to become.`,
  );
}

// ── Belt 1: raw readers of doored tables. Bootstrapped 2026-09-12 from a
// real findReaders() run on this branch, not hand-transcribed. ───────────

const RESERVATION_TICKET_READ_ALLOWLIST = [
  "_shared/agent-tools.ts", // remaps by hand (fromPlaceIdRow) — MESITA-1718 seed
  "_shared/config-section-reservations.ts",
  "_shared/delete-history-free.ts", // head-only count by consumer_id: no place_id to remap
  "_shared/reservation-doc.ts", // THE reservation door (writeReservation)
  "consumer-web-cancel-reservation/index.ts",
  "consumer-web-confirm-reservation/index.ts",
  "consumer-web-create-reservation/index.ts",
  "consumer-web-list-reservations/index.ts",
  "consumer-web-update-reservation/index.ts",
  "eleven-agent-get-reservation/index.ts",
  "supabase-cron-reservation-retries/index.ts",
  "supabase-edgefunc-reservation-call/index.ts",
];

Deno.test("RESERVATION READ: no new raw reader of reservation_tickets outside the allowlist", async () => {
  assertRatchet(
    "reservation_tickets",
    await findReaders("reservation_tickets"),
    RESERVATION_TICKET_READ_ALLOWLIST,
  );
});

const PLACE_PROFILE_READ_ALLOWLIST = [
  "_shared/agent-tools.ts",
  "_shared/mesita-name-door.ts",
  "_shared/crenup-report.ts",
  "_shared/field-correction-writer.ts", // read enrichment_sources before pin merge (MESITA-2029)
  "_shared/enrich-fill.ts", // enrichment jsonb only, to see which ladder steps already completed (MESITA-2178)
  "_shared/enrich-start.ts", // the saved profile an Enrich run reads back, and its updated_at (MESITA-2420)
  "_shared/google-refetch.ts", // the phone, endpoint and pins the wrong-number refetch compares (MESITA-2420)
  "_shared/admin-google-place-update.ts", // enrichment_sources pins + mesita_photos guard read (MESITA-2737)
  "admin-web-search-places/index.ts",
  "admin-web-get-overview/index.ts",
  "admin-web-reload-place-reviews/index.ts",
  "consumer-web-confirm-reservation/index.ts",
  "consumer-web-create-reservation/index.ts", // reservations_enabled gate before the insert (MESITA-2156)
  "eleven-a2-confirm-reservation/index.ts",
  "eleven-a4-cancel-reservation/index.ts",
  "eleven-a4-find-reservation/index.ts",
  "eleven-a4-verify-caller/index.ts",
  "eleven-agent-get-reservation/index.ts",
  "enricher-cron-enrich-place-third/index.ts",
  "enricher-cron-enrich-place-first/index.ts",
  "supabase-edgefunc-reservation-call/index.ts",
];

Deno.test("PLACE PROFILE READ: no new raw reader of place_profiles outside the allowlist", async () => {
  assertRatchet("place_profiles", await findReaders("place_profiles"), PLACE_PROFILE_READ_ALLOWLIST);
});

const PROFILES_READ_ALLOWLIST = [
  "_shared/consumer-search-lane.ts",
  "_shared/create-place.ts",
  // The Deep pipeline's Mesita Places Search: id, name, About and the summary
  // vector of active, ready places (MESITA-2327).
  "_shared/deep-pipeline.ts",
  // Area's Mesita Selected scope for the Chat Agent: the same pool query the
  // Map and the Feed run (MESITA-2339).
  "_shared/area-pipeline.ts",
  "_shared/place-embeddings.ts",
  "_shared/place-requests.ts",
  "_shared/place-slug.ts",
  "_shared/save-place.ts",
  "admin-web-delete-place/index.ts",
  // Social v1 (MESITA-2442): the place cards behind the feed and Saved,
  // through the browse view so RLS keeps unlisted places out.
  "consumer-web-list-activity/index.ts",
  "admin-web-search-places/index.ts",
  "admin-web-set-place-active/index.ts",
  "admin-web-set-place-listed/index.ts",
  // The Selected mark's one door re-reads the place after the write (MESITA-2707).
  "admin-web-set-place-selected/index.ts",
  "admin-web-get-overview/index.ts",
  // Names only (google_place_id, name) for the repeated-open list (MESITA-2323).
  "admin-web-list-place-opens/index.ts",
  "admin-web-get-activity-summary/index.ts",
  "consumer-web-get-place/index.ts",
  "consumer-web-list-catalog/index.ts",
  "consumer-web-list-places/index.ts",
  // The Area pool's owned-row lookup by google_place_id, for both views (MESITA-2379).
  "_shared/area-deps.ts",
  "supabase-edgefunc-discover-places/index.ts",
  // Stop reads content_state and enriched_at, and only to turn enriching off (MESITA-2221).
  "enricher-edgefunc-write-place/index.ts",
  // A refused Enrich start reads content_state and enriched_at to turn enriching off (MESITA-2420).
  "_shared/enrich-start.ts",
];

Deno.test("PROFILES READ: no new raw reader of profiles outside the allowlist", async () => {
  assertRatchet("profiles", await findReaders("profiles"), PROFILES_READ_ALLOWLIST);
});

const PLACES_READ_ALLOWLIST = [
  "_shared/google-refetch.ts", // content_state only: no refetch while an Enrich is in flight (MESITA-2420)
  "_shared/admin-google-place-update.ts", // content_state gate before Google refresh (MESITA-2737)
  "_shared/reservation-places.ts",
  "admin-web-delete-place/index.ts",
  "admin-web-get-place-enrichment/index.ts",
  "admin-web-set-place-listed/index.ts",
  "admin-web-set-place-selected/index.ts", // `selected` only: a no-op when already there (MESITA-2707)
  "consumer-web-create-reservation/index.ts",
];

Deno.test("PLACE ROW READ: no new raw reader of places outside the allowlist", async () => {
  assertRatchet("places", await findReaders("places"), PLACES_READ_ALLOWLIST);
});

const CONSUMER_READ_ALLOWLIST = [
  "_shared/consumer-doc.ts", // THE consumer door
  // Instagram verify (MESITA-2578) reads avatar_url alone, error checked, to
  // keep an uploaded photo; the write goes through writeConsumer.
  "_shared/instagram-avatar.ts",
  // Manage › Guests (MESITA-2550): the guest list and search, and the closed-
  // account check after a Class or Plan change (MESITA-2553). Writes go through the admin_set_guest_standing RPC.
  "admin-web-list-guests/index.ts",
  "admin-web-set-guest-standing/index.ts",
  "consumer-web-create-reservation/index.ts",
  "consumer-web-get-profile/index.ts",
  "consumer-web-signin-phone/index.ts",
  "consumer-web-update-profile/index.ts",
  "eleven-a3-verify-caller/index.ts",
  "eleven-agent-get-reservation/index.ts",
];

Deno.test("CONSUMER READ: no new raw reader of consumers outside the allowlist", async () => {
  assertRatchet("consumers", await findReaders("consumers"), CONSUMER_READ_ALLOWLIST);
});

// ── Belt 2: a raw read of a doored table may not throw its error away ────

/**
 * Files where a raw read of a doored table is destructured WITHOUT `error`.
 *
 * That is MESITA-1712's exact shape and the only shape a text scan can call
 * with certainty: if the binding does not name `error`, the caller cannot see
 * the failure, whatever it does next.
 *
 *   const { data, error } = await …   fine
 *   const { data } = await …          SWALLOWED
 *
 * DELIBERATELY NOT FLAGGED: `const r = await …` (the check may be `r.error`
 * anywhere in scope) and the builder shape `let q = admin.from(…); … await q`
 * (the binding is not adjacent at all). Both are judgements a regex would be
 * guessing at, and a ratchet that guesses gets muted rather than fixed.
 *
 * That gap is not free, and it is worth naming what is in it rather than
 * implying the scan is complete. A builder-shaped count —
 * `let query = admin.from(T).select("id", { count: "exact" })`, awaited lines
 * later as `const { count } = await query` — is invisible here. On any error
 * `count` is null, `(count ?? 0) === 0` is true, and the caller reads "none"
 * where the truth was "could not ask". Reaching that shape needs a real
 * parse, not a wider window.
 *
 * The window is the statement: everything back to the previous `;` or block
 * brace. That is what keeps a destructure belonging to an EARLIER query from
 * being read as this one's.
 */
async function findSwallowedReads(): Promise<string[]> {
  const found = new Set<string>();
  for (const { path, text } of await tsSources()) {
    if (DOORS.includes(path)) continue;
    const src = stripLineComments(text);
    for (const table of DOORED_TABLES) {
      const from = new RegExp(`\\.from\\(\\s*["'\`]${table}["'\`]\\s*\\)`, "g");
      for (const m of src.matchAll(from)) {
        const at = m.index ?? 0;
        if (!/\.select\s*\(/.test(src.slice(at, at + 900))) continue; // a write, not a read

        // The nearest binding behind this `.from()`. NOT bounded by the
        // previous `{`: the destructure's OWN brace is behind the match, so a
        // brace-bounded window cuts the very pattern it is looking for.
        const back = src.slice(Math.max(0, at - 300), at);
        const bindings = [
          ...back.matchAll(/(?:const|let)\s*\{([^}]*)\}\s*=\s*await\b/g),
        ];
        const nearest = bindings.at(-1);
        if (!nearest) continue;

        // A `;` between the binding and the `.from()` means they are different
        // statements and this query's result went somewhere else.
        const between = back.slice((nearest.index ?? 0) + nearest[0].length);
        if (between.includes(";")) continue;

        if (!/\berror\b/.test(nearest[1])) found.add(path);
      }
    }
  }
  return [...found].sort();
}

/**
 * Every raw read whose failure is currently invisible. Bootstrapped from a
 * real `findSwallowedReads()` run — NOT hand-listed, so it is the true set
 * rather than the set someone remembered. Rebased 2026-09-12 onto main;
 * five files landed after the 2026-09-10 scan and join the list.
 *
 * This list may only SHRINK. Fixing one is usually two words (`{ data }` →
 * `{ data, error }`) plus deciding what the failure should do, and that second
 * part is the reason each of these is still here rather than swept in one pass:
 * a read that has never checked its error has no answer for what to do when it
 * fires, and inventing one per file without reading the surrounding flow is how
 * a silent bug becomes a loud wrong one.
 */
const SWALLOWED_TODAY = [
  "_shared/agent-tools.ts",
  "_shared/config-section-reservations.ts",
  "_shared/place-slug.ts",
  "_shared/reservation-places.ts",
  "_shared/save-place.ts",
  "consumer-web-confirm-reservation/index.ts",
  "eleven-a2-confirm-reservation/index.ts",
  "eleven-a3-verify-caller/index.ts",
  "eleven-a4-cancel-reservation/index.ts",
  "eleven-a4-find-reservation/index.ts",
  "eleven-a4-verify-caller/index.ts",
  "eleven-agent-get-reservation/index.ts",
  "enricher-cron-enrich-place-third/index.ts",
  "enricher-cron-enrich-place-first/index.ts",
  "supabase-cron-reservation-retries/index.ts",
  "supabase-edgefunc-reservation-call/index.ts",
];

Deno.test("READ SURFACE: no NEW raw read of a doored table discards its error", async () => {
  const swallowed = await findSwallowedReads();
  const added = swallowed.filter((p) => !SWALLOWED_TODAY.includes(p));
  assertEquals(
    added,
    [],
    `New raw read(s) of a doored table that cannot see their own failure:\n  ${
      added.join("\n  ")
    }\n\nDestructure \`error\` (or read \`.error\` off the result) and decide what a ` +
      `failure means there. A query that 42703s and a query that found nothing are ` +
      `not the same answer — telling them apart is what MESITA-1712 cost.`,
  );
});

Deno.test("READ SURFACE: the swallowed list shrinks — a fixed reader leaves it", async () => {
  const swallowed = await findSwallowedReads();
  const stale = SWALLOWED_TODAY.filter((p) => !swallowed.includes(p));
  assertEquals(
    stale,
    [],
    `Fixed, but still listed as swallowing: ${stale.join(", ")}\n\n` +
      `Delete these lines. An allowlist that only ever grows is the thing this ` +
      `test exists instead of.`,
  );
});

Deno.test("READ SURFACE: the doors themselves still exist", async () => {
  // If a door is renamed or deleted, DOORS goes stale and swallowed-read
  // scans start counting its internals as raw reads — which would look like
  // dozens of new violations rather than the one structural change it is.
  for (const door of DOORS) {
    const url = new URL(door, FUNCTIONS_DIR);
    const stat = await Deno.stat(url).catch(() => null);
    assertEquals(stat?.isFile, true, `${door} is listed as a door but does not exist`);
  }
});

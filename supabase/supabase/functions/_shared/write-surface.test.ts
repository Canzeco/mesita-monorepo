// _shared/write-surface.test.ts
//
// Two things sharing one scan (MESITA-1247):
//  1. Deliverable 3's CI grep: today's scattered writers, enumerated from an
//     ACTUAL scan of the tree (not hand-transcribed from a survey doc — a
//     naive single-line grep undercounts badly; verified empirically while
//     building this file: a plain `.from("app_config").update(` grep found
//     0 writers where this windowed scan found 19, because the real code is
//     virtually all multi-line chains), are the frozen ALLOWLIST baseline.
//     This test fails on a NEW file writing an aggregate table outside its
//     door and that baseline.
//  2. Guard test 4's refusal half: a hard DELETE on an aggregate's own row,
//     ratcheted the same way. The visibility half is consumers.deleted_at
//     plus `_shared/delete-history-free.ts` (MESITA-1250).
//
// Every allowlist is the exact set a findWriters() run finds today, and each
// test also fails on a STALE entry, so a door migration must prune its line.
//
// Scan helpers duplicated from place-name-writes.test.ts on purpose — that
// file's internals are regression-pinned (MESITA-1075's relative-path fix);
// touching them for a DRY cleanup here is unneeded risk. Extracting a shared
// scan module is real but separate follow-up work.

import { assertEquals } from "jsr:@std/assert@1";

const FUNCTIONS_DIR = new URL("../", import.meta.url);

function relativeToFunctions(file: URL): string {
  const base = FUNCTIONS_DIR.pathname;
  const full = file.pathname;
  return full.startsWith(base) ? full.slice(base.length) : full;
}

async function tsSources(): Promise<Array<{ path: string; text: string }>> {
  const out: Array<{ path: string; text: string }> = [];
  for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
    if (!entry.isDirectory) continue;
    const dir = new URL(`${entry.name}/`, FUNCTIONS_DIR);
    for await (const f of walk(dir)) out.push(f);
  }
  return out;
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

function stripLineComments(src: string): string {
  return src.split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
}

/** Files (relative to functions/) that call a write verb on `table`, within
 *  a 2000-char forward window of the .from() match — same windowing as
 *  place-name-writes.test.ts, needed because most writes here are
 *  multi-line chains. Deliberately imprecise (same tradeoff
 *  place-name-writes.test.ts accepts): the window can catch an unrelated
 *  write/delete on a DIFFERENT table that happens to follow within 2000
 *  chars. That is an acceptable false-positive rate
 *  for a ratchet whose job is "does anything NEW show up", not a claim of
 *  surgical precision. */
async function findWriters(table: string, verbs: RegExp): Promise<string[]> {
  const tablePattern = new RegExp(`\\.from\\(\\s*["']${table}["']\\s*\\)`, "g");
  const found = new Set<string>();
  for (const { path, text } of await tsSources()) {
    const src = stripLineComments(text);
    for (const m of src.matchAll(tablePattern)) {
      const window = src.slice(m.index ?? 0, (m.index ?? 0) + 2000);
      if (verbs.test(window)) found.add(path);
    }
  }
  return [...found].sort();
}

const WRITE_VERBS = /\.(insert|update|upsert)\s*\(/;
const DELETE_VERB = /\.delete\s*\(/;

function assertRatchet(found: string[], allowlist: string[], what: string) {
  const extra = found.filter((f) => !allowlist.includes(f));
  assertEquals(extra, [], `new direct ${what}: ${extra.join(", ")}`);
  const stale = allowlist.filter((f) => !found.includes(f));
  assertEquals(
    stale,
    [],
    `allowlist names a file that is no longer a ${what}: ${stale.join(", ")} — delete these lines`,
  );
}

// ── PLACE (place_profiles, profiles) ─────────────────────────────────────
// `_shared/place-doc.ts` (writePlace) is THE place door; this literal-string
// scan cannot see it (the table is a parameterized arg), so it is not listed.
const PLACE_PROFILE_UPDATE_ALLOWLIST = [
  "_shared/field-correction-writer.ts", // enrichment field pins (MESITA-2029)
];

Deno.test("PLACE: no new writer of place_profiles/profiles outside the allowlist", async () => {
  const found = new Set([...await findWriters("place_profiles", WRITE_VERBS), ...await findWriters("profiles", WRITE_VERBS)]);
  assertRatchet([...found].sort(), PLACE_PROFILE_UPDATE_ALLOWLIST, "writer of place_profiles/profiles");
});

// ── PLACE ROW (places) — MESITA-1284: this table was missing from every
// ratchet in this file (both this ivory-tower ratchet and the DELETION LAW
// list below), so a new direct writer/deleter of places went completely
// unratcheted by CI. It was EMPTY of real writers until MESITA-1892, VERIFIED
// by running findWriters() rather than assumed: every real write to "places"
// went through `_shared/place-doc.ts`'s writePlace() as a parameterized
// dispatch (`admin.from(args.table)`), which this literal-string scan cannot
// and should not match.
//
// It is empty again. A raw `.from("places")` write is allowed only where the
// door would cost a guarantee, and an entry here has to say which one.
const PLACE_ROW_UPDATE_ALLOWLIST: string[] = [];

Deno.test("PLACE ROW: no new writer of places outside the allowlist", async () => {
  assertRatchet(await findWriters("places", WRITE_VERBS), PLACE_ROW_UPDATE_ALLOWLIST, "writer of places");
});

// ── CONSUMER (consumers) ─────────────────────────────────────────────────
const CONSUMER_ALLOWLIST = [
  "_shared/consumer-doc.ts", // THE consumer door (PR #1157)
];

Deno.test("CONSUMER: no new writer of consumers outside the allowlist", async () => {
  assertRatchet(await findWriters("consumers", WRITE_VERBS), CONSUMER_ALLOWLIST, "writer of consumers");
});

// ── RESERVATION (reservation_tickets) ───────────────────────────────────
const RESERVATION_ALLOWLIST = [
  "_shared/reservation-doc.ts", // THE reservation door (writeReservation, MESITA-1280)
  "supabase-cron-retry-reservations/index.ts",
  "supabase-edgefunc-place-reservation-call/index.ts",
];

Deno.test("RESERVATION: no new writer of reservation_tickets outside the allowlist", async () => {
  assertRatchet(await findWriters("reservation_tickets", WRITE_VERBS), RESERVATION_ALLOWLIST, "writer of reservation_tickets");
});

// ── CONFIG (app_config) ─────────────────────────────────────────────────
const CONFIG_ALLOWLIST = [
  "_shared/write-config.ts", // THE app_config door (MESITA-1724) — every admin config section reads and writes here
  "supabase-edgefunc-sync-reservationist/index.ts",
];

Deno.test("CONFIG: no new writer of app_config outside the allowlist", async () => {
  assertRatchet(await findWriters("app_config", WRITE_VERBS), CONFIG_ALLOWLIST, "writer of app_config");
});

// ── Guard test 4, refusal half ──────────────────────────────────────────
//
// Scope: hard DELETE on one of the five aggregates' OWN row — place_profiles,
// profiles, consumers, reservation_tickets, places (MESITA-1284 — this table
// was missing from both ratchets below). Deliberately NOT in scope:
// satellite/audit tables (place_creation_attempts)
// whose own insert/delete is normal operation, not a deletion-law question.
//
// The window's 2000-char forward reach from an aggregate's .from() match can
// catch a genuinely unrelated .delete() a few lines later that targets a
// satellite table, not the aggregate row itself. An entry that is only that
// says so in its comment, naming the real target, so a future reader is not
// misled and the scan can be tightened later without this file going stale.
const HARD_DELETE_ALLOWLIST: string[] = [];

Deno.test("DELETION LAW (refusal half): no new hard DELETE on a place/consumer/reservation row", async () => {
  const tables = ["place_profiles", "profiles", "consumers", "reservation_tickets", "places"];
  const found = new Set<string>();
  for (const t of tables) for (const f of await findWriters(t, DELETE_VERB)) found.add(f);
  assertRatchet(
    [...found].sort(),
    HARD_DELETE_ALLOWLIST,
    "hard delete on an aggregate row (MESITA-1250 owns the soft-delete replacement)",
  );
});

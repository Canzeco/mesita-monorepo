// _shared/write-surface.test.ts
//
// Two things sharing one scan (MESITA-1247):
//  1. Deliverable 3's CI grep: today's scattered writers, enumerated from an
//     ACTUAL scan of the tree (not hand-transcribed from a survey doc — a
//     naive single-line grep undercounts badly; verified empirically while
//     building this file: a plain `.from("app_config").update(` grep found
//     0 writers where this windowed scan found 19, because the real code is
//     virtually all multi-line chains), are the frozen ALLOWLIST baseline.
//     This test fails only on a NEW file writing an aggregate table outside
//     its door and that baseline — migrating an allowlisted caller onto its
//     door only ever SHRINKS the allowlist, never breaks this test.
//  2. Guard test 4's refusal half: a hard DELETE on an aggregate's own row,
//     ratcheted the same way. The visibility half is consumers.deleted_at
//     plus `_shared/delete-history-free.ts` (MESITA-1250).
//
// CONSUMER note: PR #1157 (merged 2026-08-23, same issue) already built a
// comprehensive consumer validator + write door — `_shared/consumer-doc.ts`,
// `ConsumerDoc`/`validateConsumerPatch`/`writeConsumer` — and routed its
// own survey's 7 call sites through it. This PR does not build a second,
// competing consumer door — that would contradict deliverable 3 ("the ONLY
// exported mutation function"). The allowlist below is bootstrapped from a
// real scan taken AFTER #1157 landed, and still finds 6 files besides
// consumer-doc.ts itself writing `consumers` directly — #1157's routing
// covered its own survey's call sites, not the full closure of every
// `.from("consumers")` write in the tree. Freezing that honestly (not
// pretending the door is the sole writer when the scan says otherwise) is
// what this ratchet is for; migrating those 6 onto the door is follow-up
// work, not a claim this comment makes.
//
// RECONCILIATION (2026-08-23, same day, after this PR's own branch was cut):
// three more child issues split off this same parent (MESITA-1247 §21:58)
// landed on main before this PR did — MESITA-1279/1280/1281 shipped real,
// comprehensive doors for PLACE/RESERVATION/TICKET (`place-doc.ts`
// writePlace, `reservation-doc.ts` writeReservation, `ticket-doc.ts`
// writeTicket), each routing most or all of its aggregate's existing call
// sites. `place-doc.ts`/`ticket-doc.ts`/`ojo-engine.ts`/`reservation-doc.ts`
// are added to the allowlists below — new files now writing their
// aggregate's table directly, which is exactly what a door (or, for
// ojo-engine.ts, a pre-existing shipped writer this ratchet's baseline
// simply predates) is supposed to do. See each entry's own comment for
// which is which. `update-place.ts` (this PR's own PLACE door) is REMOVED
// from the allowlist below — deleted in this reconciliation as a second,
// competing PLACE door now that `place-doc.ts` is the real one; its jsonb
// content schemas (place-jsonb-schemas.ts) were folded into place-doc.ts's
// validator instead, per the coordination comment on this PR
// (github.com/Canzeco/mesita-monorepo/pull/1163#issuecomment-5388875090).
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
 *  chars — verified this actually happens for two DELETE entries below
 *  (see the allowlist comments). That is an acceptable false-positive rate
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

// ── PLACE (place_profiles, profiles) — bootstrapped from a real findWriters() run ──
const PLACE_PROFILE_UPDATE_ALLOWLIST = [
  "_shared/place-doc.ts", // THE place door (writePlace, MESITA-1279/#1164) — not actually caught by this scan (table is a parameterized arg, not a literal .from("place_profiles")), listed for a future reader's clarity
  "_shared/field-correction-writer.ts", // enrichment field pins (MESITA-2029)
  "_shared/place-embeddings.ts",
  "_shared/save-place.ts",
  "_shared/social-followers.ts",
  "_shared/store-place-images.ts",
  "admin-web-set-place-listed/index.ts",
  "admin-web-set-place-active/index.ts",
  "admin-web-update-place/index.ts",
  "enricher-cron-enrich-place-contents/index.ts",
  "enricher-cron-enrich-place-research/index.ts",
  "supabase-edgefunc-reservation-call/index.ts",
];

Deno.test("PLACE: no new writer of place_profiles/profiles outside the allowlist", async () => {
  const found = new Set([...await findWriters("place_profiles", WRITE_VERBS), ...await findWriters("profiles", WRITE_VERBS)]);
  const extra = [...found].filter((f) => !PLACE_PROFILE_UPDATE_ALLOWLIST.includes(f));
  assertEquals(extra, [], `new direct writer(s) of place_profiles/profiles: ${extra.join(", ")}`);
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
  const found = await findWriters("places", WRITE_VERBS);
  const extra = found.filter((f) => !PLACE_ROW_UPDATE_ALLOWLIST.includes(f));
  assertEquals(extra, [], `new direct writer(s) of places: ${extra.join(", ")}`);
});

// ── CONSUMER (consumers) — see the CONSUMER note in the file header ────────
const CONSUMER_ALLOWLIST = [
  "_shared/consumer-doc.ts", // PR #1157's write door (merged)
  "consumer-web-create-reservation/index.ts",
];

Deno.test("CONSUMER: no new writer of consumers outside the allowlist", async () => {
  const found = await findWriters("consumers", WRITE_VERBS);
  const extra = found.filter((f) => !CONSUMER_ALLOWLIST.includes(f));
  assertEquals(extra, [], `new direct writer(s) of consumers: ${extra.join(", ")}`);
});

// ── RESERVATION (reservation_tickets) ───────────────────────────────────
const RESERVATION_ALLOWLIST = [
  "_shared/agent-tools.ts",
  "_shared/reservation-doc.ts", // THE reservation door (writeReservation, MESITA-1280) — 28/28 call sites routed, the last 13 (supabase-edgefunc-reservation-call/index.ts) in a follow-up PR (#1169) once the write-surface research confirmed every literal value that file writes was already covered by the closed sets
  "consumer-web-confirm-reservation/index.ts",
  "consumer-web-create-reservation/index.ts",
  "consumer-web-update-reservation/index.ts",
  "eleven-a1-report-outcome/index.ts",
  "eleven-a2-confirm-reservation/index.ts",
  "supabase-cron-reservation-retries/index.ts",
  "supabase-edgefunc-reservation-call/index.ts",
];

Deno.test("RESERVATION: no new writer of reservation_tickets outside the allowlist", async () => {
  const found = await findWriters("reservation_tickets", WRITE_VERBS);
  const extra = found.filter((f) => !RESERVATION_ALLOWLIST.includes(f));
  assertEquals(extra, [], `new direct writer(s) of reservation_tickets: ${extra.join(", ")}`);
});

// ── CONFIG (app_config) ─────────────────────────────────────────────────
//
// MESITA-1724 shrank this list by eleven: the admin console's ten config
// writers were `admin-web-update-<page>-config/index.ts`, each with its own
// `.from("app_config").update()`, and one of them was listed TWICE
// (`admin-web-update-reservations-config/index.ts`, a copy-paste in the
// bootstrap scan that made the allowlist look one entry longer than the tree
// it froze). They are now sections of admin-web-update-config, dispatched
// through `_shared/config-sections.ts` and writing through
// `_shared/write-config.ts` — the door this file has allowed since it was
// written, finally the only writer it names.
const CONFIG_ALLOWLIST = [
  "_shared/save-place.ts",
  "_shared/write-config.ts", // THE app_config door (MESITA-1724) — every admin config section reads and writes here
  "consumer-web-create-reservation/index.ts",
  "consumer-web-update-reservation/index.ts",
  "supabase-edgefunc-reservation-call/index.ts",
  "supabase-edgefunc-sync-reservationist/index.ts",
];

Deno.test("CONFIG: no new writer of app_config outside the allowlist", async () => {
  const found = await findWriters("app_config", WRITE_VERBS);
  const extra = found.filter((f) => !CONFIG_ALLOWLIST.includes(f));
  assertEquals(extra, [], `new direct writer(s) of app_config: ${extra.join(", ")}`);
});

// ── Guard test 4, refusal half ──────────────────────────────────────────
//
// Scope: hard DELETE on one of the five aggregates' OWN row — place_profiles,
// profiles, consumers, reservation_tickets, places (MESITA-1284 — this table
// was missing from both ratchets below). Deliberately NOT in scope:
// satellite/audit tables (place_creation_attempts, nearby_google_attempts)
// whose own insert/delete is normal operation, not a deletion-law question.
//
// The window's 2000-char forward reach from an aggregate's .from() match can
// catch a genuinely unrelated .delete() a few lines later that targets a
// satellite table, not the aggregate row itself. An entry that is only that
// says so in its comment, naming the real target, so a future reader is not
// misled and the scan can be tightened later without this file going stale.
const HARD_DELETE_ALLOWLIST = [
  "_shared/save-place.ts", // real: deletes the place_profiles row it just inserted, on a failed downstream step (compensating-write pattern)
];

Deno.test("DELETION LAW (refusal half): no new hard DELETE on a place/consumer/reservation row", async () => {
  const tables = ["place_profiles", "profiles", "consumers", "reservation_tickets", "places"];
  const found = new Set<string>();
  for (const t of tables) for (const f of await findWriters(t, DELETE_VERB)) found.add(f);
  const extra = [...found].filter((f) => !HARD_DELETE_ALLOWLIST.includes(f));
  assertEquals(
    extra,
    [],
    `new hard delete on an aggregate row: ${extra.join(", ")} — MESITA-1250 owns the soft-delete replacement`,
  );
});

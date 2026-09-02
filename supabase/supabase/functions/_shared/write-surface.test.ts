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

// ── PLACE (places, profiles) — bootstrapped from a real findWriters() run ──
const PLACE_UPDATE_ALLOWLIST = [
  "_shared/embeddings.ts",
  "_shared/ojo-engine.ts", // windowing false positive — its .from("profiles") is read-only (.select); the write-verb match in the 2000-char window is the unrelated visit_tickets .update() a few lines later
  "_shared/place-doc.ts", // THE place door (writePlace, MESITA-1279/#1164) — not actually caught by this scan (table is a parameterized arg, not a literal .from("places")), listed for a future reader's clarity
  "_shared/place-embeddings.ts",
  "_shared/save-place.ts",
  "_shared/social-followers.ts",
  "_shared/store-place-images.ts",
  "_shared/ticket-reprice.ts",
  "_shared/ticket-review-notify.ts",
  "admin-web-set-place-enrichment/index.ts",
  "admin-web-set-place-listed/index.ts",
  "admin-web-set-place-active/index.ts",
  "admin-web-set-place-verified/index.ts", // windowing false positive — .from("places") is a select; the insert writes project_verifications
  "admin-web-set-plan/index.ts",
  "business-web-confirm-reservation/index.ts",
  "business-web-request-manual-review/index.ts",
  "business-web-update-project/index.ts",
  "validate-web-get-ticket/index.ts",
  "consumer-web-submit-review/index.ts",
  "consumer-web-submit-story/index.ts",
  "supabase-cron-enrich-place-contents/index.ts",
  "supabase-cron-enrich-place-research/index.ts",
  "supabase-edgefunc-reservation-call/index.ts",
];

Deno.test("PLACE: no new writer of places/profiles outside the allowlist", async () => {
  const found = new Set([...await findWriters("places", WRITE_VERBS), ...await findWriters("profiles", WRITE_VERBS)]);
  const extra = [...found].filter((f) => !PLACE_UPDATE_ALLOWLIST.includes(f));
  assertEquals(extra, [], `new direct writer(s) of places/profiles: ${extra.join(", ")}`);
});

// ── PROJECT (projects) — MESITA-1284: this table was missing from every
// ratchet in this file (both this ivory-tower ratchet and the DELETION LAW
// list below), so a new direct writer/deleter of projects went completely
// unratcheted by CI. Empty on purpose, VERIFIED by running findWriters()
// against this branch, not assumed: every real write to "projects" goes
// through `_shared/place-doc.ts`'s writePlace() as a parameterized dispatch
// (`admin.from(args.table)`), which this literal-string scan cannot and
// should not match — so an empty allowlist here is the correct, current
// baseline, not an oversight. If this test ever fails, it means a NEW file
// wrote `.from("projects")` directly, bypassing the door.
const PROJECT_UPDATE_ALLOWLIST: string[] = [];

Deno.test("PROJECT: no new writer of projects outside the allowlist", async () => {
  const found = await findWriters("projects", WRITE_VERBS);
  const extra = found.filter((f) => !PROJECT_UPDATE_ALLOWLIST.includes(f));
  assertEquals(extra, [], `new direct writer(s) of projects: ${extra.join(", ")}`);
});

// ── CONSUMER (consumers) — see the CONSUMER note in the file header ────────
const CONSUMER_ALLOWLIST = [
  "_shared/consumer-doc.ts", // PR #1157's write door (merged)
  "validate-web-get-ticket/index.ts",
  "consumer-mcp/index.ts",
  "consumer-web-create-connector/index.ts",
  "consumer-web-create-reservation/index.ts",
  "consumer-web-create-ticket/index.ts",
  "consumer-web-submit-story/index.ts",
];

Deno.test("CONSUMER: no new writer of consumers outside the allowlist", async () => {
  const found = await findWriters("consumers", WRITE_VERBS);
  const extra = found.filter((f) => !CONSUMER_ALLOWLIST.includes(f));
  assertEquals(extra, [], `new direct writer(s) of consumers: ${extra.join(", ")}`);
});

// ── TICKET (visit_tickets) — no door this PR, ratchet only ─────────────
// THE ticket door now exists (`_shared/ticket-doc.ts`, writeTicket,
// MESITA-1281/#1161, merged after this PR's branch was cut) — routes 18/18
// existing call sites. This PR's own TICKET section stays ratchet-only by
// design (see the file header / PR body: a door without the state-machine
// transition logic would be misleading); no reconciliation needed beyond
// listing the new door + ojo-engine.ts below.
const TICKET_ALLOWLIST = [
  "_shared/ojo-engine.ts", // real writer (Ojo, MESITA-1034/#1159, merged after this ratchet's baseline scan) — annotation + status-transition updates on visit_tickets, all CAS-guarded (see the file itself)
  "_shared/ticket-doc.ts", // THE ticket door (writeTicket, MESITA-1281/#1161)
  "_shared/ticket-informal.ts",
  "_shared/ticket-reprice.ts",
  "_shared/ticket-review-notify.ts",
  "business-web-cancel-ticket/index.ts",
  "validate-web-approve-ticket/index.ts",
  "validate-web-get-ticket/index.ts",
  "validate-web-request-fix/index.ts",
  "validate-web-scan-ticket/index.ts",
  "validate-web-validate-ticket/index.ts",
  "consumer-web-cancel-ticket/index.ts",
  "consumer-web-create-ticket/index.ts",
  "consumer-web-report-ticket/index.ts",
  "consumer-web-select-ticket-payment/index.ts",
  "consumer-web-submit-review/index.ts",
  "consumer-web-submit-story/index.ts",
  "consumer-web-submit-ticket-bill/index.ts",
  "consumer-web-submit-ticket-review/index.ts",
  "consumer-web-submit-ticket-total/index.ts",
];

Deno.test("TICKET: no new writer of visit_tickets outside the allowlist", async () => {
  const found = await findWriters("visit_tickets", WRITE_VERBS);
  const extra = found.filter((f) => !TICKET_ALLOWLIST.includes(f));
  assertEquals(extra, [], `new direct writer(s) of visit_tickets: ${extra.join(", ")}`);
});

// ── RESERVATION (reservation_tickets) ───────────────────────────────────
const RESERVATION_ALLOWLIST = [
  "_shared/agent-tools.ts",
  "_shared/reservation-attempts.ts", // complementary to reservation-doc.ts, not competing — different axis (AttemptEntry shape) on the same file (supabase-edgefunc-reservation-call/index.ts) that reservation-doc.ts's writeReservation door now also routes
  "_shared/reservation-doc.ts", // THE reservation door (writeReservation, MESITA-1280) — 28/28 call sites routed, the last 13 (supabase-edgefunc-reservation-call/index.ts) in a follow-up PR (#1169) once the write-surface research confirmed every literal value that file writes was already covered by the closed sets
  "business-web-confirm-reservation/index.ts",
  "consumer-mcp/index.ts",
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
const CONFIG_ALLOWLIST = [
  "_shared/otp.ts",
  "_shared/save-place.ts",
  "_shared/write-config.ts",
  "admin-web-update-controls-config/index.ts",
  "admin-web-update-discovery-config/index.ts",
  "admin-web-update-enricher-config/index.ts",
  "admin-web-update-models-config/index.ts",
  "admin-web-update-ojo-config/index.ts",
  "admin-web-update-orders-config/index.ts",
  "admin-web-update-reservations-config/index.ts",
  "admin-web-update-reservations-config/index.ts",
  "admin-web-update-rewards-config/index.ts",
  "admin-web-update-verification-config/index.ts",
  "admin-web-update-visits-config/index.ts",
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
// Scope: hard DELETE on one of the six aggregates' OWN row — places,
// profiles, consumers, visit_tickets, reservation_tickets, projects
// (MESITA-1284 — this table was missing from both ratchets below). Deliberately NOT
// in scope: satellite/audit tables (place_creation_attempts,
// nearby_google_attempts,
// project_verifications, project_members, project_invites,
// consumer_review_claims) whose own insert/delete is normal operation, not
// a deletion-law question.
//
// Two of the four entries below are windowing false positives, VERIFIED by
// reading the actual source rather than trusting the scan (per this PR's
// own instructions not to trust an unverified claim): the window's 2000-char
// forward reach from a `places`/`profiles`/`visit_tickets` .from() match
// catches a genuinely unrelated .delete() a few lines later that targets a
// satellite table, not the aggregate row itself. Left in the allowlist
// (rather than "fixing" the scan to be chain-precise, which the spec this
// PR follows explicitly says to leave as-is) with a comment naming the real
// target, so a future reader is not misled and the scan technique can be
// tightened later without this file silently going stale.
const HARD_DELETE_ALLOWLIST = [
  "_shared/save-place.ts", // real: deletes the places row it just inserted, on a failed downstream step (compensating-write pattern)
  "_shared/ticket-doc.ts", // writeTicket still exposes mode: "delete"; account close must not call it (MESITA-1250 — tickets stay)
  "business-web-request-manual-review/index.ts", // windowing false positive — real delete() targets project_verifications (dedup-before-insert), not profiles
  "consumer-web-submit-review/index.ts", // windowing false positive — real delete() targets consumer_review_claims (claim rollback on a failed write), not profiles or visit_tickets
];

Deno.test("DELETION LAW (refusal half): no new hard DELETE on a place/consumer/ticket/reservation row", async () => {
  const tables = ["places", "profiles", "consumers", "visit_tickets", "reservation_tickets", "projects"];
  const found = new Set<string>();
  for (const t of tables) for (const f of await findWriters(t, DELETE_VERB)) found.add(f);
  const extra = [...found].filter((f) => !HARD_DELETE_ALLOWLIST.includes(f));
  assertEquals(
    extra,
    [],
    `new hard delete on an aggregate row: ${extra.join(", ")} — MESITA-1250 owns the soft-delete replacement`,
  );
});

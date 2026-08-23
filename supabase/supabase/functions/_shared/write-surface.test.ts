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
//     ratcheted the same way. The visibility half needs a status column
//     that doesn't exist yet — that's MESITA-1250's, not this file's.
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
  "_shared/place-embeddings.ts",
  "_shared/save-place.ts",
  "_shared/social-followers.ts",
  "_shared/store-place-images.ts",
  "_shared/ticket-reprice.ts",
  "_shared/ticket-review-notify.ts",
  "_shared/update-place.ts",
  "admin-web-set-place-enrichment/index.ts",
  "admin-web-set-place-listed/index.ts",
  "admin-web-set-plan/index.ts",
  "business-web-confirm-reservation/index.ts",
  "business-web-request-manual-review/index.ts",
  "business-web-update-project/index.ts",
  "check-web-get-ticket/index.ts",
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

// ── CONSUMER (consumers) — see the CONSUMER note in the file header ────────
const CONSUMER_ALLOWLIST = [
  "_shared/consumer-doc.ts", // PR #1157's write door (merged)
  "check-web-get-ticket/index.ts",
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
const TICKET_ALLOWLIST = [
  "_shared/ticket-informal.ts",
  "_shared/ticket-reprice.ts",
  "_shared/ticket-review-notify.ts",
  "business-web-cancel-ticket/index.ts",
  "check-web-approve-ticket/index.ts",
  "check-web-get-ticket/index.ts",
  "check-web-request-fix/index.ts",
  "check-web-scan-ticket/index.ts",
  "check-web-validate-ticket/index.ts",
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
  "_shared/reservation-attempts.ts",
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
  "admin-web-set-auto-verify/index.ts",
  "admin-web-update-discovery-config/index.ts",
  "admin-web-update-enricher-config/index.ts",
  "admin-web-update-memo-config/index.ts",
  "admin-web-update-models-config/index.ts",
  "admin-web-update-ojo-config/index.ts",
  "admin-web-update-orders-config/index.ts",
  "admin-web-update-reservations-config/index.ts",
  "admin-web-update-rewards-config/index.ts",
  "admin-web-update-sourcing-config/index.ts",
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
// profiles, consumers, visit_tickets, reservation_tickets. Deliberately NOT
// in scope: satellite/audit tables (place_creation_attempts,
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
  "business-web-request-manual-review/index.ts", // windowing false positive — real delete() targets project_verifications (dedup-before-insert), not profiles
  "consumer-web-delete-account/index.ts", // real: deletes the consumer's own visit_tickets as part of account deletion — VERIFIED it does NOT hard-delete the consumers row itself (no delete() on consumers exists anywhere in the codebase today)
  "consumer-web-submit-review/index.ts", // windowing false positive — real delete() targets consumer_review_claims (claim rollback on a failed write), not profiles or visit_tickets
];

Deno.test("DELETION LAW (refusal half): no new hard DELETE on a place/consumer/ticket/reservation row", async () => {
  const tables = ["places", "profiles", "consumers", "visit_tickets", "reservation_tickets"];
  const found = new Set<string>();
  for (const t of tables) for (const f of await findWriters(t, DELETE_VERB)) found.add(f);
  const extra = [...found].filter((f) => !HARD_DELETE_ALLOWLIST.includes(f));
  assertEquals(
    extra,
    [],
    `new hard delete on an aggregate row: ${extra.join(", ")} — MESITA-1250 owns the soft-delete replacement`,
  );
});

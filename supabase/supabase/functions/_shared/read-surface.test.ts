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
// The `project_id → place_id` remap lives ONLY inside ticket-doc.ts and
// reservation-doc.ts. A handful of readers do `fromPlaceIdRow` by hand
// (`ticket-check.ts`, `agent-tools.ts`, `consumer-web-get-ticket`) and are
// named on those allowlists. Everyone else on the list is today's honest
// baseline, not a claim they have been migrated.
//
// Belt 2 — SWALLOWED ERRORS. Being on the right side of the remap and being
// able to see your own failure are different properties. `ticket-check.ts`
// remaps by hand and still destructures `{ data }` alone, so a failed
// lookup behind Mesita Validate's staff page says the code is not a ticket.
// 31 files, list only shrinks. The scan flags only the destructure that
// omits `error`; `const r = await …` and the builder shape are not guessed.
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
  "visit_tickets",
  "reservation_tickets",
  "place_profiles",
  "profiles",
  "places",
  "consumers",
  "organization_payment_accounts",
  "organization_guest_customers",
] as const;

/** The doors themselves, and the compat shim. They read these tables because
 *  that is their job. */
const DOORS = [
  "_shared/ticket-doc.ts",
  "_shared/reservation-doc.ts",
  "_shared/place-doc.ts",
  "_shared/consumer-doc.ts",
  "_shared/payment-account-doc.ts",
  "_shared/organization-guest-customer-doc.ts",
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

const VISIT_TICKET_READ_ALLOWLIST = [
  "_shared/membership.ts",
  "_shared/ojo-engine.ts",
  "_shared/ticket-check.ts", // remaps by hand (fromPlaceIdRow) — MESITA-1718 seed
  "_shared/ticket-doc.ts", // THE ticket door (writeTicket)
  "_shared/ticket-informal.ts",
  "_shared/ticket-reprice.ts",
  "_shared/ticket-review-notify.ts",
  "admin-web-get-place-activity/index.ts",
  "business-web-cancel-ticket/index.ts",
  "business-web-get-overview/index.ts",
  "business-web-get-performance/index.ts",
  "business-web-list-tickets/index.ts",
  "business-web-mark-ticket-paid/index.ts",
  "business-web-record-strike/index.ts",
  "business-web-suggest-promo/index.ts",
  "consumer-web-apply-ticket-credits/index.ts",
  "consumer-web-cancel-ticket/index.ts",
  "consumer-web-create-ticket/index.ts",
  "consumer-web-get-metrics/index.ts",
  "consumer-web-get-place-activity/index.ts",
  "consumer-web-get-profile/index.ts",
  "consumer-web-get-ticket/index.ts", // remaps by hand (fromPlaceIdRow) — MESITA-1718 seed
  "consumer-web-list-pay-notifications/index.ts",
  "consumer-web-list-tickets/index.ts",
  "consumer-web-report-ticket/index.ts",
  "consumer-web-select-ticket-payment/index.ts",
  "consumer-web-submit-review/index.ts",
  "consumer-web-submit-story/index.ts",
  "consumer-web-submit-ticket-bill/index.ts",
  "consumer-web-submit-ticket-review/index.ts",
  "consumer-web-submit-ticket-total/index.ts",
  "stripe-webhook-handle-event/ticket-payment-intent.ts",
  "validate-web-approve-ticket/index.ts",
  "validate-web-poll-ticket/index.ts",
  "validate-web-request-fix/index.ts",
  "validate-web-validate-ticket/index.ts",
];

Deno.test("TICKET READ: no new raw reader of visit_tickets outside the allowlist", async () => {
  assertRatchet("visit_tickets", await findReaders("visit_tickets"), VISIT_TICKET_READ_ALLOWLIST);
});

const RESERVATION_TICKET_READ_ALLOWLIST = [
  "_shared/agent-tools.ts", // remaps by hand (fromPlaceIdRow) — MESITA-1718 seed
  "_shared/config-section-reservations.ts",
  "_shared/reservation-doc.ts", // THE reservation door (writeReservation)
  "admin-web-get-place-activity/index.ts",
  "business-web-confirm-reservation/index.ts",
  "business-web-get-performance/index.ts",
  "consumer-mcp/index.ts",
  "consumer-mcp/profile-tool.ts",
  "consumer-web-cancel-reservation/index.ts",
  "consumer-web-confirm-reservation/index.ts",
  "consumer-web-create-reservation/index.ts",
  "consumer-web-get-metrics/index.ts",
  "consumer-web-get-place-activity/index.ts",
  "consumer-web-get-profile/index.ts",
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
  "_shared/credits-readiness.ts",
  "_shared/discovery-place.ts",
  "_shared/mesita-name-door.ts",
  "_shared/mesita-pay-readiness.ts",
  "_shared/pulse-report.ts",
  "admin-web-enrich-place/index.ts",
  "admin-web-get-place-enrichment/index.ts",
  "admin-web-get-place-payment-account/index.ts",
  "admin-web-list-notifications/notification-state.ts",
  "admin-web-search-places/index.ts",
  "admin-web-set-place-enrichment/index.ts",
  "admin-web-set-place-verified/index.ts",
  "business-web-confirm-reservation/index.ts",
  "business-web-get-overview/index.ts",
  "business-web-update-place/place-social-refresh.ts",
  "consumer-web-apply-ticket-credits/index.ts",
  "consumer-web-confirm-reservation/index.ts",
  "consumer-web-list-credit-places/index.ts",
  "eleven-a1-report-outcome/index.ts",
  "eleven-a2-confirm-reservation/index.ts",
  "eleven-a4-cancel-reservation/index.ts",
  "eleven-a4-find-reservation/index.ts",
  "eleven-a4-verify-caller/index.ts",
  "eleven-agent-get-reservation/index.ts",
  "supabase-cron-enrich-place-contents/index.ts",
  "supabase-cron-enrich-place-research/index.ts",
  "supabase-edgefunc-reservation-call/index.ts",
];

Deno.test("PLACE PROFILE READ: no new raw reader of place_profiles outside the allowlist", async () => {
  assertRatchet("place_profiles", await findReaders("place_profiles"), PLACE_PROFILE_READ_ALLOWLIST);
});

const PROFILES_READ_ALLOWLIST = [
  "_shared/consumer-search-lane.ts",
  "_shared/create-place.ts",
  "_shared/ojo-engine.ts",
  "_shared/place-embeddings.ts",
  "_shared/place-pool.ts",
  "_shared/place-requests.ts",
  "_shared/place-slug.ts",
  "_shared/save-place.ts",
  "_shared/suggest-places.ts",
  "_shared/ticket-reprice.ts",
  "_shared/ticket-review-notify.ts",
  "admin-web-delete-place/index.ts",
  "admin-web-find-place/index.ts",
  "admin-web-list-notifications/index.ts",
  "admin-web-list-notifications/notification-state.ts",
  "admin-web-search-places/index.ts",
  "admin-web-set-place-active/index.ts",
  "admin-web-set-place-listed/index.ts",
  "admin-web-set-plan/index.ts",
  "business-web-find-place/index.ts",
  "business-web-get-overview/index.ts",
  "business-web-request-manual-review/index.ts",
  "business-web-send-email-otp/index.ts",
  "business-web-send-phone-otp/index.ts",
  "business-web-suggest-promo/index.ts",
  "consumer-mcp/index.ts",
  "consumer-web-create-ticket/index.ts",
  "consumer-web-get-place-activity/index.ts",
  "consumer-web-get-place/index.ts",
  "consumer-web-list-catalog/index.ts",
  "consumer-web-list-pay-notifications/index.ts",
  "consumer-web-list-places/index.ts",
  "consumer-web-recommend-swipe/index.ts",
  "consumer-web-submit-review/index.ts",
  "consumer-web-submit-story/index.ts",
  "supabase-edgefunc-discover-places/index.ts",
  "supabase-edgefunc-search-places/index.ts",
  "validate-web-get-ticket/index.ts",
];

Deno.test("PROFILES READ: no new raw reader of profiles outside the allowlist", async () => {
  assertRatchet("profiles", await findReaders("profiles"), PROFILES_READ_ALLOWLIST);
});

const PLACES_READ_ALLOWLIST = [
  "_shared/auth-membership.ts",
  "_shared/credits-readiness.ts",
  "_shared/membership-enforcement.ts",
  "_shared/mesita-pay-readiness.ts",
  "_shared/org-membership.ts",
  "_shared/place-claim.ts",
  "_shared/reservation-places.ts",
  "_shared/ticket-check.ts",
  "admin-web-decide-place-claim/index.ts",
  "admin-web-delete-place/index.ts",
  "admin-web-get-place-enrichment/index.ts",
  "admin-web-get-place-payment-account/index.ts",
  "admin-web-list-place-claims/index.ts",
  "admin-web-set-place-listed/index.ts",
  "admin-web-set-plan/index.ts",
  "business-web-change-subscription/index.ts",
  "business-web-get-overview/index.ts",
  "business-web-get-place/index.ts",
  "business-web-list-organizations/index.ts",
  "business-web-list-places/index.ts",
  "business-web-release-place/index.ts",
  "business-web-update-place/index.ts",
  "business-web-verify-place/index.ts",
  "consumer-web-apply-ticket-credits/index.ts",
  "consumer-web-create-reservation/index.ts",
  "consumer-web-get-discount-quote/index.ts",
  "consumer-web-list-credit-places/index.ts",
  "stripe-webhook-handle-event/index.ts",
];

Deno.test("PLACE ROW READ: no new raw reader of places outside the allowlist", async () => {
  assertRatchet("places", await findReaders("places"), PLACES_READ_ALLOWLIST);
});

const CONSUMER_READ_ALLOWLIST = [
  "_shared/class-doors.ts",
  "_shared/consumer-doc.ts", // THE consumer door
  "_shared/delete-history-free.ts",
  "_shared/stripe-billing.ts",
  "_shared/ticket-reprice.ts",
  "admin-web-grant-class/index.ts",
  "consumer-mcp/index.ts",
  "consumer-mcp/profile-tool.ts",
  "consumer-web-create-connector/index.ts",
  "consumer-web-create-reservation/index.ts",
  "consumer-web-create-ticket/index.ts",
  "consumer-web-get-discount-quote/index.ts",
  "consumer-web-get-profile/index.ts",
  "consumer-web-signin-phone/index.ts",
  "consumer-web-submit-story/index.ts",
  "consumer-web-update-profile/index.ts",
  "eleven-a3-verify-caller/index.ts",
  "eleven-agent-get-reservation/index.ts",
  "supabase-edgefunc-get-consumer-context/index.ts",
  "validate-web-get-ticket/index.ts",
];

Deno.test("CONSUMER READ: no new raw reader of consumers outside the allowlist", async () => {
  assertRatchet("consumers", await findReaders("consumers"), CONSUMER_READ_ALLOWLIST);
});

const PAYMENT_ACCOUNT_READ_ALLOWLIST = [
  "_shared/credits-readiness.ts",
  "_shared/mesita-pay-readiness.ts",
  "_shared/payment-account-doc.ts", // THE payment-account door
  "admin-web-get-place-payment-account/index.ts",
  "admin-web-refund-credit-lot/index.ts",
  "business-web-get-payment-account/index.ts",
  "business-web-get-payment-dashboard-link/index.ts",
  "business-web-start-payment-onboarding/index.ts",
  "consumer-web-list-credit-places/index.ts",
];

Deno.test("PAYMENT ACCOUNT READ: no new raw reader of organization_payment_accounts outside the allowlist", async () => {
  assertRatchet(
    "organization_payment_accounts",
    await findReaders("organization_payment_accounts"),
    PAYMENT_ACCOUNT_READ_ALLOWLIST,
  );
});

const GUEST_CUSTOMER_READ_ALLOWLIST = [
  "_shared/organization-guest-customer-doc.ts", // THE guest-customer door — sole reader today
];

Deno.test("GUEST CUSTOMER READ: no new raw reader of organization_guest_customers outside the allowlist", async () => {
  assertRatchet(
    "organization_guest_customers",
    await findReaders("organization_guest_customers"),
    GUEST_CUSTOMER_READ_ALLOWLIST,
  );
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
 * implying the scan is complete. `_shared/membership.ts:138` builds
 * `let query = admin.from("visit_tickets").select("id", { count: "exact" })`
 * and awaits it three lines later as `const { count } = await query` — the
 * builder shape, invisible to this scan. On any error `count` is null,
 * `(count ?? 0) === 0` is true, and the caller concludes this is the guest's
 * FIRST visit at this place, which is what grants the welcome rate. (The FILE
 * is on the list below, but for a different read at :183. Fixing that one
 * does not fix this one, and deleting its line while :138 stands would be the
 * wrong kind of green.) Reaching that shape needs a real parse, not a wider
 * window.
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
  "_shared/create-place.ts",
  "_shared/membership.ts",
  "_shared/org-membership.ts",
  "_shared/place-slug.ts",
  "_shared/reservation-places.ts",
  "_shared/save-place.ts",
  "_shared/stripe-billing.ts",
  "_shared/ticket-check.ts",
  "business-web-confirm-reservation/index.ts",
  "business-web-get-overview/index.ts",
  "business-web-list-organizations/index.ts",
  "business-web-release-place/index.ts",
  "business-web-update-place/place-social-refresh.ts",
  "consumer-mcp/index.ts",
  "consumer-mcp/profile-tool.ts",
  "consumer-web-confirm-reservation/index.ts",
  "consumer-web-get-profile/index.ts",
  "eleven-a1-report-outcome/index.ts",
  "eleven-a2-confirm-reservation/index.ts",
  "eleven-a3-verify-caller/index.ts",
  "eleven-a4-cancel-reservation/index.ts",
  "eleven-a4-find-reservation/index.ts",
  "eleven-a4-verify-caller/index.ts",
  "eleven-agent-get-reservation/index.ts",
  "supabase-cron-enrich-place-contents/index.ts",
  "supabase-cron-enrich-place-research/index.ts",
  "supabase-cron-reservation-retries/index.ts",
  "supabase-edgefunc-reservation-call/index.ts",
  "validate-web-poll-ticket/index.ts",
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

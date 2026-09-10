// MESITA-1718 — a raw read of a doored table may not throw its error away.
//
// `write-surface.test.ts` ratchets WRITERS onto the six document doors.
// Nothing did the same for READS, and MESITA-1712 is what that costs:
// `stripe-webhook-handle-event/ticket-payment-intent.ts` selected the retired
// column `project_id` off `visit_tickets`, PostgREST answered 42703 for the
// whole query — and the call destructured `{ data }` alone, so the error
// vanished. A null row then read exactly like "already closed by the
// synchronous path". The Mesita Pay reliability backstop silently never
// fired, the webhook answered 200, and a ticket stranded in `paying` by a
// crashed charge stayed there.
//
// WHY THIS RULE AND NOT "NO RAW READS AT ALL". The issue proposed allowlisting
// every `admin.from(T).select(...)` on a doored table. Run cold that is 151
// files across the seven tables — 55 on the two ticket tables alone — and an
// allowlist that long is the artifact `GRANDFATHERED_VIOLATIONS` in
// `ef-caller-acl.test.ts` already became: a wall of names nobody re-reads, so
// nothing shrinks and the ratchet stops meaning anything.
//
// It would also be guarding a shim rather than a mechanism. The remap the
// doors apply (`remapPlaceIdSelect` / `fromPlaceIdRow`) translates the RETIRED
// spellings `project_id` and `ticket_code` into the live ones — backward
// compatibility for callers that have not been updated. MESITA-1712 swept all
// 98 of them, so no caller says the old names any more and the translation is
// a no-op for every live call site. Going through a door does not protect you
// from the NEXT rename; it protects you from the last one.
//
// What generalises is the second half of that bug, and it is the half with no
// guard: the read had no error check, so a query that failed for ANY reason —
// a renamed column, a dropped one, a typo, an RLS change, a network blip —
// was indistinguishable from a query that found nothing.
//
// That is a live hazard today, not a hypothetical one, and the clearest case
// is a file MESITA-1718 itself lists as one of the CORRECT readers:
// `_shared/ticket-check.ts:89` `loadTicketByCheckCode`. It does remap by hand
// — that is why the issue named it — and it destructures `{ data }` alone. It
// is the lookup behind Mesita Validate's staff ticket page, so a failed query
// there returns null and the page says the code is not a ticket.
//
// Being on the right side of the remap and being able to see your own failure
// are two different properties, and only one of them had anyone watching.
//
// 26 exceptions, each a real one, and the list only shrinks.

import { assertEquals } from "jsr:@std/assert@1";

const FUNCTIONS_DIR = new URL("../", import.meta.url);

/** The six document doors' tables, plus the `profiles` view every place read
 *  lands on. A door exists for these, which is what makes a raw read here a
 *  decision rather than the only option. */
const DOORED_TABLES = [
  "visit_tickets",
  "reservation_tickets",
  "place_profiles",
  "profiles",
  "consumers",
  "organization_payment_accounts",
  "organization_guest_customers",
] as const;

/** The doors themselves, and the compat shim. They read these tables because
 *  that is their job, and they are the code every allowlisted caller is being
 *  measured against. */
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
 * Every raw read whose failure is currently invisible, 2026-09-10. Bootstrapped
 * from a real `findSwallowedReads()` run — NOT hand-listed, so it is the true
 * set rather than the set someone remembered.
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
  "_shared/place-slug.ts",
  "_shared/save-place.ts",
  "_shared/stripe-billing.ts",
  "_shared/ticket-check.ts",
  "business-web-confirm-reservation/index.ts",
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

Deno.test("READ SURFACE: the list shrinks — a fixed reader leaves it", async () => {
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

Deno.test("READ SURFACE: the doors themselves are excluded, and still exist", async () => {
  // If a door is renamed or deleted, DOORS goes stale and every read inside it
  // starts counting as a raw read — which would look like 40 new violations
  // rather than the one structural change it is.
  for (const door of DOORS) {
    const url = new URL(door, FUNCTIONS_DIR);
    const stat = await Deno.stat(url).catch(() => null);
    assertEquals(stat?.isFile, true, `${door} is listed as a door but does not exist`);
  }
});

// MESITA-1602 — no Edge Function may query a table the schema no longer has.
//
// `public.places` was renamed to `place_profiles` by MESITA-1593. The sweep in
// #1557 caught 29 call sites and missed one, because that one did not exist
// when the branch was cut: it arrived on main separately with MESITA-1598's
// `crenupOf` reader while the sweep was in flight. Nothing re-checked the sweep
// at merge time, so `discovery-place.ts` shipped a `.from("places")` against a
// dropped table and every discovery ranking read threw 42P01.
//
// A rename across two PRs is only complete against the commit it was written
// on. This test is the thing that re-checks it at merge time.
//
// WHY A NAME LIST AND NOT A SCHEMA DIFF. The complete version asserts every
// `.from("x")` resolves to a table the replayed migrations actually create,
// which pgTAP is positioned to do since it already replays from scratch. That
// is worth building (MESITA-1602 describes it) but it is not what a live
// outage needs first, and a half-right schema parser that false-positives
// would block the whole fleet. This list is exact, and cannot misfire.
//
// MESITA-1590 landed: `projects` -> `places` and its six children -> `place_*`.
// `places` came OUT of this list here for exactly the reason the note above
// predicted — it is a real table again, under new ownership — and the seven
// names it just vacated go IN, so this guard keeps catching the MESITA-1602
// failure class against the new names instead of quietly going blind.
//
// MESITA-1857: `place_super_categories` -> `place_families`. The name goes in
// here for the same reason `projects` did — a `.from("place_super_categories")`
// that survives the sweep 42P01s at run time and nowhere else.
//
// MESITA-1892 removed the organization layer, and this guard meets BOTH of its
// halves at once. The five organization tables go IN. And `place_payment_accounts`
// comes OUT: it was retired with the MESITA-1590 rename and is a real table again
// under new ownership — the merchant account hangs off the PLACE now — so it joins
// `places` and `managers` in LIVE_AGAIN, which is the mechanism this file already
// has for exactly that. A recycled name left in DROPPED_TABLES would fail every
// call site that legitimately reads it.
//
// MESITA-1719: the seven were a floor, not the set. The criterion below is
// every public relation that migrations created, renamed-from, or dropped
// and that is not in live `pg_class` (tables + views — PostgREST `.from()`
// 42P01s both). Derived 2026-09-12 from repo migrations vs the cloud catalog.
// Recycled names (`places`, `managers`) stay out: they are live again.
//
// MESITA-2091 — the First Stage cut. Thirty tables go IN: claims and members,
// verification, plans and memberships, visit tickets and their children,
// Credits, Stripe, classes, consumer connectors, place API keys, field
// proposals and favorites. Two of them, `managers` and
// `place_payment_accounts`, come OUT of LIVE_AGAIN on the way: they were
// recycled once and are now dropped for good, so a `.from()` on either is
// the MESITA-1602 failure again. `places` is still live and stays recycled.
//
// MESITA-2144 — the residue cut. `place_name_history` goes IN ahead of its
// drop: admin-web-search-places lost its free-text mode, the only reader, so
// the table can leave the schema once that Edge Function has redeployed.

import { assertEquals } from "jsr:@std/assert@1";

/** Renamed or dropped, and NOT currently recreated under the same name. */
const DROPPED_TABLES = [
  "account_invites",
  "accounts",
  "app_settings",
  "bench_restaurants",
  "bench_results",
  "business_invites",
  "business_plans",
  "businesses",
  "cashback_ledger",
  "classes",
  "consumer_connectors",
  "consumer_invite_codes",
  "consumer_mcp_tokens",
  "consumer_pay_notifications",
  "consumer_plans",
  "consumer_review_claims",
  "consumer_subscriptions",
  "coupons",
  "credit_gift_redeem_events",
  "credit_gifts",
  "credit_ledger",
  "credit_lots",
  "favorites",
  "guest_make_goods",
  "guests",
  "manager_invites",
  "managers",
  "membership_plans",
  "membership_strikes",
  "membership_tiers",
  "org_plans",
  "organization_guest_customers",
  "organization_invites",
  "organization_members",
  "organization_payment_accounts",
  "organizations",
  "partner_memberships",
  "place_api_keys",
  "place_field_proposals",
  "place_guest_customers",
  "place_invites",
  "place_members",
  "place_name_history",
  "place_payment_accounts",
  "place_plans",
  "place_strikes",
  "place_subscriptions",
  "place_super_categories",
  "place_verifications",
  "plans",
  "playground_reservations",
  "project_invites",
  "project_members",
  "project_plans",
  "project_roles",
  "project_strikes",
  "project_subscriptions",
  "project_verifications",
  "projects",
  "projects_view",
  "refund_requests",
  "reservations",
  "reward_rules",
  "saved_places",
  "saved_venues",
  "scheduled_project_creations",
  "scheduled_unit_creations",
  "staff_invites",
  "staff_whatsapp_messages",
  "staff_whatsapp_sessions",
  "stripe_events",
  "ticket_check_events",
  "ticket_reports",
  "ticket_reviews",
  "tickets",
  "units",
  "venue_categories",
  "venue_media_assets",
  "venue_members",
  "venue_roles",
  "venue_tags",
  "venue_verifications",
  "venues",
  "visit_ticket_payments",
  "visit_tickets",
] as const;

/** Ordinary words a new call site could reach for — the MESITA-1719 holes. */
const MUST_COVER = [
  "guests",
  "reservations",
  "tickets",
  "units",
  "venue_categories",
  "venue_media_assets",
  "venue_members",
  "venue_roles",
  "venue_tags",
  "venues",
] as const;

/** Recycled: vacated once, then recreated. Must never re-enter the list. */
const LIVE_AGAIN = ["places"] as const;

const FUNCTIONS_DIR = new URL("../", import.meta.url).pathname;

function edgeFunctionSources(): string[] {
  const out: string[] = [];
  for (const entry of Deno.readDirSync(FUNCTIONS_DIR)) {
    if (!entry.isDirectory) continue;
    for (
      const file of walk(`${FUNCTIONS_DIR}${entry.name}`)
    ) out.push(file);
  }
  return out;
}

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const e of Deno.readDirSync(dir)) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory) found.push(...walk(p));
    else if (p.endsWith(".ts")) found.push(p);
  }
  return found;
}

Deno.test("DROPPED_TABLES is the unique sorted retired-name set", () => {
  const sorted = [...DROPPED_TABLES].sort();
  assertEquals([...DROPPED_TABLES], sorted);
  assertEquals(new Set(DROPPED_TABLES).size, DROPPED_TABLES.length);
});

Deno.test("DROPPED_TABLES covers the names the 7-name list missed", () => {
  const names = new Set<string>(DROPPED_TABLES);
  const missing = MUST_COVER.filter((n) => !names.has(n));
  assertEquals(missing, [], `DROPPED_TABLES is missing: ${missing.join(", ")}`);
  const recycled = LIVE_AGAIN.filter((n) => names.has(n));
  assertEquals(
    recycled,
    [],
    `these names are live again and must stay out of DROPPED_TABLES: ${
      recycled.join(", ")
    }`,
  );
});

Deno.test("no Edge Function queries a table the schema no longer has", () => {
  const offenders: string[] = [];

  for (const path of edgeFunctionSources()) {
    // The guards name the dropped tables on purpose; neither is a caller.
    // This file lists them in DROPPED_TABLES, and `no-organization-layer.test.ts`
    // carries a literal `.from("organizations")` as the fixture that proves its
    // own call-shape regex still fires — the one string in the repo that must
    // look exactly like the thing being hunted. Mirrors that file's SELF list.
    if (
      path.endsWith("dropped-table-refs.test.ts") ||
      path.endsWith("no-organization-layer.test.ts")
    ) continue;
    const src = Deno.readTextFileSync(path);
    for (const table of DROPPED_TABLES) {
      // Match the PostgREST call shape only, so prose, comments explaining the
      // rename, and column names that merely contain the word do not trip it.
      if (new RegExp(`\\.from\\(\\s*["'\`]${table}["'\`]\\s*\\)`).test(src)) {
        offenders.push(`${path.replace(FUNCTIONS_DIR, "")} -> .from("${table}")`);
      }
    }
  }

  assertEquals(
    offenders,
    [],
    `These call a dropped table and will throw 42P01 at runtime:\n  ${
      offenders.join("\n  ")
    }\n\nIf a name in DROPPED_TABLES has been recreated, remove it from that list in the same PR.`,
  );
});

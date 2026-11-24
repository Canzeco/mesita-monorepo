// The guest's own visits (MESITA-3688): the read behind Activity › Visits
// and the one place that says which wallet payments belong to a visit.
//
//   pay_tabs (this guest, this money mode, newest first, 51)
//     └─ wallet_payments where tab_id in those tabs (LIST_PART_COLUMNS)
//          → effectiveStatus per tab, part_payment_ids per tab
//     └─ profiles (name, slug, round photo) for the places
//
// A failed parts read fails the whole call: a status worked out without its
// parts could say Expired for a tab that was paid. Hashes and proof tokens
// never leave: each row is mapped field by field.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { effectiveStatus, LIST_PART_COLUMNS, type TabPartRow, type TabRow } from "./tab.ts";
import { readWalletPlaces } from "./wallet.ts";

export const VISITS_LIMIT = 50;

const LIST_TAB_COLUMNS =
  "id, place_id, status, currency, livemode, bill_cents, tip_cents, ticket, waiter_name, paid_at, expires_at, created_at, origin, verified_at, discount_cents";

export type GuestVisit = {
  tab_id: string;
  place: { id: string; name: string | null; slug: string | null; photo_url: string | null };
  status: string;
  currency: string;
  bill_cents: number | null;
  /** MESITA-4770: the visit discount taken off bill_cents (0 = none). */
  discount_cents: number;
  /** MESITA-4893: the cashback this bill earned (0 = none). */
  cashback_cents: number;
  tip_cents: number;
  ticket: string | null;
  waiter_name: string | null;
  created_at: string;
  paid_at: string | null;
  expires_at: string;
  /** MESITA-3772: a guest's open payment is origin guest, verified_at null,
   *  status paying or paid, expires_at in the future (any device finds it). */
  origin: "waiter" | "guest";
  verified_at: string | null;
  part_payment_ids: string[];
};

export type ListVisitsResult =
  | { ok: true; visits: GuestVisit[]; truncated: boolean }
  | { ok: false; error: string };

type PartRow = { id: string; tab_id: string; status: string; paid_at: string | null };

export async function listVisits(
  admin: SupabaseClient,
  consumerId: string,
  livemode: boolean,
  nowMs: number,
  /** MESITA-4595: the next page, visits created before this instant (the
   *  oldest `created_at` of the page already shown). Null: the newest. */
  before: string | null = null,
): Promise<ListVisitsResult> {
  let tabQuery = admin
    .from("pay_tabs")
    .select(LIST_TAB_COLUMNS)
    .eq("consumer_id", consumerId)
    .eq("livemode", livemode)
    // MESITA-3695: a split table is listed as the guest's own share.
    .is("split_at", null);
  if (before) tabQuery = tabQuery.lt("created_at", before);
  const { data: tabData, error: tabError } = await tabQuery
    .order("created_at", { ascending: false })
    .limit(VISITS_LIMIT + 1);
  if (tabError) return { ok: false, error: `tabs: ${tabError.message}` };
  const all = (tabData ?? []) as Array<TabRow & { created_at: string }>;
  const truncated = all.length > VISITS_LIMIT;
  const tabs = all.slice(0, VISITS_LIMIT);

  // MESITA-4524: a ticket not yet closed is a guest pay attempt. A live one
  // is the guest's open payment (status paying); one that ended unpaid for
  // the waiter, the clock or the bank shows as Not paid. A cancelled one,
  // or a hold refused before any QR, never was a ticket to the guest.
  let attemptQuery = admin
    .from("guest_pay_attempts")
    .select("id, place_id, status, currency, livemode, bill_cents, tip_cents, expires_at, created_at, end_reason, held_at, payment_id, discount_cents")
    .eq("consumer_id", consumerId)
    .eq("livemode", livemode)
    .or("status.in.(opening,due),and(status.eq.released,end_reason.in.(rejected,expired,declined),held_at.not.is.null)");
  if (before) attemptQuery = attemptQuery.lt("created_at", before);
  const { data: attemptData, error: attemptError } = await attemptQuery
    .order("created_at", { ascending: false })
    .limit(VISITS_LIMIT + 1);
  if (attemptError) return { ok: false, error: `attempts: ${attemptError.message}` };
  const attempts = (attemptData ?? []) as Array<{
    id: string; place_id: string; status: string; currency: string; bill_cents: number; tip_cents: number; discount_cents: number | null;
    expires_at: string; created_at: string; end_reason: string | null; payment_id: string | null;
  }>;
  const attemptsCut = attempts.length > VISITS_LIMIT;
  if (attemptsCut) attempts.length = VISITS_LIMIT;
  if (tabs.length === 0 && attempts.length === 0) return { ok: true, visits: [], truncated: false };

  const { data: partData, error: partError } = tabs.length
    ? await admin.from("wallet_payments").select(LIST_PART_COLUMNS).in("tab_id", tabs.map((t) => t.id))
    : { data: [], error: null };
  if (partError) return { ok: false, error: `parts: ${partError.message}` };
  const partsByTab = new Map<string, PartRow[]>();
  for (const p of (partData ?? []) as PartRow[]) {
    const list = partsByTab.get(p.tab_id) ?? [];
    list.push(p);
    partsByTab.set(p.tab_id, list);
  }

  // What each bill earned, for its row (MESITA-4893). Words on a list: a failed
  // read shows the visits without them.
  const { data: backData, error: backError } = tabs.length
    ? await admin.from("wallet_entries").select("tab_id, amount_cents").eq("consumer_id", consumerId).eq("kind", "cashback").in("tab_id", tabs.map((t) => t.id))
    : { data: [], error: null };
  if (backError) console.error(`[list-visits] cashback: ${backError.message}`);
  const backByTab = new Map<string, number>();
  for (const e of (backData ?? []) as Array<{ tab_id: string; amount_cents: number }>) {
    backByTab.set(e.tab_id, (backByTab.get(e.tab_id) ?? 0) + e.amount_cents);
  }

  const placesRes = await readWalletPlaces(admin, [...new Set([...tabs.map((t) => t.place_id), ...attempts.map((a) => a.place_id)])]);
  if (!placesRes.ok) return { ok: false, error: placesRes.error };

  const visits = tabs.map((t): GuestVisit => {
    const parts = partsByTab.get(t.id) ?? [];
    const place = placesRes.places.get(t.place_id);
    return {
      tab_id: t.id,
      place: { id: t.place_id, name: place?.name ?? null, slug: place?.slug ?? null, photo_url: place?.photo ?? null },
      status: effectiveStatus(t, parts as unknown as TabPartRow[], nowMs),
      currency: t.currency,
      bill_cents: t.bill_cents,
      discount_cents: t.discount_cents ?? 0,
      cashback_cents: backByTab.get(t.id) ?? 0,
      tip_cents: t.tip_cents,
      ticket: t.ticket,
      waiter_name: t.waiter_name,
      created_at: t.created_at,
      paid_at: t.paid_at,
      expires_at: t.expires_at,
      origin: t.origin ?? "waiter",
      verified_at: t.verified_at ?? null,
      part_payment_ids: parts.map((p) => p.id),
    };
  });
  for (const a of attempts) {
    const place = placesRes.places.get(a.place_id);
    const open = a.status === "opening" || a.status === "due";
    visits.push({
      tab_id: a.id,
      place: { id: a.place_id, name: place?.name ?? null, slug: place?.slug ?? null, photo_url: place?.photo ?? null },
      status: open ? "paying" : a.end_reason === "expired" ? "expired" : "cancelled",
      currency: a.currency,
      bill_cents: a.bill_cents,
      discount_cents: a.discount_cents ?? 0,
      cashback_cents: 0,
      tip_cents: a.tip_cents,
      ticket: null,
      waiter_name: null,
      created_at: a.created_at,
      paid_at: null,
      expires_at: a.expires_at,
      origin: "guest",
      verified_at: null,
      part_payment_ids: a.payment_id ? [a.payment_id] : [],
    });
  }
  visits.sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at));
  return { ok: true, visits: visits.slice(0, VISITS_LIMIT), truncated: truncated || attemptsCut || visits.length > VISITS_LIMIT };
}

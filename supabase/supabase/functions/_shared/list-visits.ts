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
  "id, place_id, status, currency, livemode, bill_cents, tip_cents, ticket, waiter_name, paid_at, expires_at, created_at, origin, verified_at";

export type GuestVisit = {
  tab_id: string;
  place: { id: string; name: string | null; slug: string | null; photo_url: string | null };
  status: string;
  currency: string;
  bill_cents: number | null;
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
): Promise<ListVisitsResult> {
  const { data: tabData, error: tabError } = await admin
    .from("pay_tabs")
    .select(LIST_TAB_COLUMNS)
    .eq("consumer_id", consumerId)
    .eq("livemode", livemode)
    // MESITA-3695: a split table is listed as the guest's own share.
    .is("split_at", null)
    .order("created_at", { ascending: false })
    .limit(VISITS_LIMIT + 1);
  if (tabError) return { ok: false, error: `tabs: ${tabError.message}` };
  const all = (tabData ?? []) as Array<TabRow & { created_at: string }>;
  const truncated = all.length > VISITS_LIMIT;
  const tabs = all.slice(0, VISITS_LIMIT);
  if (tabs.length === 0) return { ok: true, visits: [], truncated: false };

  const { data: partData, error: partError } = await admin
    .from("wallet_payments")
    .select(LIST_PART_COLUMNS)
    .in("tab_id", tabs.map((t) => t.id));
  if (partError) return { ok: false, error: `parts: ${partError.message}` };
  const partsByTab = new Map<string, PartRow[]>();
  for (const p of (partData ?? []) as PartRow[]) {
    const list = partsByTab.get(p.tab_id) ?? [];
    list.push(p);
    partsByTab.set(p.tab_id, list);
  }

  const placesRes = await readWalletPlaces(admin, [...new Set(tabs.map((t) => t.place_id))]);
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
  return { ok: true, visits, truncated };
}

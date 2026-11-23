// Supabase Edge Function — admin-web-list-guests
//
// Manage › Guests (MESITA-2550). The 50 newest guests, or those whose name,
// member number or Instagram handle matches `q`, with their Class and Plan
// (MESITA-2553) and who last set the class. Closed accounts are left out.
// Also every VIP partner (MESITA-2556), for the partner choice on a VIP row,
// and the newest VIP invitation codes (MESITA-3540; null when that read failed).
// MESITA-4766: `{ vipOnly: true }` lists only VIP guests, each with why
// (vipReason, vipCodeLast4), real and emulated followers and paidAsVip (the
// live money rule, consumer_is_vip_for_money).
// Read-only; super-admin only.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import {
  GUEST_LIST_LIMIT,
  GUEST_ROW_SELECT,
  guestSearchFilter,
  type RawGuest,
  toGuestRow,
} from "../_shared/guest-standing.ts";
import { loadVipPartners } from "../_shared/vip-partners.ts";
import { loadVipCodes, readVipGuestFacts, VIP_GUEST_EXTRA_SELECT, type VipGuestFacts, type VipGuestRaw } from "../_shared/vip-codes.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";

serveJson("admin-web-list-guests", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const body = await readJsonOr<{ q?: unknown; vipOnly?: unknown }>(req, {});
  const filter = guestSearchFilter(body.q);
  // MESITA-4766: Admin › VIP lists only VIP guests, filtered here (never a
  // client filter over a capped page).
  const vipOnly = body.vipOnly === true;

  let query = admin
    .from("consumers")
    .select(vipOnly ? `${GUEST_ROW_SELECT}, ${VIP_GUEST_EXTRA_SELECT}` : GUEST_ROW_SELECT)
    .is("deleted_at", null);
  if (filter) query = query.or(filter);
  if (vipOnly) query = query.or("vip_invited_at.not.is.null,guest_class.eq.vip");
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(GUEST_LIST_LIMIT);
  if (error) {
    return json({ ok: false, error: `list_failed: ${error.message}` }, 500);
  }

  const rows = (data ?? []) as RawGuest[];

  // Who set each VIP: one batched lookup. A failure degrades to no email and
  // never fails the list.
  const setByIds = [...new Set(rows.map((r) => r.guest_class_set_by).filter(
    (v): v is string => typeof v === "string",
  ))];
  const emails = new Map<string, string>();
  if (setByIds.length > 0) {
    const admins = await admin
      .from("super_admins")
      .select("email, user_id")
      .in("user_id", setByIds);
    if (admins.error) {
      console.warn("guest_email_lookup_failed", JSON.stringify({ error: admins.error.message }));
    } else {
      for (const a of admins.data ?? []) {
        if (a.user_id) emails.set(a.user_id as string, a.email as string);
      }
    }
  }

  const partners = await loadVipPartners(admin);
  if (!partners.ok) return json({ ok: false, error: partners.error }, 500);

  // VIP invitation codes (MESITA-3540). A failed read never fails the list.
  const codes = await loadVipCodes(admin);
  if (!codes.ok) console.warn("vip_codes_list_failed", JSON.stringify({ error: codes.error }));

  const guests = rows.map((r) => toGuestRow(r, (id) => emails.get(id) ?? null));
  let vipFacts: Map<string, VipGuestFacts> | null = null;
  if (vipOnly) {
    try {
      vipFacts = await readVipGuestFacts(admin, rows as unknown as VipGuestRaw[], paymentsLivemode());
    } catch (err) {
      return json({ ok: false, error: `list_failed: ${err instanceof Error ? err.message : String(err)}` }, 500);
    }
  }

  return json({
    ok: true,
    guests: vipFacts ? guests.map((g) => ({ ...g, ...vipFacts!.get(g.id) })) : guests,
    partners: partners.partners,
    vipCodes: codes.ok ? codes.codes : null,
  });
});

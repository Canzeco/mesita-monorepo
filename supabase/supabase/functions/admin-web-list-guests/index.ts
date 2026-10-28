// Supabase Edge Function — admin-web-list-guests
//
// Manage › Guests (MESITA-2550). The 50 newest guests, or those whose name,
// member number or Instagram handle matches `q`, with their Class and Plan
// (MESITA-2553) and who last set the class. Closed accounts are left out.
// Also every VIP partner (MESITA-2556), for the partner choice on a VIP row.
// Read-only; super-admin only.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import {
  GUEST_LIST_LIMIT,
  GUEST_ROW_SELECT,
  guestSearchFilter,
  type RawGuest,
  toGuestRow,
} from "../_shared/guest-standing.ts";
import { loadVipPartners } from "../_shared/vip-partners.ts";

serveJson("admin-web-list-guests", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const body = await readJsonOr<{ q?: unknown }>(req, {});
  const filter = guestSearchFilter(body.q);

  let query = admin
    .from("consumers")
    .select(GUEST_ROW_SELECT)
    .is("deleted_at", null);
  if (filter) query = query.or(filter);
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

  return json({
    ok: true,
    guests: rows.map((r) => toGuestRow(r, (id) => emails.get(id) ?? null)),
    partners: partners.partners,
  });
});

// Supabase Edge Function — business-web-list-place-tickets
//
// MESITA-4487: Business Operations reads one kind of ticket at one place.
// Visits, Vouchers, Stories, Gifts. The owner and Mesita staff only; an
// editor gets 403. The universe is PAYMENTS_STRIPE_MODE's, never the body's.
// Who is named is masked here; the page never sees an email or a gift token.
//
// Body: { place_id, kind: visits|vouchers|stories|gifts,
//         before?: { created_at, id, rank } }
// Response: { ok, test_mode, kind, days, totals, rows, next }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, requirePlaceAccess } from "../_shared/place-access.ts";
import { readBoostPlace } from "../_shared/boost.ts";
import { isUuid } from "../_shared/place-id.ts";
import { maskGuest } from "../_shared/money-admin.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";

const KINDS = new Set(["visits", "vouchers", "stories", "gifts"]);
const DEFAULT_TIMEZONE = "America/Mexico_City";

function usableTimezone(timezone: string | null | undefined): string {
  if (!timezone) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) return null;
  return new Date(v).toISOString();
}

serveJson("business-web-list-place-tickets", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const b = bodyRes.body;
  if (!isUuid(b.place_id)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (typeof b.kind !== "string" || !KINDS.has(b.kind)) {
    return json({ ok: false, error: "kind must be visits, vouchers, stories or gifts" }, 400);
  }

  const access = await requirePlaceAccess(admin, user, b.place_id);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) {
    return json({ ok: false, code: "owner_only", error: "Only the place's owner sees these tickets" }, 403);
  }

  const before = (b.before ?? null) as { created_at?: unknown; id?: unknown; rank?: unknown } | null;
  const beforeAt = before ? isoOrNull(before.created_at) : null;
  const beforeRank = before && before.rank != null ? Number(before.rank) : null;
  if (before && (!beforeAt || !isUuid(before.id) || beforeRank == null || !Number.isInteger(beforeRank))) {
    return json({ ok: false, error: "before must be { created_at, id, rank }" }, 400);
  }

  const placeRes = await readBoostPlace(admin, b.place_id);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);

  const livemode = paymentsLivemode();
  const { data, error } = await admin.rpc("place_ticket_desk", {
    p_place_id: b.place_id,
    p_kind: b.kind,
    p_livemode: livemode,
    p_timezone: usableTimezone(placeRes.place?.timezone),
    p_before: beforeAt,
    p_before_id: before ? before.id : null,
    p_before_rank: beforeRank,
  });
  if (error) return json({ ok: false, error: `place_ticket_desk: ${error.message}` }, 500);

  const s = (data ?? {}) as {
    days?: unknown;
    totals?: unknown;
    rows?: Array<Record<string, unknown>>;
    next?: unknown;
  };
  const rows = (s.rows ?? []).map((r) => {
    const { guest_name, guest_email, other_name, other_email, ...rest } = r;
    return {
      ...rest,
      guest: maskGuest(guest_name as string | null, guest_email as string | null),
      other: other_name || other_email ? maskGuest(other_name as string | null, other_email as string | null) : null,
    };
  });

  return json({
    ok: true,
    test_mode: !livemode,
    kind: b.kind,
    days: s.days ?? [],
    totals: s.totals ?? {},
    rows,
    next: s.next ?? null,
  });
});

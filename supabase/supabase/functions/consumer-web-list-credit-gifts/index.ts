// Supabase Edge Function — consumer-web-list-credit-gifts (MESITA-1677)
//
// Naming: caller-verb-words. Caller = consumer, verb = list, words =
// credit-gifts.
//
// "Gifts you sent" — unclaimed / claimed / cancelled, newest first. The
// caller's own sent gifts only (sender_id = the authed consumer); nothing
// here ever returns another consumer's gifts, claimed_by identity, or a
// recoverable code — code_hash never leaves this table at all.
//
// EACH GIFT NAMES ITS PLACE. The lot behind a gift is place-scoped
// (MESITA-1892) — it spends at one venue — so the row the sender sees is
// titled with that place, read off place_profiles. It used to carry the
// organization's name, which told the sender the least useful half of where
// their money went.
//
// Body:     {}
// Response: { ok: true, gifts: [{ id, placeName, paidCents, bonusCents,
//              creditedCents, state, note, createdAt, claimedAt, cancelledAt,
//              expiresAt }] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";

// A page's worth — this is a list on a phone screen, not a ledger export.
const MAX_GIFTS = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);

  const giftsRes = await admin
    .from("credit_gifts")
    .select(
      "id, lot_id, state, note, expires_at, created_at, claimed_at, cancelled_at",
    )
    .eq("sender_id", authRes.user.id)
    .order("created_at", { ascending: false })
    .limit(MAX_GIFTS);
  if (giftsRes.error) {
    return json({
      ok: false,
      error: `credit_gifts_list: ${giftsRes.error.message}`,
    }, 500);
  }
  const gifts = (giftsRes.data ?? []) as {
    id: string;
    lot_id: string;
    state: string;
    note: string | null;
    expires_at: string;
    created_at: string;
    claimed_at: string | null;
    cancelled_at: string | null;
  }[];
  if (gifts.length === 0) return json({ ok: true, gifts: [] });

  const lotIds = gifts.map((g) => g.lot_id);
  const lotsRes = await admin
    .from("credit_lots")
    .select("id, place_id, paid_cents, bonus_cents")
    .in("id", lotIds);
  if (lotsRes.error) {
    return json({
      ok: false,
      error: `credit_gifts_list_lots: ${lotsRes.error.message}`,
    }, 500);
  }
  const lotsById = new Map(
    ((lotsRes.data ?? []) as {
      id: string;
      place_id: string;
      paid_cents: number;
      bonus_cents: number;
    }[]).map((l) => [l.id, l]),
  );

  const placeIds = [
    ...new Set([...lotsById.values()].map((l) => l.place_id)),
  ];
  const placesRes = placeIds.length
    ? await admin.from("place_profiles").select("id, name").in("id", placeIds)
    : { data: [], error: null };
  if (placesRes.error) {
    return json({
      ok: false,
      error: `credit_gifts_list_places: ${placesRes.error.message}`,
    }, 500);
  }
  const placeNameById = new Map(
    ((placesRes.data ?? []) as { id: string; name: string }[]).map((
      pl,
    ) => [pl.id, pl.name]),
  );

  const shaped = gifts.map((g) => {
    const lot = lotsById.get(g.lot_id);
    const paidCents = lot?.paid_cents ?? 0;
    const bonusCents = lot?.bonus_cents ?? 0;
    return {
      id: g.id,
      placeName: lot ? (placeNameById.get(lot.place_id) ?? "Mesita") : "Mesita",
      paidCents,
      bonusCents,
      creditedCents: paidCents + bonusCents,
      // "unclaimed" reads as "expired" on the client once expires_at has
      // passed — there is no separate DB state for it (credit_gifts_issuance_
      // schema's own header note), so the list ships the raw state + deadline
      // and lets the client derive the label, the same split redeem_credit_gift
      // itself draws between "still unclaimed" and "past its claim window".
      state: g.state,
      note: g.note,
      createdAt: g.created_at,
      claimedAt: g.claimed_at,
      cancelledAt: g.cancelled_at,
      expiresAt: g.expires_at,
    };
  });

  return json({ ok: true, gifts: shaped });
});

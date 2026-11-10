// Supabase Edge Function — business-web-find-place
//
// MESITA-3103, Google search MESITA-3112. The Claim screen's search.
//
// `q`: the Name pipeline with Admin's caps (`businessNameItems`; Discovery's
// "Admin & Business Searchbar Pipeline" box): Google Autocomplete + Text Search,
// places only, Google's order, at most 20 rows. A row Mesita holds comes back
// as that Mesita place, with its listing phone masked (so the owner knows
// which number proves it) and the caller's own state on it; archived places
// drop. A Google-only row comes back with its `google_place_id`, for
// business-web-create-place ("Add and claim").
//
// `place_id`: that one Mesita place (the consumer app's "Is this your
// business?" deep link).
//
// An empty `q` (MESITA-3147): with Discovery's Admin & Business Searchbar
// box set to "Show results on an empty query" (`name.admin.emptyQuery`), the
// preliminary results — Mesita places, most reviewed first, MAX_ROWS — read
// from Mesita only: no Google call, no search budget. Off, it answers none.
//
// `preview_place_id` (MESITA-3138): Google's preview of one Google-only row
// for the Add dialog — one Details read and its first photo, as the consumer
// Generate dialog does (MESITA-2941). Nothing is stored; it takes a slot of
// the same daily budget.
//
// Body: { q?: string, sessionToken?: string, place_id?: uuid, preview_place_id?: string }
// Response: { ok: true, places: [{ id | null, google_place_id | null, name,
//   address, photo, masked_phone, phone_on_listing, mine, claimed_by }] }
//
// `claimed_by` (MESITA-3155): when someone else holds the place's owner
// seat, their email masked to `p•••@canzeco.com` (maskEmail), so the claim
// modal can say so and offer Report to Mesita. Null otherwise.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { maskEmail, maskPhone } from "../_shared/place-verification.ts";
import { isLiveManager, MANAGER_COLUMNS, type ManagerRow } from "../_shared/place-access.ts";
import { businessNameItems } from "../_shared/name-pipeline.ts";
import { fetchPlacePreview, readGooglePlacesKey, stripPlacesPrefix } from "../_shared/google-places.ts";
import { loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import { LISTED_STATES } from "../_shared/place-state.ts";

type Row = {
  id: string;
  name: string | null;
  google_name: string | null;
  address: string | null;
  photos: string[] | null;
  phone: string | null;
};

type Found = {
  id: string | null;
  google_place_id: string | null;
  name: string | null;
  address: string | null;
  photo: string | null;
  masked_phone: string | null;
  phone_on_listing: boolean;
  mine: string | null;
  claimed_by: string | null;
};

type States = { mine: Map<string, string>; claimed: Map<string, string> };

const SELECT = "id, name, google_name, address, photos, phone";
const MAX_ROWS = 20;
/** Google searches one account may run in a rolling day (MESITA-3123). */
const SEARCHES_PER_DAY = 200;

function mesitaRow(r: Row, { mine, claimed }: States): Found {
  return {
    id: r.id,
    google_place_id: null,
    name: r.name ?? r.google_name,
    address: r.address,
    photo: r.photos?.[0] ?? null,
    masked_phone: maskPhone(r.phone),
    phone_on_listing: !!r.phone,
    mine: mine.get(r.id) ?? null,
    claimed_by: mine.get(r.id) === "owner" ? null : (claimed.get(r.id) ?? null),
  };
}

/** The caller's own state on each place (owner, expired or a pending
 *  request), and who else holds each owner seat, masked (MESITA-3155). */
async function myStates(admin: SupabaseClient, userId: string, ids: string[]): Promise<States> {
  const mine = new Map<string, string>();
  const claimed = new Map<string, string>();
  if (ids.length === 0) return { mine, claimed };
  const [managers, reqs, owners] = await Promise.all([
    admin.from("place_managers").select(MANAGER_COLUMNS).eq("consumer_id", userId).is("revoked_at", null).in("place_id", ids),
    admin.from("place_verification_requests").select("place_id").eq("consumer_id", userId).eq("status", "pending").in("place_id", ids),
    admin.from("place_managers").select(MANAGER_COLUMNS).eq("role", "owner").is("revoked_at", null).neq("consumer_id", userId).in("place_id", ids),
  ]);
  for (const r of (reqs.data ?? []) as Array<{ place_id: string }>) mine.set(r.place_id, "pending");
  for (const r of (managers.data ?? []) as ManagerRow[]) mine.set(r.place_id, isLiveManager(r) ? "owner" : "expired");
  const seats = ((owners.data ?? []) as ManagerRow[]).filter((r) => isLiveManager(r));
  await Promise.all(seats.map(async (r) => {
    const { data } = await admin.auth.admin.getUserById(r.consumer_id);
    const masked = maskEmail(data?.user?.email);
    if (masked) claimed.set(r.place_id, masked);
  }));
  return { mine, claimed };
}

serveJson("business-web-find-place", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;

  const body = await readJsonOr<{ q?: unknown; sessionToken?: unknown; place_id?: unknown; preview_place_id?: unknown }>(req, {});

  // The deep link: one Mesita place by id.
  if (isUuid(body.place_id)) {
    const { data, error } = await admin.from("profiles").select(SELECT).eq("id", body.place_id).in("state", ["active", "paused"]).limit(1);
    if (error) return json({ ok: false, error: error.message }, 500);
    const rows = (data ?? []) as Row[];
    const states = await myStates(admin, user.id, rows.map((r) => r.id));
    return json({ ok: true, places: rows.map((r) => mesitaRow(r, states)) });
  }

  // The Add dialog's Google preview: photo, category, stars, address.
  const previewId = typeof body.preview_place_id === "string" ? stripPlacesPrefix(body.preview_place_id.trim()).slice(0, 200) : "";
  if (previewId) {
    const take = await admin.rpc("business_search_take", { p_account_id: user.id, p_cap: SEARCHES_PER_DAY });
    if (take.error) return json({ ok: false, error: `search_budget: ${take.error.message}` }, 500);
    if (take.data !== true) {
      return json({ ok: false, code: "search_budget", error: "You've searched a lot today. Try again tomorrow." }, 429);
    }
    const keyRes = readGooglePlacesKey();
    if (!keyRes.ok) return keyRes.response;
    const res = await fetchPlacePreview(previewId, keyRes.key);
    if (!res.ok) {
      return res.reason === "not_found"
        ? json({ ok: false, code: "preview_not_found", error: "Couldn't find that place on Google." }, 404)
        : json({ ok: false, code: "google_unreachable", error: "Couldn't load that place right now." }, 502);
    }
    return json({ ok: true, preview: res.preview });
  }

  const q = typeof body.q === "string" ? body.q.trim().slice(0, 80) : "";
  if (q.length === 0) {
    const cfg = await loadDiscoveryConfig(admin);
    if (!cfg.name.admin.emptyQuery) return json({ ok: true, places: [] });
    const { data, error } = await admin
      .from("profiles")
      .select(SELECT)
      .in("state", [...LISTED_STATES])
      .order("google_review_count", { ascending: false, nullsFirst: false })
      .limit(MAX_ROWS);
    if (error) return json({ ok: false, error: error.message }, 500);
    const rows = (data ?? []) as Row[];
    const states = await myStates(admin, user.id, rows.map((r) => r.id));
    return json({ ok: true, preliminary: true, places: rows.map((r) => mesitaRow(r, states)) });
  }
  if (q.length < 2) return json({ ok: true, places: [] });

  // A daily budget per account before any Google spend (MESITA-3123).
  const budget = await admin.rpc("business_search_take", { p_account_id: user.id, p_cap: SEARCHES_PER_DAY });
  if (budget.error) return json({ ok: false, error: `search_budget: ${budget.error.message}` }, 500);
  if (budget.data !== true) {
    return json({ ok: false, code: "search_budget", error: "You've searched a lot today. Try again tomorrow." }, 429);
  }

  const lane = await businessNameItems(env, {
    input: q,
    sessionToken: typeof body.sessionToken === "string" ? body.sessionToken : "",
    mode: "deep",
  });
  if (!lane.ok) return lane.response;
  const items = lane.items.filter((i) => i.kind !== "location").slice(0, MAX_ROWS);

  // Mesita rows: the stored place (archived ones drop) + my state on it.
  const mesitaIds = items.map((i) => i.mesitaId).filter((id): id is string => !!id);
  const byId = new Map<string, Row>();
  if (mesitaIds.length > 0) {
    const { data, error } = await admin.from("profiles").select(SELECT).in("id", mesitaIds).in("state", ["active", "paused"]);
    if (error) return json({ ok: false, error: error.message }, 500);
    for (const r of (data ?? []) as Row[]) byId.set(r.id, r);
  }
  const states = await myStates(admin, user.id, [...byId.keys()]);

  const places: Found[] = [];
  for (const item of items) {
    if (item.mesitaId) {
      const row = byId.get(item.mesitaId);
      if (row) places.push(mesitaRow(row, states));
      continue;
    }
    if (!item.placeId) continue;
    const card = (item.card ?? {}) as { name?: unknown; address?: unknown };
    places.push({
      id: null,
      google_place_id: item.placeId,
      name: typeof card.name === "string" && card.name ? card.name : item.mainText,
      address: typeof card.address === "string" && card.address ? card.address : item.secondaryText || null,
      photo: null,
      masked_phone: null,
      phone_on_listing: false,
      mine: null,
      claimed_by: null,
    });
  }
  return json({ ok: true, places });
});

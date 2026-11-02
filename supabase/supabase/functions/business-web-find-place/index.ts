// Supabase Edge Function — business-web-find-place
//
// MESITA-3103, Google search MESITA-3112. The Claim screen's search.
//
// `q`: the Name pipeline with Admin's caps (`businessNameItems`; Discovery's
// "Admin & Business Name Pipeline" box): Google Autocomplete + Text Search,
// places only, Google's order, at most 20 rows. A row Mesita holds comes back
// as that Mesita place, with its listing phone masked (so the owner knows
// which number proves it) and the caller's own state on it; archived places
// drop. A Google-only row comes back with its `google_place_id`, for
// business-web-create-place ("Add and claim").
//
// `place_id`: that one Mesita place (the consumer app's "Is this your
// business?" deep link).
//
// Body: { q?: string, sessionToken?: string, place_id?: uuid }
// Response: { ok: true, places: [{ id | null, google_place_id | null, name,
//   address, photo, masked_phone, phone_on_listing, mine }] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { maskPhone } from "../_shared/place-verification.ts";
import { isLiveManager, MANAGER_COLUMNS, type ManagerRow } from "../_shared/place-access.ts";
import { businessNameItems } from "../_shared/name-pipeline.ts";

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
};

const SELECT = "id, name, google_name, address, photos, phone";
const MAX_ROWS = 20;
/** Google searches one account may run in a rolling day (MESITA-3123). */
const SEARCHES_PER_DAY = 200;

function mesitaRow(r: Row, mine: Map<string, string>): Found {
  return {
    id: r.id,
    google_place_id: null,
    name: r.name ?? r.google_name,
    address: r.address,
    photo: r.photos?.[0] ?? null,
    masked_phone: maskPhone(r.phone),
    phone_on_listing: !!r.phone,
    mine: mine.get(r.id) ?? null,
  };
}

/** The caller's own state on each place: owner, expired or a pending request. */
async function myStates(admin: SupabaseClient, userId: string, ids: string[]): Promise<Map<string, string>> {
  const mine = new Map<string, string>();
  if (ids.length === 0) return mine;
  const [managers, reqs] = await Promise.all([
    admin.from("place_managers").select(MANAGER_COLUMNS).eq("consumer_id", userId).is("revoked_at", null).in("place_id", ids),
    admin.from("place_verification_requests").select("place_id").eq("consumer_id", userId).eq("status", "pending").in("place_id", ids),
  ]);
  for (const r of (reqs.data ?? []) as Array<{ place_id: string }>) mine.set(r.place_id, "pending");
  for (const r of (managers.data ?? []) as ManagerRow[]) mine.set(r.place_id, isLiveManager(r) ? "owner" : "expired");
  return mine;
}

serveJson("business-web-find-place", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;

  const body = await readJsonOr<{ q?: unknown; sessionToken?: unknown; place_id?: unknown }>(req, {});

  // The deep link: one Mesita place by id.
  if (isUuid(body.place_id)) {
    const { data, error } = await admin.from("profiles").select(SELECT).eq("id", body.place_id).in("state", ["active", "paused"]).limit(1);
    if (error) return json({ ok: false, error: error.message }, 500);
    const rows = (data ?? []) as Row[];
    const mine = await myStates(admin, user.id, rows.map((r) => r.id));
    return json({ ok: true, places: rows.map((r) => mesitaRow(r, mine)) });
  }

  const q = typeof body.q === "string" ? body.q.trim().slice(0, 80) : "";
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
  const mine = await myStates(admin, user.id, [...byId.keys()]);

  const places: Found[] = [];
  for (const item of items) {
    if (item.mesitaId) {
      const row = byId.get(item.mesitaId);
      if (row) places.push(mesitaRow(row, mine));
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
    });
  }
  return json({ ok: true, places });
});

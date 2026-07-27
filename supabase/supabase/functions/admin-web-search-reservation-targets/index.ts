// Supabase Edge Function — admin-web-search-reservation-targets
//
// Naming: caller-verb-words. Caller = admin, verb = search, words = reservation-targets.
//
// The Reservations Playground's pickers: an emulated intent is built from a REAL
// place and a REAL consumer, both straight from the Mesita DB. This endpoint
// searches either kind and returns the fields the playground needs to build a
// call brief — crucially the phone each side would use in "actual number" mode:
//   place    → the reservation endpoint the agent would dial
//              (products.reservations phone endpoint, else places.phone)
//   consumer → consumers.phone (the guest callback number)
//
// admin-web-search-places deliberately stays untouched — it reads projects_view
// for the Manage Single Unit catalog and carries no phone/products.
//
// Auth: caller's JWT email must be in public.super_admins.
//
// Deploy: supabase functions deploy admin-web-search-reservation-targets

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

type Body = { kind?: unknown; query?: unknown; limit?: unknown };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function likePattern(q: string): string {
  const safe = q.replace(/[,()"]/g, " ").trim();
  return `%${safe.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
}

// The number the Reservationist would dial for this place in "actual" mode —
// mirrors supabase-edgefunc-reservation-call's non-test resolution exactly.
function placeDialNumber(row: {
  phone?: string | null;
  products?: Record<string, unknown> | null;
}): string | null {
  const resv = (row.products?.reservations ?? null) as
    | { channel?: string; value?: string }
    | null;
  return resv?.channel === "phone" && resv.value ? resv.value : row.phone ?? null;
}

function consumerName(row: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const full = row.full_name?.trim();
  if (full) return full;
  const joined = [row.first_name, row.last_name]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return joined || "(no name)";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const kind = bodyRes.body.kind;
  if (kind !== "place" && kind !== "consumer") {
    return json({ ok: false, error: "kind must be 'place' or 'consumer'" }, 400);
  }
  const q = typeof bodyRes.body.query === "string" ? bodyRes.body.query.trim() : "";
  const limit =
    typeof bodyRes.body.limit === "number" && Number.isInteger(bodyRes.body.limit)
      ? Math.min(Math.max(bodyRes.body.limit, 1), 25)
      : 10;

  if (kind === "place") {
    const cols = "id, slug, name, address, phone, products, photos";
    let query = admin.from("places").select(cols).limit(limit);
    if (UUID_RE.test(q)) {
      query = admin.from("places").select(cols).eq("id", q);
    } else if (q) {
      const pattern = likePattern(q);
      query = query.or(`name.ilike."${pattern}",slug.ilike."${pattern}"`);
    } else {
      query = query.order("created_at", { ascending: false });
    }
    const { data, error } = await query;
    if (error) return json({ ok: false, error: `search_failed: ${error.message}` }, 500);
    const results = (data ?? []).map((v) => ({
      id: v.id,
      name: v.name ?? "(unnamed place)",
      address: v.address ?? null,
      photo: Array.isArray(v.photos) && v.photos.length > 0 ? v.photos[0] : null,
      // The line "actual number" mode would dial; null = place has no phone endpoint.
      phone: placeDialNumber(v),
    }));
    return json({ ok: true, kind, results });
  }

  // kind === "consumer"
  const cols = "id, full_name, first_name, last_name, phone, avatar_url";
  let query = admin.from("consumers").select(cols).limit(limit);
  if (UUID_RE.test(q)) {
    query = admin.from("consumers").select(cols).eq("id", q);
  } else if (q) {
    const pattern = likePattern(q);
    query = query.or(
      `full_name.ilike."${pattern}",first_name.ilike."${pattern}",last_name.ilike."${pattern}",phone.ilike."${pattern}"`,
    );
  } else {
    query = query.order("created_at", { ascending: false });
  }
  const { data, error } = await query;
  if (error) return json({ ok: false, error: `search_failed: ${error.message}` }, 500);
  const results = (data ?? []).map((v) => ({
    id: v.id,
    name: consumerName(v),
    phone: (v.phone as string | null)?.trim() || null,
    avatar: (v.avatar_url as string | null) ?? null,
  }));
  return json({ ok: true, kind, results });
});

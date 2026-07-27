// Supabase Edge Function — admin-web-list-reservations
//
// Naming: caller-verb-words. Caller = admin, verb = list, words = reservations.
//
// The operator door onto the ONE reservations table (sandbox retired,
// 2026-07-27): newest tickets first — real and is_test alike, each row shaped
// with the guest and place names so the Reservations Playground's tickets
// section renders without further joins. This is the only list surface that
// shows is_test rows; consumer/business EFs filter them out.
//
// Auth: caller's JWT email must be in public.super_admins.
//
// Deploy: supabase functions deploy admin-web-list-reservations

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const body = await readJsonOr<{ limit?: unknown }>(req, {});
  const limit =
    typeof body.limit === "number" && Number.isInteger(body.limit)
      ? Math.min(Math.max(body.limit, 1), 200)
      : 50;

  const { data, error } = await admin
    .from("reservations")
    .select(
      "id, created_at, reference_code, project_id, reserved_at, party_size, notes, status, is_test, business_number, consumer_number, call_attempts, last_conversation_id, last_called_at, last_call_status, attempts, attempts_planned, attempts_state, callback_state, callback_conversation_id, callback_at, confirmed_at, consumer:consumers(full_name, first_name, last_name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return json({ ok: false, error: error.message }, 500);

  type Row = {
    project_id: string;
    consumer: {
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
    } | null;
  } & Record<string, unknown>;
  const rows = (data ?? []) as Row[];

  // reservations.project_id has no PostgREST FK hint to places — batch names.
  const placeIds = [...new Set(rows.map((r) => r.project_id))];
  const { data: places } = placeIds.length
    ? await admin.from("places").select("id, name").in("id", placeIds)
    : { data: [] };
  const placeName = new Map<string, string>(
    ((places ?? []) as { id: string; name: string | null }[]).map(
      (p) => [p.id, p.name ?? "(unnamed place)"],
    ),
  );

  const tickets = rows.map((r) => {
    const c = r.consumer;
    const guest = c?.full_name?.trim() ||
      [c?.first_name, c?.last_name].map((s) => (s ?? "").trim()).filter(Boolean).join(" ") ||
      "(sin nombre)";
    const { consumer: _consumer, ...rest } = r;
    return {
      ...rest,
      place_name: placeName.get(r.project_id) ?? "(unnamed place)",
      consumer_name: guest,
      // The UI's historical field names — kept so the tickets section reads
      // one shape regardless of which columns back it.
      conversation_id: r.last_conversation_id ?? null,
      called_at: r.last_called_at ?? null,
      call_status: r.last_call_status ?? null,
    };
  });

  return json({ ok: true, tickets });
});

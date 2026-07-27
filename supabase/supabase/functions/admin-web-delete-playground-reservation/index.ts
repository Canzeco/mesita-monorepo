// Supabase Edge Function — admin-web-delete-playground-reservation
//
// Naming: caller-verb-words. Caller = admin, verb = delete, words = playground-reservation.
//
// Sandbox cleanup for the Reservations Playground: deletes tickets from
// public.playground_reservations — one by id, or every one of them with
// { all: true }. These rows exist only for the playground (never
// public.reservations), so deleting them is always safe; a running intent
// loop whose ticket disappears just stops persisting progress.
//
// Auth: caller's JWT email must be in public.super_admins.
//
// Deploy: supabase functions deploy admin-web-delete-playground-reservation

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

  const body = await readJsonOr<{ id?: unknown; all?: unknown }>(req, {});
  const all = body.all === true;
  const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;
  if (!all && !id) {
    return json({ ok: false, error: "Pass a ticket id, or all: true" }, 400);
  }

  // PostgREST refuses an unfiltered DELETE — `not id is null` matches all rows.
  const del = admin.from("playground_reservations").delete();
  const filtered = all ? del.not("id", "is", null) : del.eq("id", id as string);
  const { data, error } = await filtered.select("id");
  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true, deleted: data?.length ?? 0 });
});

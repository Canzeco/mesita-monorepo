// Supabase Edge Function — admin-web-delete-reservation
//
// Naming: caller-verb-words. Caller = admin, verb = delete, words = reservation.
//
// Operator cleanup on the ONE reservations table (sandbox retired,
// 2026-07-27): deletes one ticket by id — any row, it's the operator console —
// or every is_test row with { all_test: true }. There is deliberately NO
// "delete everything": real guest reservations can only go one-by-one, on
// purpose.
//
// Auth: caller's JWT email must be in public.super_admins.
//
// Deploy: supabase functions deploy admin-web-delete-reservation

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

  const body = await readJsonOr<{ id?: unknown; all_test?: unknown }>(req, {});
  const allTest = body.all_test === true;
  const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;
  if (!allTest && !id) {
    return json({ ok: false, error: "Pass a reservation id, or all_test: true" }, 400);
  }

  const del = admin.from("reservations").delete();
  const filtered = allTest ? del.eq("is_test", true) : del.eq("id", id as string);
  const { data, error } = await filtered.select("id");
  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true, deleted: data?.length ?? 0 });
});

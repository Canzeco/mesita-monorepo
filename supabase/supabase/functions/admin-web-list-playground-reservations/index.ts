// Supabase Edge Function — admin-web-list-playground-reservations
//
// Naming: caller-verb-words. Caller = admin, verb = list, words = playground-reservations.
//
// The Reservations Playground's sandbox: returns the remembered playground
// tickets (public.playground_reservations, newest first) so the sandbox section
// shows every emulated reservation across sessions and operators. These rows
// never touch public.reservations — they exist only for the playground.
//
// Auth: caller's JWT email must be in public.super_admins.
//
// Deploy: supabase functions deploy admin-web-list-playground-reservations

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
    .from("playground_reservations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true, tickets: data ?? [] });
});

// Supabase Edge Function — admin-web-list-aura
//
// Naming: caller-verb-words. Caller = admin, verb = list, words = aura.
//
// The Aura roster: every consumer holding the INVITATION DOOR to Aura
// (consumers.invitation_class_key — the door fact, MESITA-972). Read-only —
// the console's Aura Config page renders this list, and every membership
// write still goes through admin-web-grant-class.
//
// The roster keys off the door, not the slot: an Aura member always wins the
// slot today (nothing outranks Aura), but the list must mean "who is on the
// Aura list", not "whose computed class happens to read aura". Each row still
// carries the slot class/origin so the difference stays legible.
//
// Body: {}   (none)
// Response: { ok: true, members: ConsumerSummary[] }
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import {
  CONSUMER_SUMMARY_COLUMNS,
  toConsumerSummary,
} from "../_shared/consumer-lookup.ts";

const AURA_CLASS_KEY = "aura";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  // Newest invitation first — the roster reads as a log of who was let in.
  // Rows predating invitation_granted_at (null) sort last rather than vanishing.
  const { data, error } = await admin
    .from("consumers")
    .select(CONSUMER_SUMMARY_COLUMNS)
    .eq("invitation_class_key", AURA_CLASS_KEY)
    .order("invitation_granted_at", { ascending: false, nullsFirst: false });
  if (error) {
    return json({ ok: false, error: `list_failed: ${error.message}` }, 500);
  }

  return json({
    ok: true,
    members: (data ?? []).map(toConsumerSummary),
  });
});

// Supabase Edge Function — consumer-web-get-controls-config
//
// Naming: caller-verb-words. Caller = consumer, verb = get, words =
// controls-config.
//
// The guest-facing slice of the Wallet's Credits policy: the hold a top-up
// inherits, the bonus that goes with it, and how many DAYS the Credits live
// before they expire. Exists so the Wallet stops hard-coding numbers the
// console claims to own — an admin knob nothing reads is the "unenforced
// config = bug" failure root CLAUDE.md names.
//
// Returns the GUEST slice only. maxHoldHours, minHoldHours and minExpiryDays
// are operator policy about what a PLACE may choose; a guest reads the terms on
// their own card, not the range a venue was allowed to pick from. The expiry
// DEFAULT crosses because a guest is owed the date their own Credits die.
//
// Auth: any signed-in consumer. There is nothing per-user here — it is the
// same policy for everyone — but the Wallet is behind the auth wall anyway and
// an anonymous door would be a new surface with no caller.
//
// Body:     {}
// Response: { ok: true, policy: { defaultHoldHours, defaultBonusPct,
//                                 defaultExpiryDays } }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  guestControlsPolicy,
  loadControlsConfig,
} from "../_shared/controls-config.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  // loadControlsConfig never throws and falls back to the shipped defaults, so
  // a config read failure degrades the hold to 3h rather than breaking the
  // Wallet — the surface is more useful wrong-by-a-default than absent.
  const config = await loadControlsConfig(adminClient(envRes.env));

  return json({ ok: true, policy: guestControlsPolicy(config) });
});

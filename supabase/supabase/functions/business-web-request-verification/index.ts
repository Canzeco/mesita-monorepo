// Supabase Edge Function — business-web-request-verification
//
// MESITA-3103. "This is my place." The caller's name, role and note become a
// pending request a super-admin approves or rejects in the Business app's
// Internal page. Three requests per guest per day. Never says whether anyone
// else runs the place. (Phone match left with phone sign-in, MESITA-3105: a
// Google account carries no phone to compare.) The request carries a WhatsApp
// number Mesita writes to while it checks (MESITA-3127); the other way in is
// the claim call (business-web-call-place-code).
//
// Body: { place_id: uuid, name?: string, role?: string, contact?: string, note?: string }
// Response: { ok: true, outcome: "pending" | "already_pending" | "already_owner" | "needs_details" }
//         | { ok: false, code: "no_account" | "too_many_requests" | "invalid", error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { ensureConsumer } from "../_shared/business-request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { isLiveManager, managerRow } from "../_shared/place-access.ts";
import { boundedText } from "../_shared/place-verification.ts";

const REQUESTS_PER_DAY = 3;

/** The pending request row (the place_verification_requests table, EF-only). */
function insertRequest(
  admin: SupabaseClient,
  row: { place_id: string; consumer_id: string; name: string; role: string; contact: string; note: string | null },
) {
  return admin.from("place_verification_requests").insert(row);
}

serveJson("business-web-request-verification", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, code: "invalid", error: "place_id must be a Mesita place id" }, 400);

  const consumer = await ensureConsumer(admin, user);
  if (!consumer.ok) return json({ ok: false, error: consumer.error, code: consumer.code ?? null }, consumer.status);
  if (!consumer.consumerId) {
    return json({ ok: false, code: "no_account", error: "Sign in with your phone number to claim a place" }, 400);
  }

  const { data: place, error: placeErr } = await admin
    .from("profiles")
    .select("id, state")
    .eq("id", placeId)
    .maybeSingle();
  if (placeErr) return json({ ok: false, error: placeErr.message }, 500);
  if (!place || (place.state !== "active" && place.state !== "paused")) {
    return json({ ok: false, code: "not_found", error: "Place not found" }, 404);
  }

  try {
    const row = await managerRow(admin, placeId, user.id);
    if (isLiveManager(row)) return json({ ok: true, outcome: "already_owner" });
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }

  const { data: pending } = await admin
    .from("place_verification_requests")
    .select("id")
    .eq("place_id", placeId)
    .eq("consumer_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) return json({ ok: true, outcome: "already_pending" });

  const name = boundedText(bodyRes.body.name, 80);
  const role = boundedText(bodyRes.body.role, 80);
  const contact = boundedText(bodyRes.body.contact, 40);
  const note = boundedText(bodyRes.body.note, 500);
  if (name === undefined || role === undefined || contact === undefined || note === undefined) {
    return json({ ok: false, code: "invalid", error: "Name and role are 80 characters at most, the WhatsApp number 40, the note 500" }, 400);
  }
  if (!name || !role || !contact) return json({ ok: true, outcome: "needs_details" });
  if (contact.replace(/\D/g, "").length < 7) {
    return json({ ok: false, code: "invalid_contact", error: "Write a WhatsApp number we can reach you at" }, 400);
  }

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count, error: countErr } = await admin
    .from("place_verification_requests")
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", user.id)
    .gte("created_at", since);
  if (countErr) return json({ ok: false, error: countErr.message }, 500);
  if ((count ?? 0) >= REQUESTS_PER_DAY) {
    return json({ ok: false, code: "too_many_requests", error: "You can send three requests a day. Try again tomorrow." }, 429);
  }

  const { error } = await insertRequest(admin, { place_id: placeId, consumer_id: user.id, name, role, contact, note });
  if (error) {
    if (error.code === "23505") return json({ ok: true, outcome: "already_pending" });
    return json({ ok: false, error: error.message }, 500);
  }
  console.log(JSON.stringify({ fn: "business-web-request-verification", place_id: placeId, outcome: "pending" }));
  return json({ ok: true, outcome: "pending" });
});

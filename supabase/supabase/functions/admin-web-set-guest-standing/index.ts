// Supabase Edge Function — admin-web-set-guest-standing
//
// Manage › Guests (MESITA-2550). Grants or takes away a guest's Diamond and
// sets their plan, Free or Premium (MESITA-2548). Diamond is by invitation,
// so an operator is the only one who sets it: no consumer EF accepts either
// field. Writes through the consumer door and returns the row as written.
// Super-admin only.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { writeConsumer } from "../_shared/consumer-doc.ts";
import { GUEST_ROW_SELECT, readStandingBody, toGuestRow } from "../_shared/guest-standing.ts";

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

  const bodyRes = await readJson<unknown>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = readStandingBody(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);

  // A closed account keeps its row for history; it is not granted anything.
  const existing = await admin
    .from("consumers")
    .select("id, deleted_at")
    .eq("id", parsed.consumerId)
    .maybeSingle();
  if (existing.error) {
    return json({ ok: false, error: `read_failed: ${existing.error.message}` }, 500);
  }
  if (!existing.data) return json({ ok: false, error: "No such guest" }, 404);
  if (existing.data.deleted_at) {
    return json({ ok: false, error: "This account is closed" }, 409);
  }

  const written = await writeConsumer(admin, {
    mode: "update",
    id: parsed.consumerId,
    patch: parsed.patch,
    select: GUEST_ROW_SELECT,
  });
  if (!written.ok) {
    return json({ ok: false, error: `update_failed: ${written.error}` }, 500);
  }

  return json({ ok: true, guest: toGuestRow(written.row ?? {}) });
});

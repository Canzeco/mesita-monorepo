// Supabase Edge Function — business-web-set-check-pin
//
// Sets (or clears) the place's optional staff PIN for the public check page
// (MESITA-823). One shared 6-digit secret per place — NOT a waiter identity
// (MESITA-833 stands): staff hold no account; the manager briefs them with
// this PIN and check-page WRITE actions require it. NULL = gate off.
//
// The current PIN rides back on business-web-get-overview's active place
// (owner/super-admin view) so consoles can display it — a shared secret the
// manager can't read is a shared secret nobody can brief.
//
// Auth: place OWNER (super-admins bypass). Editors/viewers can't set it —
// the gate exists to protect the owner's numbers from the floor.
//
// Body:     { placeId: string, pin: "123456" | null }
// Response: { ok: true, pin: string | null }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, readPlaceIdAlias } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireOwner,
} from "../_shared/auth.ts";

type Body = { placeId?: string; projectId?: string; pin?: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const projectId = readPlaceIdAlias(bodyRes.body);
  if (!projectId) return json({ ok: false, error: "placeId is required" }, 400);

  const raw = bodyRes.body.pin;
  let pin: string | null;
  if (raw == null || raw === "") {
    pin = null;
  } else if (typeof raw === "string" && /^[0-9]{6}$/.test(raw.trim())) {
    pin = raw.trim();
  } else {
    return json(
      { ok: false, error: "pin must be exactly 6 digits, or null to disable" },
      400,
    );
  }

  const admin = adminClient(envRes.env);
  const ownerRes = await requireOwner(
    admin,
    authRes.user,
    projectId,
    "Only owners can manage the check PIN.",
  );
  if (!ownerRes.ok) return ownerRes.response;

  const upd = await admin
    .from("projects")
    .update({ check_pin: pin })
    .eq("id", projectId)
    .select("check_pin")
    .maybeSingle();
  if (upd.error) {
    return json({ ok: false, error: `update: ${upd.error.message}` }, 500);
  }
  if (!upd.data) return json({ ok: false, error: "Place not found" }, 404);

  return json({ ok: true, pin: (upd.data as { check_pin: string | null }).check_pin });
});

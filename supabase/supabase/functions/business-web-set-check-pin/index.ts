// Supabase Edge Function — business-web-set-check-pin
//
// The check-page settings door: sets (or clears) the place's optional staff
// PIN (MESITA-823) and/or the require-bill switch (MESITA-898). Each key is
// updated only when present in the body, so the two cards save
// independently.
//
// PIN: one shared 6-digit secret per place — NOT a waiter identity
// (MESITA-833 stands): staff hold no account; the manager briefs them with
// this PIN and check-page WRITE actions require it. NULL = gate off.
//
// requireBill: when true, check-web-mark-paid refuses to close an unbilled
// ticket (default false = the v3b optional bill, MESITA-850).
//
// Current values ride back on business-web-get-overview's active place
// (owner/super-admin view) so consoles can display them — a shared secret
// the manager can't read is a shared secret nobody can brief.
//
// Auth: place OWNER (super-admins bypass). Editors/viewers can't set it —
// the gate exists to protect the owner's numbers from the floor.
//
// Body:     { placeId: string, pin?: "123456" | null, requireBill?: boolean }
// Response: { ok: true, pin: string | null, requireBill: boolean }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireOwner,
} from "../_shared/auth.ts";
import { writePlace } from "../_shared/place-doc.ts";

type Body = {
  placeId?: string;
  projectId?: string;
  pin?: string | null;
  requireBill?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const projectId = readPlaceIdAlias(bodyRes.body);
  if (!projectId) return json({ ok: false, error: "placeId is required" }, 400);

  // Partial update: only keys present in the body are written, so the PIN
  // card and the require-bill card save without clobbering each other.
  const update: { check_pin?: string | null; check_require_bill?: boolean } =
    {};
  if ("pin" in bodyRes.body) {
    const raw = bodyRes.body.pin;
    if (raw == null || raw === "") {
      update.check_pin = null;
    } else if (typeof raw === "string" && /^[0-9]{6}$/.test(raw.trim())) {
      update.check_pin = raw.trim();
    } else {
      return json(
        { ok: false, error: "pin must be exactly 6 digits, or null to disable" },
        400,
      );
    }
  }
  if ("requireBill" in bodyRes.body) {
    if (typeof bodyRes.body.requireBill !== "boolean") {
      return json({ ok: false, error: "requireBill must be a boolean" }, 400);
    }
    update.check_require_bill = bodyRes.body.requireBill;
  }
  if (Object.keys(update).length === 0) {
    return json({ ok: false, error: "Nothing to update" }, 400);
  }

  const admin = adminClient(envRes.env);
  const ownerRes = await requireOwner(
    admin,
    authRes.user,
    projectId,
    "Only owners can manage the check PIN.",
  );
  if (!ownerRes.ok) return ownerRes.response;

  const upd = await writePlace(admin, {
    table: "projects",
    mode: "update",
    id: projectId,
    patch: update,
    select: "check_pin, check_require_bill",
    selectMode: "maybeSingle",
  });
  if (!upd.ok) {
    return json({ ok: false, error: `update: ${upd.error}` }, 500);
  }
  if (!upd.row) return json({ ok: false, error: "Place not found" }, 404);

  const row = upd.row as {
    check_pin: string | null;
    check_require_bill: boolean | null;
  };
  return json({
    ok: true,
    pin: row.check_pin,
    requireBill: row.check_require_bill === true,
  });
});

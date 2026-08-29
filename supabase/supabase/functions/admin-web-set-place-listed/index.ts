// Supabase Edge Function — admin-web-set-place-listed
//
// The ONLY door onto projects.status.
//
// Listed is one of the nine facts the admin Status box reports — "can a guest
// reach this place on Mesita at all" — and until now it was the only one
// nothing in the product could change. The column was enforced (the consumer
// RLS policy projects_select_public_visible gates SELECT on it) and
// unreachable: business-web-update-project does not accept `status`, and no
// admin EF wrote it. Every row read 'active' purely because nothing had ever
// written anything else. Pato, 2026-08-22: "maybe we want to activate or not
// the place in Mesita."
//
// LISTED is exactly the policy's predicate, not a new idea:
//
//   projects_select_public_visible USING
//     status IN ('active','lead') AND content_status IN (...)
//
// The content_status leg allows all four labels of its enum, so `status`
// alone decides. Unlisting therefore removes the place from every guest
// surface at once — browse, search, the swipe deck, a shared link — because
// they all read through that one policy with the anon key.
//
// Body:     { placeId | projectId, listed: boolean }
// Response: { ok: true, listed, status, place }
//           `place` is the same AdminPlace shape business-web-update-project
//           returns, so the console reconciles from one call.
// Auth:     caller's JWT email must be in public.super_admins.
//
// UNLIST WRITES 'paused', NOT 'archived'. Both sit outside the visible set, so
// either would hide the place; paused is the reversible one and this is a
// toggle. `archived` reads as terminal and is left to whatever eventually
// handles real deletion.
//
// KNOWN NARROWING: `lead` is also a listed status, so unlisting a lead place
// and re-listing it lands on 'active' — the lead/active distinction does not
// survive the round trip. That is deliberate rather than overlooked: carrying
// the prior value would need somewhere to store it, and nothing in the product
// distinguishes the two today (every row is 'active'). Revisit if lead ever
// starts meaning something a guest can tell apart.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { PLACE_BUSINESS_COLUMNS } from "../_shared/place-columns.ts";
import { writePlace } from "../_shared/place-doc.ts";

/** The statuses the consumer RLS policy treats as reachable. */
const LISTED_STATUSES = ["active", "lead"] as const;
/** Where an unlist lands — outside the visible set, and reversible. */
const UNLISTED_STATUS = "paused";
/** Where a re-list lands. */
const LISTED_STATUS = "active";

type Body = { placeId?: unknown; projectId?: unknown; listed?: unknown };

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

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const projectId = readPlaceIdAlias(body);
  if (!projectId) return json({ ok: false, error: "placeId is required" }, 400);
  if (typeof body.listed !== "boolean") {
    return json({ ok: false, error: "listed must be a boolean" }, 400);
  }
  const listed = body.listed;

  const { data: current, error: readCurrent } = await admin
    .from("projects")
    .select("status")
    .eq("id", projectId)
    .maybeSingle();
  if (readCurrent) {
    return json({ ok: false, error: `status_read: ${readCurrent.message}` }, 500);
  }
  if (!current) return json({ ok: false, error: "Place not found" }, 404);

  const currentStatus = (current as { status: string | null }).status ?? "";
  const alreadyListed = (LISTED_STATUSES as readonly string[]).includes(
    currentStatus,
  );

  // Already where the caller wants it — report success without a write, so a
  // double-click or a stale toggle cannot demote a 'lead' place to 'active'.
  if (alreadyListed === listed) {
    const { data: place, error: readError } = await admin
      .from("profiles")
      .select(PLACE_BUSINESS_COLUMNS)
      .eq("id", projectId)
      .single();
    if (readError) {
      return json({ ok: false, error: `place_read: ${readError.message}` }, 500);
    }
    return json({ ok: true, listed, status: currentStatus, place });
  }

  const nextStatus = listed ? LISTED_STATUS : UNLISTED_STATUS;
  const updRes = await writePlace(admin, {
    table: "projects",
    mode: "update",
    id: projectId,
    patch: { status: nextStatus },
    select: "id",
    selectMode: "maybeSingle",
  });
  if (!updRes.ok) {
    return json({ ok: false, error: `status_update: ${updRes.error}` }, 500);
  }
  if (!updRes.row) return json({ ok: false, error: "Place not found" }, 404);

  console.log(
    JSON.stringify({
      event: "place_listing_changed",
      project: projectId,
      from: currentStatus,
      to: nextStatus,
      actor: authRes.user.email ?? authRes.user.id,
    }),
  );

  const { data: place, error: readError } = await admin
    .from("profiles")
    .select(PLACE_BUSINESS_COLUMNS)
    .eq("id", projectId)
    .single();
  if (readError) {
    return json({ ok: false, error: `place_read: ${readError.message}` }, 500);
  }

  return json({ ok: true, listed, status: nextStatus, place });
});

// Supabase Edge Function — admin-web-list-verifications
//
// Returns ownership verification requests with place + requester
// metadata, ordered newest first. Used by admin.mesita.ai/verifications
// to surface the queue. Pending rows are the actionable ones; decided
// rows (approved / rejected) are kept in the list as history.
//
// Queue surface: the admin only ever sees rows that need a human
// decision. That's all video rows (regardless of auto_verify_video,
// since decided history matters too) plus ai_call rows where the
// caller successfully entered the OTP but auto_verify_ai_call was off
// at that moment (payload.codeVerifiedAt set). Phone rows where the
// code hasn't been entered yet stay invisible — they're not the
// admin's concern.
//
// Per-place mode: pass projectId to get ONE place's verification history
// instead (newest first, method gate skipped — the inspector wants the
// full trail). Used by Manage Single Place's Ownership box.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods, readPlaceIdAlias } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

type Body = {
  // Filter by status. Omit / undefined / null = all.
  status?: "pending" | "approved" | "rejected" | null;
  limit?: number;
  // Per-place inspector: only this project's rows, no method gate.
  projectId?: string | null;
};

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

  const body = await readJsonOr<Body>(req, {});
  const limit = Math.min(200, Math.max(1, body.limit ?? 100));

  // project_verifications FKs to `projects`, never to `places`, so the place
  // has to come through the project. `slug` and `status` are project columns;
  // only name/address/phone/google_place_id live on `places`. Embedding
  // places directly here fails the whole query with PGRST200 — same trap
  // admin-web-list-notifications documents.
  let query = admin
    .from("project_verifications")
    .select(
      "id, project_id, requester_id, method, payload, requester_email, status, reject_reason, decided_at, decided_by, decided_via, created_at, project:projects(id, slug, status, place:places(name, address, phone, google_place_id))",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (body.status) {
    query = query.eq("status", body.status);
  }
  const projectId = readPlaceIdAlias(body) || null;
  if (projectId) {
    query = query.eq("project_id", projectId);
  } else {
    // Method gate (queue surface only): video always shows; ai_call only
    // shows once the operator has confirmed the OTP (codeVerifiedAt stamped
    // by business-web-verify-phone-otp when auto_verify_ai_call was off).
    query = query.or(
      "method.eq.video,and(method.eq.ai_call,payload->>codeVerifiedAt.not.is.null)",
    );
  }

  const { data, error } = await query;
  if (error) {
    return json(
      { ok: false, error: `verification_list: ${error.message}` },
      500,
    );
  }

  // Flatten project+place back into the single `place` object the admin
  // web renders. id/slug/status come from the project, the rest from the
  // place — the shape the client sees is unchanged.
  type PlaceRow = {
    name: string | null;
    address: string | null;
    phone: string | null;
    google_place_id: string | null;
  };
  type ProjectRow = {
    id: string;
    slug: string | null;
    status: string | null;
    place: PlaceRow | PlaceRow[] | null;
  };
  const one = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v;

  const verifications = (data ?? []).map((row) => {
    const { project, ...rest } = row as typeof row & {
      project: ProjectRow | ProjectRow[] | null;
    };
    const p = one(project);
    const pl = p ? one(p.place) : null;
    return {
      ...rest,
      place: p
        ? {
            id: p.id,
            slug: p.slug,
            status: p.status,
            name: pl?.name ?? null,
            address: pl?.address ?? null,
            phone: pl?.phone ?? null,
            google_place_id: pl?.google_place_id ?? null,
          }
        : null,
    };
  });

  // Auto-mode flags piggyback on this call so the admin web doesn't
  // need a second round-trip just to render the toggles' current
  // state.
  const { data: settings } = await admin
    .from("app_settings")
    .select("auto_verify_ai_call, auto_verify_video, updated_at")
    .eq("id", 1)
    .maybeSingle();

  return json({
    ok: true,
    verifications,
    autoVerifyAiCall: settings?.auto_verify_ai_call ?? true,
    autoVerifyVideo: settings?.auto_verify_video ?? false,
    autoVerifyUpdatedAt: settings?.updated_at ?? null,
  });
});

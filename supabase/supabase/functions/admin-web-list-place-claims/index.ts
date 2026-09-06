// Supabase Edge Function — admin-web-list-place-claims
//
// MESITA-1544: claim_place_into_org (business-web-claim-place) grants
// ownership instantly and atomically — no evidence, no admin gate. That
// stays true; this EF is the audit trail layered on top so a super-admin
// can catch a bad claim after the fact instead of before it.
//
// Queue mode (default): unreviewed claims — organization_id and claimed_by
// set, claim_reviewed_at still null — newest first (projects_unreviewed_
// claims_idx). includeReviewed=true also returns cleared claims as history,
// same shape as admin-web-list-verifications's state filter.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

type Body = {
  includeReviewed?: boolean;
  limit?: number;
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

  // FKs: claimed_by -> managers, organization_id -> organizations, id ->
  // places (1:1, same trap admin-web-list-verifications documents: places
  // has to come in through its own relation, never embedded via projects).
  let query = admin
    .from("projects")
    .select(
      "id, claimed_by, claimed_at, claim_reviewed_at, claim_reviewed_by, organization:organizations(id, name), claimer:managers!claimed_by(full_name, email), place:places(name, address, google_place_id)",
    )
    .not("organization_id", "is", null)
    .not("claimed_by", "is", null)
    .order("claimed_at", { ascending: false })
    .limit(limit);
  if (!body.includeReviewed) {
    query = query.is("claim_reviewed_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return json({ ok: false, error: `claims_list: ${error.message}` }, 500);
  }

  const one = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v;

  const claims = (data ?? []).map((row) => {
    const r = row as {
      id: string;
      claimed_by: string;
      claimed_at: string;
      claim_reviewed_at: string | null;
      claim_reviewed_by: string | null;
      organization: { id: string; name: string } | { id: string; name: string }[] | null;
      claimer: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
      place: { name: string | null; address: string | null; google_place_id: string | null } | { name: string | null; address: string | null; google_place_id: string | null }[] | null;
    };
    const org = one(r.organization);
    const claimer = one(r.claimer);
    const place = one(r.place);
    return {
      id: r.id,
      claimed_by: r.claimed_by,
      claimed_at: r.claimed_at,
      claim_reviewed_at: r.claim_reviewed_at,
      claim_reviewed_by: r.claim_reviewed_by,
      organization: org,
      claimer: {
        full_name: claimer?.full_name ?? null,
        email: claimer?.email ?? null,
      },
      place: {
        name: place?.name ?? null,
        address: place?.address ?? null,
        google_place_id: place?.google_place_id ?? null,
      },
    };
  });

  return json({ ok: true, claims });
});

// Supabase Edge Function — business-web-verify-place
//
// Turns a place the caller's organization ALREADY HOLDS into a Verified one,
// against a mock code.
//
// WHY THIS EXISTS. `business-web-claim-place` says in its own header that
// ownership verification is out of scope: claiming is one conditional UPDATE
// on `organization_id`. Until now the only verification a business could
// perform lived inside `/add`, the create-a-place flow — and MESITA-1664
// removes that flow, because businesses no longer add places at all. So the
// proof-of-ownership step has to exist as an action on a place the
// organization holds, which is what this is.
//
// THE CODE IS A MOCK, ON PURPOSE. Pato, 2026-09-08: "to verify them, for the
// moment just use a mock code 123456, nothing else — don't send emails nor
// make phone calls, you just need to input shit." Nothing is sent anywhere.
// The code is compared here, server-side, and not in the browser: a mock
// that the client could bypass would teach the console a shape that the real
// OTP cannot keep, and the swap later would silently widen access.
//
// WHAT STAYS REAL WHILE THE CODE IS FAKE:
//   1. OWNERSHIP. Only an organization that already holds the place may
//      verify it, and only an owner may do it — the same role law as
//      claiming, since this is the other half of the same ceremony.
//   2. THE RECORD. It writes a normal `place_verifications` row, approved,
//      with method `mock_code`, via the shared `writeApprovedVerification`
//      (MESITA-1690 — `business-web-claim-place` and
//      `admin-web-set-place-verified` write the identical shape now, so the
//      insert exists in one place). `business-web-list-places` derives
//      Verified from exactly that (`state = approved`), so no second source
//      of truth appears and the admin queue sees the truth about how it
//      happened.
//   3. IDEMPOTENCE. Verified never lapses (MESITA-1320), so verifying an
//      already-verified place is a no-op success, not a duplicate row.
//
// MESITA-1690: this used to write `decided_via: "mock_code"` — a copy-paste
// that crossed `method` and `decided_via`. The column's check constraint
// only allows `'auto' | 'admin'`, so every real Confirm click 500'd. The
// shared writer takes `decidedVia` as its own argument now, so the two
// columns cannot cross again by accident.
//
// Auth: OWNER of the organization that holds the place.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJsonOr,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { requireOrgRole } from "../_shared/org-membership.ts";
import { writeApprovedVerification } from "../_shared/place-verification.ts";

/** The mock. One constant, named for what it is, so removing the mock is a
 *  grep for this identifier rather than a hunt for a string literal. */
const MOCK_VERIFICATION_CODE = "123456";

type Body = { placeId?: string; projectId?: string; code?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const placeId = readPlaceIdAlias(body);
  const code = String(body.code ?? "").trim();
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);
  if (!code) return json({ ok: false, error: "code is required" }, 400);

  const admin = adminClient(envRes.env);

  // The place names its own holder. Reading it here rather than trusting an
  // organizationId from the body is what stops a caller who owns org A from
  // verifying a place held by org B.
  const placeRes = await admin
    .from("places")
    .select("id, organization_id")
    .eq("id", placeId)
    .maybeSingle();
  if (placeRes.error) {
    return json({ ok: false, error: placeRes.error.message }, 500);
  }
  if (!placeRes.data) {
    return json({ ok: false, error: "No such place" }, 404);
  }

  const organizationId = placeRes.data.organization_id as string | null;
  if (!organizationId) {
    // Claim first. Saying so beats a 403 that reads like a permission
    // problem when it is really an ordering one.
    return json(
      {
        ok: false,
        error: "Claim this place before verifying it",
        code: "not_held",
      },
      409,
    );
  }

  const roleRes = await requireOrgRole(admin, authRes.user, organizationId, [
    "owner",
  ]);
  if (!roleRes.ok) return roleRes.response;

  // Verified never lapses, so checking for an existing approved row happens
  // inside writeApprovedVerification, BEFORE the code is checked below — a
  // re-submit with a typo on an already verified place still reports the
  // truth instead of a rejection. This early return is only for the code
  // itself; the idempotence check is the shared writer's job.
  const already = await admin
    .from("place_verifications")
    .select("id")
    .eq("place_id", placeId)
    .eq("state", "approved")
    .limit(1);
  if (already.error) {
    return json({ ok: false, error: already.error.message }, 500);
  }
  if ((already.data ?? []).length > 0) {
    return json({ ok: true, verified: true, alreadyVerified: true });
  }

  if (code !== MOCK_VERIFICATION_CODE) {
    return json(
      { ok: false, error: "That code is not right", code: "bad_code" },
      400,
    );
  }

  const result = await writeApprovedVerification(admin, {
    placeId,
    userId: authRes.user.id,
    userEmail: authRes.user.email ?? "",
    method: "mock_code",
    decidedVia: "auto",
  });
  if (!result.ok) return json({ ok: false, error: result.error }, 500);

  return json({
    ok: true,
    verified: true,
    alreadyVerified: result.alreadyVerified,
  });
});

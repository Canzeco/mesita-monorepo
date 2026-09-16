// Supabase Edge Function — business-web-verify-place
//
// Turns a place the caller ALREADY OWNS into a Verified one, on one click.
// No code, no proof, nothing sent anywhere.
//
// WHY THIS EXISTS. `business-web-claim-place` says in its own header that
// ownership verification is out of scope: claiming mints an owner row and
// stamps `claimed_at`, and asserts nothing about who you really are. Until
// MESITA-1664 the only verification a business could perform lived inside
// `/add`, the create-a-place flow — and that issue removed the flow, because
// businesses no longer add places at all. So the proof-of-ownership step has
// to exist as an action on a place the caller holds, which is what this is.
//
// THERE IS NO PROOF YET, ON PURPOSE. Pato, 2026-09-08: "just verify button
// and that's it. later we are going to implement all the shit to verify,
// like the phone verification shit." The mock 123456 code that used to gate
// this is gone — a fake secret taught the console a ceremony that proved
// nothing while costing a typing step. The button is the whole gesture until
// the real phone OTP lands, and that swap adds a challenge in FRONT of this
// call rather than resurrecting a constant.
//
// WHAT IS REAL WHILE THE PROOF IS NOT:
//   1. OWNERSHIP. Only someone who already holds the place may verify it, and
//      only an owner may do it — the same role law as claiming, since this is
//      the other half of the same ceremony. The holder used to be the
//      organization named by `places.organization_id`; MESITA-1892 removed
//      that layer, so the holder is now the `place_members` owner row the
//      claim minted, and `requireOwner` reads exactly that.
//   2. THE RECORD. It writes a normal `place_verifications` row, approved,
//      with method `mock_code` — the enum value that means "verified without
//      real proof" — via the shared `writeApprovedVerification` (MESITA-1690
//      — `business-web-claim-place` and `admin-web-set-place-verified` write
//      the identical shape now, so the insert exists in one place).
//      `business-web-list-places` derives Verified from exactly that
//      (`state = approved`), so no second source of truth appears and the
//      admin queue sees the truth about how it happened.
//   3. IDEMPOTENCE. Verified never lapses (MESITA-1320), so verifying an
//      already-verified place is a no-op success, not a duplicate row.
//
// MESITA-1690: this used to write `decided_via: "mock_code"` — a copy-paste
// that crossed `method` and `decided_via`. The column's check constraint
// only allows `'auto' | 'admin'`, so every real click 500'd. The shared
// writer takes `decidedVia` as its own argument now, so the two columns
// cannot cross again by accident.
//
// Auth: OWNER of the place.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJsonOr,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { requireOwner } from "../_shared/auth-membership.ts";
import { isPlaceClaimable } from "../_shared/place-claim.ts";
import { writeApprovedVerification } from "../_shared/place-verification.ts";

type Body = { placeId?: string; projectId?: string };

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
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const admin = adminClient(envRes.env);

  // The place must EXIST before anything else answers. Reading the row here
  // rather than trusting an id the caller says is theirs is what keeps the
  // 404 and the 409 below honest about two different situations.
  const placeRes = await admin
    .from("places")
    .select("id")
    .eq("id", placeId)
    .maybeSingle();
  if (placeRes.error) {
    return json({ ok: false, error: placeRes.error.message }, 500);
  }
  if (!placeRes.data) {
    return json({ ok: false, error: "No such place" }, 404);
  }

  // A place still in the pool is an ORDERING problem, not a permission one,
  // and saying so beats a 403 that reads like the latter. The predicate is
  // the shared one (_shared/place-claim.ts) so this endpoint, the listing and
  // the claim cannot disagree about what "unheld" means.
  if (await isPlaceClaimable(admin, placeId)) {
    return json(
      {
        ok: false,
        error: "Claim this place before verifying it",
        code: "not_held",
      },
      409,
    );
  }

  const roleRes = await requireOwner(admin, authRes.user, placeId);
  if (!roleRes.ok) return roleRes.response;

  // Verified never lapses, so an existing approved row is a success — the
  // check lives inside writeApprovedVerification, which is the only place
  // the insert happens.
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

// Supabase Edge Function — admin-web-list-credit-liability (admin console)
//
// The operator view MESITA-1679 asks for: issued value, outstanding balance,
// pending (still-held) lots, per-PLACE exposure, and breakage to date —
// "Credits would otherwise ship with no operator view of issued value,
// outstanding liability, or per-org exposure." That last phrase is the only
// thing MESITA-1892 changed: the tenant whose exposure an operator reads is
// the place, so get_credit_liability's payload carries `byPlace` (entries of
// placeId / placeName / currency / issuedCents / outstandingCents / lotCount /
// currencyMismatch) where it carried `byOrganization`. The totals and the
// breakage half are untouched.
//
// ITS OWN admin-web-* NAME, NOT A REUSE. ef-caller-acl.test.ts fails if a
// consumer-web-* name shows up inside apps/web-admin, so this cannot borrow
// any consumer-facing wallet read even though the underlying tables are the
// same — the admin console gets its own door.
//
// The heavy lifting — currency-safe grouping, the per-place currency-mismatch
// flag (a lot's currency against the place's own), breakage falling out of
// the ledger — lives in the SQL function get_credit_liability
// (20260908153425_credit_refund_adjust_and_liability.sql, re-scoped by
// 20260915234500_the_place_is_the_only_tenant.sql).
// This EF is a thin ACL-gated wrapper, same shape as
// admin-web-get-config's `controls` section.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, jsonError, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

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

  const { data, error } = await admin.rpc("get_credit_liability");
  if (error) return jsonError(`credit_liability_read: ${error.message}`, 500);

  return json({ ok: true, liability: data });
});

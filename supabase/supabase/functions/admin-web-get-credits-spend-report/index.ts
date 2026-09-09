// Supabase Edge Function — admin-web-get-credits-spend-report (admin console)
//
// Visibility, not reconciliation (MESITA-1678 §6). Mesita has no POS/register
// integration to reconcile at_place credit spend against, so this is not the
// Stripe-ledger ↔ credit_ledger reconciliation the issue itself flags as a
// separate, larger mechanism — it is a per-organization, per-paid_method
// total an operator can notice a spike or a mismatch against their own books
// with. Same thin ACL-gated wrapper shape as admin-web-list-credit-liability;
// the aggregation lives in get_credit_spend_report
// (20260909210000_credits_settle_ticket_bill.sql).
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

  const { data, error } = await admin.rpc("get_credit_spend_report");
  if (error) return jsonError(`credit_spend_report_read: ${error.message}`, 500);

  return json({ ok: true, report: data });
});

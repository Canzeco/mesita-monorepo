// Supabase Edge Function — check-web-poll-ticket (product caller: the public
// check page's live refresh)
//
// verify_jwt = FALSE — code-possession auth (see _shared/ticket-check.ts).
// THE TICKET v4 (MESITA-1090): the AUDIT-FREE read the staff poll runs while
// a ticket is open on screen. check-web-get-ticket logs a `scanned` event on
// every read, and the sliding-window limiter counts every event per ip_hash —
// so a 2-3s poll through get-ticket would deposit 30 rows a minute, hit the
// write ceiling, and rate-limit the waiter out of approving their own ticket
// (the review's NAT finding). This endpoint writes NOTHING: no event, no
// first_scanned_at, no offer resolution, no joins — one PK-shaped select,
// authenticated by the 128-bit code's entropy alone.
//
// Body:     { code: string }
// Response: { ok: true, poll: {...} } | 404 uniform miss

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { amountDueCents } from "../_shared/business-ticket-billing.ts";
import { checkNotFound, isPlausibleCheckCode } from "../_shared/ticket-check.ts";

type Body = { code?: string };

const POLL_COLUMNS =
  "id, status, updated_at, fix_requested, fix_note, approved_at, validated_at, paid_method, " +
  "bill_subtotal_cents, tip_cents, tip_pct, total_cents, discount_percent, discount_cents, " +
  "story_status, review_status";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const code = (bodyRes.body.code ?? "").toString().trim();
  if (!code || !isPlausibleCheckCode(code)) return checkNotFound(json);

  const admin = adminClient(envRes.env);
  const { data } = await admin
    .from("visit_tickets")
    .select(POLL_COLUMNS)
    .eq("check_code", code)
    .maybeSingle();
  if (!data) return checkNotFound(json);

  const t = data as {
    status: string;
    updated_at: string;
    fix_requested: string | null;
    fix_note: string | null;
    approved_at: string | null;
    validated_at: string | null;
    paid_method: string | null;
    bill_subtotal_cents: number | null;
    tip_cents: number | null;
    tip_pct: number | null;
    total_cents: number | null;
    discount_percent: number | null;
    discount_cents: number | null;
    story_status: string | null;
    review_status: string | null;
  };

  const billed = (t.total_cents ?? 0) > 0 || (t.bill_subtotal_cents ?? 0) > 0;
  // Same collapse rule as shapeCheckPayload: verified states report
  // "approved"; the verification channel itself never leaks.
  const collapse = (s: string | null): string =>
    s === "self_verified" || s === "ai_verified" || s === "staff_verified" ||
      s === "waiter_verified"
      ? "approved"
      : s ?? "none";

  return json({
    ok: true,
    poll: {
      status: t.status,
      updated_at: t.updated_at,
      fix_requested: t.fix_requested,
      fix_note: t.fix_note,
      approved_at: t.approved_at,
      validated_at: t.validated_at,
      paid_method: t.paid_method,
      bill: billed
        ? {
          bill_subtotal_cents: t.bill_subtotal_cents,
          tip_cents: t.tip_cents,
          tip_pct: t.tip_pct,
          discount_percent: t.discount_percent,
          discount_cents: t.discount_cents,
          amount_due_cents: amountDueCents({
            checkSubtotalCents: t.bill_subtotal_cents ?? 0,
            discountCents: t.discount_cents ?? 0,
            tipCents: t.tip_cents ?? 0,
          }),
        }
        : null,
      story_state: collapse(t.story_status),
      review_state: collapse(t.review_status),
    },
  });
});

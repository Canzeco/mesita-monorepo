// Supabase Edge Function — consumer-web-signin-phone
//
// Post-sign-in housekeeping for the phone-OTP consumer flow. The Supabase
// Auth call (signInWithOtp + verifyOtp) already landed a session before
// the client calls this function. Our job is to:
//
//   1. Stamp app_metadata.role = 'consumer' on first sign-in (don't clobber
//      if the user is already a staff member of some place).
//   2. Lazy-create the consumers row with sequential 8-digit code (0000-0000),
//      mirroring auth.user.phone into consumers.phone.
//
// Safe to call on every sign-in (idempotent). Returns the current role +
// consumer row so the client can refresh its session and route accordingly.
//
// Self-contained: own JWT verification, own DB writes via the service role.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import { writeConsumer } from "../_shared/consumer-doc.ts";
import {
  accountDeletedResponse,
  isDeletedConsumer,
} from "../_shared/delete-history-free.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const user = authRes.user.raw;

  // Phone is required for consumer sign-in. If the session was opened via
  // some other provider, reject — consumer auth is phone-only.
  if (!user.phone) {
    return json({ ok: false, error: "Consumer sign-in requires a phone session." }, 400);
  }

  const admin = adminClient(envRes.env);

  // Decide the role to stamp. If the user is already promoted to staff,
  // keep that; otherwise default to consumer. Never downgrade an admin/business
  // — they should never be here (different auth pools), but defence in
  // depth is cheap.
  const currentRole =
    (user.app_metadata as Record<string, unknown> | null)?.role as string | undefined;
  const allowedKeep = new Set(["staff", "business", "admin"]);
  const role = currentRole && allowedKeep.has(currentRole) ? currentRole : "consumer";

  if (role !== currentRole) {
    const stamp = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...(user.app_metadata ?? {}), role },
    });
    if (stamp.error) {
      return json({ ok: false, error: `role_stamp: ${stamp.error.message}` }, 500);
    }
  }

  const SIGNIN_SELECT =
    "id, code, full_name, first_name, last_name, phone, birthday, sex, deleted_at";

  // Lazy-create consumers row. Race: two parallel sign-ins on a brand-new
  // account can both insert — handle 23505 by reading the row back.
  const existing = await admin
    .from("consumers")
    .select(SIGNIN_SELECT)
    .eq("id", user.id)
    .maybeSingle();
  if (existing.error) {
    return json({ ok: false, error: `consumer_read: ${existing.error.message}` }, 500);
  }

  let consumerRow = existing.data;
  if (isDeletedConsumer(consumerRow)) return accountDeletedResponse();
  if (!consumerRow) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const codeResult = await admin.rpc("generate_consumer_code");
      if (codeResult.error) {
        return json({ ok: false, error: `code_gen: ${codeResult.error.message}` }, 500);
      }
      const inserted = await writeConsumer(admin, {
        mode: "insert",
        id: user.id,
        patch: { code: codeResult.data as string, phone: user.phone },
        select: SIGNIN_SELECT,
      });
      if (inserted.ok) {
        consumerRow = inserted.row as typeof consumerRow;
        break;
      }
      if (inserted.code !== "23505") {
        return json({ ok: false, error: `consumer_create: ${inserted.error}` }, 500);
      }
      // Conflict — someone else inserted concurrently. Read it back.
      const refetch = await admin
        .from("consumers")
        .select(SIGNIN_SELECT)
        .eq("id", user.id)
        .maybeSingle();
      if (refetch.data) {
        consumerRow = refetch.data;
        break;
      }
    }
  } else if (consumerRow.phone !== user.phone) {
    // Phone drifted (rare — admin manually changed auth.users.phone).
    // Re-sync.
    const sync = await writeConsumer(admin, {
      mode: "update",
      id: user.id,
      patch: { phone: user.phone },
      select: SIGNIN_SELECT,
    });
    if (!sync.ok) {
      return json({ ok: false, error: `consumer_phone_sync: ${sync.error}` }, 500);
    }
    consumerRow = sync.row as typeof consumerRow;
  }

  if (consumerRow && "deleted_at" in consumerRow) {
    delete (consumerRow as { deleted_at?: unknown }).deleted_at;
  }

  return json({
    ok: true,
    role,
    consumer: consumerRow,
    // Routing hint for post-signin. This is the BROWSE gate and nothing more
    // — the same predicate the client guards use (web
    // lib/consumer-onboarding.ts `consumerCanBrowse`, mobile lib/api/auth.ts
    // `isOnboarded`): first name + birthday + sex (MESITA-1829).
    //
    // It must stay in lock-step with the (shell) gate, in BOTH directions.
    // Too loose and a row is routed into the app and bounced straight back to
    // /onboard; too strict and a guest who is perfectly able to browse is
    // sent to re-enter data nothing is waiting on. SEX MOVED SIDES: it was
    // named here as an example of "too strict" under MESITA-1806, and is now
    // part of the gate, so this line moves with the other three or the guest
    // ping-pongs. Last name did NOT move — it is the RESERVATION's gate,
    // enforced by consumer-web-create-reservation.
    //
    // `sex` is checked against the two values the column's own constraint
    // allows rather than for mere presence — both client guards named above
    // do the same — so a legacy row holding anything else is routed to
    // /onboard to fix it instead of into the app and straight back out.
    onboarded: !!consumerRow?.first_name && !!consumerRow?.birthday &&
      (consumerRow?.sex === "male" || consumerRow?.sex === "female"),
  });
});

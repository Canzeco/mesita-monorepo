// Supabase Edge Function — consumer-web-claim-invite-code (product caller)
//
// Naming: caller-verb-words. Caller = consumer, verb = claim, words = invite
// code.
//
// Authenticated. The TRANSFERABLE invitation door (MESITA-1168). A partner —
// a modelling agency, a venue, an event — is handed a batch of 10-digit PINs
// and gives them to people Mesita has never met. The holder signs up on their
// own schedule, enters the PIN here, and the invitation door opens.
//
// This is the sibling of admin-web-grant-class, not a replacement for it:
//   grant-class          names a consumer Mesita already has (uuid/phone/handle)
//   claim-invite-code    is bearer — whoever holds the PIN redeems it
//
// Like every other door writer it persists a FACT and then defers to the shared
// recompute (_shared/class-doors.ts, MESITA-972) rather than setting the class
// slot by hand. So a PIN never demotes anyone: a subscriber who redeems a
// Diamond PIN keeps the subscription running underneath, and if the PIN's class
// ranks below a door they already hold, the slot does not move.
//
// SECURITY — the error message is deliberately the same for every rejection.
// "Unknown PIN", "already used" and "expired" as distinct replies would turn
// this endpoint into an oracle that confirms which 10-digit strings are real
// PINs. The caller learns only that the PIN did not work; the LOG keeps the
// real reason.
//
// Single-use is enforced in the DATABASE, not here: the claim is an atomic
// UPDATE ... WHERE claimed_at IS NULL (the same guard business-web-accept-invite
// uses on project_invites), so two devices racing the same PIN cannot both win.
//
// Body: { code: string }   (10 digits; spaces and dashes are stripped)
// Response: { ok: true, classKey, origin, batchLabel }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { recomputeConsumerClass } from "../_shared/class-doors.ts";

type Body = { code?: string };

type InviteRow = {
  id: string;
  class_key: string;
  batch_label: string | null;
  expires_at: string | null;
  claimed_at: string | null;
};

/** One reply for every rejection — see the SECURITY note in the header. */
const REJECTED = "That PIN didn't work. Check it and try again.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const consumerId = authRes.user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;

  // People read PINs off a card or a screenshot, so they type them with
  // spaces and dashes. Strip anything that is not a digit before validating.
  const code = String(bodyRes.body.code ?? "").replace(/\D/g, "");
  if (!/^[0-9]{10}$/.test(code)) {
    return json({ ok: false, error: "A PIN is 10 digits." }, 400);
  }

  const admin = adminClient(envRes.env);

  const found = await admin
    .from("consumer_invite_codes")
    .select("id, class_key, batch_label, expires_at, claimed_at")
    .eq("code", code)
    .maybeSingle();

  if (found.error) {
    console.error("claim_invite_code_lookup", {
      consumerId,
      error: found.error.message,
    });
    return json({ ok: false, error: "Couldn't check that PIN." }, 500);
  }

  const invite = found.data as InviteRow | null;

  // Every branch below answers REJECTED to the caller and logs the real reason.
  if (!invite) {
    console.warn("claim_invite_code_rejected", { consumerId, reason: "unknown" });
    return json({ ok: false, error: REJECTED }, 404);
  }
  if (invite.claimed_at) {
    console.warn("claim_invite_code_rejected", {
      consumerId,
      reason: "already_claimed",
      inviteId: invite.id,
    });
    return json({ ok: false, error: REJECTED }, 404);
  }
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    console.warn("claim_invite_code_rejected", {
      consumerId,
      reason: "expired",
      inviteId: invite.id,
    });
    return json({ ok: false, error: REJECTED }, 404);
  }

  // THE ATOMIC CLAIM. `.is("claimed_at", null)` makes this a compare-and-set:
  // if another request claimed the PIN between the read above and this write,
  // zero rows come back and we lose the race cleanly instead of double-granting.
  const claimed = await admin
    .from("consumer_invite_codes")
    .update({ claimed_at: new Date().toISOString(), claimed_by: consumerId })
    .eq("id", invite.id)
    .is("claimed_at", null)
    .select("id")
    .maybeSingle();

  if (claimed.error) {
    // The one-PIN-per-consumer unique index lands here when someone who has
    // already redeemed tries a second PIN. Nothing was granted, so say so
    // plainly rather than hiding it — this is not an enumeration signal.
    console.warn("claim_invite_code_claim_failed", {
      consumerId,
      inviteId: invite.id,
      error: claimed.error.message,
    });
    return json(
      { ok: false, error: "You've already used an invitation PIN." },
      409,
    );
  }
  if (!claimed.data) {
    console.warn("claim_invite_code_lost_race", { consumerId, inviteId: invite.id });
    return json({ ok: false, error: REJECTED }, 409);
  }

  // The invitation door FACT. The slot itself is settled by the recompute.
  const wrote = await admin
    .from("consumers")
    .update({
      invitation_class_key: invite.class_key,
      invitation_granted_at: new Date().toISOString(),
    })
    .eq("id", consumerId);

  if (wrote.error) {
    // Hand the PIN back rather than burning it on a grant that did not land.
    await admin
      .from("consumer_invite_codes")
      .update({ claimed_at: null, claimed_by: null })
      .eq("id", invite.id);
    console.error("claim_invite_code_grant_failed", {
      consumerId,
      inviteId: invite.id,
      error: wrote.error.message,
    });
    return json({ ok: false, error: "Couldn't apply that PIN." }, 500);
  }

  const effective = await recomputeConsumerClass(admin, consumerId);

  console.info("claim_invite_code_ok", {
    consumerId,
    inviteId: invite.id,
    classKey: invite.class_key,
    batchLabel: invite.batch_label,
    effective: effective.classKey,
  });

  return json({
    ok: true,
    classKey: effective.classKey,
    origin: effective.origin,
    batchLabel: invite.batch_label,
  });
});

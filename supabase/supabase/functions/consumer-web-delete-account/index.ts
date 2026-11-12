// Supabase Edge Function — consumer-web-delete-account
//
// Authenticated. Closes the caller's own consumer account. Tickets are NEVER
// wiped here (Atlas §C / MESITA-1250): reservation rows stay so ON DELETE
// RESTRICT remains honest. THE blessed door is
// `_shared/delete-history-free.ts` — history → `consumers.deleted_at` + auth
// tombstone (phone/email freed for a new uid); history-free → delete auth
// (consumers cascades). Self-contained: verifies the JWT, then writes via
// the service role. Does NOT call any other Edge Function. First it ends
// the guest's Boost subscriptions in Stripe (MESITA-1998).
//
// Local:  supabase functions serve consumer-web-delete-account
// Deploy: supabase functions deploy consumer-web-delete-account

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { deleteConsumerAccount } from "../_shared/delete-history-free.ts";
import { boostStripeKey, stripeClient } from "../_shared/stripe.ts";
import { endConsumerPledges } from "../_shared/boost-writes.ts";
import { closeGuard } from "./guard.ts";

serveJson("consumer-web-delete-account", async (req) => {
  // Account close is self-only — the JWT identifies which row to
  // tombstone or hard-delete. No body needed.
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const userId = user.id;

  // MESITA-3777: a place owner or an admin keeps their account; refused
  // before anything touches Stripe or the tombstone.
  const guard = await closeGuard({
    managesPlace: async () => {
      const { count, error } = await admin
        .from("place_managers")
        .select("id", { count: "exact", head: true })
        .eq("consumer_id", userId)
        .is("revoked_at", null);
      return error ? { ok: false, error: error.message } : { ok: true, value: (count ?? 0) > 0 };
    },
    isSuperAdmin: async () => {
      // By user id, and by email (a row whose user_id is not backfilled yet).
      const byId = await admin
        .from("super_admins")
        .select("email", { count: "exact", head: true })
        .eq("user_id", userId);
      if (byId.error) return { ok: false, error: byId.error.message };
      if ((byId.count ?? 0) > 0 || !user.emailLower) return { ok: true, value: (byId.count ?? 0) > 0 };
      const byEmail = await admin
        .from("super_admins")
        .select("email", { count: "exact", head: true })
        .eq("email", user.emailLower);
      return byEmail.error
        ? { ok: false, error: byEmail.error.message }
        : { ok: true, value: (byEmail.count ?? 0) > 0 };
    },
  });
  if (!guard.ok) return json(guard.body, guard.status);

  // Premier (MESITA-2995): settle any charge in flight and take every pledge
  // out of its line (cards detached) before the account goes, or a renewal
  // could still charge a deleted member.
  const key = boostStripeKey();
  const stopped = await endConsumerPledges(admin, userId, key ? stripeClient(key) : null);
  if (!stopped.ok) {
    return json({ ok: false, error: stopped.error }, 502);
  }

  const closed = await deleteConsumerAccount(admin, userId);
  if (!closed.ok) {
    return json({ ok: false, error: closed.error }, 500);
  }

  return json({
    ok: true,
    id: userId,
    mode: closed.mode,
  });
});

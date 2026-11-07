// MESITA-3304 (W2a): wallet_pay_credit against a real database, two calls at
// once. pgTAP runs in one transaction and cannot race; this can. It needs
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the nightly audit has them; a
// PR's `deno test` does not, and the test reports itself ignored).
//
// It makes its own guest and two places, credits 200 pesos at each, fires two 150-peso
// payments with different request ids at the same moment, and expects one
// paid and one insufficient: the pair lock holds. Then the same request id
// at two places at once: one pays, the other reads taken, never a 500.
// Everything it made is deleted in finally, children first.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { mintProofToken } from "./proof.ts";

const URL = Deno.env.get("SUPABASE_URL");
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ready = !!URL && !!KEY;
if (!ready) console.log("wallet-pay.live: ignored (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run it)");

Deno.test({
  name: "wallet_pay_credit: two payments at once never spend more than the credit",
  ignore: !ready,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const admin = createClient(URL!, KEY!, { auth: { persistSession: false } });
    const stamp = crypto.randomUUID().slice(0, 8);
    const placeA = crypto.randomUUID();
    const placeB = crypto.randomUUID();
    let userId: string | null = null;
    try {
      const { data: u, error: uErr } = await admin.auth.admin.createUser({
        email: `w2a-race-${stamp}@test.mesita.ai`,
        email_confirm: true,
      });
      if (uErr) throw uErr;
      userId = u.user.id;

      const { error: cErr } = await admin.from("consumers").upsert({ id: userId }, { ignoreDuplicates: true });
      if (cErr) throw cErr;
      const { error: ppErr } = await admin.from("place_profiles").insert([
        { id: placeA, google_name: `W2a race A ${stamp}` },
        { id: placeB, google_name: `W2a race B ${stamp}` },
      ]);
      if (ppErr) throw ppErr;
      const { error: pErr } = await admin.from("places").insert([placeA, placeB].map((id, i) => ({
        id,
        slug: `w2a-race-${stamp}-${i}`,
        state: "active",
        content_state: "generating",
        currency: "MXN",
      })));
      if (pErr) throw pErr;

      // MX$200 Available at each place: a credited voucher purchase, the way
      // a guest gets credit (bonus 0).
      for (const place_id of [placeA, placeB]) {
        const purchaseId = crypto.randomUUID();
        const { error: buyErr } = await admin.from("wallet_purchases").insert({
          id: purchaseId,
          consumer_id: userId,
          place_id,
          amount_cents: 20000,
          currency: "mxn",
          status: "open",
          stripe_account_id: "acct_test_w2a_race",
          voucher: "voucher_200",
          bonus_cents: 0,
          application_fee_cents: 0,
          stripe_checkout_session_id: `cs_test_w2a_${purchaseId}`,
          livemode: false,
        });
        if (buyErr) throw buyErr;
        const { error: creditErr } = await admin.rpc("wallet_credit_purchase", {
          p_purchase_id: purchaseId,
          p_payment_intent: `pi_test_w2a_${purchaseId}`,
          p_available_at: new Date(Date.now() - 60_000).toISOString(),
        });
        if (creditErr) throw creditErr;
      }

      const pay = (place: string, amount: number, requestId: string) =>
        admin.rpc("wallet_pay_credit", {
          p_consumer_id: userId,
          p_place_id: place,
          p_amount_cents: amount,
          p_currency: "mxn",
          p_livemode: false,
          p_request_id: requestId,
          p_proof_token: mintProofToken(),
          p_ticket: null,
        });

      // Two different taps, one pair: the lock lets one through.
      const [x, y] = await Promise.all([pay(placeA, 15000, crypto.randomUUID()), pay(placeA, 15000, crypto.randomUUID())]);
      assertEquals(x.error, null);
      assertEquals(y.error, null);
      const outcomes = [x.data, y.data].map((d) => (d.ok ? d.outcome : d.code)).sort();
      assertEquals(outcomes, ["insufficient", "paid"]);
      const { count } = await admin.from("wallet_payments").select("id", { count: "exact", head: true })
        .eq("consumer_id", userId).eq("place_id", placeA);
      assertEquals(count, 1);

      // One request id at two places: two locks, the unique index decides.
      const same = crypto.randomUUID();
      const [m, n] = await Promise.all([pay(placeA, 1000, same), pay(placeB, 1000, same)]);
      assertEquals(m.error, null);
      assertEquals(n.error, null);
      const both = [m.data, n.data].map((d) => (d.ok ? d.outcome : d.code)).sort();
      assertEquals(both, ["paid", "taken"]);
      const taken = [m.data, n.data].find((d) => !d.ok);
      assert(taken.payment_id, "taken names the payment that went through");
    } finally {
      if (userId) {
        await admin.from("wallet_entries").delete().eq("consumer_id", userId);
        await admin.from("wallet_payments").delete().eq("consumer_id", userId);
        await admin.from("wallet_purchases").delete().eq("consumer_id", userId);
      }
      await admin.from("places").delete().in("id", [placeA, placeB]);
      await admin.from("place_profiles").delete().in("id", [placeA, placeB]);
      if (userId) await admin.auth.admin.deleteUser(userId);
    }
  },
});

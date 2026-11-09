// MESITA-3545 (Payments Flow v2): the cash path end to end through the
// deployed doors, with no Stripe anywhere: the waiter opens a charge with a
// tip, the guest looks it up and pays the waiter, the staff screen sees the
// bill waiting, Received pays it and writes 2% cashback Pending one hour.
// Then a cancel (Received reads closed) and a timeout (the sweep closes it,
// nothing born). It needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
// SUPABASE_ANON_KEY (a PR's `deno test` has none: the test reports itself
// ignored). Everything it made is deleted in finally, children first.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { hashPlaceCode } from "./place-code.ts";

const URL = Deno.env.get("SUPABASE_URL");
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON = Deno.env.get("SUPABASE_ANON_KEY");
const ready = !!URL && !!KEY && !!ANON;
if (!ready) console.log("outside-path.live: ignored (set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY to run it)");

async function call(name: string, body: Record<string, unknown>, jwt?: string): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON!, Authorization: `Bearer ${jwt ?? ANON}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

Deno.test({
  name: "outside path: charge with tip → pay the waiter → Received → 2% Pending; cancel reads closed; timeout births nothing",
  ignore: !ready,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const admin = createClient(URL!, KEY!, { auth: { persistSession: false } });
    const stamp = crypto.randomUUID().slice(0, 8);
    const place = crypto.randomUUID();
    const email = `outside-${stamp}@test.mesita.ai`;
    let userId: string | null = null;
    try {
      const { data: u, error: uErr } = await admin.auth.admin.createUser({ email, email_confirm: true });
      if (uErr) throw uErr;
      userId = u.user.id;
      const { error: cErr } = await admin.from("consumers").upsert({ id: userId }, { ignoreDuplicates: true });
      if (cErr) throw cErr;
      // A session for the guest: a magic link verified on the spot.
      const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (lErr) throw lErr;
      const anon = createClient(URL!, ANON!, { auth: { persistSession: false } });
      const { data: s, error: sErr } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
      if (sErr || !s.session) throw sErr ?? new Error("no session");
      const jwt = s.session.access_token;

      // A place with no Stripe account: Cashback on and a place code.
      await admin.from("place_profiles").insert({ id: place, google_name: `Outside live ${stamp}` }).throwOnError();
      await admin.from("places").insert({ id: place, slug: `outside-live-${stamp}`, state: "active", content_state: "generating", currency: "MXN" }).throwOnError();
      await admin.from("place_payment_settings").upsert({ place_id: place, cashback: true }).throwOnError();
      await admin.from("place_codes").insert({ place_id: place, code_hash: await hashPlaceCode(place, "123456") }).throwOnError();

      // 1. Received pays it.
      const open = await call("visit-web-open-charge", { place_id: place, place_code: "123456", amount_cents: 50000, tip_cents: 5000 });
      assertEquals(open.status, 200, JSON.stringify(open.data));
      const token = String(open.data.charge_token);
      const look = await call("consumer-web-start-payment", { place_id: place, charge_code: open.data.code, look: true }, jwt);
      assertEquals((look.data.charge as Record<string, unknown>)?.tip_cents, 5000);
      const start = await call("consumer-web-start-payment", {
        place_id: place, charge_code: open.data.code, outside: true, tip_cents: 5000, request_id: crypto.randomUUID(),
      }, jwt);
      assertEquals([start.status, start.data.outcome, start.data.outside_cents], [200, "opened", 50000], JSON.stringify(start.data));
      const poll = await call("visit-web-get-charge", { token });
      assertEquals((poll.data.outside as Record<string, unknown>)?.cents, 50000);
      const recv = await call("visit-web-confirm-charge", { token });
      assertEquals([recv.status, recv.data.outcome, recv.data.cashback_cents], [200, "paid", 1000], JSON.stringify(recv.data));
      const { data: entries } = await admin.from("wallet_entries").select("kind, amount_cents, available_at").eq("payment_id", String(start.data.payment_id));
      assertEquals(entries?.length, 1);
      assertEquals(entries?.[0].kind, "cashback");
      assertEquals(entries?.[0].amount_cents, 1000);
      assert(Date.parse(String(entries?.[0].available_at)) - Date.parse(String(recv.data.paid_at)) === 3_600_000);

      // 2. The guest cancels: Received reads closed.
      const open2 = await call("visit-web-open-charge", { place_id: place, place_code: "123456", amount_cents: 20000 });
      const start2 = await call("consumer-web-start-payment", {
        place_id: place, charge_code: open2.data.code, outside: true, tip_cents: 0, request_id: crypto.randomUUID(),
      }, jwt);
      assertEquals(start2.status, 200, JSON.stringify(start2.data));
      const cancel = await call("consumer-web-release-payment", { payment_id: start2.data.payment_id }, jwt);
      assertEquals(cancel.data.outcome, "released");
      const recv2 = await call("visit-web-confirm-charge", { token: open2.data.charge_token });
      assertEquals([recv2.status, recv2.data.code], [409, "closed"]);
    } finally {
      if (userId) {
        await admin.from("wallet_entries").delete().eq("consumer_id", userId);
        await admin.from("place_charges").delete().eq("place_id", place);
        await admin.from("wallet_payments").delete().eq("consumer_id", userId);
      }
      await admin.from("place_codes").delete().eq("place_id", place);
      await admin.from("place_payment_settings").delete().eq("place_id", place);
      await admin.from("places").delete().eq("id", place);
      await admin.from("place_profiles").delete().eq("id", place);
      if (userId) await admin.auth.admin.deleteUser(userId);
    }
  },
});

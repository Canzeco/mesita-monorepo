// MESITA-3305 — the settle cron's bounds: a 60-row fixture drains in two
// ticks, nothing starts past the deadline, the 49th tick gives up, a
// Stripe 404 gives up at once, a stale `opening` row is failed, and the
// config overrides the defaults.

import { assertEquals } from "jsr:@std/assert@1";
import { type BatchRow, runSettleTick, SETTLE_DEFAULTS, settleConfigFrom, settleRow } from "./settle-cron.ts";
import { fakeAdmin } from "./testing/fake-admin.ts";
import { type StripeCall, StripeError } from "./stripe.ts";

const T0 = Date.parse("2026-11-08T12:00:00Z");

function row(i: number, over: Partial<BatchRow> = {}): BatchRow {
  return {
    kind: i % 2 === 0 ? "payment" : "purchase",
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    consumer_id: "c",
    place_id: "p",
    stripe_checkout_session_id: `cs_${i}`,
    stripe_account_id: "acct_place",
    created_at: new Date(T0 - 60_000).toISOString(),
    expires_at: null,
    settle_tries: 1,
    status: "open",
    voucher: i % 2 === 0 ? null : "voucher_200",
    livemode: false,
    ...over,
  };
}

const paidStripe: StripeCall = (_m, path) => {
  const sessionId = path.split("/").pop() ?? "";
  const idx = Number(sessionId.replace("cs_", ""));
  const key = idx % 2 === 0 ? "payment_id" : "purchase_id";
  return Promise.resolve({ metadata: { [key]: row(idx).id }, payment_status: "paid", payment_intent: `pi_${idx}` });
};

Deno.test("config: defaults stand in for a missing or bad key; a valid key overrides", () => {
  assertEquals(settleConfigFrom(null), SETTLE_DEFAULTS);
  assertEquals(settleConfigFrom({ buying_paused: true, settle_rows: "many", settle_concurrency: 0 }), SETTLE_DEFAULTS);
  assertEquals(settleConfigFrom({ settle_rows: 10, settle_deadline_ms: 1000 }), { ...SETTLE_DEFAULTS, settle_rows: 10, settle_deadline_ms: 1000 });
});

Deno.test("a 60-row fixture drains in two ticks of 50 and 10; every row settled once", async () => {
  let open = Array.from({ length: 60 }, (_, i) => row(i + 1));
  const settled: string[] = [];
  const fake = fakeAdmin({
    rpc: (name, args) => {
      if (name === "wallet_settle_batch") {
        const take = open.slice(0, Number(args.p_limit));
        open = open.slice(take.length);
        return { data: take };
      }
      if (name === "wallet_settle_payment") settled.push(String(args.p_payment_id));
      if (name === "wallet_credit_purchase") settled.push(String(args.p_purchase_id));
      if (name === "place_charges_sweep") return { data: 0 };
      return { data: { ok: true, outcome: name === "wallet_credit_purchase" ? "credited" : "paid" } };
    },
    table: () => ({ data: null, count: 0 }),
  });
  const deps = { admin: fake.client, stripe: paidStripe, livemode: false, now: () => T0 };
  const first = await runSettleTick(deps, SETTLE_DEFAULTS);
  assertEquals(first.rows, 50);
  assertEquals(first.outcomes.paid + first.outcomes.credited, 50);
  const second = await runSettleTick(deps, SETTLE_DEFAULTS);
  assertEquals(second.rows, 10);
  assertEquals(second.outcomes.paid + second.outcomes.credited, 10);
  assertEquals(new Set(settled).size, 60);
  const third = await runSettleTick(deps, SETTLE_DEFAULTS);
  assertEquals(third.rows, 0);
});

Deno.test("no row starts past the deadline; those left are counted, not touched", async () => {
  let clock = T0;
  const fake = fakeAdmin({
    rpc: (name) => {
      if (name === "wallet_settle_batch") return { data: Array.from({ length: 6 }, (_, i) => row(i + 1)) };
      if (name === "place_charges_sweep") return { data: 0 };
      return { data: { ok: true, outcome: "paid" } };
    },
    table: () => ({ data: null, count: 0 }),
  });
  // Each Stripe read costs 400 ms of the 1 000 ms deadline; one worker.
  const slowStripe: StripeCall = (m, p, a, o) => {
    clock += 400;
    return paidStripe(m, p, a, o);
  };
  const r = await runSettleTick({ admin: fake.client, stripe: slowStripe, livemode: false, now: () => clock }, { ...SETTLE_DEFAULTS, settle_concurrency: 1, settle_deadline_ms: 1000 });
  assertEquals(r.rows, 6);
  assertEquals(r.outcomes.skipped_deadline > 0, true);
  assertEquals(r.outcomes.skipped_deadline + r.outcomes.paid + r.outcomes.credited, 6);
});

Deno.test("the 49th tick gives up: needs_review with give_up, Stripe not asked", async () => {
  const fake = fakeAdmin({});
  const deps = { admin: fake.client, stripe: () => Promise.reject(new Error("not asked")), livemode: false, now: () => T0 };
  assertEquals(await settleRow(deps, SETTLE_DEFAULTS, row(2, { settle_tries: 49 })), "needs_review");
  assertEquals(fake.rpcs, [{ name: "wallet_give_up", args: { p_kind: "payment", p_row_id: row(2).id, p_error: "give_up" } }]);
  // The 48th still reads.
  const fake2 = fakeAdmin({ rpc: () => ({ data: { ok: true, outcome: "paid" } }) });
  assertEquals(await settleRow({ ...deps, admin: fake2.client, stripe: paidStripe }, SETTLE_DEFAULTS, row(2, { settle_tries: 48 })), "paid");
});

Deno.test("a Stripe 404 gives up at once with Stripe's code; any other Stripe error stays open for the next tick", async () => {
  const gone: StripeCall = () => Promise.reject(new StripeError("checkout/sessions/cs_x", "invalid_request_error", "resource_missing", 404, "No such checkout.session"));
  const fake = fakeAdmin({});
  assertEquals(await settleRow({ admin: fake.client, stripe: gone, livemode: false, now: () => T0 }, SETTLE_DEFAULTS, row(3)), "needs_review");
  assertEquals(fake.rpcs[0], { name: "wallet_give_up", args: { p_kind: "purchase", p_row_id: row(3).id, p_error: "resource_missing" } });

  const down: StripeCall = () => Promise.reject(new StripeError("checkout/sessions/cs_x", "api_error", "", 503, "down"));
  const fake2 = fakeAdmin({
    rpc: (name) => name === "wallet_settle_batch" ? { data: [row(4)] } : name === "place_charges_sweep" ? { data: 0 } : { data: { ok: true } },
    table: () => ({ data: null, count: 0 }),
  });
  const r = await runSettleTick({ admin: fake2.client, stripe: down, livemode: false, now: () => T0 }, SETTLE_DEFAULTS);
  assertEquals(r.outcomes.error, 1);
  assertEquals(fake2.rpcs.filter((x) => x.name === "wallet_give_up").length, 0);
});

Deno.test("an opening row older than 10 minutes never got its Checkout: failed, no Stripe read", async () => {
  const fake = fakeAdmin({});
  const deps = { admin: fake.client, stripe: () => Promise.reject(new Error("not asked")), livemode: false, now: () => T0 };
  const stale = row(2, { status: "opening", stripe_checkout_session_id: null, created_at: new Date(T0 - 11 * 60_000).toISOString() });
  assertEquals(await settleRow(deps, SETTLE_DEFAULTS, stale), "failed_stale");
  assertEquals(fake.rpcs, [{ name: "wallet_release_payment", args: { p_payment_id: stale.id, p_status: "failed", p_error: "no_session" } }]);
  // A young opening row is left alone.
  const young = row(2, { status: "opening", stripe_checkout_session_id: null, created_at: new Date(T0 - 60_000).toISOString() });
  assertEquals(await settleRow(deps, SETTLE_DEFAULTS, young), "pending");
});

Deno.test("an expired session releases a payment's hold once and ends a purchase", async () => {
  const expired: StripeCall = (_m, path) => {
    const idx = Number((path.split("/").pop() ?? "").replace("cs_", ""));
    return Promise.resolve({ metadata: { [idx % 2 === 0 ? "payment_id" : "purchase_id"]: row(idx).id }, status: "expired", payment_status: "unpaid" });
  };
  const fake = fakeAdmin({ table: () => ({ data: null }) });
  const deps = { admin: fake.client, stripe: expired, livemode: false, now: () => T0 };
  assertEquals(await settleRow(deps, SETTLE_DEFAULTS, row(2)), "expired");
  assertEquals(fake.rpcs, [{ name: "wallet_release_payment", args: { p_payment_id: row(2).id, p_status: "expired", p_error: null } }]);
  assertEquals(await settleRow(deps, SETTLE_DEFAULTS, row(3)), "expired");
  const upd = fake.ops.find((o) => o.table === "wallet_purchases" && o.kind === "update");
  assertEquals((upd?.payload as { status: string }).status, "expired");
});

Deno.test("the tick sweeps the waiter's charges and reports the needs_review count", async () => {
  const fake = fakeAdmin({
    rpc: (name) => name === "wallet_settle_batch" ? { data: [] } : name === "place_charges_sweep" ? { data: 3 } : { data: { ok: true } },
    table: (op) => ({ data: null, count: op.table === "wallet_payments" ? 2 : 1 }),
  });
  const r = await runSettleTick({ admin: fake.client, stripe: paidStripe, livemode: false, now: () => T0 }, SETTLE_DEFAULTS);
  assertEquals(r.charges_swept, 3);
  assertEquals(r.needs_review_total, 3);
});

// ── An in-app card part settles by its PaymentIntent (MESITA-3568) ─────────

function piRow(createdAgoMs: number): BatchRow {
  return row(2, { stripe_checkout_session_id: null, created_at: new Date(T0 - createdAgoMs).toISOString() });
}

function piAdmin(rpcs: string[]) {
  return fakeAdmin({
    rpc: (name, args) => {
      rpcs.push(`${name}:${String(args.p_status ?? args.p_payment_intent ?? "")}`);
      return { data: { ok: true, outcome: name === "wallet_settle_payment" ? "paid" : "released" } };
    },
    table: (op) => op.table === "wallet_payments" ? { data: { stripe_payment_intent_id: "pi_tab" } } : { data: null },
  }).client;
}

Deno.test("pi: a succeeded PaymentIntent settles, even long past its ten minutes; never fails", async () => {
  const rpcs: string[] = [];
  const stripe: StripeCall = (method, path) => {
    assertEquals([method, path], ["GET", "payment_intents/pi_tab"]);
    return Promise.resolve({ id: "pi_tab", status: "succeeded", metadata: { payment_id: row(2).id } });
  };
  const out = await settleRow({ admin: piAdmin(rpcs), stripe, livemode: false, now: () => T0 }, SETTLE_DEFAULTS, piRow(60 * 60_000));
  assertEquals(out, "paid");
  assertEquals(rpcs, ["wallet_settle_payment:pi_tab"]);
});

Deno.test("pi: requires_action inside ten minutes waits; past them it is cancelled first, then released", async () => {
  const calls: string[] = [];
  const stripe: StripeCall = (method, path) => {
    calls.push(`${method} ${path}`);
    return Promise.resolve({ id: "pi_tab", status: method === "POST" ? "canceled" : "requires_action", metadata: { payment_id: row(2).id } });
  };
  const young: string[] = [];
  assertEquals(await settleRow({ admin: piAdmin(young), stripe, livemode: false, now: () => T0 }, SETTLE_DEFAULTS, piRow(5 * 60_000)), "pending");
  assertEquals(young, []);
  const old: string[] = [];
  assertEquals(await settleRow({ admin: piAdmin(old), stripe, livemode: false, now: () => T0 }, SETTLE_DEFAULTS, piRow(11 * 60_000)), "expired");
  assertEquals(calls.slice(-2), ["GET payment_intents/pi_tab", "POST payment_intents/pi_tab/cancel"]);
  assertEquals(old, ["wallet_release_payment:failed"]);
});

Deno.test("pi: a cancel refused because the PI just succeeded settles instead", async () => {
  const rpcs: string[] = [];
  let reads = 0;
  const stripe: StripeCall = (method) => {
    if (method === "POST") return Promise.reject(new StripeError("payment_intents/pi_tab/cancel", "invalid_request_error", "payment_intent_unexpected_state", 400, "succeeded"));
    reads++;
    return Promise.resolve({ id: "pi_tab", status: reads === 1 ? "requires_action" : "succeeded", metadata: { payment_id: row(2).id } });
  };
  assertEquals(await settleRow({ admin: piAdmin(rpcs), stripe, livemode: false, now: () => T0 }, SETTLE_DEFAULTS, piRow(20 * 60_000)), "paid");
  assertEquals(rpcs, ["wallet_settle_payment:pi_tab"]);
});

// MESITA-3305 — the Connect receiver's rules: the signature gate, the
// replay guard, and one fixture per event and per failure class. The
// database and Stripe are fakes; the RPCs' own arithmetic is pgTAP's
// (wallet_card.test.sql).

import { assertEquals } from "jsr:@std/assert@1";
import type { StripeCall } from "./boost.ts";
import {
  type ConnectEvent,
  handleConnectEvent,
  parseSignatureHeader,
  signPayload,
  verifyStripeSignature,
} from "./connect-events.ts";
import { type FakeOp, fakeAdmin, type FakeResult } from "./testing/fake-admin.ts";

const SECRET = "whsec_test_3305";
const ACCT = "acct_place_3305";
const PLACE = "00000000-0000-4000-8000-0000000a3305";
const PAYMENT = "00000000-0000-4000-8000-0000000b3305";
const PURCHASE = "00000000-0000-4000-8000-0000000c3305";

const noStripe: StripeCall = () => Promise.reject(new Error("no stripe call expected"));

function event(type: string, object: Record<string, unknown>, extra: Partial<ConnectEvent> = {}): ConnectEvent {
  return { id: `evt_${type}_${Math.random().toString(36).slice(2, 8)}`, type, account: ACCT, livemode: false, created: 1_800_000_000, data: { object }, ...extra };
}

// ── The signature ──────────────────────────────────────────────────────────

Deno.test("signature: Stripe's own scheme verifies, a wrong secret or a mangled header does not", async () => {
  const raw = JSON.stringify({ id: "evt_1", type: "account.updated" });
  const header = await signPayload(SECRET, raw, 1_000);
  assertEquals(parseSignatureHeader(header)?.t, 1_000);
  assertEquals(await verifyStripeSignature(raw, header, SECRET, 1_100), { ok: true });
  assertEquals(await verifyStripeSignature(raw, header, "whsec_other", 1_100), { ok: false, code: "bad_signature" });
  assertEquals(await verifyStripeSignature(raw + " ", header, SECRET, 1_100), { ok: false, code: "bad_signature" });
  assertEquals(await verifyStripeSignature(raw, null, SECRET, 1_100), { ok: false, code: "bad_signature" });
  assertEquals(await verifyStripeSignature(raw, "t=abc,v1=zz", SECRET, 1_100), { ok: false, code: "bad_signature" });
});

Deno.test("signature: a good signature older than 300 s is stale_event, within it is fine either way", async () => {
  const raw = "{}";
  const header = await signPayload(SECRET, raw, 10_000);
  assertEquals(await verifyStripeSignature(raw, header, SECRET, 10_301), { ok: false, code: "stale_event" });
  assertEquals(await verifyStripeSignature(raw, header, SECRET, 10_300), { ok: true });
  assertEquals(await verifyStripeSignature(raw, header, SECRET, 9_700), { ok: true });
});

// ── The guards before any work ─────────────────────────────────────────────

function accountTable(known: boolean, lastEvent: number | null = null) {
  return (op: FakeOp): FakeResult => {
    if (op.table === "place_payment_accounts" && op.kind === "select") {
      return { data: known ? { place_id: PLACE, stripe_account_id: ACCT, livemode: false, last_event_created: lastEvent } : null };
    }
    return { data: null };
  };
}

Deno.test("an event from the other Stripe universe is acknowledged and ignored before any read", async () => {
  const fake = fakeAdmin({ table: accountTable(true) });
  const r = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, event("checkout.session.completed", {}, { livemode: true }));
  assertEquals(r, { status: 200, body: { ok: true, ignored: "livemode" } });
  assertEquals(fake.ops.length, 0);
});

Deno.test("an unknown account is acknowledged and ignored; nothing is inserted", async () => {
  const fake = fakeAdmin({ table: accountTable(false) });
  const r = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, event("checkout.session.completed", { id: "cs_1" }));
  assertEquals(r.body.ignored, "unknown_account");
  assertEquals(fake.ops.filter((o) => o.table === "stripe_connect_events").length, 0);
});

Deno.test("a replayed event id is a duplicate insert: 200 ignored replay, no RPC", async () => {
  const fake = fakeAdmin({
    table: (op) => {
      if (op.table === "stripe_connect_events" && op.kind === "insert") return { error: { code: "23505", message: "duplicate key" } };
      return accountTable(true)(op);
    },
  });
  const r = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, event("checkout.session.completed", { id: "cs_1", metadata: { payment_id: PAYMENT }, payment_status: "paid" }));
  assertEquals(r, { status: 200, body: { ok: true, ignored: "replay" } });
  assertEquals(fake.rpcs, []);
});

// ── checkout.session.completed ─────────────────────────────────────────────

Deno.test("completed: metadata names the payment → wallet_settle_payment once, the event row is marked processed", async () => {
  const fake = fakeAdmin({
    table: accountTable(true),
    rpc: (name) => ({ data: name === "wallet_settle_payment" ? { ok: true, outcome: "paid" } : { ok: true } }),
  });
  const e = event("checkout.session.completed", { id: "cs_1", metadata: { payment_id: PAYMENT }, payment_status: "paid", payment_intent: "pi_1" });
  const r = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, e);
  assertEquals(r, { status: 200, body: { ok: true, payment_id: PAYMENT, outcome: "paid" } });
  assertEquals(fake.rpcs, [{ name: "wallet_settle_payment", args: { p_payment_id: PAYMENT, p_payment_intent: "pi_1" } }]);
  const done = fake.ops.find((o) => o.table === "stripe_connect_events" && o.kind === "update");
  assertEquals(typeof (done?.payload as { processed_at?: unknown })?.processed_at, "string");
  assertEquals(done?.filters, { id: e.id });
});

Deno.test("completed: a voucher purchase is credited with its hour from the event's time", async () => {
  const fake = fakeAdmin({
    table: accountTable(true),
    rpc: () => ({ data: { ok: true, outcome: "credited" } }),
  });
  const r = await handleConnectEvent(
    { admin: fake.client, stripe: noStripe, livemode: false },
    event("checkout.session.completed", { id: "cs_2", metadata: { purchase_id: PURCHASE, voucher: "voucher_200" }, payment_status: "paid", payment_intent: "pi_2" }),
  );
  assertEquals(r.body, { ok: true, purchase_id: PURCHASE, outcome: "credited" });
  assertEquals(fake.rpcs[0].name, "wallet_credit_purchase");
  assertEquals(fake.rpcs[0].args.p_available_at, new Date((1_800_000_000 + 3600) * 1000).toISOString());
});

Deno.test("completed before the session id is stored: metadata is missing, the session id finds the row", async () => {
  const fake = fakeAdmin({
    table: (op) => {
      if (op.table === "wallet_payments" && op.kind === "select" && op.filters.stripe_checkout_session_id === "cs_3") return { data: { id: PAYMENT } };
      if (op.table === "wallet_purchases" && op.kind === "select") return { data: null };
      return accountTable(true)(op);
    },
    rpc: () => ({ data: { ok: true, outcome: "paid" } }),
  });
  const r = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, event("checkout.session.completed", { id: "cs_3", payment_status: "paid" }));
  assertEquals(r.body, { ok: true, payment_id: PAYMENT, outcome: "paid" });
});

Deno.test("completed on a known account with a session no row names answers 5xx and forgets the event, so Stripe retries", async () => {
  const fake = fakeAdmin({
    table: (op) => (op.table === "wallet_payments" || op.table === "wallet_purchases") ? { data: null } : accountTable(true)(op),
  });
  const e = event("checkout.session.completed", { id: "cs_none", payment_status: "paid" });
  const r = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, e);
  assertEquals(r.status, 500);
  assertEquals(r.body.code, "settle_failed");
  assertEquals(r.body.event_id, e.id);
  assertEquals(r.body.account, ACCT);
  const forgot = fake.ops.find((o) => o.table === "stripe_connect_events" && o.kind === "delete");
  assertEquals(forgot?.filters, { id: e.id });
});

Deno.test("an RPC that throws answers 500 and forgets the event; the same event again runs the work once", async () => {
  let fail = true;
  const fake = fakeAdmin({
    table: accountTable(true),
    rpc: () => fail ? { error: { message: "deadlock detected" } } : { data: { ok: true, outcome: "paid" } },
  });
  const e = event("checkout.session.completed", { id: "cs_4", metadata: { payment_id: PAYMENT }, payment_status: "paid" });
  const first = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, e);
  assertEquals(first.status, 500);
  assertEquals(fake.ops.filter((o) => o.table === "stripe_connect_events" && o.kind === "delete").length, 1);
  fail = false;
  const second = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, e);
  assertEquals(second.status, 200);
  assertEquals(fake.rpcs.filter((r) => r.name === "wallet_settle_payment").length, 2);
});

Deno.test("completed but unpaid credits nothing", async () => {
  const fake = fakeAdmin({ table: accountTable(true) });
  const r = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, event("checkout.session.completed", { id: "cs_5", metadata: { payment_id: PAYMENT }, payment_status: "unpaid" }));
  assertEquals(r.body.ignored, "unpaid");
  assertEquals(fake.rpcs, []);
});

// ── checkout.session.expired ───────────────────────────────────────────────

Deno.test("expired: a payment's hold is released through wallet_release_payment; a purchase is closed", async () => {
  const fake = fakeAdmin({ table: accountTable(true) });
  const r = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, event("checkout.session.expired", { id: "cs_6", metadata: { payment_id: PAYMENT } }));
  assertEquals(r.body, { ok: true, payment_id: PAYMENT, outcome: "expired" });
  assertEquals(fake.rpcs, [{ name: "wallet_release_payment", args: { p_payment_id: PAYMENT, p_status: "expired", p_error: null } }]);

  const fake2 = fakeAdmin({ table: accountTable(true) });
  await handleConnectEvent({ admin: fake2.client, stripe: noStripe, livemode: false }, event("checkout.session.expired", { id: "cs_7", metadata: { purchase_id: PURCHASE } }));
  const upd = fake2.ops.find((o) => o.table === "wallet_purchases" && o.kind === "update");
  assertEquals((upd?.payload as { status: string }).status, "expired");
  assertEquals(upd?.filters["status:in"], ["opening", "open"]);
});

// ── charge.refunded ────────────────────────────────────────────────────────

Deno.test("refunded: two partial refunds in reverse order each hand Stripe's cumulative amount to the RPC; no application fee is read (MESITA-3461)", async () => {
  const feeReads: string[] = [];
  const stripe: StripeCall = (_m, path) => {
    feeReads.push(path);
    return Promise.resolve({});
  };
  const fake = fakeAdmin({
    table: (op) => {
      if (op.table === "wallet_payments" && op.kind === "select" && op.filters.stripe_payment_intent_id === "pi_9") return { data: { id: PAYMENT } };
      if (op.table === "wallet_purchases" && op.kind === "select") return { data: null };
      return accountTable(true)(op);
    },
    rpc: (name) => ({ data: name === "wallet_refund_payment" ? { ok: true, outcome: "applied", status: "partly_refunded" } : { ok: true } }),
  });
  const deps = { admin: fake.client, stripe, livemode: false };
  // The later refund (cumulative 300) arrives first, then the earlier one (cumulative 100).
  await handleConnectEvent(deps, event("charge.refunded", { id: "ch_1", payment_intent: "pi_9", amount_refunded: 300, application_fee: "fee_1" }));
  await handleConnectEvent(deps, event("charge.refunded", { id: "ch_1", payment_intent: "pi_9", amount_refunded: 100, application_fee: "fee_1" }));
  const refunds = fake.rpcs.filter((r) => r.name === "wallet_refund_payment").map((r) => r.args.p_amount_refunded);
  assertEquals(refunds, [300, 100]);
  assertEquals(fake.rpcs.some((r) => r.name === "wallet_note_fee_refund"), false);
  assertEquals(feeReads, []);
});

Deno.test("refunded: a charge no row names is acknowledged and ignored", async () => {
  const fake = fakeAdmin({ table: (op) => (op.table === "wallet_payments" || op.table === "wallet_purchases") ? { data: null } : accountTable(true)(op) });
  const r = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, event("charge.refunded", { id: "ch_2", payment_intent: "pi_x", amount_refunded: 5 }));
  assertEquals(r.body.ignored, "unknown_charge");
});

// ── account.updated ────────────────────────────────────────────────────────

Deno.test("account.updated out of order: the newer event writes the snapshot, an older one after it is ignored", async () => {
  let last: number | null = null;
  const fake = fakeAdmin({
    table: (op) => {
      if (op.table === "place_payment_accounts" && op.kind === "update") {
        last = (op.payload as { last_event_created: number }).last_event_created;
        return { data: null };
      }
      return accountTable(true, last)(op);
    },
  });
  const deps = { admin: fake.client, stripe: noStripe, livemode: false };
  const newer = await handleConnectEvent(deps, event("account.updated", { id: ACCT, charges_enabled: true, details_submitted: true, payouts_enabled: false, country: "MX", requirements: { currently_due: ["x"] } }, { created: 2_000 }));
  assertEquals(newer.body.outcome, "account_updated");
  const upd = fake.ops.find((o) => o.table === "place_payment_accounts" && o.kind === "update");
  const payload = upd?.payload as Record<string, unknown>;
  assertEquals(payload.charges_enabled, true);
  assertEquals(payload.requirements_due, ["x"]);
  assertEquals(payload.account_country, "MX");
  assertEquals("livemode" in payload, false);
  assertEquals(upd?.filters, { stripe_account_id: ACCT });
  const older = await handleConnectEvent(deps, event("account.updated", { id: ACCT, charges_enabled: false }, { created: 1_500 }));
  assertEquals(older.body.ignored, "stale_account_event");
  assertEquals(fake.ops.filter((o) => o.table === "place_payment_accounts" && o.kind === "update").length, 1);
});

Deno.test("an event type outside the handled ones is acknowledged and ignored", async () => {
  const fake = fakeAdmin({ table: accountTable(true) });
  const r = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, event("charge.dispute.funds_withdrawn", {}));
  assertEquals(r.body.ignored, "unhandled");
});

// ── charge.dispute.* (MESITA-3460) ─────────────────────────────────────────

/** A fake Stripe on the place's account: the charge's current state, and
 *  the disputes listed on it. Every call must name the connected account. */
function disputeStripe(charge: Record<string, unknown>, disputes: Record<string, unknown>[] = [], calls: string[] = []): StripeCall {
  return (_m, path, _p, opts) => {
    calls.push(path);
    assertEquals(opts?.stripeAccount, ACCT);
    if (path.startsWith("charges/")) return Promise.resolve(charge);
    if (path === "disputes") return Promise.resolve({ data: disputes });
    return Promise.reject(new Error(`unexpected ${path}`));
  };
}

/** The ledger: pi_d is the payment, pi_v the voucher purchase. */
function ledgerTable(op: FakeOp): FakeResult {
  if (op.table === "wallet_payments" && op.kind === "select") return { data: op.filters.stripe_payment_intent_id === "pi_d" ? { id: PAYMENT } : null };
  if (op.table === "wallet_purchases" && op.kind === "select") return { data: op.filters.stripe_payment_intent_id === "pi_v" ? { id: PURCHASE } : null };
  return accountTable(true)(op);
}

const refundOk = () => ({ data: { ok: true, outcome: "applied", status: "refunded" } });

function dispute(status: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: "dp_1", object: "dispute", charge: "ch_d", payment_intent: "pi_d", amount: 10000, status, ...extra };
}

for (const [type, status] of [["charge.dispute.created", "needs_response"], ["charge.dispute.closed", "won"], ["charge.dispute.closed", "warning_closed"]]) {
  Deno.test(`dispute: ${type} ${status} logs only; no Stripe read, no RPC`, async () => {
    const fake = fakeAdmin({ table: ledgerTable, rpc: refundOk });
    const r = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, event(type, dispute(status)));
    assertEquals(r, { status: 200, body: { ok: true, outcome: "dispute_logged", dispute_status: status } });
    assertEquals(fake.rpcs, []);
  });
}

Deno.test("dispute: lost on a payment reads the charge on the place's account and refunds the whole charge as dispute_lost", async () => {
  const calls: string[] = [];
  const fake = fakeAdmin({ table: ledgerTable, rpc: refundOk });
  const stripe = disputeStripe({ id: "ch_d", amount: 10000, amount_refunded: 0, payment_intent: "pi_d" }, [], calls);
  const r = await handleConnectEvent({ admin: fake.client, stripe, livemode: false }, event("charge.dispute.closed", dispute("lost")));
  assertEquals(r, { status: 200, body: { ok: true, payment_id: PAYMENT, outcome: "applied", status: "refunded", reason: "dispute_lost" } });
  assertEquals(calls, ["charges/ch_d"]);
  assertEquals(fake.rpcs, [{ name: "wallet_refund_payment", args: { p_payment_id: PAYMENT, p_amount_refunded: 10000, p_reason: "dispute_lost" } }]);
});

Deno.test("dispute: lost on a voucher purchase goes to wallet_refund_purchase", async () => {
  const fake = fakeAdmin({ table: ledgerTable, rpc: refundOk });
  const stripe = disputeStripe({ id: "ch_v", amount: 20000, amount_refunded: 0, payment_intent: "pi_v" });
  const r = await handleConnectEvent({ admin: fake.client, stripe, livemode: false }, event("charge.dispute.closed", dispute("lost", { charge: "ch_v", payment_intent: "pi_v", amount: 20000 })));
  assertEquals(r.body.purchase_id, PURCHASE);
  assertEquals(fake.rpcs, [{ name: "wallet_refund_purchase", args: { p_purchase_id: PURCHASE, p_amount_refunded: 20000, p_reason: "dispute_lost" } }]);
});

Deno.test("dispute: lost after a partial refund adds the disputed amount to Stripe's current amount_refunded, capped at the charge", async () => {
  const fake = fakeAdmin({ table: ledgerTable, rpc: refundOk });
  // MX$30 refunded already; the dispute is for the MX$70 left.
  const stripe = disputeStripe({ id: "ch_d", amount: 10000, amount_refunded: 3000, payment_intent: "pi_d" });
  await handleConnectEvent({ admin: fake.client, stripe, livemode: false }, event("charge.dispute.closed", dispute("lost", { amount: 7000 })));
  assertEquals(fake.rpcs[0].args.p_amount_refunded, 10000);
  // A dispute that names the full amount after a refund never passes the charge.
  const fake2 = fakeAdmin({ table: ledgerTable, rpc: refundOk });
  await handleConnectEvent({ admin: fake2.client, stripe, livemode: false }, event("charge.dispute.closed", dispute("lost", { amount: 10000 })));
  assertEquals(fake2.rpcs[0].args.p_amount_refunded, 10000);
});

Deno.test("dispute: a partial dispute amount refunds only that amount", async () => {
  const fake = fakeAdmin({ table: ledgerTable, rpc: refundOk });
  const stripe = disputeStripe({ id: "ch_d", amount: 10000, amount_refunded: 0, payment_intent: "pi_d" });
  await handleConnectEvent({ admin: fake.client, stripe, livemode: false }, event("charge.dispute.closed", dispute("lost", { amount: 4000 })));
  assertEquals(fake.rpcs[0].args.p_amount_refunded, 4000);
});

Deno.test("dispute: a refund arriving after the lost dispute still counts what the dispute took", async () => {
  const calls: string[] = [];
  const fake = fakeAdmin({ table: ledgerTable, rpc: refundOk });
  // MX$40 lost to the dispute, then the place refunds MX$20 of the rest.
  const stripe = disputeStripe({}, [{ id: "dp_1", status: "lost", amount: 4000 }], calls);
  const r = await handleConnectEvent(
    { admin: fake.client, stripe, livemode: false },
    event("charge.refunded", { id: "ch_d", payment_intent: "pi_d", amount: 10000, amount_refunded: 2000, disputed: true }),
  );
  assertEquals(r.status, 200);
  assertEquals(calls, ["disputes"]);
  assertEquals(fake.rpcs, [{ name: "wallet_refund_payment", args: { p_payment_id: PAYMENT, p_amount_refunded: 6000 } }]);
});

Deno.test("dispute: the same lost event twice runs the refund once (the replay guard)", async () => {
  const seen = new Set<string>();
  const fake = fakeAdmin({
    table: (op) => {
      if (op.table === "stripe_connect_events" && op.kind === "insert") {
        const id = (op.payload as { id: string }).id;
        if (seen.has(id)) return { error: { code: "23505", message: "duplicate key" } };
        seen.add(id);
        return { data: null };
      }
      return ledgerTable(op);
    },
    rpc: refundOk,
  });
  const stripe = disputeStripe({ id: "ch_d", amount: 10000, amount_refunded: 0, payment_intent: "pi_d" });
  const e = event("charge.dispute.closed", dispute("lost"));
  await handleConnectEvent({ admin: fake.client, stripe, livemode: false }, e);
  const again = await handleConnectEvent({ admin: fake.client, stripe, livemode: false }, e);
  assertEquals(again.body.ignored, "replay");
  assertEquals(fake.rpcs.length, 1);
});

Deno.test("dispute: no payment_intent on the dispute falls back to the charge's own", async () => {
  const fake = fakeAdmin({ table: ledgerTable, rpc: refundOk });
  const stripe = disputeStripe({ id: "ch_d", amount: 10000, amount_refunded: 0, payment_intent: "pi_d" });
  const r = await handleConnectEvent({ admin: fake.client, stripe, livemode: false }, event("charge.dispute.closed", dispute("lost", { payment_intent: null })));
  assertEquals(r.body.payment_id, PAYMENT);
  assertEquals(fake.rpcs[0].name, "wallet_refund_payment");
});

Deno.test("dispute: a Stripe read failure answers 500 and forgets the event, so Stripe retries; no RPC", async () => {
  const fake = fakeAdmin({ table: ledgerTable, rpc: refundOk });
  const stripe: StripeCall = () => Promise.reject(new Error("stripe 503"));
  const e = event("charge.dispute.closed", dispute("lost"));
  const r = await handleConnectEvent({ admin: fake.client, stripe, livemode: false }, e);
  assertEquals(r.status, 500);
  assertEquals(r.body.code, "settle_failed");
  assertEquals(fake.rpcs, []);
  assertEquals(fake.ops.find((o) => o.table === "stripe_connect_events" && o.kind === "delete")?.filters, { id: e.id });
});

Deno.test("dispute: an RPC refusal answers 500 too", async () => {
  const fake = fakeAdmin({ table: ledgerTable, rpc: () => ({ data: { ok: false, code: "not_paid" } }) });
  const stripe = disputeStripe({ id: "ch_d", amount: 10000, amount_refunded: 0, payment_intent: "pi_d" });
  const r = await handleConnectEvent({ admin: fake.client, stripe, livemode: false }, event("charge.dispute.closed", dispute("lost")));
  assertEquals(r.status, 500);
});

Deno.test("dispute: a lost charge no row names is acknowledged as dispute_unmatched", async () => {
  const fake = fakeAdmin({ table: ledgerTable, rpc: refundOk });
  const stripe = disputeStripe({ id: "ch_x", amount: 500, amount_refunded: 0, payment_intent: "pi_x" });
  const r = await handleConnectEvent({ admin: fake.client, stripe, livemode: false }, event("charge.dispute.closed", dispute("lost", { charge: "ch_x", payment_intent: null })));
  assertEquals(r, { status: 200, body: { ok: true, ignored: "dispute_unmatched" } });
  assertEquals(fake.rpcs, []);
});

// ── payment_intent.* (MESITA-3568: an in-app card part) ────────────────────

function paymentRow(sessionId: string | null) {
  return (op: FakeOp): FakeResult => {
    if (op.table === "wallet_payments" && op.kind === "select") return { data: { id: PAYMENT, stripe_checkout_session_id: sessionId } };
    return accountTable(true)(op);
  };
}

Deno.test("pi: a PaymentIntent without Mesita's metadata (the place's own sale) is 200 ignored, no ledger read", async () => {
  const fake = fakeAdmin({ table: accountTable(true) });
  const r = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, event("payment_intent.succeeded", { id: "pi_own", metadata: {} }));
  assertEquals(r, { status: 200, body: { ok: true, ignored: "not_mesita" } });
  assertEquals(fake.rpcs, []);
  assertEquals(fake.ops.filter((o) => o.table === "wallet_payments").length, 0);
});

Deno.test("pi: succeeded settles the payment its metadata names, once across a replay", async () => {
  const seen = new Set<string>();
  const fake = fakeAdmin({
    table: (op) => {
      if (op.table === "stripe_connect_events" && op.kind === "insert") {
        const id = (op.payload as { id: string }).id;
        if (seen.has(id)) return { error: { code: "23505", message: "duplicate key" } };
        seen.add(id);
      }
      return paymentRow(null)(op);
    },
    rpc: () => ({ data: { ok: true, outcome: "paid" } }),
  });
  const e = event("payment_intent.succeeded", { id: "pi_tab", metadata: { mesita_kind: "wallet_payment", payment_id: PAYMENT } });
  const first = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, e);
  assertEquals(first.body, { ok: true, payment_id: PAYMENT, outcome: "paid" });
  const again = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, e);
  assertEquals(again.body.ignored, "replay");
  assertEquals(fake.rpcs, [{ name: "wallet_settle_payment", args: { p_payment_id: PAYMENT, p_payment_intent: "pi_tab" } }]);
});

Deno.test("pi: canceled releases an in-app payment, but leaves a Checkout's own PI to checkout.session.expired", async () => {
  const inApp = fakeAdmin({ table: paymentRow(null), rpc: () => ({ data: { ok: true, outcome: "released" } }) });
  const r = await handleConnectEvent({ admin: inApp.client, stripe: noStripe, livemode: false }, event("payment_intent.canceled", { id: "pi_tab", metadata: { mesita_kind: "wallet_payment", payment_id: PAYMENT } }));
  assertEquals(r.body.outcome, "released");
  assertEquals(inApp.rpcs, [{ name: "wallet_release_payment", args: { p_payment_id: PAYMENT, p_status: "failed", p_error: "pi_canceled" } }]);

  const checkout = fakeAdmin({ table: paymentRow("cs_1") });
  const c = await handleConnectEvent({ admin: checkout.client, stripe: noStripe, livemode: false }, event("payment_intent.canceled", { id: "pi_cs", metadata: { mesita_kind: "wallet_payment", payment_id: PAYMENT } }));
  assertEquals(c.body.ignored, "checkout_owns_it");
  assertEquals(checkout.rpcs, []);
});

Deno.test("pi: payment_failed is logged only; the hold stays for a retry", async () => {
  const fake = fakeAdmin({ table: paymentRow(null) });
  const r = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, event("payment_intent.payment_failed", { id: "pi_tab", metadata: { mesita_kind: "wallet_payment", payment_id: PAYMENT }, last_payment_error: { code: "card_declined" } }));
  assertEquals(r.body.outcome, "payment_failed_logged");
  assertEquals(fake.rpcs, []);
});

// ── payment_intent.* for a voucher bought with a saved card (MESITA-3552) ──

function purchaseRow(sessionId: string | null) {
  return (op: FakeOp): FakeResult => {
    if (op.table === "wallet_purchases" && op.kind === "select") {
      return {
        data: {
          id: PURCHASE, status: "open", consumer_id: "c", place_id: PLACE, voucher: "voucher_200", amount_cents: 20000, bonus_cents: 0,
          stripe_account_id: ACCT, stripe_checkout_session_id: sessionId, stripe_payment_intent_id: "pi_v", created_at: "2026-11-09T00:00:00Z",
        },
      };
    }
    return accountTable(true)(op);
  };
}

Deno.test("voucher pi: succeeded credits the purchase its metadata names with its hour, once across a replay", async () => {
  const seen = new Set<string>();
  const fake = fakeAdmin({
    table: (op) => {
      if (op.table === "stripe_connect_events" && op.kind === "insert") {
        const id = (op.payload as { id: string }).id;
        if (seen.has(id)) return { error: { code: "23505", message: "duplicate key" } };
        seen.add(id);
      }
      return purchaseRow(null)(op);
    },
    rpc: () => ({ data: { ok: true, outcome: "credited" } }),
  });
  const e = event("payment_intent.succeeded", { id: "pi_v", metadata: { mesita_kind: "wallet_voucher", purchase_id: PURCHASE, voucher: "voucher_200" } });
  const first = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, e);
  assertEquals(first.body, { ok: true, purchase_id: PURCHASE, outcome: "credited" });
  const again = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, e);
  assertEquals(again.body.ignored, "replay");
  assertEquals(fake.rpcs, [{
    name: "wallet_credit_purchase",
    args: { p_purchase_id: PURCHASE, p_payment_intent: "pi_v", p_available_at: new Date((1_800_000_000 + 3600) * 1000).toISOString() },
  }]);
});

Deno.test("voucher pi: canceled fails a saved-card purchase; a Checkout voucher's own PI is left to checkout.session.*", async () => {
  const inApp = fakeAdmin({ table: purchaseRow(null) });
  const r = await handleConnectEvent({ admin: inApp.client, stripe: noStripe, livemode: false }, event("payment_intent.canceled", { id: "pi_v", metadata: { mesita_kind: "wallet_voucher", purchase_id: PURCHASE } }));
  assertEquals(r.body.outcome, "released");
  const upd = inApp.ops.find((o) => o.table === "wallet_purchases" && o.kind === "update");
  assertEquals((upd?.payload as { status?: string }).status, "failed");
  assertEquals(upd?.filters, { id: PURCHASE, "status:in": ["opening", "open"] });
  assertEquals(inApp.rpcs, []);

  const checkout = fakeAdmin({ table: purchaseRow("cs_v") });
  for (const type of ["payment_intent.succeeded", "payment_intent.canceled"]) {
    const c = await handleConnectEvent({ admin: checkout.client, stripe: noStripe, livemode: false }, event(type, { id: "pi_v", metadata: { mesita_kind: "wallet_voucher", purchase_id: PURCHASE } }));
    assertEquals(c.body.ignored, "checkout_owns_it");
  }
  assertEquals(checkout.rpcs, []);
  assertEquals(checkout.ops.filter((o) => o.table === "wallet_purchases" && o.kind === "update").length, 0);
});

Deno.test("voucher pi: payment_failed is logged only", async () => {
  const fake = fakeAdmin({ table: purchaseRow(null) });
  const r = await handleConnectEvent({ admin: fake.client, stripe: noStripe, livemode: false }, event("payment_intent.payment_failed", { id: "pi_v", metadata: { mesita_kind: "wallet_voucher", purchase_id: PURCHASE }, last_payment_error: { decline_code: "insufficient_funds" } }));
  assertEquals(r.body.outcome, "payment_failed_logged");
  assertEquals(fake.rpcs, []);
  assertEquals(fake.ops.filter((o) => o.table === "wallet_purchases" && o.kind === "update").length, 0);
});

// MESITA-3304 (W2a): what reaches wallet_pay_credit and what leaves the doors.
// Money: a refusal that maps wrong either pays twice or hides a payment.
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import { MAX_PAYMENT_INPUT_CENTS } from "./money.ts";
import { MONEY_CODES } from "./money-codes.ts";
import { type PaymentRow, paymentView, proofView, readPayBody, startPayment } from "./pay.ts";

const PLACE = "00000000-0000-4000-8000-000000003304";
const REQ = "00000000-0000-4000-8000-00000000a304";
const USER = "00000000-0000-4000-8000-00000000b304";
const TOKEN = "aaaaaaaaaaaaaaaaaaaaa1";

const body = (o: Record<string, unknown> = {}) => ({ place_id: PLACE, request_id: REQ, amount_cents: 5000, ...o });

Deno.test("readPayBody: a good body reads through", () => {
  const r = readPayBody(body({ ticket: "  T-12 " }));
  assertEquals(r, { ok: true, input: { placeId: PLACE, amountCents: 5000, requestId: REQ, ticket: "T-12" } });
  const blank = readPayBody(body({ ticket: "   " }));
  assert(blank.ok && blank.input.ticket === null);
});

Deno.test("readPayBody: refusals, with a code only where a person can fix it", () => {
  const cases: Array<[Record<string, unknown>, number, string | undefined]> = [
    [body({ place_id: "nope" }), 400, undefined],
    [body({ request_id: undefined }), 400, undefined],
    [body({ amount_cents: undefined }), 400, "amount_required"],
    [body({ amount_cents: 0 }), 400, "amount_required"],
    [body({ amount_cents: -100 }), 400, "amount_required"],
    [body({ amount_cents: 12.5 }), 400, undefined],
    [body({ amount_cents: "5000" }), 400, undefined],
    [body({ amount_cents: MAX_PAYMENT_INPUT_CENTS + 1 }), 400, "above_cap"],
    [body({ ticket: 12 }), 400, undefined],
    [body({ ticket: "x".repeat(33) }), 400, undefined],
    [body({ ticket: "T\n12" }), 400, undefined],
  ];
  for (const [b, status, code] of cases) {
    const r = readPayBody(b);
    assert(!r.ok, JSON.stringify(b));
    assertEquals([r.status, r.code], [status, code], JSON.stringify(b));
  }
  const cap = readPayBody(body({ amount_cents: MAX_PAYMENT_INPUT_CENTS + 1 }));
  assert(!cap.ok);
  assertEquals(cap.detail, { cap_cents: MAX_PAYMENT_INPUT_CENTS });
  assert(readPayBody(body({ amount_cents: MAX_PAYMENT_INPUT_CENTS })).ok);
});

Deno.test("every code the pay doors answer is a money code the apps know", () => {
  for (const c of ["amount_required", "above_cap", "insufficient", "taken"]) {
    assert((MONEY_CODES as readonly string[]).includes(c), c);
  }
});

function stubRpc(answer: unknown, error: { message: string } | null = null) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  return {
    calls,
    // deno-lint-ignore no-explicit-any
    admin: { rpc: (fn: string, args: Record<string, unknown>) => (calls.push({ fn, args }), Promise.resolve({ data: answer, error })) } as any,
  };
}

const input = { placeId: PLACE, amountCents: 5000, requestId: REQ, ticket: "T-12" };

Deno.test("startPayment: passes the request through and shapes a paid answer", async () => {
  const s = stubRpc({
    ok: true, outcome: "paid", payment_id: "p1", status: "paid", credit_cents: 5000, currency: "mxn",
    paid_at: "2026-11-07T12:00:00Z", proof_token: TOKEN,
  });
  const r = await startPayment(s.admin, { consumerId: USER, input, currency: "mxn", livemode: false, token: TOKEN });
  assertEquals(s.calls, [{
    fn: "wallet_pay_credit",
    args: {
      p_consumer_id: USER, p_place_id: PLACE, p_amount_cents: 5000, p_currency: "mxn", p_livemode: false,
      p_request_id: REQ, p_proof_token: TOKEN, p_ticket: "T-12",
    },
  }]);
  assert(r.ok);
  assertEquals(r.payment.outcome, "paid");
  assertEquals(r.payment.amount_cents, 5000);
  assertEquals(r.payment.test_mode, true);
  assertEquals(r.payment.proof?.token, TOKEN);
  assert(r.payment.proof?.url.endsWith(`/proof/${TOKEN}`));
});

Deno.test("startPayment: mints a fresh token when none is given", async () => {
  const s = stubRpc({ ok: true, outcome: "paid", payment_id: "p1", status: "paid", credit_cents: 1, currency: "mxn", paid_at: "x", proof_token: TOKEN });
  await startPayment(s.admin, { consumerId: USER, input, currency: "mxn", livemode: true });
  const t = s.calls[0].args.p_proof_token as string;
  assert(/^[A-Za-z0-9_-]{22}$/.test(t));
});

Deno.test("startPayment: a replay answers the stored payment, not a new one", async () => {
  const s = stubRpc({ ok: true, outcome: "already_paid", payment_id: "p0", status: "refunded", credit_cents: 5000, currency: "mxn", paid_at: "x", proof_token: TOKEN });
  const r = await startPayment(s.admin, { consumerId: USER, input, currency: "mxn", livemode: true, token: "bbbbbbbbbbbbbbbbbbbbb2" });
  assert(r.ok);
  assertEquals([r.payment.payment_id, r.payment.outcome, r.payment.status, r.payment.proof?.token], ["p0", "already_paid", "refunded", TOKEN]);
});

Deno.test("startPayment: insufficient says how much credit there is", async () => {
  const r = await startPayment(stubRpc({ ok: false, code: "insufficient", spendable_cents: 17000 }).admin, {
    consumerId: USER, input, currency: "mxn", livemode: true,
  });
  assert(!r.ok);
  assertEquals([r.status, r.code, r.detail], [409, "insufficient", { spendable_cents: 17000 }]);
  assertEquals(r.error, "You have $170.00MX of credit here");
});

Deno.test("startPayment: taken carries the payment that already went through", async () => {
  const r = await startPayment(stubRpc({ ok: false, code: "taken", payment_id: "p9" }).admin, {
    consumerId: USER, input, currency: "mxn", livemode: true,
  });
  assert(!r.ok);
  assertEquals([r.status, r.code, r.detail], [409, "taken", { payment_id: "p9" }]);
});

Deno.test("startPayment: an RPC error or an unknown answer is a 5xx, never a refusal", async () => {
  await assertRejects(() => startPayment(stubRpc(null, { message: "boom" }).admin, { consumerId: USER, input, currency: "mxn", livemode: true }));
  await assertRejects(() => startPayment(stubRpc(null).admin, { consumerId: USER, input, currency: "mxn", livemode: true }));
  await assertRejects(() => startPayment(stubRpc({ ok: false, code: "weird" }).admin, { consumerId: USER, input, currency: "mxn", livemode: true }));
});

const ROW: PaymentRow = {
  id: "p1", place_id: PLACE, status: "paid", amount_cents: 5000, credit_cents: 5000, card_cents: 0, tip_cents: 0, cashback_cents: 0,
  currency: "mxn", paid_at: "2026-11-07T12:00:00Z", proof_token: TOKEN, proof_seen_at: null, ticket: "T-12", refunded_cents: 0, livemode: false,
  stripe_checkout_session_id: null, stripe_account_id: null, created_at: "2026-11-07T11:59:00Z", expires_at: null,
};

Deno.test("paymentView (MESITA-3305): an open card part has no proof yet, a paid one does", () => {
  const open = paymentView({ ...ROW, status: "open", paid_at: null, card_cents: 500, amount_cents: 5500 }, "Casa");
  assertEquals(open.proof, null);
  assertEquals(open.status, "open");
  assertEquals(open.card_cents, 500);
  assertEquals(paymentView(ROW, "Casa").proof?.token, TOKEN);
});

Deno.test("proofView: what the staff page reads, and nothing about who paid", () => {
  const v = proofView(ROW, "Casa", "2026-11-07T12:01:00Z");
  assertEquals(Object.keys(v).sort(), ["amount_cents", "currency", "paid_at", "place", "seen_at", "server_time", "status", "test_mode", "ticket"]);
  assertEquals(v.place, { name: "Casa" });
  assertEquals(v.test_mode, true);
  assertEquals(v.server_time, "2026-11-07T12:01:00Z");
});

Deno.test("paymentView: a refunded payment keeps its status; no token, no proof", () => {
  assertEquals(paymentView({ ...ROW, status: "refunded" }, "Casa").status, "refunded");
  assertEquals(paymentView({ ...ROW, status: "partly_refunded", refunded_cents: 1200 }, "Casa").refunded_cents, 1200);
  assertEquals(paymentView({ ...ROW, proof_token: null }, "Casa").proof, null);
  assertEquals(paymentView(ROW, null).place, { id: PLACE, name: null });
});

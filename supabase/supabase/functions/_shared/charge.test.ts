// MESITA-3306 (W2c): the waiter's charge. Money: a lock that never locks lets
// a code be guessed; a charge two guests can claim is paid twice; a stale
// token that writes a try locks staff out by polling.
import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { MONEY_CODES } from "./money-codes.ts";
import { hashPlaceCode } from "./place-code.ts";
import { outsideSplit } from "./pay.ts";
import {
  type ChargePayment,
  type ChargeRow,
  type ChargeStore,
  chargeLook,
  clientAddress,
  confirmCharge,
  findGuestCharge,
  getCharge,
  hashChargeCode,
  lockedFor,
  mintChargeCode,
  openCharge,
  type OpenChargeInput,
  openOutsideOf,
  readChargeCode,
  readOpenChargeBody,
  readTip,
  staffTryKey,
  type TryKind,
} from "./charge.ts";

const PLACE = "00000000-0000-4000-8000-000000003306";
const GUEST_A = "00000000-0000-4000-8000-00000000a306";
const GUEST_B = "00000000-0000-4000-8000-00000000b306";
const T0 = Date.parse("2026-11-09T20:00:00Z");

type TestPayment = ChargePayment & { cancelled?: boolean };

function memoryChargeStore(seed: { codes?: Record<string, string>; payments?: TestPayment[] } = {}) {
  const charges: Array<ChargeRow & { code_hash: string; token_hash: string }> = [];
  const tries: Array<{ place_id: string; kind: TryKind; key: string; at: string }> = [];
  const codes = new Map(Object.entries(seed.codes ?? {}));
  const payments = new Map<string, TestPayment>((seed.payments ?? []).map((p) => [p.id, p]));
  const clock = { ms: T0 };
  const billOf = new Map<string, number>();
  const store: ChargeStore = {
    tries: (placeId, kind, key, sinceIso, limit) =>
      Promise.resolve(
        tries
          .filter((t) => t.place_id === placeId && t.kind === kind && (!key || t.key === key) && t.at >= sinceIso)
          .map((t) => t.at)
          .sort()
          .reverse()
          .slice(0, limit),
      ),
    addTry(placeId, kind, key) {
      tries.push({ place_id: placeId, kind, key, at: new Date(clock.ms).toISOString() });
      return Promise.resolve();
    },
    placeHasCode: (placeId) => Promise.resolve(codes.has(placeId)),
    checkPlaceCode: (placeId, hash) => Promise.resolve(codes.get(placeId) === hash),
    clearExpired(placeId, nowIso) {
      for (let i = charges.length - 1; i >= 0; i--) {
        const c = charges[i];
        if (c.place_id === placeId && !c.paid_at && !c.payment_id && c.expires_at < nowIso) charges.splice(i, 1);
      }
      return Promise.resolve();
    },
    insertCharge(row) {
      if (charges.some((c) => c.place_id === row.place_id && c.code_hash === row.code_hash && !c.paid_at)) return Promise.resolve("dup");
      charges.push({ ...row, id: crypto.randomUUID(), payment_id: null, consumer_id: null, paid_at: null });
      return Promise.resolve("ok");
    },
    chargeByToken: (h) => Promise.resolve(charges.find((c) => c.token_hash === h) ?? null),
    chargeByCode: (placeId, h) => Promise.resolve(charges.find((c) => c.place_id === placeId && c.code_hash === h && !c.paid_at) ?? null),
    payment: (id) => Promise.resolve(payments.get(id) ?? null),
    claim(id, consumerId) {
      const c = charges.find((x) => x.id === id);
      if (!c || c.paid_at || (c.consumer_id && c.consumer_id !== consumerId)) return Promise.resolve(false);
      c.consumer_id = consumerId;
      return Promise.resolve(true);
    },
    unclaim(id, consumerId) {
      const c = charges.find((x) => x.id === id);
      if (c && c.consumer_id === consumerId && !c.payment_id) c.consumer_id = null;
      return Promise.resolve();
    },
    bind(id, paymentId, paidAt, chargeAmountCents) {
      const c = charges.find((x) => x.id === id);
      if (!c || (c.payment_id && c.payment_id !== paymentId)) return Promise.resolve(false);
      c.payment_id = paymentId;
      if (paidAt) c.paid_at = paidAt;
      billOf.set(paymentId, chargeAmountCents);
      return Promise.resolve(true);
    },
    unbind(paymentId, consumerId) {
      const c = charges.find((x) => x.payment_id === paymentId && x.consumer_id === consumerId && !x.paid_at);
      if (c) {
        c.payment_id = null;
        c.consumer_id = null;
      }
      return Promise.resolve();
    },
    // wallet_confirm_outside's answers, on the in-memory payment.
    confirmOutside(paymentId) {
      const p = payments.get(paymentId);
      if (!p) return Promise.resolve({ ok: false, code: "not_found" });
      if (p.outside_cents === 0) return Promise.resolve({ ok: false, code: "not_outside" });
      if (p.paid_at) return Promise.resolve({ ok: true, outcome: "already_paid", paid_at: p.paid_at, outside_cents: p.outside_cents, cashback_cents: Math.floor((p.outside_cents * 200) / 10000) });
      if (p.status === "expired" && p.cancelled) return Promise.resolve({ ok: false, code: "closed", bill_cents: billOf.get(paymentId) });
      if (p.status !== "open") return Promise.resolve({ ok: false, code: "expired", bill_cents: billOf.get(paymentId) });
      if (p.expires_at && Date.parse(p.expires_at) <= clock.ms) {
        p.status = "expired";
        return Promise.resolve({ ok: false, code: "expired", bill_cents: billOf.get(paymentId) });
      }
      p.status = "paid";
      p.paid_at = new Date(clock.ms).toISOString();
      return Promise.resolve({ ok: true, outcome: "paid", paid_at: p.paid_at, outside_cents: p.outside_cents, cashback_cents: Math.floor((p.outside_cents * 200) / 10000) });
    },
  };
  return { store, charges, tries, payments, clock, billOf };
}

async function withCode(code = "123456") {
  return memoryChargeStore({ codes: { [PLACE]: await hashPlaceCode(PLACE, code) } });
}

const input = (o: Partial<OpenChargeInput> = {}): OpenChargeInput => ({
  placeId: PLACE,
  placeCode: "123456",
  amountCents: 25000,
  tipCents: 0,
  ticket: "T-12",
  ...o,
});

/** A payment row the charge reads (status open unless set). */
const payment = (o: Partial<TestPayment> & { id: string }): TestPayment => ({
  place_id: PLACE,
  credit_cents: 0,
  consumer_id: GUEST_A,
  status: "open",
  paid_at: null,
  livemode: false,
  amount_cents: 25000,
  tip_cents: 0,
  outside_cents: 0,
  expires_at: null,
  ...o,
});

Deno.test("readOpenChargeBody: a 33-character ticket answers ticket_too_long", () => {
  const ok = readOpenChargeBody({ place_id: PLACE, place_code: "123 456", amount_cents: 25000, ticket: " " + "x".repeat(32) + " " });
  assert(ok.ok);
  assertEquals(ok.input.placeCode, "123456");
  assertEquals(ok.input.ticket, "x".repeat(32));
  const long = readOpenChargeBody({ place_id: PLACE, place_code: "123456", amount_cents: 25000, ticket: "x".repeat(33) });
  assert(!long.ok);
  assertEquals([long.status, long.code], [400, "ticket_too_long"]);
  const noAmount = readOpenChargeBody({ place_id: PLACE, place_code: "123456" });
  assert(!noAmount.ok && noAmount.code === "amount_required");
  assert(!readOpenChargeBody({ place_id: PLACE, place_code: "12345", amount_cents: 100 }).ok);
});

Deno.test("every code the charge doors answer is a money code the apps know", () => {
  for (const c of ["ticket_too_long", "taken", "gone", "place_code_required", "locked", "forbidden"]) {
    assert((MONEY_CODES as readonly string[]).includes(c), c);
  }
});

Deno.test("open-charge: no place code answers place_code_required; with one it opens", async () => {
  const none = memoryChargeStore();
  const r = await openCharge(none.store, { input: input(), currency: "mxn", staffKey: "k", nowMs: T0 });
  assert(!r.ok);
  assertEquals([r.status, r.code, r.error], [409, "place_code_required", "Set the waiter code on Business › Payments first"]);
  assertEquals(none.charges.length, 0);

  const m = await withCode();
  const ok = await openCharge(m.store, { input: input(), currency: "mxn", staffKey: "k", nowMs: T0 });
  assert(ok.ok);
  assert(/^\d{4}$/.test(ok.charge.code));
  assertEquals(ok.charge.charge_token.length, 22);
  assertEquals(ok.charge.expires_at, new Date(T0 + 600_000).toISOString());
  assertEquals(m.charges.length, 1);
  // Only hashes are stored.
  assertNotEquals(m.charges[0].code_hash, ok.charge.code);
  assertEquals(m.charges[0].code_hash, await hashChargeCode(PLACE, ok.charge.code));
  assertEquals(m.charges[0].ticket, "T-12");
});

Deno.test("open-charge: a sixth wrong code from one address locks it while another still opens", async () => {
  const m = await withCode();
  const one = await staffTryKey("service", "203.0.113.7");
  const two = await staffTryKey("service", "198.51.100.9");
  for (let i = 0; i < 5; i++) {
    m.clock.ms = T0 + i * 1000;
    const r = await openCharge(m.store, { input: input({ placeCode: "000000" }), currency: "mxn", staffKey: one, nowMs: m.clock.ms });
    assert(!r.ok);
    assertEquals([r.status, r.code], [403, "forbidden"]);
  }
  const sixth = await openCharge(m.store, { input: input({ placeCode: "000000" }), currency: "mxn", staffKey: one, nowMs: T0 + 6000 });
  assert(!sixth.ok);
  assertEquals(sixth.code, "locked");
  assertEquals(sixth.detail?.retry_after_s, 594);
  // Even the right code waits on that address…
  const right = await openCharge(m.store, { input: input(), currency: "mxn", staffKey: one, nowMs: T0 + 6000 });
  assert(!right.ok && right.code === "locked");
  // …while another address opens.
  const other = await openCharge(m.store, { input: input(), currency: "mxn", staffKey: two, nowMs: T0 + 6000 });
  assert(other.ok);
  // Ten minutes after the first wrong code, the window lets one through.
  const later = await openCharge(m.store, { input: input(), currency: "mxn", staffKey: one, nowMs: T0 + 601_000 });
  assert(later.ok);
});

Deno.test("open-charge: 50 staff tries per place lock every address; 50 guest tries never do", async () => {
  const m = await withCode();
  for (let i = 0; i < 50; i++) m.tries.push({ place_id: PLACE, kind: "guest", key: `g${i}`, at: new Date(T0).toISOString() });
  assert((await openCharge(m.store, { input: input(), currency: "mxn", staffKey: "fresh", nowMs: T0 })).ok);
  for (let i = 0; i < 50; i++) m.tries.push({ place_id: PLACE, kind: "staff", key: `s${i}`, at: new Date(T0).toISOString() });
  const r = await openCharge(m.store, { input: input(), currency: "mxn", staffKey: "fresh", nowMs: T0 });
  assert(!r.ok && r.code === "locked");
});

Deno.test("clientAddress: x-forwarded-for is client-written, so it never changes the hash", async () => {
  const plain = new Headers({ "cf-connecting-ip": "203.0.113.7" });
  const forged = new Headers({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "6.6.6.6" });
  assertEquals(clientAddress(forged), "203.0.113.7");
  assertEquals(await staffTryKey("k", clientAddress(plain)), await staffTryKey("k", clientAddress(forged)));
  assertEquals(clientAddress(new Headers({ "x-real-ip": "198.51.100.9", "x-forwarded-for": "1.1.1.1" })), "198.51.100.9");
  assertEquals(clientAddress(new Headers({ "x-forwarded-for": "1.1.1.1" })), "unknown");
  assertNotEquals(await staffTryKey("k", "203.0.113.7"), await staffTryKey("other", "203.0.113.7"));
});

Deno.test("get-charge: a stale token answers gone and writes no try", async () => {
  const m = await withCode();
  assertEquals(await getCharge(m.store, "aaaaaaaaaaaaaaaaaaaaa1", T0), null);
  const opened = await openCharge(m.store, { input: input(), currency: "mxn", staffKey: "k", nowMs: T0 });
  assert(opened.ok);
  const open = await getCharge(m.store, opened.charge.charge_token, T0 + 1000);
  assertEquals(open?.state, "open");
  // Ten minutes on with no payment started: gone.
  assertEquals(await getCharge(m.store, opened.charge.charge_token, T0 + 600_000), null);
  assertEquals(m.tries.length, 0);
});

Deno.test("get-charge: a started payment carries the charge past ten minutes; paid reads paid", async () => {
  const pay = payment({ id: "p1" });
  const m = memoryChargeStore({ codes: { [PLACE]: await hashPlaceCode(PLACE, "123456") }, payments: [pay] });
  const opened = await openCharge(m.store, { input: input(), currency: "mxn", staffKey: "k", nowMs: T0 });
  assert(opened.ok);
  await m.store.bind(m.charges[0].id, "p1", null, 25000);
  assertEquals((await getCharge(m.store, opened.charge.charge_token, T0 + 900_000))?.state, "open");
  pay.status = "paid";
  pay.paid_at = new Date(T0 + 901_000).toISOString();
  const paid = await getCharge(m.store, opened.charge.charge_token, T0 + 902_000);
  assertEquals([paid?.state, paid?.paid_at], ["paid", pay.paid_at]);
  pay.status = "expired";
  pay.paid_at = null;
  assertEquals(await getCharge(m.store, opened.charge.charge_token, T0 + 903_000), null);
});

async function openedWith(m: Awaited<ReturnType<typeof withCode>>) {
  const r = await openCharge(m.store, { input: input(), currency: "mxn", staffKey: "k", nowMs: T0 });
  assert(r.ok);
  return r.charge;
}

Deno.test("guest: the right code answers the charge; a sixth wrong code locks that guest only", async () => {
  const m = await withCode();
  const c = await openedWith(m);
  const wrong = c.code === "0000" ? "0001" : "0000";
  for (let i = 0; i < 5; i++) {
    const r = await findGuestCharge(m.store, { placeId: PLACE, consumerId: GUEST_A, code: wrong, nowMs: T0 });
    assert(!r.ok);
    assertEquals([r.status, r.code], [404, "gone"]);
  }
  assertEquals(m.tries.filter((t) => t.kind === "guest").length, 5);
  const locked = await findGuestCharge(m.store, { placeId: PLACE, consumerId: GUEST_A, code: c.code, nowMs: T0 });
  assert(!locked.ok && locked.code === "locked");
  const b = await findGuestCharge(m.store, { placeId: PLACE, consumerId: GUEST_B, code: c.code, nowMs: T0 });
  assert(b.ok);
  assertEquals(b.charge.amount_cents, 25000);
  // Guest tries never lock staff open.
  assert((await openCharge(m.store, { input: input(), currency: "mxn", staffKey: "k", nowMs: T0 })).ok);
});

Deno.test("guest: a charge another guest claimed answers taken; the same guest resumes it", async () => {
  const m = await withCode();
  const c = await openedWith(m);
  const a = await findGuestCharge(m.store, { placeId: PLACE, consumerId: GUEST_A, code: c.code, nowMs: T0 });
  assert(a.ok);
  assert(await m.store.claim(a.charge.id, GUEST_A));
  assert(!(await m.store.claim(a.charge.id, GUEST_B)));
  const b = await findGuestCharge(m.store, { placeId: PLACE, consumerId: GUEST_B, code: c.code, nowMs: T0 });
  assert(!b.ok);
  assertEquals([b.code, b.detail?.payment_id], ["taken", null]);
  assert((await findGuestCharge(m.store, { placeId: PLACE, consumerId: GUEST_A, code: c.code, nowMs: T0 })).ok);
  // A start that moved no money (insufficient) gives it back.
  await m.store.unclaim(a.charge.id, GUEST_A);
  assert((await findGuestCharge(m.store, { placeId: PLACE, consumerId: GUEST_B, code: c.code, nowMs: T0 })).ok);
});

Deno.test("guest: an over-balance charge stays open with no payment for the staff screen", async () => {
  const m = await withCode();
  const c = await openedWith(m);
  const a = await findGuestCharge(m.store, { placeId: PLACE, consumerId: GUEST_A, code: c.code, nowMs: T0 });
  assert(a.ok && (await m.store.claim(a.charge.id, GUEST_A)));
  await m.store.unclaim(a.charge.id, GUEST_A); // the door's answer to insufficient
  assertEquals([m.charges[0].payment_id, m.charges[0].consumer_id], [null, null]);
  assertEquals((await getCharge(m.store, c.charge_token, T0 + 1000))?.state, "open");
});

Deno.test("guest: a paid charge answers taken, with the payment only for its payer", async () => {
  const pay = payment({ id: "p9" });
  const m = memoryChargeStore({ codes: { [PLACE]: await hashPlaceCode(PLACE, "123456") }, payments: [pay] });
  const opened = await openCharge(m.store, { input: input(), currency: "mxn", staffKey: "k", nowMs: T0 });
  assert(opened.ok);
  const row = m.charges[0];
  row.consumer_id = GUEST_A;
  await m.store.bind(row.id, "p9", null, 25000);
  pay.status = "paid";
  pay.paid_at = new Date(T0 + 5000).toISOString();
  const mine = await findGuestCharge(m.store, { placeId: PLACE, consumerId: GUEST_A, code: opened.charge.code, nowMs: T0 + 6000 });
  assert(!mine.ok);
  assertEquals([mine.code, mine.detail?.payment_id], ["taken", "p9"]);
  // The staff screen turns Paid.
  assertEquals((await getCharge(m.store, opened.charge.charge_token, T0 + 7000))?.state, "paid");
});

Deno.test("codes and helpers", () => {
  assertEquals(readChargeCode(" 12 34 "), "1234");
  assertEquals(readChargeCode("123"), null);
  assertEquals(readChargeCode(1234), null);
  for (let i = 0; i < 200; i++) assert(/^\d{4}$/.test(mintChargeCode()));
  assertEquals(lockedFor([], 5, T0), 0);
  const five = Array.from({ length: 5 }, (_, i) => new Date(T0 - i * 1000).toISOString());
  assertEquals(lockedFor(five, 5, T0), 596);
  assertEquals(lockedFor(five, 5, T0 + 700_000), 0);
});

// ── MESITA-3545: the tip and the bill paid to the waiter ────────────────────

Deno.test("tip: open-charge carries it to the charge, the look and the poll; out of bounds is tip_invalid", async () => {
  assertEquals(readTip(undefined), { ok: true, tipCents: 0 });
  for (const bad of [-1, 1.5, "30", 100_000_01]) {
    const r = readTip(bad);
    assert(!r.ok && r.code === "tip_invalid" && r.status === 400, String(bad));
  }
  const body = readOpenChargeBody({ place_id: PLACE, place_code: "123456", amount_cents: 45000, tip_cents: 4500 });
  assert(body.ok && body.input.tipCents === 4500);
  const m = await withCode();
  const opened = await openCharge(m.store, { input: input({ amountCents: 45000, tipCents: 4500 }), currency: "mxn", staffKey: "k", nowMs: T0 });
  assert(opened.ok);
  assertEquals([opened.charge.tip_cents, m.charges[0].tip_cents], [4500, 4500]);
  assertEquals(chargeLook(m.charges[0]).tip_cents, 4500);
  assertEquals((await getCharge(m.store, opened.charge.charge_token, T0 + 1000))?.tip_cents, 4500);
});

Deno.test("bind copies the waiter's bill onto the payment; once bound, the payment's tip is the tip", async () => {
  const pay = payment({ id: "p2", amount_cents: 45000, tip_cents: 3000 });
  const m = memoryChargeStore({ codes: { [PLACE]: await hashPlaceCode(PLACE, "123456") }, payments: [pay] });
  const opened = await openCharge(m.store, { input: input({ amountCents: 45000, tipCents: 4500 }), currency: "mxn", staffKey: "k", nowMs: T0 });
  assert(opened.ok);
  await m.store.bind(m.charges[0].id, "p2", null, 45000);
  assertEquals(m.billOf.get("p2"), 45000);
  assertEquals((await getCharge(m.store, opened.charge.charge_token, T0 + 1000))?.tip_cents, 3000);
});

Deno.test("outside: the split takes credit first; credit covering the bill leaves nothing outside", () => {
  assertEquals(outsideSplit(45000, 15000), { credit: 15000, outside: 30000 });
  assertEquals(outsideSplit(45000, 0), { credit: 0, outside: 45000 });
  assertEquals(outsideSplit(45000, -5), { credit: 0, outside: 45000 });
  assertEquals(outsideSplit(45000, 45000), null);
  assertEquals(outsideSplit(45000, 90000), null);
  for (const c of ["tip_invalid", "outside_needs_charge", "credit_covers", "not_outside", "closed", "expired", "outside_limit"]) {
    assert((MONEY_CODES as readonly string[]).includes(c), c);
  }
});

Deno.test("outside: the poll shows the bill waiting for Received with its own expiry; Received pays it once", async () => {
  const out = payment({ id: "p3", amount_cents: 45000, outside_cents: 30000, tip_cents: 4500, expires_at: new Date(T0 + 1_800_000).toISOString() });
  const m = memoryChargeStore({ codes: { [PLACE]: await hashPlaceCode(PLACE, "123456") }, payments: [out] });
  const opened = await openCharge(m.store, { input: input({ amountCents: 45000 }), currency: "mxn", staffKey: "k", nowMs: T0 });
  assert(opened.ok);
  const token = opened.charge.charge_token;
  // Nothing bound yet: not paying outside.
  const early = await confirmCharge(m.store, token);
  assert(!early.ok);
  assertEquals([early.status, early.code], [409, "not_outside"]);
  m.charges[0].consumer_id = GUEST_A;
  await m.store.bind(m.charges[0].id, "p3", null, 45000);
  // Past the code's 10 minutes, the bill still waits (its own 30).
  const v = await getCharge(m.store, token, T0 + 900_000);
  assertEquals([v?.state, v?.outside], ["open", { cents: 30000, tip_cents: 4500, expires_at: out.expires_at }]);
  // The same guest's second tap finds that bill (in_progress); another guest's does not.
  assertEquals((await openOutsideOf(m.store, m.charges[0], GUEST_A))?.id, "p3");
  assertEquals(await openOutsideOf(m.store, m.charges[0], GUEST_B), null);
  m.clock.ms = T0 + 901_000;
  const ok = await confirmCharge(m.store, token);
  assert(ok.ok);
  assertEquals([ok.outcome, ok.outside_cents, ok.cashback_cents], ["paid", 30000, 600]);
  const again = await confirmCharge(m.store, token);
  assert(again.ok && again.outcome === "already_paid");
  const paid = await getCharge(m.store, token, T0 + 902_000);
  assertEquals([paid?.state, paid?.paid_outside, paid?.paid_cents, paid?.outside], ["paid", true, 15000, null]);
});

Deno.test("outside: Received after the guest cancelled reads closed; after 30 minutes, expired; another place's bill is forbidden", async () => {
  const cancelled = payment({ id: "p4", amount_cents: 45000, outside_cents: 45000, status: "expired", cancelled: true, expires_at: new Date(T0 + 1_800_000).toISOString() });
  const late = payment({ id: "p5", amount_cents: 45000, outside_cents: 45000, expires_at: new Date(T0 + 1_800_000).toISOString() });
  const elsewhere = payment({ id: "p6", place_id: "00000000-0000-4000-8000-00000000ffff", amount_cents: 45000, outside_cents: 45000 });
  const m = memoryChargeStore({ codes: { [PLACE]: await hashPlaceCode(PLACE, "123456") }, payments: [cancelled, late, elsewhere] });
  const tokens: string[] = [];
  for (const id of ["p4", "p5", "p6"]) {
    const o = await openCharge(m.store, { input: input({ amountCents: 45000 }), currency: "mxn", staffKey: "k", nowMs: T0 });
    assert(o.ok);
    tokens.push(o.charge.charge_token);
    await m.store.bind(m.charges[m.charges.length - 1].id, id, null, 45000);
  }
  const closed = await confirmCharge(m.store, tokens[0]);
  assert(!closed.ok && closed.code === "closed");
  assertEquals(closed.error, "Cancelled by the guest. Collect $450.00MX: nothing was paid from credit.");
  m.clock.ms = T0 + 1_800_000;
  const expired = await confirmCharge(m.store, tokens[1]);
  assert(!expired.ok && expired.code === "expired");
  assertEquals(expired.error, "Expired. Collect $450.00MX: nothing was paid from credit.");
  const other = await confirmCharge(m.store, tokens[2]);
  assert(!other.ok && other.code === "forbidden");
  assertEquals(late.paid_at, null);
});

Deno.test("outside: a guest's cancel unbinds and unclaims the charge so it can be paid again", async () => {
  const out = payment({ id: "p7", amount_cents: 45000, outside_cents: 45000 });
  const m = memoryChargeStore({ codes: { [PLACE]: await hashPlaceCode(PLACE, "123456") }, payments: [out] });
  const opened = await openCharge(m.store, { input: input({ amountCents: 45000 }), currency: "mxn", staffKey: "k", nowMs: T0 });
  assert(opened.ok);
  const row = m.charges[0];
  assert(await m.store.claim(row.id, GUEST_A));
  assert(await m.store.bind(row.id, "p7", null, 45000));
  // Compare-and-set: another payment never takes a bound charge.
  assertEquals(await m.store.bind(row.id, "p8", null, 45000), false);
  // Another guest's cancel touches nothing.
  await m.store.unbind("p7", GUEST_B);
  assertEquals(row.payment_id, "p7");
  out.status = "expired";
  await m.store.unbind("p7", GUEST_A);
  assertEquals([row.payment_id, row.consumer_id], [null, null]);
  // The code still works for its remaining minutes, for anyone.
  assert((await findGuestCharge(m.store, { placeId: PLACE, consumerId: GUEST_B, code: opened.charge.code, nowMs: T0 + 60_000 })).ok);
  assertEquals((await getCharge(m.store, opened.charge.charge_token, T0 + 60_000))?.outside, null);
});

// MESITA-3306 (W2c): the waiter's charge. Money: a lock that never locks lets
// a code be guessed; a charge two guests can claim is paid twice; a stale
// token that writes a try locks staff out by polling.
import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { MONEY_CODES } from "./money-codes.ts";
import { hashPlaceCode } from "./place-code.ts";
import {
  type ChargePayment,
  type ChargeRow,
  type ChargeStore,
  clientAddress,
  findGuestCharge,
  getCharge,
  hashChargeCode,
  lockedFor,
  mintChargeCode,
  openCharge,
  type OpenChargeInput,
  readChargeCode,
  readOpenChargeBody,
  staffTryKey,
  type TryKind,
} from "./charge.ts";

const PLACE = "00000000-0000-4000-8000-000000003306";
const GUEST_A = "00000000-0000-4000-8000-00000000a306";
const GUEST_B = "00000000-0000-4000-8000-00000000b306";
const T0 = Date.parse("2026-11-09T20:00:00Z");

function memoryChargeStore(seed: { codes?: Record<string, string>; payments?: ChargePayment[] } = {}) {
  const charges: Array<ChargeRow & { code_hash: string; token_hash: string }> = [];
  const tries: Array<{ place_id: string; kind: TryKind; key: string; at: string }> = [];
  const codes = new Map(Object.entries(seed.codes ?? {}));
  const payments = new Map((seed.payments ?? []).map((p) => [p.id, p]));
  const clock = { ms: T0 };
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
    bind(id, paymentId, paidAt) {
      const c = charges.find((x) => x.id === id);
      if (c) {
        c.payment_id = paymentId;
        if (paidAt) c.paid_at = paidAt;
      }
      return Promise.resolve();
    },
  };
  return { store, charges, tries, payments, clock };
}

async function withCode(code = "123456") {
  return memoryChargeStore({ codes: { [PLACE]: await hashPlaceCode(PLACE, code) } });
}

const input = (o: Partial<OpenChargeInput> = {}): OpenChargeInput => ({
  placeId: PLACE,
  placeCode: "123456",
  amountCents: 25000,
  ticket: "T-12",
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
  assertEquals([r.status, r.code, r.error], [409, "place_code_required", "Set a place code on Business › Settings first"]);
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
  const pay: ChargePayment = { id: "p1", consumer_id: GUEST_A, status: "open", paid_at: null, livemode: false };
  const m = memoryChargeStore({ codes: { [PLACE]: await hashPlaceCode(PLACE, "123456") }, payments: [pay] });
  const opened = await openCharge(m.store, { input: input(), currency: "mxn", staffKey: "k", nowMs: T0 });
  assert(opened.ok);
  await m.store.bind(m.charges[0].id, "p1", null);
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
  const pay: ChargePayment = { id: "p9", consumer_id: GUEST_A, status: "open", paid_at: null, livemode: false };
  const m = memoryChargeStore({ codes: { [PLACE]: await hashPlaceCode(PLACE, "123456") }, payments: [pay] });
  const opened = await openCharge(m.store, { input: input(), currency: "mxn", staffKey: "k", nowMs: T0 });
  assert(opened.ok);
  const row = m.charges[0];
  row.consumer_id = GUEST_A;
  await m.store.bind(row.id, "p9", null);
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

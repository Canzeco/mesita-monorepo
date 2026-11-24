import { assertEquals } from "jsr:@std/assert@1";
import { billState, type BillRow, readCents, readOpenBy, readSignInBy, staffBillView } from "./pay-bill.ts";

const NOW = Date.parse("2026-11-24T12:00:00Z");
const later = "2026-11-24T12:10:00Z";
const before = "2026-11-24T11:50:00Z";
const att = { status: "due" as const, charging_at: null, end_reason: null, expires_at: later, tab_id: null };
const bill: BillRow = {
  id: "b", consumer_id: "c", place_id: "p", livemode: false, currency: "mxn", status: "sent", version: 1,
  bill_cents: 50000, tip_cents: 5000, attempt_id: null, expires_at: later, updated_at: before,
  quote: {
    mechanism: "cashback", line: "welcome", discount_bps: 0, discount_cents: 0, credit_cents: 20000, outside_bill_cents: 30000,
    tip_cents: 5000, outside_cents: 35000, cashback_bps: 1000, cashback_cents: 3000,
  },
};

Deno.test("the attempt is the truth once accepted", () => {
  assertEquals(billState(bill, null, NOW), "sent");
  assertEquals(billState({ ...bill, expires_at: before }, null, NOW), "expired");
  const acc = { ...bill, status: "accepted" as const };
  assertEquals(billState(acc, att, NOW), "accepted");
  assertEquals(billState(acc, { ...att, expires_at: before }, NOW), "expired");
  assertEquals(billState(acc, { ...att, charging_at: before, expires_at: before }, NOW), "confirming");
  assertEquals(billState(acc, { ...att, status: "closed" }, NOW), "paid");
  assertEquals(billState(acc, { ...att, status: "released", end_reason: "rejected" }, NOW), "cancelled");
});

Deno.test("the waiter reads no credits before the guest accepts", () => {
  const v = staffBillView(bill, null, NOW);
  assertEquals([v.credit_cents, v.outside_cents], [0, null]);
  const a = staffBillView({ ...bill, status: "accepted" }, att, NOW);
  assertEquals([a.credit_cents, a.outside_cents], [20000, 35000]);
});

Deno.test("what opens a bill", () => {
  const id = "00000000-0000-4000-8000-0000000a4833";
  assertEquals(readOpenBy({ code: "012345" }), null);
  assertEquals(readOpenBy({ token: "nope" }), null);
  assertEquals(readOpenBy({ again_bill_id: id }), { kind: "again", billId: id });
  assertEquals(readSignInBy({ code: "012345" }), null);
  assertEquals(readSignInBy({ bill_id: id }), { kind: "bill", billId: id });
  assertEquals([readCents(0, 1), readCents(0, 0), readCents(1.5, 1), readCents("5", 1)], [null, 0, null, null]);
});

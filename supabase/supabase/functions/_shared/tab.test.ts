// MESITA-3562 — Pay at the table: the doors' money and auth rules that live
// in TypeScript (the ledger's are pgTAP's, pay_tabs.test.sql).

import { assertEquals } from "jsr:@std/assert@1";
import { effectiveStatus, hashTabStaffKey, hashTabToken, readBillBody, readCashBody, readSplitBody, rpcRefusal, type TabPartRow, type TabRow, tabMoney } from "./tab.ts";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUv";
const TAB = "00000000-0000-4000-8000-000000003562";
const REQ = "00000000-0000-4000-8000-0000000a3562";

Deno.test("Received needs staff: the guest's QR token alone is refused", () => {
  const r = readCashBody({ token: TOKEN });
  assertEquals(r.ok ? null : [r.status, r.code], [403, "staff_only"]);
  assertEquals(readCashBody({ token: TOKEN, staff_token: "s1.x" }).ok, true);
});

Deno.test("billing needs staff and the version the screen read", () => {
  const noKey = readBillBody({ token: TOKEN, bill_cents: 30000, bill_version: 0 });
  assertEquals(noKey.ok ? null : noKey.code, "staff_only");
  const noVersion = readBillBody({ token: TOKEN, place_code: "123456", bill_cents: 30000 });
  assertEquals(noVersion.ok ? null : noVersion.code, "bad_request");
  const zero = readBillBody({ token: TOKEN, place_code: "123456", bill_cents: 0, bill_version: 0 });
  assertEquals(zero.ok ? null : zero.code, "amount_required");
  const ok = readBillBody({ token: TOKEN, place_code: "123456", bill_cents: 30000, tip_cents: 4500, bill_version: 0, waiter_name: "  Ana " });
  assertEquals(ok.ok ? [ok.input.billCents, ok.input.tipCents, ok.input.waiterName] : null, [30000, 4500, "Ana"]);
});

Deno.test("the split: whole centavos, never a credit tip", () => {
  const base = { tab_id: TAB, request_id: REQ, bill_version: 1, credit_cents: 1000, cash_bill_cents: 2000, cash_tip_cents: 300 };
  const ok = readSplitBody(base);
  assertEquals(ok.ok ? [ok.input.creditCents, ok.input.cashBillCents, ok.input.cashTipCents, ok.input.cardBillCents] : null, [1000, 2000, 300, 0]);
  const creditTip = readSplitBody({ ...base, credit_tip_cents: 100 });
  assertEquals(creditTip.ok ? null : creditTip.code, "tip_by_credit");
  const negative = readSplitBody({ ...base, cash_bill_cents: -1 });
  assertEquals(negative.ok ? null : negative.code, "parts");
  const fractional = readSplitBody({ ...base, credit_cents: 10.5 });
  assertEquals(fractional.ok ? null : fractional.code, "parts");
  const noRequest = readSplitBody({ ...base, request_id: undefined });
  assertEquals(noRequest.ok ? null : noRequest.code, "bad_request");
});

Deno.test("a short Received answers what is missing", () => {
  const r = rpcRefusal({ ok: false, code: "short", missing_cents: 1000, cash_bill_cents: 10000 });
  assertEquals([r.status, r.code, r.detail?.missing_cents], [409, "short", 1000]);
  assertEquals(rpcRefusal({ ok: false, code: "staff_key" }).status, 403);
});

Deno.test("the token and the staff key hash apart", async () => {
  assertEquals((await hashTabToken(TOKEN)) === (await hashTabStaffKey(TOKEN)), false);
  assertEquals((await hashTabToken(TOKEN)).length, 64);
});

function tab(over: Partial<TabRow> = {}): TabRow {
  return {
    id: TAB, place_id: TAB, consumer_id: REQ, status: "paying", currency: "mxn", livemode: false,
    bill_cents: 32000, tip_cents: 4500, ticket: null, bill_version: 2, waiter_name: null, staff_key_hash: "x".repeat(64),
    credit_cents: 22000, cash_bill_cents: 10000, cash_tip_cents: 4500, card_bill_cents: 0, card_tip_cents: 0,
    cash_received_cents: null, billed_at: null, paying_at: null, paid_at: null,
    expires_at: "2026-11-09T10:30:00Z", updated_at: "2026-11-09T10:00:00Z", ...over,
  };
}

function part(over: Partial<TabPartRow> = {}): TabPartRow {
  return {
    id: REQ, part: "outside", status: "open", credit_cents: 22000, outside_cents: 10000, card_cents: 0, tip_cents: 4500,
    cashback_cents: 0, paid_at: null, proof_token: null, created_at: "2026-11-09T10:00:00Z", ...over,
  };
}

Deno.test("cashback: the place's cash rate on the cash bill part only, never credits or the tip", () => {
  assertEquals(tabMoney(tab(), [part()], 200).cashback_cents, 200);
  assertEquals(tabMoney(tab(), [part()], 700).cashback_cents, 700);
  assertEquals(tabMoney(tab(), [part()], 0).cashback_cents, 0);
  assertEquals(tabMoney(tab(), [part()], 200).cash_due_cents, 14500);
});

Deno.test("a stale tab reads expired, unless a part is in flight or paid", () => {
  const late = Date.parse("2026-11-09T11:00:00Z");
  assertEquals(effectiveStatus(tab({ status: "billed" }), [], late), "expired");
  assertEquals(effectiveStatus(tab(), [part()], late), "paying");
  assertEquals(effectiveStatus(tab(), [part({ status: "paid", paid_at: "2026-11-09T10:10:00Z" })], late), "paid");
  assertEquals(effectiveStatus(tab({ status: "billed" }), [], Date.parse("2026-11-09T10:10:00Z")), "billed");
});

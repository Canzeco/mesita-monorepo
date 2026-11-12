// MESITA-3562 — Pay at the table: the doors' money and auth rules that live
// in TypeScript (the ledger's are pgTAP's, pay_tabs.test.sql).

import { assertEquals } from "jsr:@std/assert@1";
import { callTabRpc, cashbackGranted, cashbackOnSign, effectiveStatus, guestTabView, guestRefusal, readGuestPayBody, hashTabStaffKey, hashTabToken, readBillBody, readCashBody, readSplitBody, readSplitTabBody, rpcRefusal, tableView, type TabPartRow, type TabRow, tabMoney } from "./tab.ts";

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

// ── Friends split one bill (MESITA-3695) ────────────────────────────────────

Deno.test("the table: paid, taken and left from its live shares; expired and cancelled shares hold nothing", () => {
  const now = Date.parse("2026-11-09T10:10:00Z");
  const table = tab({ status: "billed", bill_cents: 100000, tip_cents: 10000, split_ways: 3, split_at: "2026-11-09T10:00:00Z" });
  const share = (id: string, over: Partial<TabRow>) =>
    tab({ id, parent_tab_id: TAB, credit_cents: 0, cash_bill_cents: 0, cash_tip_cents: 0, ...over });
  const v = tableView(table, [
    share("s1", { status: "paid", bill_cents: 40000, cash_bill_cents: 40000, cash_tip_cents: 4000, cash_received_cents: 44000 }),
    share("s2", { status: "paying", bill_cents: 30000, card_bill_cents: 30000, expires_at: "2026-11-09T10:05:00Z" }),
    share("s3", { status: "billed", bill_cents: 30000, tip_cents: 3000 }),
    share("s4", { status: "billed", bill_cents: 30000, expires_at: "2026-11-09T10:05:00Z" }),
    share("s5", { status: "cancelled", bill_cents: 30000 }),
  ], now);
  assertEquals([v.paid_cents, v.taken_cents, v.left_cents, v.ways], [40000, 70000, 30000, 3]);
  assertEquals(v.shares.map((s) => [s.id, s.status]), [["s1", "paid"], ["s2", "paying"], ["s3", "billed"]]);
  assertEquals(v.shares[0].cash_due_cents, 44000);
  assertEquals(v.shares[2].tip_cents, 3000);
  assertEquals(v.status, "billed");
});

Deno.test("a split table past its time with nothing moving reads expired; a share in flight keeps it open", () => {
  const late = Date.parse("2026-11-09T11:00:00Z");
  const table = tab({ status: "billed", bill_cents: 100000, split_at: "2026-11-09T10:00:00Z" });
  const paid = tab({ id: "s1", parent_tab_id: TAB, status: "paid", bill_cents: 50000 });
  assertEquals(tableView(table, [paid], late).status, "expired");
  assertEquals(tableView(table, [paid], late).paid_cents, 50000);
  const paying = tab({ id: "s2", parent_tab_id: TAB, status: "paying", bill_cents: 50000 });
  assertEquals(tableView(table, [paid, paying], late).status, "billed");
});

Deno.test("the split body: ways 2 to 20 with a share, whole, or a share alone", () => {
  assertEquals(readSplitTabBody({ tab_id: TAB, ways: 2, share_cents: 50000 }), { ok: true, input: { kind: "split", tabId: TAB, ways: 2, shareCents: 50000 } });
  assertEquals(readSplitTabBody({ tab_id: TAB, whole: true }), { ok: true, input: { kind: "whole", tabId: TAB } });
  assertEquals(readSplitTabBody({ tab_id: TAB, share_cents: 100 }), { ok: true, input: { kind: "share", tabId: TAB, shareCents: 100 } });
  for (const bad of [{ tab_id: TAB, ways: 1, share_cents: 100 }, { tab_id: TAB, ways: 21, share_cents: 100 }, { tab_id: TAB, ways: 2 }, { tab_id: TAB, share_cents: 0 }, { tab_id: "x", whole: true }]) {
    assertEquals(readSplitTabBody(bad).ok, false);
  }
});

Deno.test("a split guard's raise is a refusal the screens can read, with what is left", async () => {
  const fake = (message: string) => ({ rpc: () => Promise.resolve({ data: null, error: { message } }) }) as unknown as Parameters<typeof callTabRpc>[0];
  assertEquals(await callTabRpc(fake("share_too_big:50000"), "pay_tab_open_parts", {}), { ok: false, code: "share_too_big", left_cents: 50000 });
  assertEquals(await callTabRpc(fake("split_locked"), "pay_tab_open_parts", {}), { ok: false, code: "split_locked" });
  assertEquals(rpcRefusal({ ok: false, code: "share_too_big", left_cents: 50000 }).status, 409);
  let threw = false;
  try {
    await callTabRpc(fake("deadlock detected"), "pay_tab_open_parts", {});
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

// ── Guest pays, waiter verifies (MESITA-3707) ──────────────────────────────
// Money: a refused guest tap rolls back in SQL and must reach the guest as its
// refusal (never a 500 or a half-made payment); the typed bill is whole
// centavos and the tip is never paid by credit.

Deno.test("a guest's refused tap reads back as its refusal", async () => {
  const msg = 'guest_refused:{"ok": false, "code": "insufficient", "spendable_cents": 7000}';
  assertEquals(guestRefusal(msg), { ok: false, code: "insufficient", spendable_cents: 7000 });
  assertEquals(guestRefusal("something else"), null);
  const rpc = { rpc: () => Promise.resolve({ data: null, error: { message: msg } }) } as unknown as Parameters<typeof callTabRpc>[0];
  assertEquals((await callTabRpc(rpc, "pay_tab_guest_pay", {})).code, "insufficient");
});

Deno.test("the guest's tap: a typed bill in whole centavos, never a credit tip", () => {
  const base = { place_id: "00000000-0000-4000-8000-000000003707", request_id: "00000000-0000-4000-8000-0000000e3707" };
  const ok = readGuestPayBody({ ...base, bill_cents: 45000, credit_cents: 20000, cash_bill_cents: 25000, cash_tip_cents: 4500 });
  assertEquals(ok.ok && ok.input.billCents, 45000);
  assertEquals(ok.ok && ok.input.cashTipCents, 4500);
  const noBill = readGuestPayBody({ ...base, credit_cents: 100 });
  assertEquals(noBill.ok ? null : noBill.code, "amount_required");
  const half = readGuestPayBody({ ...base, bill_cents: 100.5, credit_cents: 100 });
  assertEquals(half.ok ? null : half.code, "amount_required");
  const creditTip = readGuestPayBody({ ...base, bill_cents: 100, credit_cents: 100, credit_tip_cents: 10 });
  assertEquals(creditTip.ok ? null : creditTip.code, "tip_by_credit");
  const noCard = readGuestPayBody({ ...base, bill_cents: 100, card_bill_cents: 100 });
  assertEquals(noCard.ok ? null : noCard.code, "card_required");
});

// ━━━ MESITA-3772: the signature turns cashback on ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const NOW = Date.parse("2026-11-09T10:10:00Z");

function guestTab(over: Partial<TabRow> = {}): TabRow {
  return tab({ origin: "guest", verified_at: null, credit_cents: 0, cash_bill_cents: 10000, cash_tip_cents: 0, card_bill_cents: 20000, ...over });
}
const cardPart = (over: Partial<TabPartRow> = {}) =>
  part({ id: "card", part: "card", status: "paid", credit_cents: 0, outside_cents: 0, card_cents: 20000, tip_cents: 0, paid_at: "2026-11-09T10:01:00Z", cashback_bps: 500, ...over });
const cashPart = (over: Partial<TabPartRow> = {}) =>
  part({ credit_cents: 0, outside_cents: 10000, tip_cents: 0, outside_cashback_bps: 200, ...over });

Deno.test("cashbackOnSign: an unsigned guest tab's settled card and pending cash earn only on signing", () => {
  // 5% of $200 card + 2% of $100 cash.
  assertEquals(cashbackOnSign(guestTab(), [cardPart(), cashPart()], 200, 500, NOW), 1000 + 200);
  // A card still going through counts too; a failed one does not.
  assertEquals(cashbackOnSign(guestTab(), [cardPart({ status: "open", paid_at: null })], 0, 500, NOW), 1000);
  assertEquals(cashbackOnSign(guestTab(), [cardPart({ status: "failed", paid_at: null })], 0, 500, NOW), 0);
  // Nothing once signed, closed (window over) or cancelled, nor on a waiter's tab.
  assertEquals(cashbackOnSign(guestTab({ verified_at: "2026-11-09T10:05:00Z" }), [cardPart()], 200, 500, NOW), 0);
  assertEquals(cashbackOnSign(guestTab({ status: "paid", expires_at: "2026-11-09T10:09:00Z" }), [cardPart()], 200, 500, NOW), 0);
  assertEquals(cashbackOnSign(guestTab({ status: "cancelled" }), [cardPart()], 200, 500, NOW), 0);
  assertEquals(cashbackOnSign(tab({ card_bill_cents: 20000 }), [cardPart()], 200, 500, NOW), 0);
});

Deno.test("guest view: cashback_cents is what was granted, never the promise", () => {
  const extra = { placeName: null, spendableCents: 0, cashOk: true, cashBackBps: 200, nowMs: NOW,
    card: { card_available: true, card_unavailable_code: null, card_back_bps: 500, card_minimum_cents: 0 } };
  const unsigned = guestTabView(guestTab(), [cardPart(), cashPart()], extra);
  assertEquals([unsigned.cashback_cents, unsigned.cashback_on_sign_cents], [0, 1200]);
  const signed = guestTabView(guestTab({ status: "paid", verified_at: "2026-11-09T10:05:00Z" }),
    [cardPart({ cashback_cents: 1000 }), cashPart({ status: "paid", paid_at: "2026-11-09T10:05:00Z", cashback_cents: 200 })], extra);
  assertEquals([signed.cashback_cents, signed.cashback_on_sign_cents], [1200, 0]);
  assertEquals(cashbackGranted([cardPart({ cashback_cents: 1000 }), cashPart({ cashback_cents: 200 })]), 1000);
});

Deno.test("too_many_open names the open payment", () => {
  const r = rpcRefusal({ ok: false, code: "too_many_open", max_open: 1, open_tab_id: TAB, open_place_id: TAB });
  assertEquals([r.status, r.error, r.detail?.open_tab_id], [409, "Get your open payment signed or close it before paying again.", TAB]);
});

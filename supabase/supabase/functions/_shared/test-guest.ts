// The test guest (MESITA-4931): the account the app's end-to-end flows and the
// store reviewers sign in with. Its code is written down outside Mesita, so
// the backend limits it: consumers.is_test_guest, read by the guest doors in
// request.ts. It holds no money, reserves only at a place marked
// places.is_test_place, shows in nobody's Social (consumer_social_level) and
// counts in no place's views.
//
// Every consumer-web-* function has one rule here (test-guest.test.ts walks
// the folder). Only a rule other than "open" costs the flag read.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json } from "./http.ts";

/** open        the test guest is like anyone
 *  buy · pay · credit   refused at the door
 *  account     refused: a deleted account would sign in again unflagged
 *  reserve     the handler asks refuseOutsideTestPlace
 *  uncounted   the handler writes nothing a place or another guest sees */
export type TestGuestRule = "open" | "buy" | "pay" | "credit" | "account" | "reserve" | "uncounted";

export const TEST_GUEST_RULES: Record<string, TestGuestRule> = {
  "consumer-web-add-card": "buy",
  "consumer-web-add-loyalty-card": "open",
  "consumer-web-answer-bill": "pay",
  "consumer-web-ask-memo": "open",
  "consumer-web-buy-voucher": "buy",
  "consumer-web-cancel-plan": "open",
  "consumer-web-cancel-reservation": "open",
  "consumer-web-cancel-tab": "open",
  "consumer-web-claim-credit": "credit",
  "consumer-web-claim-instagram": "open",
  "consumer-web-confirm-reservation": "reserve",
  "consumer-web-create-place": "open",
  "consumer-web-create-reservation": "reserve",
  "consumer-web-delete-account": "account",
  "consumer-web-express-pay-setup": "buy",
  "consumer-web-get-calendar-feed": "open",
  "consumer-web-get-calendar-link": "open",
  "consumer-web-get-gift-link": "open",
  "consumer-web-get-gift-preview": "open",
  "consumer-web-get-pay-code": "pay",
  "consumer-web-get-pay-place-name": "open",
  "consumer-web-get-payment": "open",
  "consumer-web-get-person": "open",
  "consumer-web-get-place": "open",
  "consumer-web-get-plan": "open",
  "consumer-web-get-premier-refill": "open",
  "consumer-web-get-profile": "open",
  "consumer-web-get-tab": "open",
  "consumer-web-get-wallet": "open",
  "consumer-web-join-tab": "pay",
  "consumer-web-list-activity": "open",
  "consumer-web-list-cards": "open",
  "consumer-web-list-catalog": "open",
  "consumer-web-list-pay-notifications": "open",
  "consumer-web-list-pay-places": "open",
  "consumer-web-list-place-likes": "open",
  "consumer-web-list-places": "open",
  "consumer-web-list-reservations": "open",
  "consumer-web-list-saved-locations": "open",
  "consumer-web-list-saved-places": "open",
  "consumer-web-list-visits": "open",
  "consumer-web-list-vouchers": "open",
  "consumer-web-open-tab": "pay",
  "consumer-web-pay-guest": "pay",
  "consumer-web-pay-tab": "pay",
  // No session reaches it: an ad counter, not a view.
  "consumer-web-record-premier-ad": "open",
  "consumer-web-redeem-vip-code": "open",
  "consumer-web-release-payment": "open",
  "consumer-web-remove-card": "open",
  "consumer-web-remove-loyalty-card": "open",
  "consumer-web-report-place": "open",
  "consumer-web-reverse-geocode": "open",
  "consumer-web-save-location": "open",
  "consumer-web-send-credit": "credit",
  "consumer-web-send-feedback": "open",
  "consumer-web-set-pay-method": "open",
  "consumer-web-signin-phone": "open",
  "consumer-web-split-tab": "pay",
  "consumer-web-start-payment": "pay",
  "consumer-web-start-plan": "buy",
  "consumer-web-start-premier-refill": "buy",
  "consumer-web-suggest-places": "open",
  "consumer-web-take-back-credit": "credit",
  "consumer-web-track-activity": "uncounted",
  "consumer-web-track-event": "open",
  "consumer-web-track-place-share": "uncounted",
  "consumer-web-update-profile": "open",
  "consumer-web-update-reservation": "reserve",
};

const REFUSALS: Partial<Record<TestGuestRule, string>> = {
  buy: "This is a test account. It can't buy.",
  pay: "This is a test account. It can't pay.",
  credit: "This is a test account. It can't send or receive credit.",
  account: "This is a test account. It can't be deleted.",
};

export function testGuestRule(fnName: string | undefined): TestGuestRule {
  return (fnName && TEST_GUEST_RULES[fnName]) || "open";
}

/** Whether this guest is the test guest. A failed read says no, so an outage
 *  never refuses a real guest. */
async function readTestGuest(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin.from("consumers").select("is_test_guest").eq("id", userId).maybeSingle();
  if (error) console.error(`[test-guest] read: ${error.message}`);
  return (data as { is_test_guest?: boolean } | null)?.is_test_guest === true;
}

/** What the door does with this guest: the refusal to send, or whether the
 *  handler must limit them. An "open" function reads nothing. */
export async function checkTestGuest(
  admin: SupabaseClient,
  userId: string,
  rule: TestGuestRule,
): Promise<{ refusal: Response | null; testGuest: boolean }> {
  if (rule === "open") return { refusal: null, testGuest: false };
  const testGuest = await readTestGuest(admin, userId);
  const error = testGuest ? REFUSALS[rule] : undefined;
  return { refusal: error ? json({ ok: false, code: "test_guest", error }, 403) : null, testGuest };
}

/** The 403 for the test guest at any place but a test one, or null. Anyone
 *  else passes with no read. An unreadable place is refused. */
export async function refuseOutsideTestPlace(
  ctx: { admin: SupabaseClient; testGuest: boolean },
  placeId: string,
): Promise<Response | null> {
  if (!ctx.testGuest) return null;
  const { data, error } = await ctx.admin.from("places").select("is_test_place").eq("id", placeId).maybeSingle();
  if (error) console.error(`[test-guest] place read: ${error.message}`);
  if ((data as { is_test_place?: boolean } | null)?.is_test_place === true) return null;
  return json({ ok: false, code: "test_guest", error: "This is a test account. It can only reserve at the test place." }, 403);
}

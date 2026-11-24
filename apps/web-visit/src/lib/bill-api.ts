// Waiter-led pay (MESITA-4823), the waiter's calls. Every rule and peso is
// the server's; nothing here names the guest.

import { post } from "./visit-api";

export type BillState = "open" | "sent" | "accepted" | "confirming" | "paid" | "declined" | "cancelled" | "expired";

export type Bill = {
  id: string;
  state: BillState;
  /** An edit carries the version the screen read (409 stale otherwise). */
  version: number;
  currency: string;
  bill_cents: number | null;
  tip_cents: number;
  /** From the moment the bill is sent (MESITA-4889). */
  discount_cents: number;
  credit_cents: number;
  outside_bill_cents: number | null;
  outside_cents: number | null;
  expires_at: string;
  updated_at: string;
  test_mode: boolean;
  /** The waiter tapped Receive on this version. */
  waiter_ready?: boolean;
  /** What that tap said was taken, even if the bill changed since. */
  took_cents?: number | null;
};
export type BillRead = { bill: Bill; place: { id: string; name: string | null }; guest_photo: string | null; guest_name?: string | null };

export type Refused = { refused: true; code: string; error: string };
const refused = (data: Record<string, unknown>, fallback: string): Refused => ({
  refused: true,
  code: typeof data.code === "string" ? data.code : "refused",
  error: typeof data.error === "string" ? data.error : fallback,
});

async function call<T>(name: string, body: Record<string, unknown>, fallback: string): Promise<T | Refused | "failed"> {
  const { res, data } = await post(name, body);
  if (data?.ok) return data as unknown as T;
  if (!res || res.status >= 500 || !data) return "failed";
  return refused(data, fallback);
}

/** `waiter`: the name the code answered, for the receipt; never sent. */
export type Staff = { place_id: string; staff_token: string; waiter?: string | null };
const keyed = (s: Staff) => ({ place_id: s.place_id, staff_token: s.staff_token });

/** The waiter's 8-digit code; it names the place and the waiter, and is tried
 *  only with the guest's QR or a bill (MESITA-4833). */
export const signIn = (code: string, by: { token: string } | { bill_id: string }) =>
  call<{ place: { id: string; name: string | null }; waiter?: { name: string }; staff_token: string }>("visit-web-sign-in", { code, ...by }, "Couldn't check the code. Try again.");

// The staff key of one bill, in this tab only: the code is typed once per
// bill, and nothing about the phone is remembered (MESITA-4827).
const keyOf = (billId: string) => `mesita.bill.${billId}`;
export function readBillStaff(billId: string): Staff | null {
  try {
    return JSON.parse(sessionStorage.getItem(keyOf(billId)) ?? "null") as Staff | null;
  } catch {
    return null;
  }
}
export function keepBillStaff(billId: string, staff: Staff | null) {
  try {
    if (staff) sessionStorage.setItem(keyOf(billId), JSON.stringify(staff));
    else sessionStorage.removeItem(keyOf(billId));
  } catch {
    // Private mode: the bill asks for the code again.
  }
}

/** What is on the keypad, for the guest's screen (MESITA-4883). Display only:
 *  a lost one is nothing. */
export type Typing = { bill_cents: number; tip_cents: number; step: "bill" | "tip" | "code" };
export const typeBill = (token: string, typing: Typing) => post("visit-web-type-bill", { token, ...typing });

export const openBill = (staff: Staff, by: { token: string } | { again_bill_id: string }) =>
  call<{ bill_id: string }>("visit-web-open-bill", { ...keyed(staff), ...by }, "Couldn't open the bill. Try again.");

export const sendBill = (staff: Staff, args: { bill_id: string; version: number; bill_cents: number; tip_cents: number }) =>
  call<{ version: number }>("visit-web-send-bill", { ...keyed(staff), ...args }, "Couldn't send the bill. Try again.");

export const getBill = (staff: Staff, bill_id: string) => call<BillRead>("visit-web-get-bill", { ...keyed(staff), bill_id }, "Couldn't read the bill.");

/** The waiter's side of the handshake (MESITA-4889): `paid` when the guest
 *  already paid, `ready` when not. */
export const receiveBill = (staff: Staff, bill_id: string, version: number) =>
  call<{ outcome: string }>("visit-web-close-bill", { ...keyed(staff), bill_id, action: "receive", version }, "Couldn't reach Mesita. Tap again.");
export const unreceiveBill = (staff: Staff, bill_id: string) =>
  call<{ outcome: string }>("visit-web-close-bill", { ...keyed(staff), bill_id, action: "unreceive" }, "Couldn't reach Mesita. Tap again.");

export const closeBill = (staff: Staff, bill_id: string, action: "cancel") =>
  call<{ outcome: string }>("visit-web-close-bill", { ...keyed(staff), bill_id, action }, "Couldn't reach Mesita. Tap again.");

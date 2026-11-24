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
  /** Filled only once the guest accepted. */
  discount_cents: number;
  credit_cents: number;
  outside_bill_cents: number | null;
  outside_cents: number | null;
  expires_at: string;
  updated_at: string;
  test_mode: boolean;
};
export type BillRead = { bill: Bill; place: { id: string; name: string | null }; guest_photo: string | null };

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

export type Staff = { place_id: string; staff_token: string };

/** The place's 6-digit code; the code alone names the place, and is tried
 *  only with the guest's QR or a bill (MESITA-4833). */
export const signIn = (code: string, by: { token: string } | { bill_id: string }) =>
  call<{ place: { id: string; name: string | null }; staff_token: string }>("visit-web-sign-in", { code, ...by }, "Couldn't check the code. Try again.");

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

export const openBill = (staff: Staff, by: { token: string } | { again_bill_id: string }) =>
  call<{ bill_id: string }>("visit-web-open-bill", { ...staff, ...by }, "Couldn't open the bill. Try again.");

export const sendBill = (staff: Staff, args: { bill_id: string; version: number; bill_cents: number; tip_cents: number }) =>
  call<{ version: number }>("visit-web-send-bill", { ...staff, ...args }, "Couldn't send the bill. Try again.");

export const getBill = (staff: Staff, bill_id: string) => call<BillRead>("visit-web-get-bill", { ...staff, bill_id }, "Couldn't read the bill.");

export const closeBill = (staff: Staff, bill_id: string, action: "received" | "cancel") =>
  call<{ outcome: string }>("visit-web-close-bill", { ...staff, bill_id, action }, "Couldn't reach Mesita. Tap again.");

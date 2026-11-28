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
export type BillRead = { bill: Bill; place: { id: string; name: string | null }; guest_photo: string | null; guest_name?: string | null; guest_age?: number | null; guest_sex?: "female" | "male" | null };

export type Refused = { refused: true; code: string; error: string; name_required?: boolean };
const refused = (data: Record<string, unknown>, fallback: string): Refused => ({
  refused: true,
  code: typeof data.code === "string" ? data.code : "refused",
  error: typeof data.error === "string" ? data.error : fallback,
  name_required: data.name_required === true || data.code === "name_needed",
});

async function call<T>(name: string, body: Record<string, unknown>, fallback: string): Promise<T | Refused | "failed"> {
  const { res, data } = await post(name, body);
  if (data?.ok) return data as unknown as T;
  if (!res || res.status >= 500 || !data) return "failed";
  return refused(data, fallback);
}

/** `waiter`: the name typed with the code, for the receipt; never sent. */
export type Staff = { place_id: string; staff_token: string; waiter?: string | null };
const keyed = (s: Staff) => ({ place_id: s.place_id, staff_token: s.staff_token });

/** The place's 6-digit code, with the waiter's name where the owner asks for
 *  one (MESITA-4904: refused `name_needed`, or `name_required` on code_needed). Tried
 *  only with the guest's QR or a bill (MESITA-4833). Every bill needs it. */
export const signIn = (code: string, by: { token: string } | { bill_id: string }, name: string | null = null) =>
  call<{ place: { id: string; name: string | null }; waiter?: { name: string } | null; staff_token: string }>("visit-web-sign-in", { code, ...(name ? { name } : {}), ...by }, "Couldn't check the code. Try again.");

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

// What is typed and not sent yet, in this tab: a reload loses nothing (MESITA-4916).
const draftOf = (billId: string) => `mesita.bill-draft.${billId}`;
export function readBillDraft(billId: string): { bill: number; tip: number } | undefined {
  try {
    return (JSON.parse(sessionStorage.getItem(draftOf(billId)) ?? "null") as { bill: number; tip: number } | null) ?? undefined;
  } catch {
    return undefined;
  }
}
export function keepBillDraft(billId: string, draft: { bill: number; tip: number } | null) {
  try {
    if (draft) sessionStorage.setItem(draftOf(billId), JSON.stringify(draft));
    else sessionStorage.removeItem(draftOf(billId));
  } catch {
    // Private mode: a reload types it again.
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

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

export const signIn = (place_id: string, place_code?: string) =>
  call<{ place: { id: string; name: string | null }; has_code: boolean; staff_token?: string | null; staff_expires_at?: string | null }>(
    "visit-web-sign-in",
    { place_id, ...(place_code ? { place_code } : {}) },
    "Couldn't sign in. Try again.",
  );

export const openBill = (staff: Staff, by: { token: string } | { code: string } | { again_bill_id: string }) =>
  call<{ bill_id: string }>("visit-web-open-bill", { ...staff, ...by }, "Couldn't open the bill. Try again.");

export const sendBill = (staff: Staff, args: { bill_id: string; version: number; bill_cents: number; tip_cents: number }) =>
  call<{ version: number }>("visit-web-send-bill", { ...staff, ...args }, "Couldn't send the bill. Try again.");

export const getBill = (staff: Staff, bill_id: string) => call<BillRead>("visit-web-get-bill", { ...staff, bill_id }, "Couldn't read the bill.");

export const closeBill = (staff: Staff, bill_id: string, action: "received" | "cancel") =>
  call<{ outcome: string }>("visit-web-close-bill", { ...staff, bill_id, action }, "Couldn't reach Mesita. Tap again.");

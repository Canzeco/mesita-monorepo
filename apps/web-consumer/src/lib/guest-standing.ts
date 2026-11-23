// Plan (Pato, MESITA-2553): the subscription, Free or Pro. The server sends
// the stored word; anything else reads as the plain value, so a guest is
// never shown a status they do not have.
//
// NO CLASS (Pato, 2026-11-22, MESITA-4709: "no more VIP"), then VIP BACK
// (MESITA-4766): a VIP reads it on Me (lib/vip.ts); a non-VIP never reads
// the word "Regular".

export type GuestPlan = "free" | "premium";

export function toGuestPlan(v: unknown): GuestPlan {
  return v === "premium" ? "premium" : "free";
}

/** The words the app shows (MESITA-2553). */
// The stored value stays "premium"; the word shown is Pro (MESITA-2948; Premier was MESITA-2942, now the paid place tier).
export const PLAN_LABEL: Record<GuestPlan, string> = { free: "Free", premium: "Pro" };

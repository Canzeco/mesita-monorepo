// Plan (Pato, MESITA-2553): the subscription, Free or Pro. The server sends
// the stored word; anything else reads as the plain value, so a guest is
// never shown a status they do not have.
//
// CLASS IS BACK ON ME (MESITA-4639, Pato 2026-11-22: "Name left, Class right
// … Class is regular class and vip class. vip class is if you have more than
// 5000 followers on instagram"). The server computes consumers.guest_class
// (generated); the app only reads it. Anything but "vip" reads Regular.

export type GuestPlan = "free" | "premium";

export function toGuestPlan(v: unknown): GuestPlan {
  return v === "premium" ? "premium" : "free";
}

/** The words the app shows (MESITA-2553). */
// The stored value stays "premium"; the word shown is Pro (MESITA-2948; Premier was MESITA-2942, now the paid place tier).
export const PLAN_LABEL: Record<GuestPlan, string> = { free: "Free", premium: "Pro" };

export type GuestClass = "regular" | "vip";

export function toGuestClass(v: unknown): GuestClass {
  return v === "vip" ? "vip" : "regular";
}

/** The Class chip's words (MESITA-4639). */
export const CLASS_LABEL: Record<GuestClass, string> = { regular: "Regular", vip: "VIP" };

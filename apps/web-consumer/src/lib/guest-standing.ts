// Plan (Pato, MESITA-2553): the subscription, Free or Pro. The server sends
// the stored word; anything else reads as the plain value, so a guest is
// never shown a status they do not have.
//
// No Class here since MESITA-4306 (Pato: "LETS REMOVE THE CLASS"): the guest
// app never shows it. consumers.guest_class stays on the server.

export type GuestPlan = "free" | "premium";

export function toGuestPlan(v: unknown): GuestPlan {
  return v === "premium" ? "premium" : "free";
}

/** The words the app shows (MESITA-2553). */
// The stored value stays "premium"; the word shown is Pro (MESITA-2948; Premier was MESITA-2942, now the paid place tier).
export const PLAN_LABEL: Record<GuestPlan, string> = { free: "Free", premium: "Pro" };

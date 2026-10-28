// Plan and Class (Pato, MESITA-2553): two independent account fields.
//   Plan  — the subscription: Free or Pro.
//   Class — partnership status: Regular or VIP (through a partner; never sold,
//           never an upgrade to Pro).
// Only an operator sets either (Admin › Manage › Guests). The server sends the
// stored words; anything else reads as the plain value, so a guest is never
// shown a status they do not have.

export type GuestPlan = "free" | "premium";
export type GuestClass = "regular" | "vip";

export function toGuestPlan(v: unknown): GuestPlan {
  return v === "premium" ? "premium" : "free";
}

export function toGuestClass(v: unknown): GuestClass {
  return v === "vip" ? "vip" : "regular";
}

/** The words the app shows. Exactly these four (MESITA-2553). */
// The stored value stays "premium"; the word shown is Pro (MESITA-2948; Premier was MESITA-2942, now the paid place tier).
export const PLAN_LABEL: Record<GuestPlan, string> = { free: "Free", premium: "Pro" };
export const CLASS_LABEL: Record<GuestClass, string> = { regular: "Regular", vip: "VIP" };

// Plan and Class (Pato, MESITA-2553): two independent account fields.
//   Plan  — the subscription: Free or Pro.
//   Class — partnership status: Regular or VIP (through a partner; never sold,
//           never an upgrade to Pro).
// Only an operator sets either (Admin › Manage › Guests). The server sends the
// stored words; anything else reads as the plain value, so a guest is never
// shown a status they do not have.

export type GuestPlan = "free" | "pro";
export type GuestClass = "regular" | "vip";

export function toGuestPlan(v: unknown): GuestPlan {
  return v === "pro" ? "pro" : "free";
}

export function toGuestClass(v: unknown): GuestClass {
  return v === "vip" ? "vip" : "regular";
}

/** The words the app shows. Exactly these four (MESITA-2553). */
export const PLAN_LABEL: Record<GuestPlan, string> = { free: "Free", pro: "Pro" };
export const CLASS_LABEL: Record<GuestClass, string> = { regular: "Regular", vip: "VIP" };

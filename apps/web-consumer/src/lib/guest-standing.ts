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

/** MESITA-2556: where a VIP came from and its last day, as the guest reads
 *  them on their own Class sheet. A record, not a rule: nothing here grants a
 *  rate. A last day already past is not shown (nothing demotes a VIP yet). */
export type VipDetails = { partner: string | null; until: string | null };

export function toVipDetails(
  guestClass: GuestClass,
  partner: unknown,
  until: unknown,
  today: string = new Date().toISOString().slice(0, 10),
): VipDetails | null {
  if (guestClass !== "vip") return null;
  const p = typeof partner === "string" && partner.trim() !== "" ? partner.trim() : null;
  const u =
    typeof until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(until) && until >= today
      ? until
      : null;
  return p || u ? { partner: p, until: u } : null;
}

/** "Dec 31, 2026" for a YYYY-MM-DD day. */
export function formatVipUntil(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The words the app shows. Exactly these four (MESITA-2553). */
// The stored value stays "premium"; the word shown is Pro (MESITA-2948; Premier was MESITA-2942, now the paid place tier).
export const PLAN_LABEL: Record<GuestPlan, string> = { free: "Free", premium: "Pro" };
export const CLASS_LABEL: Record<GuestClass, string> = { regular: "Regular", vip: "VIP" };

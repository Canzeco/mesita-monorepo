// Shared consumer-plan presentation — the Free/Premium binary and the
// Premium "door" (how the consumer reached Premium). Kept in one place so
// ticket and reservation displays can't drift apart.

export type ConsumerPlan = "Premium" | "Free";

// The app speaks a Free/Premium binary; membership tiers collapsed to two,
// and "premium" is the only premium marker on the consumer row.
export function isPremiumTier(tierKey: string | null | undefined): boolean {
  return tierKey === "premium";
}

export function planLabel(tierKey: string | null | undefined): ConsumerPlan {
  return isPremiumTier(tierKey) ? "Premium" : "Free";
}

// Human label for the Premium door (consumers.tier_origin), or null when
// the origin isn't one of the three known doors.
export function premiumDoorLabel(
  origin: string | null | undefined,
): string | null {
  const o = (origin ?? "").toLowerCase();
  if (o.includes("insta") || o === "ig") return "Instagram";
  if (o.includes("sub")) return "Subscription";
  if (o.includes("invit")) return "Invitation";
  return null;
}

// Shared consumer-class presentation — the Free/Premium binary and the
// Premium "door" (how the consumer reached Premium). Kept in one place so
// ticket and reservation displays can't drift apart.
//
// Consumers belong to a "class" (free/premium) — distinct from a business
// "plan" (free/pro/ultra). The consumer row exposes class_key / class_origin.

export type ConsumerPlan = "Premium" | "Free";

// The app speaks a Free/Premium binary; membership classes collapsed to two,
// and "premium" is the only premium marker on the consumer row.
export function isPremiumClass(classKey: string | null | undefined): boolean {
  return classKey === "premium";
}

export function planLabel(classKey: string | null | undefined): ConsumerPlan {
  return isPremiumClass(classKey) ? "Premium" : "Free";
}

// Human label for the Premium door (consumers.class_origin), or null when
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

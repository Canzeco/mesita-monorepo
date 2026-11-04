// Visits and Rewards (MESITA-3202): the words the Edge Functions share. Every
// rule and every peso is decided in SQL (place_visit_create and friends); this
// module only validates what arrives and draws the guest's code.

export const REWARD_KINDS = ["welcome_visit", "returning_visit", "instagram_story", "vip_class"] as const;
export type RewardKind = typeof REWARD_KINDS[number];

export const PAYMENT_METHODS = ["cash", "card", "transfer", "other"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

/** How long a guest's code works. */
export const VISIT_CODE_MINUTES = 10;
/** Draws before giving up on a free set of digits at this place. */
export const VISIT_CODE_DRAWS = 5;

export function isRewardKind(v: unknown): v is RewardKind {
  return typeof v === "string" && (REWARD_KINDS as readonly string[]).includes(v);
}

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === "string" && (PAYMENT_METHODS as readonly string[]).includes(v);
}

export function isBillCents(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 100_000_000;
}

/** Six digits, or null. Spaces a person typed do not count. */
export function readVisitCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const code = v.replace(/\s/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

/** Six random digits, leading zeros kept. */
export function newVisitCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

/** SHA-256 hex of the code, bound to its place: the same digits mean nothing
 *  anywhere else, and only a hash is stored. */
export async function hashVisitCode(placeId: string, code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`visit:${placeId}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

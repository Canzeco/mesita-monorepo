// Visits and Rewards (MESITA-3202): the words the Edge Functions share. Every
// rule and every peso is decided in SQL (place_visit_create and friends); this
// module only validates what arrives and draws the guest's code.

export const REWARD_KINDS = ["welcome_visit", "returning_visit", "instagram_story", "vip_class"] as const;
export type RewardKind = typeof REWARD_KINDS[number];

export const PAYMENT_METHODS = ["cash", "card", "transfer", "other"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

/** How long a guest's code works. */
export const VISIT_CODE_MINUTES = 10;
/** Draws before giving up on a free code at this place. */
export const VISIT_CODE_DRAWS = 5;

export function isRewardKind(v: unknown): v is RewardKind {
  return typeof v === "string" && (REWARD_KINDS as readonly string[]).includes(v);
}

/** A list of rewards: known kinds, or null. Who qualifies is the server's. */
export function readRewardKinds(v: unknown): RewardKind[] | null {
  if (!Array.isArray(v) || v.length > REWARD_KINDS.length || !v.every(isRewardKind)) return null;
  return v;
}

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === "string" && (PAYMENT_METHODS as readonly string[]).includes(v);
}

export function isBillCents(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 100_000_000;
}

/** A place code: six digits, or null. Spaces a person typed do not count. */
export function readPlaceCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const code = v.replace(/\s/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

/** The secret in a guest's QR link, or null. */
export function readVisitCode(v: unknown): string | null {
  return typeof v === "string" && /^[0-9a-f]{32}$/.test(v) ? v : null;
}

/** 128 random bits as hex (MESITA-3240). Nobody types it, and whoever holds the
 *  link sees the guest's first name, so it must not be guessable. */
export function newVisitCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hex of the code, bound to its place: the same code means nothing
 *  anywhere else, and only a hash is stored. */
export async function hashVisitCode(placeId: string, code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`visit:${placeId}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hex of the place code (MESITA-3226), under its own prefix so it can never
 *  match a guest's code hash. Six digits are guessable from a leaked hash; the hash
 *  keeps the number out of plain sight, and the table is service-role only. */
export async function hashPlaceCode(placeId: string, code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`place-code:${placeId}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

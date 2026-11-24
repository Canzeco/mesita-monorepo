// Privacy levels (MESITA-4850): what other guests see of a member in Social.
// Private: nothing. Public: approximate age and sex, no name and no photo.
// Public + Instagram: name, photo and @handle, for guests who share theirs.
//
// MINORS ARE ALWAYS PRIVATE (Pato, 2026-11-24: "minors have their accounts in
// private automatically and cannot change that configuration. only ask for
// the year"). A year alone proves 18 only once this year − birth year is 19,
// so that is the line; no birth year is no proof. The same rule as SQL's
// consumer_social_level, which decides who the feed returns.

export const SOCIAL_LEVELS = ["private", "public", "instagram"] as const;
export type SocialLevel = typeof SOCIAL_LEVELS[number];
export type SocialLock = "minor" | "no_birth_year" | null;

const ADULT_YEARS = 19;

export function isSocialLevel(v: unknown): v is SocialLevel {
  return typeof v === "string" && (SOCIAL_LEVELS as readonly string[]).includes(v);
}

/** Why the guest cannot leave Private, or null. */
export function socialLock(birthYear: number | null | undefined, now: Date = new Date()): SocialLock {
  if (birthYear == null) return "no_birth_year";
  return now.getUTCFullYear() - birthYear < ADULT_YEARS ? "minor" : null;
}

export type SocialFacts = {
  birth_year: number | null;
  social_private: boolean | null;
  instagram_verified_at: string | null;
  instagram_handle_shown: boolean | null;
};

export function socialLevel(c: SocialFacts, now: Date = new Date()): SocialLevel {
  if (c.social_private === true || socialLock(c.birth_year, now)) return "private";
  return c.instagram_verified_at != null && c.instagram_handle_shown === true ? "instagram" : "public";
}

/** The columns a chosen level writes. The two flags always move together. */
export function levelPatch(level: SocialLevel): { social_private: boolean; instagram_handle_shown: boolean } {
  return { social_private: level === "private", instagram_handle_shown: level === "instagram" };
}

/** "early 20s" · "mid 20s" · "late teens" · "60+". Null for anyone who is not
 *  surely an adult: a minor's age is never worded. */
export function approxAge(birthYear: number | null | undefined, now: Date = new Date()): string | null {
  if (birthYear == null || socialLock(birthYear, now)) return null;
  const age = now.getUTCFullYear() - birthYear;
  if (age < 20) return "late teens";
  if (age >= 60) return "60+";
  const unit = age % 10;
  return `${unit < 4 ? "early" : unit < 7 ? "mid" : "late"} ${age - unit}s`;
}

/** Who a Public member is in words: "Woman, mid 20s". */
export function socialLabel(birthYear: number | null | undefined, sex: string | null | undefined, now: Date = new Date()): string {
  const age = approxAge(birthYear, now);
  if (!age) return "Guest";
  const who = sex === "female" ? "Woman" : sex === "male" ? "Man" : "Guest";
  return `${who}, ${age}`;
}

/** Sex as the mark shows it; never for anyone who is not surely an adult. */
export function shownSex(birthYear: number | null | undefined, sex: string | null | undefined, now: Date = new Date()): "female" | "male" | null {
  if (!approxAge(birthYear, now)) return null;
  return sex === "female" || sex === "male" ? sex : null;
}

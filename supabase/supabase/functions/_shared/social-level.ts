// Privacy levels (MESITA-4850): what other guests see of a member in Social.
// A PRIVATE MEMBER SEES NOBODY EITHER (Pato, 2026-11-24, MESITA-4854: "other
// guests never see your activity, but you cannot see activity of others if
// private"); a Public one sees everyone but their Instagram.
// Private: nothing. Public: first name, age and sex, no photo.
// Instagram is never shown to a guest (MESITA-4863): it only unlocks VIP.
//
// MINORS ARE ALWAYS PRIVATE (Pato, 2026-11-24: "minors have their accounts in
// private automatically and cannot change that configuration. only ask for
// the year"). A year alone proves 18 only once this year − birth year is 19,
// so that is the line; no birth year is no proof. The same rule as SQL's
// consumer_social_level, which decides who the feed returns.

export const SOCIAL_LEVELS = ["private", "public"] as const;
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
};

export function socialLevel(c: SocialFacts, now: Date = new Date()): SocialLevel {
  if (c.social_private === true || socialLock(c.birth_year, now)) return "private";
  return "public";
}

/** Why this member sees nobody's activity, or null when they do. */
export function socialBlocked(c: SocialFacts | null, now: Date = new Date()): "private" | "minor" | "no_birth_year" | null {
  if (!c) return "no_birth_year";
  return socialLock(c.birth_year, now) ?? (socialLevel(c, now) === "private" ? "private" : null);
}

/** The column a chosen level writes. */
export function levelPatch(level: SocialLevel): { social_private: boolean } {
  return { social_private: level === "private" };
}

/** The age another guest may see, by the year alone. Null for anyone who is
 *  not surely an adult. A number, never words (Pato, 2026-11-24, MESITA-4854:
 *  "don't say early twenties"). */
export function shownAge(birthYear: number | null | undefined, now: Date = new Date()): number | null {
  if (birthYear == null || socialLock(birthYear, now)) return null;
  return now.getUTCFullYear() - birthYear;
}

/** A member with no name to show. The words never say age or sex: the face
 *  does (Pato, 2026-11-24, MESITA-4857: "redundant, the image already displays"). */
export const GUEST_NAME = "Guest";

export type ShownSex = "female" | "male" | "other";

/** Sex as the face's colour shows it; never for anyone who is not surely an adult. */
export function shownSex(birthYear: number | null | undefined, sex: string | null | undefined, now: Date = new Date()): ShownSex | null {
  if (shownAge(birthYear, now) === null) return null;
  return sex === "female" || sex === "male" || sex === "other" ? sex : null;
}

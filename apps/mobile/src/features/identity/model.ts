import type { Profile } from "@/features/auth";

export const MIN_AGE = 14;

export const SEXES = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
] as const;
export type Sex = (typeof SEXES)[number]["value"];

export type Details = { firstName: string; lastName: string; sex: Sex; birthYear: number };
export type Draft = { firstName: string; lastName: string; sex: string; birthYear: string };
export type DraftErrors = Partial<Record<keyof Draft, string>>;

export function draftOf(p: Profile | undefined): Draft {
  return {
    firstName: p?.firstName ?? "",
    lastName: p?.lastName ?? "",
    sex: p?.sex ?? "",
    birthYear: p?.birthYear ? String(p.birthYear) : "",
  };
}

const tidy = (name: string) => name.trim().replace(/\s+/g, " ");

export function checkDraft(
  draft: Draft,
  now: Date = new Date(),
): { details: Details; errors: null } | { details: null; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const firstName = tidy(draft.firstName);
  const lastName = tidy(draft.lastName);
  const sex = SEXES.find((s) => s.value === draft.sex)?.value;
  const year = /^\d{4}$/.test(draft.birthYear.trim()) ? Number(draft.birthYear) : null;
  if (!firstName) errors.firstName = "Enter your first name.";
  if (!lastName) errors.lastName = "Enter your last name.";
  if (!sex) errors.sex = "Choose one.";
  if (year === null || year < 1900 || year > now.getFullYear()) errors.birthYear = "Enter the year you were born.";
  else if (now.getFullYear() - year < MIN_AGE) errors.birthYear = `You must be at least ${MIN_AGE} to use Mesita.`;
  if (Object.keys(errors).length > 0 || !sex || year === null) return { details: null, errors };
  return { details: { firstName, lastName, sex, birthYear: year }, errors: null };
}

/** A re-read shows the save happened. */
export function wasSaved(profile: Profile, d: Details): boolean {
  return (
    profile.firstName === d.firstName &&
    profile.lastName === d.lastName &&
    profile.sex === d.sex &&
    profile.birthYear === d.birthYear
  );
}

/** The years the picker offers, newest first: never one under the age floor. */
export function birthYears(now: Date = new Date()): string[] {
  const newest = now.getFullYear() - MIN_AGE;
  return Array.from({ length: 87 }, (_, i) => String(newest - i));
}

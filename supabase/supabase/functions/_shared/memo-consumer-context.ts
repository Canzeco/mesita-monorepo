import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// Memo's per-user profile clause — the signed-in user's first name, age and sex
// from the consumers profile — assembled into the hidden context Memo reasons
// over (but never recites). Shared by the consumer concierge
// (consumer-web-ask-memo) and the admin playground (admin-web-ask-memo) so the
// dogfood surface builds the SAME persona context production does.

// Whole years from an ISO birthday (YYYY-MM-DD), or null when absent/implausible.
function ageFromBirthday(birthday: unknown): number | null {
  if (typeof birthday !== "string" || birthday.length < 4) return null;
  const dob = new Date(birthday);
  if (isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 13 && age <= 120 ? age : null;
}

// Assemble the clause from the parts we actually have (name / age / sex).
// Returns null when there's nothing useful. Kept in one place so the real
// (DB-read) and mock (admin-supplied) paths render identically.
function composeProfileClause(
  name: string | null,
  age: number | null,
  sex: string | null,
): string | null {
  const bits: string[] = [];
  const first = (name ?? "").trim().split(/\s+/)[0];
  if (first) bits.push(`named ${first}`);
  if (age) bits.push(`${age} years old`);
  const s = (sex ?? "").trim().toLowerCase();
  if (s) bits.push(s);
  return bits.length > 0 ? bits.join(", ") : null;
}

// A short profile clause for Memo's hidden context, keyed by auth user id. Only
// the parts we actually have are included; returns null when there's nothing
// useful. Never let a profile miss sink the answer.
export async function readConsumerContext(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  try {
    const { data, error } = await admin
      .from("consumers")
      .select("first_name, full_name, sex, birthday")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) {
      if (error) console.error("[ask-memo] profile read:", error.message);
      return null;
    }
    return composeProfileClause(
      (data.first_name ?? data.full_name ?? "") as string,
      ageFromBirthday(data.birthday),
      (data.sex ?? "") as string,
    );
  } catch (e) {
    console.error("[ask-memo] profile threw:", (e as Error).message);
    return null;
  }
}

// The same clause from admin-supplied MOCK parts (no DB read) — lets the
// playground dogfood a synthetic persona that renders exactly like a real one.
export function mockConsumerContext(mock: {
  name?: unknown;
  age?: unknown;
  sex?: unknown;
}): string | null {
  const name = typeof mock.name === "string" ? mock.name : null;
  const age = typeof mock.age === "number" && Number.isFinite(mock.age) &&
      mock.age >= 13 && mock.age <= 120
    ? Math.trunc(mock.age)
    : null;
  const sex = typeof mock.sex === "string" ? mock.sex : null;
  return composeProfileClause(name, age, sex);
}

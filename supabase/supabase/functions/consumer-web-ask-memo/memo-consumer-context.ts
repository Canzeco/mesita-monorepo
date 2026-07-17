import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

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

// A short profile clause for Memo's hidden context — the signed-in user's first
// name, age and sex from the consumers profile (keyed by auth user id). Only the
// parts we actually have are included; returns null when there's nothing useful.
// Never let a profile miss sink the answer.
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
    const bits: string[] = [];
    const name = ((data.first_name ?? data.full_name ?? "") as string)
      .trim()
      .split(/\s+/)[0];
    if (name) bits.push(`named ${name}`);
    const age = ageFromBirthday(data.birthday);
    if (age) bits.push(`${age} years old`);
    const sex = (data.sex ?? "").toString().trim().toLowerCase();
    if (sex) bits.push(sex);
    return bits.length > 0 ? bits.join(", ") : null;
  } catch (e) {
    console.error("[ask-memo] profile threw:", (e as Error).message);
    return null;
  }
}

// memo-consumer-context.ts — how a consumer profile becomes Memo's persona clause.
//
// PURE composition only. The DB read that feeds the real path lives in
// supabase-edgefunc-get-consumer-context (Memo holds no database client — see
// memo-data.ts); it imports the two helpers below and returns only the finished
// clause, so raw profile fields never travel to the agent.
//
// Keeping the composition here — not inside that EF — is what lets the MOCK
// path (the admin playground's synthetic persona) render identically to a real
// one: same function, one fed DB parts, one fed operator-typed parts.

// Whole years from an ISO birthday (YYYY-MM-DD), or null when absent/implausible.
export function ageFromBirthday(birthday: unknown): number | null {
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
// (EF-served) and mock (admin-supplied) paths render identically.
export function composeProfileClause(
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

// The same clause from admin-supplied MOCK parts (no read at all) — lets the
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

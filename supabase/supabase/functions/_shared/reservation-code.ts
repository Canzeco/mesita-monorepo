// The 8-digit reference code every reservation ticket carries (Product rule,
// 2026-07-27): human-readable, speakable over the phone, and safe to expose —
// it identifies a ticket to venues and guests without leaking the row id.
// Range 10000000–99999999 so it is always exactly 8 digits with no leading
// zero. Uniqueness is enforced by a unique index on each ticket table; the
// creator EFs retry with a fresh code on the (astronomically rare) collision.
export function generateReservationCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(10000000 + (buf[0] % 90000000));
}

/** Postgres unique_violation — the signal to retry with a fresh code. */
export function isUniqueViolation(error: { code?: string } | null): boolean {
  return !!error && error.code === "23505";
}

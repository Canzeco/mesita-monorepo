// Pure OTP crypto primitives — no Supabase / HTTP deps.
// Safe to import from any EF or shared helper.

// Cryptographically random 6-digit string, zero-padded. Uses the
// Web Crypto Uint32 source; uniform enough for an OTP (the modulo
// bias on 10^6 from 2^32 is negligible).
export function randomSixDigits(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 1_000_000).toString().padStart(6, "0");
}

// Lowercase hex SHA-256 of a UTF-8 string. We never store the raw OTP
// — only this hash — so a DB leak doesn't hand out codes.
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Gift codes (MESITA-1677): a keyed HMAC over a random, human-shareable code.
//
// TEN DIGITS, MATCHING THE UI THAT ALREADY SHIPPED (MESITA-1692). GiftClient
// and RedeemClient (and PinField's PIN_LENGTH) were built against the browser
// emulator's ten-digit format before this real backend existed —
// credits-emulator.ts's own `giftCode()` draws a non-zero leading digit plus
// nine more. Keeping the identical shape means neither client component's
// UI changes, only what backs them.
//
// A KEYED HMAC, NOT A PLAIN HASH. A plain SHA-256 digest of a 10-digit space
// (9e9 possibilities, non-zero leading digit) is offline-bruteforceable in
// well under a second on commodity hardware if the digest table ever leaked
// — a keyed MAC makes that infeasible without the server's own secret, which
// never leaves the EF runtime and is never derivable from the digest alone.
//
// NO NEW SECRET PROVISIONED — A JUDGMENT CALL, FLAGGED. The key is derived
// from SUPABASE_SERVICE_ROLE_KEY (already present in every EF's env, already
// as sensitive as anything this table needs protected) with domain
// separation, rather than adding a fresh operator step
// (`supabase secrets set GIFT_CODE_HMAC_SECRET=...`) for a single-purpose
// key. This is the pragmatic call for a same-session ship with no operator
// in the loop; a dedicated secret would be more conventional and rotatable
// independently of the service key, and is a clean one-line follow-up
// (swap the input to hmacKey) if ops wants that separation later.
//
// PLAUSIBILITY BEFORE ANY DB WORK — same posture as
// _shared/ticket-check.ts's isPlausibleCheckCode: a malformed code never
// even reaches a query, which is also what keeps the rate limiter's
// "only successful lookups reach the DB" property honest for garbage input.

const FIRST_DIGIT = "123456789"; // never 0 — survives every paste path that treats the code as a number.
const DIGIT = "0123456789";
export const GIFT_CODE_LENGTH = 10;

/** Ten digits, non-zero leading digit. Matches credits-emulator.ts's giftCode() shape exactly. */
export function generateGiftCode(rand: () => number = Math.random): string {
  let code = FIRST_DIGIT[Math.floor(rand() * FIRST_DIGIT.length)];
  for (let i = 1; i < GIFT_CODE_LENGTH; i += 1) {
    code += DIGIT[Math.floor(rand() * DIGIT.length)];
  }
  return code;
}

export function isPlausibleGiftCode(code: string): boolean {
  return new RegExp(`^[1-9][0-9]{${GIFT_CODE_LENGTH - 1}}$`).test(code);
}

async function hmacKey(serviceRoleKey: string): Promise<CryptoKey> {
  // Domain-separated so this key can never collide with any other digest
  // this codebase derives from the same service-role secret.
  const material = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`mesita-gift-code-hmac-v1:${serviceRoleKey}`),
  );
  return crypto.subtle.importKey(
    "raw",
    material,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** HMAC-SHA256(code), hex-encoded. Never store or log the raw code this digests. */
export async function hashGiftCode(
  code: string,
  serviceRoleKey: string,
): Promise<string> {
  const key = await hmacKey(serviceRoleKey);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(code),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

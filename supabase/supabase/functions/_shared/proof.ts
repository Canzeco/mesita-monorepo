// The payment proof's key and address (MESITA-3304, W2a).
//
// A paid Mesita payment carries one proof token: 128 random bits, base64url,
// 22 characters, stored in clear on wallet_payments.proof_token. It is the
// only key the staff page on visit.mesita.ai has (no session there): it
// reads one receipt and stamps it seen, and the guest reopens the same QR
// from the Wallet, so it is never rotated. W2c's charge token gates a money
// flow and stays hashed; this one does not.

export const PROOF_ORIGIN = "https://visit.mesita.ai";

const TOKEN = /^[A-Za-z0-9_-]{22}$/;

/** 16 bytes from the platform CSPRNG, base64url without padding. */
export function mintProofToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function isProofToken(v: unknown): v is string {
  return typeof v === "string" && TOKEN.test(v);
}

type ReadEnv = (name: string) => string | undefined;
const envRead: ReadEnv = (n) => Deno.env.get(n);

/** Where the QR points. VISIT_WEB_URL overrides the origin for a test
 *  project; a Vercel preview of web-visit is checked by pasting the token
 *  into its own /proof/<token> by hand, since this env is the Supabase
 *  project's, not a per-deploy value. */
export function proofUrl(token: string, read: ReadEnv = envRead): string {
  return `${visitOrigin(read)}/proof/${token}`;
}

/** The Story voucher's activation page (MESITA-3507), on the same origin. */
export function storyUrl(token: string, read: ReadEnv = envRead): string {
  return `${visitOrigin(read)}/story/${token}`;
}

/** A table's tab (MESITA-3562): the QR the guest shows the waiter. */
export function tabUrl(token: string, read: ReadEnv = envRead): string {
  return `${visitOrigin(read)}/tab/${token}`;
}

function visitOrigin(read: ReadEnv): string {
  return (read("VISIT_WEB_URL") ?? "").trim().replace(/\/+$/, "") || PROOF_ORIGIN;
}

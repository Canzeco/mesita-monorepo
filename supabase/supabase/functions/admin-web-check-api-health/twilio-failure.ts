// What the Billing Test's Twilio card says when Twilio says no (MESITA-2097).
//
// Twilio answers 401 to EVERY request from an account that is not active —
// suspended at a $0 balance, closed, or held for review. The account failed,
// but the words blame the key. Its body then reads "authentication failed,
// account AC… with status 4 is not active", which the card used to print
// verbatim and which reads exactly like a bad key. Error 20005 ("Account not
// active") is the documented code; 10001 is the Messaging twin.

/** Twilio's documented "this account is not active" codes. */
export const TWILIO_INACTIVE_CODES: ReadonlySet<number> = new Set([
  20005,
  10001,
]);

/** Twilio's plain bad-credentials code. */
export const TWILIO_BAD_KEY_CODE = 20003;

const INACTIVE_WORDS = /\bnot active\b|\bsuspended\b|\bclosed\b/i;

function twilioCode(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const code = (body as Record<string, unknown>).code;
  return typeof code === "number" ? code : null;
}

function twilioMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const msg = (body as Record<string, unknown>).message;
  return typeof msg === "string" ? msg : "";
}

/** The sentence for an account Twilio will not serve — shared by both doors. */
export function inactiveAccountLine(evidence: string): string {
  return `Account not active (suspended or closed) — Twilio refuses every request, so no sign-in code can be sent. Top up or reactivate it in the Twilio Console. Twilio said: ${evidence}`;
}

/**
 * Explain a Twilio non-2xx in words an operator can act on, or return null to
 * fall back to Twilio's own line. `vendorLine` is that line, kept as evidence.
 */
export function twilioFailureDetail(
  body: unknown,
  status: number,
  vendorLine: string,
): string | null {
  const code = twilioCode(body);
  if (
    (code !== null && TWILIO_INACTIVE_CODES.has(code)) ||
    INACTIVE_WORDS.test(twilioMessage(body))
  ) {
    return inactiveAccountLine(vendorLine);
  }
  if (status === 401 && (code === null || code === TWILIO_BAD_KEY_CODE)) {
    return `Key rejected — TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are wrong, or the token was rotated. Twilio said: ${vendorLine}`;
  }
  return null;
}

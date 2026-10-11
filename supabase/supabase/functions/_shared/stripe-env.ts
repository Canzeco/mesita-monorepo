// Stripe credentials, resolved from STRIPE_MODE (MESITA-1530).
//
// Both universes' secrets sit in the EF env at once —
//   STRIPE_SECRET_KEY_{TEST,LIVE}
//   STRIPE_PUBLISHABLE_KEY_{TEST,LIVE}
// — and STRIPE_MODE=test|live picks the active set. Switching universes is
// then ONE secret change: no key pasting, no window where the platform holds
// half of one account's credentials and half of the other's. The legacy
// unsuffixed names (STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY) stay as a
// fallback, so an env that predates the split keeps working untouched.
//
// Context: the Mesita Account is ONE Stripe account with two universes — its
// built-in Test mode (acct_1UCK3i…, sk_test_…) and its live mode. There is no
// sandbox: the one that briefly existed (acct_1UCK4D…) was deleted, and Test
// mode does everything it did for development. So the two key sets this
// module switches between belong to the same account, and the Canzeco
// Account's own test mode (acct_1TVJAz…) is a different account entirely —
// never Mesita's.
//
// Two invariants this module exists to hold:
//
//   • STRIPE_MODE defaults to TEST. An unset, misspelled or half-written
//     value must never be the thing that starts addressing the live account.
//   • The candidate names NEVER include the other mode's key.
//     A missing STRIPE_SECRET_KEY_TEST means "no test key" — it does not mean
//     "use the live one".
//
// This module only says WHICH Stripe account is addressed.

export type StripeMode = "test" | "live";

/** Base names, before the mode suffix. */
export const STRIPE_SECRET_KEY_BASE = "STRIPE_SECRET_KEY";
/** The browser-safe half of the pair (MESITA-1670). It rides the SAME mode
 *  switch as the secret, and that is the whole reason it is resolved here
 *  rather than shipped to the client as a NEXT_PUBLIC_ build variable: a
 *  publishable key baked into a deploy cannot follow STRIPE_MODE, so one
 *  flip would leave the browser addressing the other universe and every 3DS
 *  challenge would fail against an intent it cannot see. The server hands the
 *  key down with the client secret it belongs to, so the two can never skew. */
export const STRIPE_PUBLISHABLE_KEY_BASE = "STRIPE_PUBLISHABLE_KEY";

/** Every secret-key name this codebase reads, for "which env vars matter"
 *  displays (admin Controls / API health). Resolution ORDER is mode-dependent
 *  and comes from stripeSecretKeyNames(); this list is just the set. */
export const STRIPE_SECRET_KEY_NAMES = [
  `${STRIPE_SECRET_KEY_BASE}_TEST`,
  `${STRIPE_SECRET_KEY_BASE}_LIVE`,
  STRIPE_SECRET_KEY_BASE,
];

/** The same set for the publishable key. */
export const STRIPE_PUBLISHABLE_KEY_NAMES = [
  `${STRIPE_PUBLISHABLE_KEY_BASE}_TEST`,
  `${STRIPE_PUBLISHABLE_KEY_BASE}_LIVE`,
  STRIPE_PUBLISHABLE_KEY_BASE,
];

type ReadEnv = (name: string) => string | undefined;

const envRead: ReadEnv = (name) => Deno.env.get(name);

/** Trimmed value, or undefined when unset/blank — a secret set to "" is not
 *  a secret, and must fall through to the next candidate name. */
function value(read: ReadEnv, name: string): string | undefined {
  const raw = read(name);
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** The active Stripe universe. Anything that is not exactly `live` is test. */
export function stripeMode(read: ReadEnv = envRead): StripeMode {
  return (value(read, "STRIPE_MODE") ?? "").toLowerCase() === "live"
    ? "live"
    : "test";
}

/** Candidate names for `base`, most specific first: the active mode's
 *  suffixed name, then the legacy unsuffixed one. The other mode's name is
 *  deliberately absent. */
export function stripeEnvNames(base: string, mode: StripeMode): string[] {
  return [`${base}_${mode.toUpperCase()}`, base];
}

/** Ordered secret-key candidates for `mode`. */
export function stripeSecretKeyNames(mode: StripeMode): string[] {
  return stripeEnvNames(STRIPE_SECRET_KEY_BASE, mode);
}

/** Ordered publishable-key candidates for `mode`. */
export function stripePublishableKeyNames(mode: StripeMode): string[] {
  return stripeEnvNames(STRIPE_PUBLISHABLE_KEY_BASE, mode);
}

/** Does the publishable key address the universe STRIPE_MODE claims? It
 *  matters most on this key: it is the only Stripe credential that reaches a
 *  browser. */
export function stripePublishableKeyMatchesMode(
  key: string,
  mode: StripeMode,
): boolean {
  return key.startsWith("pk_live_") === (mode === "live");
}

/**
 * Why the resolved secret cannot be a Stripe secret key, in the operator's
 * words — or null when it looks like one.
 *
 * Stripe's own rejection is `Invalid API Key provided: <the key, middle
 * starred out>`. That message is useless twice over: it names no env var, so
 * the operator cannot tell WHICH of three candidate names holds the bad
 * value, and it echoes the credential itself — which is fine in a server log
 * and wrong in a merchant's browser, where the Connect path used to relay it
 * verbatim (a restaurant owner learned the platform key's first and last
 * characters and nothing actionable).
 *
 * So every caller that is about to hand a key to Stripe asks here FIRST. The
 * shape check is cheap, it names the variable actually in force, and it never
 * puts the value in the response — the prefix alone identifies the mistake,
 * because each wrong paste has a distinct one.
 */
export function stripeSecretKeyProblem(
  name: string,
  key: string,
): string | null {
  if (/^sk_(live|test)_/.test(key)) return null;
  if (key.startsWith("rk_")) {
    return `${name} holds a restricted key (rk_…). The secret key (sk_test_… / sk_live_…) is the one that works everywhere.`;
  }
  if (key.startsWith("pk_")) {
    return `${name} holds a publishable key (pk_…). Paste the secret key (sk_test_… / sk_live_…).`;
  }
  if (key.startsWith("mk_")) {
    return `${name} holds an API key ID (mk_…), not the key. The dashboard shows both — copy the token that starts sk_test_… / sk_live_…, not the identifier beside it.`;
  }
  // The residual case, and the one that actually bit: a key that CONTAINS a
  // real sk_ token but does not start with it, because something was typed or
  // pasted in front of it. Say so precisely — "does not look like a key" sends
  // an operator hunting for a new key when the one they have is fine and only
  // needs the junk stripped off its front.
  const starts = [key.indexOf("sk_test_"), key.indexOf("sk_live_")]
    .filter((i) => i > 0);
  if (starts.length > 0) {
    // Measured from the real token, not the first "sk_" — a value that
    // happens to contain an earlier "sk_" would otherwise report a lead of
    // zero, which reads as no problem at all.
    return `${name} has ${Math.min(...starts)} stray character(s) before the key. The value must START with sk_test_… / sk_live_… — re-paste it with nothing in front.`;
  }
  return `${name} does not look like a Stripe secret key (expected sk_test_… or sk_live_…).`;
}

// What a restaurant owner reads when Stripe says no.
//
// THIS USED TO BE A DENY-LIST AND IT LEAKED (MESITA-1645). Every Stripe
// rejection travelled word for word, with one carve-out for a 401. The
// carve-out's reasoning was right — "the reader here is a RESTAURANT OWNER,
// not a Mesita operator" — and it applies to nearly everything this endpoint
// can return, not to one case. On 2026-09-07 an owner pressed Connect
// payments and read this in a red box:
//
//   "When stripe_dashboard[type]=express, your platform must collect fees and
//    be liable for negative balances or refunds and chargebacks."
//
// That is a sentence about OUR platform configuration. There is nothing in it
// a restaurant can act on, and a deny-list guarantees the next one gets
// through too, until somebody remembers to add it.
//
// So the default is inverted. The owner supplied exactly two things — country
// and legal entity — so only rejections ABOUT THOSE are theirs to read.
// Everything else is ours, and it goes to the log where an operator already
// looks.

/** The only fields the owner chose. A rejection naming one of these is the
 *  only kind they can do anything about. */
const MERCHANT_FIELDS = new Set(["country", "business_type"]);

/** Said whenever the fault is on our side. Deliberately the same sentence the
 *  401 path already used: it is true, it is calm, and it does not imply the
 *  restaurant did something wrong. */
export const PLATFORM_FAULT_COPY =
  "Payments aren’t set up on Mesita’s side yet — nothing to fix on your end. We’ve been notified.";

/** Stripe having a bad minute is not a permanent error, and it used to render
 *  as one. */
export const TRANSIENT_COPY =
  "Stripe is busy right now. Try again in a minute.";

export type OnboardingFailure = {
  /** What the owner reads. */
  error: string;
  code: string;
  status: number;
  /** True only when Stripe's own words were judged safe and useful for a
   *  merchant — i.e. the rejection named a field they picked. */
  passthrough: boolean;
};

type StripeErrorish = {
  type?: unknown;
  code?: unknown;
  param?: unknown;
  statusCode?: unknown;
  message?: unknown;
  raw?: { message?: unknown; param?: unknown; code?: unknown };
};

/** Stripe's own sentence, for the operator log. Always extracted, even when it
 *  is not sent — a swallowed error with no log is how this stays invisible. */
export function stripeMessageOf(err: unknown): string {
  const e = (err ?? {}) as StripeErrorish;
  const raw = e.raw?.message;
  if (typeof raw === "string" && raw !== "") return raw;
  if (typeof e.message === "string" && e.message !== "") return e.message;
  return "Stripe rejected the request.";
}

function paramOf(err: unknown): string | null {
  const e = (err ?? {}) as StripeErrorish;
  const p = e.param ?? e.raw?.param;
  return typeof p === "string" && p !== "" ? p : null;
}

/**
 * Classify a Stripe rejection for a merchant audience.
 *
 * Order matters: transient before merchant-field, because a 429 can carry a
 * param and "try again" beats a parameter lecture when the request may well
 * succeed unchanged.
 *
 * `keyRejected` is passed in rather than detected here so this module stays
 * pure and testable — the caller already owns `isStripeKeyRejection`.
 */
export function classifyOnboardingFailure(
  err: unknown,
  opts: { keyRejected: boolean },
): OnboardingFailure {
  if (opts.keyRejected) {
    return {
      error: PLATFORM_FAULT_COPY,
      code: "stripe_key_rejected",
      status: 503,
      passthrough: false,
    };
  }

  const status = (err as StripeErrorish)?.statusCode;
  if (typeof status === "number" && (status === 429 || status >= 500)) {
    return {
      error: TRANSIENT_COPY,
      code: "stripe_unavailable",
      status: 503,
      passthrough: false,
    };
  }

  const param = paramOf(err);
  if (param && MERCHANT_FIELDS.has(param)) {
    // Their answer, their fix. Stripe names the bad value precisely and that
    // is genuinely the most useful sentence available.
    return {
      error: stripeMessageOf(err),
      code: "stripe_invalid_field",
      status: 400,
      passthrough: true,
    };
  }

  return {
    error: PLATFORM_FAULT_COPY,
    code: "stripe_platform_error",
    status: 503,
    passthrough: false,
  };
}

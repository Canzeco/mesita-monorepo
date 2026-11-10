// Stripe, for every function that moves money: which key and universe
// (test or live) a call runs in, the one HTTP client, and the return-address
// guard for Checkout. Premier (boost.ts), payments, vouchers, the Pay card
// part and the fee invoices all call Stripe through here (MESITA-3612).
//
// Two universes, two switches (MESITA-3279):
//   STRIPE_MODE           Premier, on Mesita's own account
//   PAYMENTS_STRIPE_MODE  money on places' connected accounts: vouchers, the
//                         Pay card part, the waiter's charge, cashback, the
//                         5% fee invoices, refunds, close-out
// so taking Premier live cannot take payments live by accident, and the other
// way round. Same platform account and the same keys. A value other than
// exactly `live` is test; live without STRIPE_ALLOW_LIVE=true is refused, and
// a mode never falls through to the other mode's key. Pato flips them;
// agents never do.

export type ReadEnv = (name: string) => string | undefined;
const envRead: ReadEnv = (name) => Deno.env.get(name);

type ModeVar = "STRIPE_MODE" | "PAYMENTS_STRIPE_MODE";

const wantsLive = (modeVar: ModeVar, read: ReadEnv) => (read(modeVar) ?? "").trim() === "live";
const allowsLive = (read: ReadEnv) => (read("STRIPE_ALLOW_LIVE") ?? "").trim() === "true";

function secretKey(modeVar: ModeVar, read: ReadEnv): string | null {
  const live = wantsLive(modeVar, read);
  if (live && !allowsLive(read)) return null;
  const key = (read(live ? "STRIPE_SECRET_KEY_LIVE" : "STRIPE_SECRET_KEY_TEST") ?? "").trim();
  return key === "" ? null : key;
}

function liveMode(modeVar: ModeVar, read: ReadEnv): boolean {
  return wantsLive(modeVar, read) && allowsLive(read);
}

/** Premier's secret key for the active universe, or null. */
export function boostStripeKey(read: ReadEnv = envRead): string | null {
  return secretKey("STRIPE_MODE", read);
}

/** True when Premier runs on the live key (a test customer does not exist in
 *  live mode, so customers are stored per mode). */
export function boostLivemode(read: ReadEnv = envRead): boolean {
  return liveMode("STRIPE_MODE", read);
}

/** Payments' secret key for the active universe, or null. */
export function paymentsStripeKey(read: ReadEnv = envRead): string | null {
  return secretKey("PAYMENTS_STRIPE_MODE", read);
}

/** True when payments run on the live key: every livemode column a payment
 *  row, account row or fee row carries is compared against this. */
export function paymentsLivemode(read: ReadEnv = envRead): boolean {
  return liveMode("PAYMENTS_STRIPE_MODE", read);
}

/** Stripe.js's key for the payments universe, or null when it is not set
 *  (STRIPE_PUBLISHABLE_KEY_TEST / _LIVE). A key of the other mode is null. */
export function paymentsPublishableKey(livemode: boolean, read: ReadEnv = envRead): string | null {
  const key = (read(livemode ? "STRIPE_PUBLISHABLE_KEY_LIVE" : "STRIPE_PUBLISHABLE_KEY_TEST") ?? "").trim();
  return key.startsWith(livemode ? "pk_live_" : "pk_test_") ? key : null;
}

/** Checkout's return address: https on a Mesita or Vercel host (a preview
 *  must come back to itself), or a local dev host. Never anywhere else. */
export function isAllowedReturnUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol === "http:") return host === "localhost" || host === "127.0.0.1";
  if (u.protocol !== "https:") return false;
  return host === "mesita.ai" || host.endsWith(".mesita.ai") || host.endsWith(".vercel.app");
}

/** Stripe's form encoding: nested keys as a[b][c], arrays as a[0][b]. */
export function stripeForm(params: Record<string, unknown>): string {
  const out = new URLSearchParams();
  const walk = (prefix: string, v: unknown) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(`${prefix}[${i}]`, item));
    } else if (typeof v === "object") {
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        walk(prefix ? `${prefix}[${k}]` : k, child);
      }
    } else {
      out.append(prefix, String(v));
    }
  };
  walk("", params);
  return out.toString();
}

/** A Stripe API error with its type and code (card_error, idempotency_error…). */
export class StripeError extends Error {
  constructor(
    readonly path: string,
    readonly type: string,
    readonly code: string,
    readonly httpStatus: number,
    message: string,
  ) {
    super(`stripe ${path}: ${message}`);
  }
}

export type StripeCall = (
  method: "GET" | "POST" | "DELETE",
  path: string,
  params?: Record<string, unknown>,
  /** `version`: a Stripe-Version header for this one call (Connect's account
   *  create needs a preview version, MESITA-3296); unset is the key's default.
   *  `stripeAccount`: a Stripe-Account header, so the call runs on the
   *  place's connected account (direct charges and their refunds,
   *  MESITA-3302); unset is Mesita's own account (Premier).
   *  `signal`: aborts the fetch (a wallet read's budget), never the caller's
   *  database write. */
  opts?: { idempotencyKey?: string; version?: string; stripeAccount?: string; signal?: AbortSignal },
) => Promise<Record<string, unknown>>;

export function stripeClient(key: string, fetchFn: typeof fetch = fetch): StripeCall {
  return async (method, path, params, opts) => {
    const body = params ? stripeForm(params) : "";
    const url = `https://api.stripe.com/v1/${path}${method === "GET" && body ? `?${body}` : ""}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (opts?.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
    if (opts?.version) headers["Stripe-Version"] = opts.version;
    if (opts?.stripeAccount) headers["Stripe-Account"] = opts.stripeAccount;
    const res = await fetchFn(url, { method, headers, body: method === "GET" ? undefined : body, signal: opts?.signal });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = (data.error ?? {}) as { message?: string; type?: string; code?: string };
      throw new StripeError(path, err.type ?? "", err.code ?? "", res.status, err.message ?? String(res.status));
    }
    return data;
  };
}

// Payment method domains for express pay (MESITA-4384).
//
// Apple Pay and Google Pay in Stripe's Express Checkout Element show only on
// a domain registered as a payment method domain. A voucher is a DIRECT
// charge on the place's connected account, so the domain is registered on
// EACH connected account (Stripe-Account header), once per environment
// (test accounts under the test key, live under the live key). Stripe does
// Apple's merchant validation for a registered domain: no association file
// is hosted.
//
// Three callers, one module:
//   - connect-events.ts, account.updated with charges_enabled: registers,
//     after the account snapshot write, never blocking it;
//   - consumer-web-express-pay-setup: while a wallet's stamp is null, checks
//     (and registers) at most once every 6 hours per account, inside 1.5 s;
//   - admin-web-register-pm-domains: the per-environment backfill and the
//     repair/check tool (re-runnable).
//
// "Already exists" is decided from the list result or Stripe's error code,
// never from message text. Failures log `express_domains_failed` with
// {account_id, place_id, domain, wallet, stripe_error_code, livemode}, never
// a key.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type StripeCall, StripeError } from "./stripe.ts";

/** Registered on every account. The app is served on mesita.ai. */
export const EXPRESS_DOMAINS = ["mesita.ai", "www.mesita.ai"] as const;
/** The domain whose status decides whether a wallet shows. */
export const PRIMARY_DOMAIN = "mesita.ai";
/** The guest path re-checks a missing stamp at most this often. */
export const DOMAIN_RECHECK_MS = 6 * 60 * 60_000;
/** The guest path waits at most this long for Stripe. */
export const DOMAIN_CHECK_TIMEOUT_MS = 1_500;

export type WalletDomains = { apple_pay: boolean; google_pay: boolean };

export type DomainStamps = {
  apple_pay_domain_at: string | null;
  google_pay_domain_at: string | null;
  pm_domains_checked_at: string | null;
};

export type DomainReport = {
  place_id: string;
  account_id: string;
  apple_pay: boolean;
  google_pay: boolean;
  error?: string;
};

function stripeCode(err: unknown): string {
  if (err instanceof StripeError) return (err.code || err.type || "stripe_error").slice(0, 64);
  if (err instanceof DOMException && err.name === "AbortError") return "timeout";
  return "stripe_unreachable";
}

function logFailure(ctx: { accountId: string; placeId: string; livemode: boolean }, domain: string, wallet: string | null, err: unknown) {
  console.error("[pm-domains] express_domains_failed", JSON.stringify({
    account_id: ctx.accountId,
    place_id: ctx.placeId,
    domain,
    wallet,
    stripe_error_code: stripeCode(err),
    livemode: ctx.livemode,
  }));
}

/** A PaymentMethodDomain's wallets as booleans. Pure. */
export function walletsOf(pmd: Record<string, unknown> | null): WalletDomains {
  const status = (k: string) => ((pmd?.[k] ?? {}) as Record<string, unknown>).status === "active";
  return { apple_pay: !!pmd && pmd.enabled !== false && status("apple_pay"), google_pay: !!pmd && pmd.enabled !== false && status("google_pay") };
}

async function listDomain(stripe: StripeCall, account: string, domain: string, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
  const res = await stripe("GET", "payment_method_domains", { domain_name: domain, limit: 1 }, { stripeAccount: account, signal });
  const data = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : [];
  return data.find((d) => d.domain_name === domain) ?? null;
}

/** List, then create when missing; returns each domain's object (null when
 *  it could not be read or made). `create: false` only reads. */
async function ensureDomain(
  stripe: StripeCall,
  account: string,
  domain: string,
  opts: { create: boolean; signal?: AbortSignal },
): Promise<Record<string, unknown> | null> {
  const found = await listDomain(stripe, account, domain, opts.signal);
  if (found || !opts.create) return found;
  try {
    return await stripe("POST", "payment_method_domains", { domain_name: domain, enabled: true }, {
      stripeAccount: account,
      idempotencyKey: `pmd:${account}:${domain}`,
      signal: opts.signal,
    });
  } catch (err) {
    // Another caller made it in between: read it back.
    if (err instanceof StripeError && err.code === "resource_already_exists") return await listDomain(stripe, account, domain, opts.signal);
    throw err;
  }
}

/** Every express domain on one account; the primary's wallets decide. */
export async function ensureDomains(
  stripe: StripeCall,
  ctx: { accountId: string; placeId: string; livemode: boolean },
  opts: { create: boolean; signal?: AbortSignal },
): Promise<WalletDomains & { error?: string }> {
  let primary: WalletDomains = { apple_pay: false, google_pay: false };
  let error: string | undefined;
  for (const domain of EXPRESS_DOMAINS) {
    try {
      const pmd = await ensureDomain(stripe, ctx.accountId, domain, opts);
      const w = walletsOf(pmd);
      if (domain === PRIMARY_DOMAIN) primary = w;
      if (pmd) {
        for (const wallet of ["apple_pay", "google_pay"] as const) {
          if (!w[wallet]) {
            console.log("[pm-domains] wallet_inactive", JSON.stringify({ account_id: ctx.accountId, place_id: ctx.placeId, domain, wallet, livemode: ctx.livemode }));
          }
        }
      }
    } catch (err) {
      logFailure(ctx, domain, null, err);
      error = stripeCode(err);
      if (error === "timeout") break;
    }
  }
  return { ...primary, ...(error ? { error } : {}) };
}

/** The stamps on a place's account row; null when it has no account. */
export async function readDomainStamps(admin: SupabaseClient, placeId: string): Promise<DomainStamps | null> {
  const { data, error } = await admin.from("place_payment_accounts")
    .select("apple_pay_domain_at, google_pay_domain_at, pm_domains_checked_at").eq("place_id", placeId).maybeSingle();
  if (error) throw new Error(`pm_domain_stamps: ${error.message}`);
  return (data as DomainStamps | null) ?? null;
}

/** Writes what Stripe said: a stamp keeps its first time while active and
 *  clears when inactive; checked_at is now. */
export async function stampDomains(
  admin: SupabaseClient,
  accountId: string,
  before: DomainStamps | null,
  wallets: WalletDomains,
  nowIso: string,
): Promise<DomainStamps> {
  const next: DomainStamps = {
    apple_pay_domain_at: wallets.apple_pay ? (before?.apple_pay_domain_at ?? nowIso) : null,
    google_pay_domain_at: wallets.google_pay ? (before?.google_pay_domain_at ?? nowIso) : null,
    pm_domains_checked_at: nowIso,
  };
  const { error } = await admin.from("place_payment_accounts").update(next).eq("stripe_account_id", accountId);
  if (error) throw new Error(`pm_domain_stamp: ${error.message}`);
  return next;
}

/** Register (list, create when missing) and stamp. Skips Stripe when both
 *  wallets are already stamped, unless `force` (the admin check). */
export async function registerAndStamp(
  admin: SupabaseClient,
  stripe: StripeCall,
  ctx: { placeId: string; accountId: string; livemode: boolean; force?: boolean; nowMs?: number },
): Promise<DomainReport> {
  const before = await readDomainStamps(admin, ctx.placeId);
  if (!ctx.force && before?.apple_pay_domain_at && before?.google_pay_domain_at) {
    return { place_id: ctx.placeId, account_id: ctx.accountId, apple_pay: true, google_pay: true };
  }
  const res = await ensureDomains(stripe, ctx, { create: true });
  if (res.error && !res.apple_pay && !res.google_pay) {
    return { place_id: ctx.placeId, account_id: ctx.accountId, apple_pay: !!before?.apple_pay_domain_at, google_pay: !!before?.google_pay_domain_at, error: res.error };
  }
  const nowIso = new Date(ctx.nowMs ?? Date.now()).toISOString();
  await stampDomains(admin, ctx.accountId, before, res, nowIso);
  return { place_id: ctx.placeId, account_id: ctx.accountId, apple_pay: res.apple_pay, google_pay: res.google_pay, ...(res.error ? { error: res.error } : {}) };
}

/** The guest path (consumer-web-express-pay-setup): the wallets this
 *  account can show. Reads the stamps; when one is null and the last check
 *  is older than 6 h, checks Stripe once inside 1.5 s (registering when
 *  missing) and stamps. A timeout answers `timeout` and shows no wallet it
 *  has no stamp for. */
export async function walletDomainsForSetup(
  admin: SupabaseClient,
  stripe: StripeCall,
  ctx: { placeId: string; accountId: string; livemode: boolean; nowMs: number },
  deps: { timeoutMs?: number } = {},
): Promise<WalletDomains & { checked: boolean; timeout?: boolean }> {
  const stamps = await readDomainStamps(admin, ctx.placeId);
  const have: WalletDomains = { apple_pay: !!stamps?.apple_pay_domain_at, google_pay: !!stamps?.google_pay_domain_at };
  if (have.apple_pay && have.google_pay) return { ...have, checked: false };
  const last = stamps?.pm_domains_checked_at ? Date.parse(stamps.pm_domains_checked_at) : NaN;
  if (Number.isFinite(last) && ctx.nowMs - last < DOMAIN_RECHECK_MS) return { ...have, checked: false };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DOMAIN_CHECK_TIMEOUT_MS);
  try {
    const res = await ensureDomains(stripe, ctx, { create: true, signal: controller.signal });
    const nowIso = new Date(ctx.nowMs).toISOString();
    if (res.error === "timeout") {
      // Throttle the slow path too: the backfill is the repair.
      await stampDomains(admin, ctx.accountId, stamps, have, nowIso);
      return { ...have, checked: true, timeout: true };
    }
    const merged = { apple_pay: have.apple_pay || res.apple_pay, google_pay: have.google_pay || res.google_pay };
    await stampDomains(admin, ctx.accountId, stamps, res.error ? merged : res, nowIso);
    return { ...(res.error ? merged : res), checked: true };
  } finally {
    clearTimeout(timer);
  }
}

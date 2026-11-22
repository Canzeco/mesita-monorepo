// The money section of app_config (MESITA-3303): buying_paused, the kill
// switch for every voucher sale, and sending_live (MESITA-3292), the switch
// that lets guests send credit to a friend in live mode once the lawyer
// answers (MESITA-3274). Read through the app_config door (write-config.ts);
// the admin console writes it (W3, MESITA-3307) with the settle cron's
// bounds beside it.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { readAppConfig } from "./write-config.ts";

/** MESITA-4384: the wallets express pay may offer (Apple Pay, Google Pay). */
export type ExpressWallet = "apple_pay" | "google_pay";
export const EXPRESS_WALLETS: readonly ExpressWallet[] = ["apple_pay", "google_pay"];

export type MoneyConfig = {
  buying_paused: boolean;
  sending_live: boolean;
  /** MESITA-4384: the express-pay kill switch. Absent reads both wallets;
   *  [] turns express off; a list narrows it. Unknown names are dropped. */
  express_wallets: ExpressWallet[];
  /** MESITA-4524: how long a guest pay ticket stays live (minutes, 5-120;
   *  absent or bad reads 5). */
  guest_pay_window_minutes: number;
};

/** FIVE MINUTES TO SIGN (Pato, 2026-11-21, MESITA-4618: "make payment
 *  confirmation 5 minutes no more"): the waiter's confirmation stays (the one
 *  proof the guest is at that table paying that amount), shorter. 15 before. */
export const GUEST_PAY_WINDOW_DEFAULT = 5;

export function guestPayWindowFrom(raw: unknown): number {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 5 && raw <= 120 ? raw : GUEST_PAY_WINDOW_DEFAULT;
}

export function expressWalletsFrom(raw: unknown): ExpressWallet[] {
  if (!Array.isArray(raw)) return [...EXPRESS_WALLETS];
  return EXPRESS_WALLETS.filter((w) => raw.includes(w));
}

export function moneyConfigFrom(raw: unknown): MoneyConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    buying_paused: o.buying_paused === true,
    sending_live: o.sending_live === true,
    express_wallets: expressWalletsFrom(o.express_wallets),
    guest_pay_window_minutes: guestPayWindowFrom(o.guest_pay_window_minutes),
  };
}

/** A read failure reads as not paused (a broken config must not stop every
 *  sale) and as not sending live (a
 *  money move the lawyer has not cleared stays off when in doubt). */
export async function readMoneyConfig(admin: SupabaseClient): Promise<MoneyConfig> {
  const res = await readAppConfig(admin, "money_config", "money_config_read");
  if (!res.ok) {
    console.error("[money-config] read failed; reading as not paused, not sending live, express off");
    // Express is new money surface: off when in doubt (the card path stays).
    return { buying_paused: false, sending_live: false, express_wallets: [], guest_pay_window_minutes: GUEST_PAY_WINDOW_DEFAULT };
  }
  return moneyConfigFrom(res.row?.money_config);
}

/** Sending credit is on in test mode always; in live mode only once
 *  sending_live is set (MESITA-3292). */
export function sendingOn(config: MoneyConfig, livemode: boolean): boolean {
  return !livemode || config.sending_live;
}

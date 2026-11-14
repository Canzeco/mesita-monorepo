// The money section of app_config (MESITA-3303): buying_paused, the kill
// switch for every voucher sale, and sending_live (MESITA-3292), the switch
// that lets guests send credit to a friend in live mode once the lawyer
// answers (MESITA-3274). Read through the app_config door (write-config.ts);
// the admin console writes it (W3, MESITA-3307) with the settle cron's
// bounds beside it.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { readAppConfig } from "./write-config.ts";

export type MoneyConfig = { buying_paused: boolean; sending_live: boolean };

export function moneyConfigFrom(raw: unknown): MoneyConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { buying_paused: o.buying_paused === true, sending_live: o.sending_live === true };
}

/** A read failure reads as not paused (a broken config must not stop every
 *  sale) and as not sending live (a
 *  money move the lawyer has not cleared stays off when in doubt). */
export async function readMoneyConfig(admin: SupabaseClient): Promise<MoneyConfig> {
  const res = await readAppConfig(admin, "money_config", "money_config_read");
  if (!res.ok) {
    console.error("[money-config] read failed; reading as not paused, not sending live");
    return { buying_paused: false, sending_live: false };
  }
  return moneyConfigFrom(res.row?.money_config);
}

/** Sending credit is on in test mode always; in live mode only once
 *  sending_live is set (MESITA-3292). */
export function sendingOn(config: MoneyConfig, livemode: boolean): boolean {
  return !livemode || config.sending_live;
}

// The money section of app_config (MESITA-3303): one key today,
// buying_paused, the kill switch for every voucher sale. Read through the
// app_config door (write-config.ts); the admin console writes it (W3,
// MESITA-3307) with the settle cron's bounds beside it.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { readAppConfig } from "./write-config.ts";
import { type SettleConfig, settleConfigFrom } from "./settle-cron.ts";

export type MoneyConfig = { buying_paused: boolean };

export function moneyConfigFrom(raw: unknown): MoneyConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { buying_paused: o.buying_paused === true };
}

/** The whole money section as the admin console reads and writes it
 *  (MESITA-3307, the `money` section): the pause switch and the settle
 *  cron's bounds, each coerced (a bad bound reads as its default). */
export function normalizeMoneySection(raw: unknown): MoneyConfig & SettleConfig {
  return { ...moneyConfigFrom(raw), ...settleConfigFrom(raw) };
}

/** A read failure reads as not paused: a broken config must not stop every
 *  sale, and the console shows the real value. */
export async function readMoneyConfig(admin: SupabaseClient): Promise<MoneyConfig> {
  const res = await readAppConfig(admin, "money_config", "money_config_read");
  if (!res.ok) {
    console.error("[money-config] read failed; reading as not paused");
    return { buying_paused: false };
  }
  return moneyConfigFrom(res.row?.money_config);
}

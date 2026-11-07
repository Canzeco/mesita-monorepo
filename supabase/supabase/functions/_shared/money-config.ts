// The money section of app_config (MESITA-3303): one key today,
// buying_paused, the kill switch for every voucher sale. Read through the
// app_config door (write-config.ts); the admin console writes it from W3.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { readAppConfig } from "./write-config.ts";

export type MoneyConfig = { buying_paused: boolean };

export function moneyConfigFrom(raw: unknown): MoneyConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { buying_paused: o.buying_paused === true };
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

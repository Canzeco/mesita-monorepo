// Load app_settings.scoring_config for Lineup (MESITA-718).
// NULL / missing / garbage → code defaults (soft-migrate).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  coerceScoringSettings,
  DEFAULT_SCORING_SETTINGS,
  type ScoringSettings,
} from "./lineup-scoring.ts";

/** Read the singleton scoring_config blob. Failures → defaults (never throw). */
export async function loadScoringSettings(
  admin: SupabaseClient,
): Promise<ScoringSettings> {
  try {
    const { data, error } = await admin
      .from("app_settings")
      .select("scoring_config")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      console.warn("[lineup-config] read failed:", error.message);
      return DEFAULT_SCORING_SETTINGS;
    }
    return coerceScoringSettings(data?.scoring_config ?? null);
  } catch (err) {
    console.warn("[lineup-config] read threw:", err);
    return DEFAULT_SCORING_SETTINGS;
  }
}

// Supabase Edge Function — admin-web-get-rewards-config
//
// Naming: caller-verb-words. Caller = admin, verb = get, words = rewards-config.
//
// Returns the Promos config: the v11 ADDITIVE blob (MESITA-1069) when one has
// been saved (`config`, from app_settings.rewards_config.v11 — a leftover v10
// blob is handed back as-is and the client migrates it), plus the v8 legacy
// rule rows and the cap scalar. The admin client prefers `config` and seeds
// its knobs from the rows on the first load before any save; the rows also
// keep an older client mid-deploy rendering. "standing" is the None column.
//
// Rows are returned as stored. The admin catalog fills any gap from the
// launch defaults, so a partially-seeded table still renders a full table.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, jsonError, jsonOk, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const [settings, rules] = await Promise.all([
    admin
      .from("app_settings")
      .select("rewards_config, updated_at")
      .eq("id", 1)
      .maybeSingle(),
    admin
      .from("reward_rules")
      .select("strategy, class, action, discount_percent, updated_at")
      .order("strategy")
      .order("class")
      .order("action"),
  ]);

  if (settings.error) {
    return jsonError(`rewards_config_read: ${settings.error.message}`, 500);
  }
  if (rules.error) {
    return jsonError(`reward_rules_read: ${rules.error.message}`, 500);
  }

  const cfg = (settings.data?.rewards_config ?? {}) as Record<string, unknown>;
  const cap = typeof cfg.cap === "number" ? cfg.cap : null;
  // The additive config — null until the first save, in which case the client
  // seeds from the legacy rows. A leftover v10 blob is handed back as-is and
  // the client migrates it to v11 (coercePromosConfig), so the page opens on
  // the operator's real numbers rather than the launch defaults.
  const isBlob = (v: unknown) =>
    !!v && typeof v === "object" && !Array.isArray(v);
  const config = isBlob(cfg.v11) ? cfg.v11 : isBlob(cfg.v10) ? cfg.v10 : null;

  // Freshest write across both stores — the page shows one "Updated" stamp.
  const stamps = [
    settings.data?.updated_at as string | null | undefined,
    ...(rules.data ?? []).map((r) =>
      (r as { updated_at?: string | null }).updated_at
    ),
  ].filter((v): v is string => typeof v === "string");
  const updatedAt = stamps.length > 0 ? (stamps.sort().at(-1) ?? null) : null;

  return jsonOk({
    config,
    rules: (rules.data ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        strategy: row.strategy,
        class: row.class,
        action: row.action,
        discount_percent: row.discount_percent,
      };
    }),
    cap,
    updatedAt,
  });
});

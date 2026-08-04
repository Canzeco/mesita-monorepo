// Supabase Edge Function — admin-web-get-rewards-config
//
// Naming: caller-verb-words. Caller = admin, verb = get, words = rewards-config.
//
// Returns the v8 NORMALIZED reward rules (MESITA-873) — one row per
// (strategy × class × action), 60 of them — plus the universal cap, which
// stays a scalar on app_settings because it is one platform constant rather
// than a rule. "standing" is the None column.
//
// Rows are returned as stored. The admin catalog fills any gap from the
// launch defaults, so a partially-seeded table still renders a full table.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

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
    return json(
      { ok: false, error: `rewards_config_read: ${settings.error.message}` },
      500,
    );
  }
  if (rules.error) {
    return json(
      { ok: false, error: `reward_rules_read: ${rules.error.message}` },
      500,
    );
  }

  // The cap is the only thing still read out of the blob.
  const cfg = (settings.data?.rewards_config ?? {}) as Record<string, unknown>;
  const cap = typeof cfg.cap === "number" ? cfg.cap : null;

  // Freshest write across both stores — the page shows one "Updated" stamp.
  const stamps = [
    settings.data?.updated_at as string | null | undefined,
    ...(rules.data ?? []).map((r) =>
      (r as { updated_at?: string | null }).updated_at
    ),
  ].filter((v): v is string => typeof v === "string");
  const updatedAt = stamps.length > 0 ? (stamps.sort().at(-1) ?? null) : null;

  return json({
    ok: true,
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

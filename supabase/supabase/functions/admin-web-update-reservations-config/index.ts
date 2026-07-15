// Supabase Edge Function — admin-web-update-reservations-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words = reservations-config.
//
// Writes the reservation-endpoint policy on the public.app_settings singleton from
// the admin console's Reservations Config page. Unlike the sourcing knobs this is a
// WHOLE-CONFIG write, not a per-key merge: `priority` is an ordered list, and a
// partial merge of an ordering is meaningless — the caller always sends the full
// policy. See the getter + 20260715120000_reservations_config.sql for the shape.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { RESERVATION_CHANNELS } from "../_shared/enrich-reservation-endpoint.ts";

type ReservationsConfig = {
  priority: string[];
  disabled: string[];
  respectAdminOverride: boolean;
};

const KNOWN = new Set<string>(RESERVATION_CHANNELS);

// Coerce the whole policy. Returns an error string on invalid input — the row is
// never touched on a partial or unknown-channel body.
function normalizeConfig(
  raw: unknown,
): { ok: true; value: ReservationsConfig } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "config must be an object" };
  }
  const c = raw as Record<string, unknown>;

  if (!Array.isArray(c.priority)) {
    return { ok: false, error: "config.priority must be an array" };
  }
  const priority: string[] = [];
  for (const ch of c.priority) {
    if (typeof ch !== "string" || !KNOWN.has(ch)) {
      return { ok: false, error: `config.priority has unknown channel "${String(ch)}"` };
    }
    if (!priority.includes(ch)) priority.push(ch);
  }
  // The list is the eligible set as well as the order, so it must be complete —
  // parking a channel is what `disabled` is for. Otherwise a channel silently
  // dropped from the array would be indistinguishable from one never wired.
  if (priority.length !== RESERVATION_CHANNELS.length) {
    return {
      ok: false,
      error: `config.priority must rank every channel (${RESERVATION_CHANNELS.join(", ")})`,
    };
  }

  if (!Array.isArray(c.disabled)) {
    return { ok: false, error: "config.disabled must be an array" };
  }
  const disabled: string[] = [];
  for (const ch of c.disabled) {
    if (typeof ch !== "string" || !KNOWN.has(ch)) {
      return { ok: false, error: `config.disabled has unknown channel "${String(ch)}"` };
    }
    if (!disabled.includes(ch)) disabled.push(ch);
  }
  if (disabled.length === RESERVATION_CHANNELS.length) {
    return {
      ok: false,
      error: "config.disabled cannot park every channel — no place could be booked",
    };
  }

  if (typeof c.respectAdminOverride !== "boolean") {
    return { ok: false, error: "config.respectAdminOverride must be a boolean" };
  }

  return {
    ok: true,
    value: { priority, disabled, respectAdminOverride: c.respectAdminOverride },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<{ config?: unknown }>(req);
  if (!bodyRes.ok) return bodyRes.response;

  const norm = normalizeConfig(bodyRes.body.config);
  if (!norm.ok) return json({ ok: false, error: norm.error }, 400);

  const { data, error } = await admin
    .from("app_settings")
    .update({ reservations_config: norm.value, updated_by: userId })
    .eq("id", 1)
    .select("reservations_config, updated_at")
    .single();
  if (error) {
    return json({ ok: false, error: `reservations_config_update: ${error.message}` }, 500);
  }

  return json({
    ok: true,
    config: data.reservations_config,
    updatedAt: data.updated_at,
  });
});

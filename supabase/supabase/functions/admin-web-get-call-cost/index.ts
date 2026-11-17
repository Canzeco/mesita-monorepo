// Supabase Edge Function — admin-web-get-call-cost
//
// Configurations › Reservations › Call cost (MESITA-4043, Pato: "a section
// calculating how much a one minute call of eleven labs reservation costs on
// average"). Super-admin only, read-only: it reads what ElevenLabs already
// billed and never places a call. The ElevenLabs key stays here.
//
//   calls    the reservation agents' conversations of the last `days`
//            (agents_config.agents.<key>.id), by ElevenLabs' list API, which
//            carries each call's `cost` in credits and its length
//   plan     /v1/user/subscription: USD per credit = invoice ÷ credit limit,
//            else the tier's list price
//   answer   Σ credits ÷ Σ minutes, × USD per credit (cost.ts)
//   pesos    USD → MXN from Frankfurter (ECB rates, no key), so the card reads
//            in pesos (MESITA-4235, Pato: "use pesos not only eleven labs
//            credits"); null when the rate cannot be read
//
// ElevenLabs only: the Twilio phone line bills apart.
//
// Body: { days?: 7 | 30 | 90 }  (30 by default)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { resolveElevenLabsKey } from "../_shared/elevenlabs.ts";
import { type CallRow, callCost, parseMxnPerUsd } from "./cost.ts";

const FX = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=MXN";

async function mxnPerUsd(): Promise<number | null> {
  try {
    const res = await fetch(FX, { signal: AbortSignal.timeout(5_000) });
    return res.ok ? parseMxnPerUsd(await res.json()) : null;
  } catch {
    return null;
  }
}

const EL = "https://api.elevenlabs.io";
const PAGE = 100;
const MAX_PAGES = 10;

async function elGet(key: string, path: string): Promise<{ ok: true; body: unknown } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${EL}${path}`, {
      headers: { "xi-api-key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `${res.status} ${text.slice(0, 200)}` };
    return { ok: true, body: text ? JSON.parse(text) : null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "request failed" };
  }
}

type Conv = { cost?: unknown; call_duration_secs?: unknown };

async function agentCalls(key: string, agentId: string, sinceUnix: number) {
  const rows: CallRow[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const qs = new URLSearchParams({
      agent_id: agentId,
      page_size: String(PAGE),
      call_start_after_unix: String(sinceUnix),
    });
    if (cursor) qs.set("cursor", cursor);
    const r = await elGet(key, `/v1/convai/conversations?${qs}`);
    if (!r.ok) return { ok: false as const, error: r.error };
    const body = r.body as { conversations?: Conv[]; has_more?: boolean; next_cursor?: string | null } | null;
    for (const c of body?.conversations ?? []) {
      rows.push({ cost: Number(c.cost ?? NaN), seconds: Number(c.call_duration_secs ?? 0) });
    }
    if (!body?.has_more || !body.next_cursor) return { ok: true as const, rows, truncated: false };
    cursor = body.next_cursor;
  }
  return { ok: true as const, rows, truncated: true };
}

serveJson("admin-web-get-call-cost", async (req) => {
  const ctx = await requireAdminRequest(req, "Only admins can read call costs.");
  if (ctx instanceof Response) return ctx;

  const key = await resolveElevenLabsKey();
  if (!key) return json({ ok: false, error: "ELEVENLABS_KEY is not set on the Edge Functions" }, 500);

  const body = await readJsonOr<{ days?: unknown }>(req, {});
  const days = typeof body.days === "number" && [7, 30, 90].includes(body.days) ? body.days : 30;
  const sinceUnix = Math.floor(Date.now() / 1000) - days * 86_400;

  const { data: settings, error: settingsError } = await ctx.admin
    .from("app_config")
    .select("agents_config")
    .eq("id", 1)
    .maybeSingle();
  if (settingsError) return json({ ok: false, error: `agents_config: ${settingsError.message}` }, 500);
  const agents = ((settings?.agents_config as { agents?: Record<string, { id?: unknown }> } | null)?.agents) ?? {};
  const agentIds = [...new Set(
    Object.values(agents).map((a) => (typeof a?.id === "string" ? a.id.trim() : "")).filter(Boolean),
  )];
  if (agentIds.length === 0) return json({ ok: false, error: "No reservation agents in agents_config" }, 500);

  const [lists, sub, fx] = await Promise.all([
    Promise.all(agentIds.map((id) => agentCalls(key, id, sinceUnix))),
    elGet(key, "/v1/user/subscription"),
    mxnPerUsd(),
  ]);
  const failed = lists.find((l) => !l.ok);
  if (failed && !failed.ok) return json({ ok: false, error: `ElevenLabs conversations: ${failed.error}` }, 502);
  const rows = lists.flatMap((l) => (l.ok ? l.rows : []));

  const s = (sub.ok ? sub.body : null) as {
    tier?: unknown;
    character_limit?: unknown;
    next_invoice?: { amount_due_cents?: unknown } | null;
  } | null;
  const tier = typeof s?.tier === "string" ? s.tier : null;
  const creditLimit = typeof s?.character_limit === "number" ? s.character_limit : null;
  const cents = s?.next_invoice?.amount_due_cents;
  const invoiceUsd = typeof cents === "number" ? cents / 100 : null;

  return json({
    ok: true,
    days,
    plan: tier,
    mxnPerUsd: fx,
    truncated: lists.some((l) => l.ok && l.truncated),
    ...callCost(rows, { tier, creditLimit, invoiceUsd }),
  });
});

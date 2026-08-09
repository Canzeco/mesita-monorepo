import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient, type User } from "jsr:@supabase/supabase-js@2";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } as const;
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } }); }
function corsPreflight(): Response { return new Response(null, { headers: CORS }); }
function rejectUnlessMethods(req: Request, ...allowed: string[]): Response | null { return allowed.includes(req.method) ? null : json({ ok: false, error: "Method not allowed" }, 405); }
async function readJsonOr<T>(req: Request, fallback: T): Promise<T> { try { return (await req.json()) as T; } catch { return fallback; } }
type EFEnv = { url: string; anonKey: string; serviceKey: string };
function readEFEnv(): { ok: true; env: EFEnv } | { ok: false; response: Response } {
  const url = Deno.env.get("SUPABASE_URL"); const anonKey = Deno.env.get("SUPABASE_ANON_KEY"); const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return { ok: false, response: json({ ok: false, error: "Server misconfigured" }, 500) };
  return { ok: true, env: { url, anonKey, serviceKey } };
}
type AuthedUser = { id: string; email: string | null; emailLower: string | null; phone: string | null };
async function getAuthedUser(req: Request, env: EFEnv): Promise<{ ok: true; user: AuthedUser } | { ok: false; response: Response }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return { ok: false, response: json({ ok: false, error: "Missing bearer token" }, 401) };
  const userClient = createClient(env.url, env.anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return { ok: false, response: json({ ok: false, error: "Invalid session" }, 401) };
  const raw = data.user;
  return { ok: true, user: { id: raw.id, email: raw.email ?? null, emailLower: raw.email?.toLowerCase() ?? null, phone: raw.phone ?? null } };
}
function adminClient(env: EFEnv): SupabaseClient { return createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }); }
async function requireSuperAdmin(admin: SupabaseClient, user: AuthedUser): Promise<{ ok: true } | { ok: false; response: Response }> {
  if (!user.emailLower && !user.phone) return { ok: false, response: json({ ok: false, error: "No identity on session" }, 401) };
  let sa: { email: string; user_id: string | null } | null = null;
  if (user.emailLower) { const { data } = await admin.from("super_admins").select("email, user_id").eq("email", user.emailLower).maybeSingle(); sa = data as typeof sa; }
  if (!sa && user.phone) { const { data } = await admin.from("super_admins").select("email, user_id").eq("phone", user.phone).maybeSingle(); sa = data as typeof sa; }
  if (!sa) return { ok: false, response: json({ ok: false, error: "Not a super-admin" }, 403) };
  if (sa.user_id == null) void admin.from("super_admins").update({ user_id: user.id }).eq("email", sa.email).is("user_id", null);
  return { ok: true };
}
const PROBE_TIMEOUT_MS = 8_000;
const STALE_CALL_MINS = 30;
type Verdict = "ok" | "degraded" | "down" | "unconfigured";
type Cost = "free" | "paid";
type ProbeResult = {
  id: string; label: string; impact: string; cost: Cost; verdict: Verdict;
  envKeys: string[]; httpStatus: number | null; latencyMs: number | null; detail: string;
};
type ProbeSpec = {
  id: string; label: string; impact: string; cost: Cost; envKeys: string[];
  run: (keys: Record<string, string | undefined>) => Promise<{
    res: Response;
    detail: (body: unknown) => string;
    verdict?: (body: unknown) => Verdict | null;
  }>;
};
function cleanSecret(raw: string): string {
  let s = raw.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1).trim();
  return s.replace(/^\uFEFF/, "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\r?\n/g, "").trim();
}
function firstKey(keys: Record<string, string | undefined>, names: string[]): string | undefined {
  for (const n of names) { const v = keys[n]; if (v && v.trim()) return cleanSecret(v); }
  return undefined;
}
function firstKeyedSecret(keys: Record<string, string | undefined>, names: string[], ok: (v: string) => boolean): string | undefined {
  const c: string[] = [];
  for (const n of names) { const v = keys[n]; if (v && v.trim()) c.push(cleanSecret(v)); }
  return c.find(ok) ?? c[0];
}
function num(body: unknown, ...path: string[]): number | null {
  let cur: unknown = body;
  for (const seg of path) { if (!cur || typeof cur !== "object") return null; cur = (cur as Record<string, unknown>)[seg]; }
  return typeof cur === "number" ? cur : null;
}
function numAny(body: unknown, paths: string[][]): number | null {
  for (const path of paths) { const v = num(body, ...path); if (v !== null) return v; }
  return null;
}
function str(body: unknown, ...path: string[]): string | null {
  let cur: unknown = body;
  for (const seg of path) { if (!cur || typeof cur !== "object") return null; cur = (cur as Record<string, unknown>)[seg]; }
  return typeof cur === "string" ? cur : null;
}
async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}
function errorLine(body: unknown, raw: string): string {
  const msg = str(body, "error", "message") ?? str(body, "detail", "message") ?? str(body, "error") ?? str(body, "message") ?? str(body, "detail");
  const line = (msg ?? raw).trim();
  return line.length > 220 ? `${line.slice(0, 220)}…` : line || "No error body.";
}
const PROBES: ProbeSpec[] = [
  {
    id: "firecrawl", label: "Firecrawl",
    impact: "Enricher link discovery (S4 gather) — fails SOFT, returns no links",
    cost: "free", envKeys: ["FIRECRAWL_KEY"],
    run: async (keys) => {
      const key = firstKey(keys, ["FIRECRAWL_KEY"])!;
      const res = await timedFetch("https://api.firecrawl.dev/v2/team/credit-usage", { headers: { Authorization: `Bearer ${key}` } });
      const remainingOf = (b: unknown) => numAny(b, [["data", "remainingCredits"], ["data", "remaining_credits"]]);
      return {
        res,
        verdict: (b) => (remainingOf(b) === null ? "degraded" : null),
        detail: (b) => {
          const remaining = remainingOf(b);
          return remaining === null
            ? "Key accepted, but balance UNVERIFIED — no credit figure in the response."
            : `${remaining.toLocaleString()} credits remaining.`;
        },
      };
    },
  },
  {
    id: "apify", label: "Apify", impact: "Enricher Instagram/actor scraping", cost: "free", envKeys: ["APIFY_KEY"],
    run: async (keys) => {
      const key = firstKey(keys, ["APIFY_KEY"])!;
      const res = await timedFetch(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(key)}`);
      let spend: string | null = null; let spendUnknown = true;
      if (res.ok) {
        try {
          const u = await timedFetch(`https://api.apify.com/v2/users/me/usage/monthly?token=${encodeURIComponent(key)}`);
          if (u.ok) {
            const b = await u.json();
            const used = num(b, "data", "totalUsageCreditsUsdBeforeVolumeDiscount") ?? num(b, "data", "monthlyUsageUsd");
            if (used !== null) { spend = `$${used.toFixed(2)} used this month`; spendUnknown = false; }
          }
        } catch { /* best-effort */ }
      }
      return {
        res, verdict: () => (spendUnknown ? "degraded" : null),
        detail: (b) => {
          const plan = str(b, "data", "plan", "id"); const user = str(b, "data", "username");
          const head = [user && `user ${user}`, plan && `plan ${plan}`].filter(Boolean).join(" · ") || "Key accepted";
          return `${head} · ${spend ?? "spend UNVERIFIED"}.`;
        },
      };
    },
  },
  {
    id: "twilio", label: "Twilio",
    impact: "Phone OTP — the ONLY consumer sign-in. Dead key = nobody logs in",
    cost: "free", envKeys: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
    run: async (keys) => {
      const sid = firstKey(keys, ["TWILIO_ACCOUNT_SID"])!;
      const token = firstKey(keys, ["TWILIO_AUTH_TOKEN"])!;
      const auth = { Authorization: `Basic ${btoa(`${sid}:${token}`)}` };
      const res = await timedFetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`, { headers: auth });
      let balance: string | null = null; let balanceUnknown = true; let broke = false;
      if (res.ok) {
        try {
          const bal = await timedFetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Balance.json`, { headers: auth });
          if (bal.ok) {
            const b = await bal.json();
            const raw = str(b, "balance"); const cur = str(b, "currency") ?? "";
            const amount = raw === null ? null : Number(raw);
            if (amount !== null && Number.isFinite(amount)) {
              balance = `${amount.toFixed(2)} ${cur}`.trim(); balanceUnknown = false; broke = amount <= 0;
            }
          }
        } catch { /* best-effort */ }
      }
      return {
        res, verdict: () => (broke ? "down" : (balanceUnknown ? "degraded" : null)),
        detail: (b) => {
          const status = str(b, "status"); const type = str(b, "type");
          const head = [status && `account ${status}`, type].filter(Boolean).join(" · ") || "Key accepted";
          if (broke) return `${head} · NO BALANCE (${balance}) — OTP sign-in will fail.`;
          return `${head} · ${balance ? `balance ${balance}` : "balance UNVERIFIED"}.`;
        },
      };
    },
  },
  {
    id: "elevenlabs", label: "ElevenLabs", impact: "Reservationist voice agents (a1–a4)",
    cost: "free", envKeys: ["ELEVENLABS_KEY", "ELEVEN_KEY"],
    run: async (keys) => {
      const key = firstKeyedSecret(keys, ["ELEVENLABS_KEY", "ELEVEN_KEY"], (v) => v.startsWith("sk_"))!;
      if (!key.startsWith("sk_")) {
        return {
          res: new Response(JSON.stringify({ detail: { type: "authentication_error", message: "Secret looks like an API key ID, not an API key. ElevenLabs keys start with 'sk_' — paste the secret value shown when the key was created/rotated into ELEVENLABS_KEY (or ELEVEN_KEY)." } }), { status: 400 }),
          detail: (b) => errorLine(b, ""),
        };
      }
      const headers = { "xi-api-key": key };
      const res = await timedFetch("https://api.elevenlabs.io/v1/convai/agents?page_size=100", { headers });
      let quota: string | null = null; let quotaHidden = false;
      if (res.ok) {
        try {
          const sub = await timedFetch("https://api.elevenlabs.io/v1/user/subscription", { headers });
          if (sub.ok) {
            const b = await sub.json();
            const used = num(b, "character_count"); const limit = num(b, "character_limit"); const tier = str(b, "tier");
            const chars = used !== null && limit !== null ? `${used.toLocaleString()}/${limit.toLocaleString()} chars` : null;
            quota = [tier && `tier ${tier}`, chars].filter(Boolean).join(" · ") || null;
          } else if (sub.status === 401 || sub.status === 403) {
            quotaHidden = true; quota = "quota hidden (key lacks user_read)";
          }
        } catch { quotaHidden = true; }
      }
      let lastCallFailure: string | null = null; let lastCallFailureStale = false;
      if (res.ok) {
        try {
          const conv = await timedFetch("https://api.elevenlabs.io/v1/convai/conversations?page_size=1", { headers });
          if (conv.ok) {
            const list = (await conv.json()) as { conversations?: Array<{ conversation_id?: string }> };
            const id = list.conversations?.[0]?.conversation_id;
            if (id) {
              const one = await timedFetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(id)}`, { headers });
              if (one.ok) {
                const c = (await one.json()) as { metadata?: { error?: { code?: number; reason?: string }; termination_reason?: string; charging?: { tier?: string }; start_time_unix_secs?: number } };
                const err = c.metadata?.error; const reason = c.metadata?.termination_reason ?? "";
                if (err?.code === 1002 || /quota/i.test(reason)) {
                  const startedSecs = c.metadata?.start_time_unix_secs ?? null;
                  const ageMins = startedSecs ? Math.round((Date.now() / 1000 - startedSecs) / 60) : null;
                  lastCallFailureStale = ageMins === null ? false : ageMins > STALE_CALL_MINS;
                  const when = ageMins === null ? "at an unknown time" : ageMins < 60 ? `${ageMins} min ago` : `${Math.round(ageMins / 60)} h ago`;
                  lastCallFailure = lastCallFailureStale
                    ? `Last call (${when}) was killed for quota — may be STALE if you have since topped up. Place a test call to confirm.`
                    : `OUT OF CREDITS — last call (${when}) killed on answer: ${(err?.reason ?? reason).slice(0, 80)}`;
                }
                if (!quota && c.metadata?.charging?.tier) quota = `tier ${c.metadata.charging.tier}`;
              }
            }
          }
        } catch { /* best-effort */ }
      }
      return {
        res,
        verdict: () => lastCallFailure ? (lastCallFailureStale ? "degraded" : "down") : (quotaHidden ? "degraded" : null),
        detail: (b) => {
          if (lastCallFailure) return lastCallFailure;
          const agents = (b as { agents?: unknown[] } | null)?.agents;
          const head = Array.isArray(agents) ? `${agents.length} agent(s) visible` : "Key accepted";
          const tail = quotaHidden ? "balance UNVERIFIED — grant user_read to the key to see it" : quota;
          return [head, tail].filter(Boolean).join(" · ") + ".";
        },
      };
    },
  },
  {
    id: "openai", label: "OpenAI", impact: "Memo airlock (parked) — not yet load-bearing",
    cost: "free", envKeys: ["OPENAI_KEY"],
    run: async (keys) => {
      const key = firstKey(keys, ["OPENAI_KEY"])!;
      const res = await timedFetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
      return {
        res,
        detail: (b) => {
          const data = (b as { data?: unknown[] } | null)?.data;
          const head = Array.isArray(data) ? `Key accepted — ${data.length} models visible` : "Key accepted";
          return `${head} · balance not exposed by OpenAI (key-only check).`;
        },
      };
    },
  },
  {
    id: "stripe", label: "Stripe", impact: "Business plans + consumer Premium subscriptions",
    cost: "free", envKeys: ["STRIPE_SECRET_KEY"],
    run: async (keys) => {
      const key = firstKey(keys, ["STRIPE_SECRET_KEY"])!;
      if (!/^sk_(live|test)_/.test(key)) {
        return {
          res: new Response(JSON.stringify({ error: { message: key.startsWith("rk_")
            ? "STRIPE_SECRET_KEY holds a restricted key (rk_…). Billing Test needs the secret key (sk_live_… / sk_test_…)."
            : key.startsWith("pk_")
            ? "STRIPE_SECRET_KEY holds a publishable key (pk_…). Paste the secret key (sk_live_… / sk_test_…)."
            : "STRIPE_SECRET_KEY does not look like a Stripe secret key (expected sk_live_… or sk_test_…)." } }), { status: 401 }),
          detail: (b) => errorLine(b, ""),
        };
      }
      const res = await timedFetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${key}` } });
      return {
        res,
        detail: (b) => {
          const live = (b as { livemode?: unknown } | null)?.livemode;
          return live === true ? "Key accepted — LIVE mode." : live === false ? "Key accepted — test mode." : "Key accepted.";
        },
      };
    },
  },
  {
    id: "perplexity", label: "Perplexity", impact: "Memo answers + Enricher S5 (Agent Y link select)",
    cost: "paid", envKeys: ["PERPLEXITY_KEY"],
    run: async (keys) => {
      const key = firstKey(keys, ["PERPLEXITY_KEY"])!;
      const res = await timedFetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "sonar", max_tokens: 16, disable_search: true, messages: [{ role: "user", content: "ping" }] }),
      });
      return { res, detail: (b) => { const model = str(b, "model"); return model ? `Key accepted — ${model} answered.` : "Key accepted."; } };
    },
  },
  {
    id: "google-places", label: "Google Places", impact: "Identity spine for Atlas, Enricher and Lineup",
    cost: "paid", envKeys: ["GMP_KEY", "SUPA_GMP_KEY"],
    run: async (keys) => {
      const key = firstKey(keys, ["GMP_KEY", "SUPA_GMP_KEY"])!;
      const res = await timedFetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id" },
        body: JSON.stringify({ textQuery: "cafe", maxResultCount: 1 }),
      });
      return {
        res,
        detail: (b) => {
          const places = (b as { places?: unknown[] } | null)?.places;
          return Array.isArray(places) ? `Key accepted — ${places.length} result(s).` : "Key accepted.";
        },
      };
    },
  },
];
async function runProbe(spec: ProbeSpec, keys: Record<string, string | undefined>): Promise<ProbeResult> {
  const base = { id: spec.id, label: spec.label, impact: spec.impact, cost: spec.cost, envKeys: spec.envKeys };
  if (!firstKey(keys, spec.envKeys)) {
    return { ...base, verdict: "unconfigured", httpStatus: null, latencyMs: null, detail: `No secret set for ${spec.envKeys.join(" / ")}.` };
  }
  const started = Date.now();
  try {
    const { res, detail, verdict: verdictOf } = await spec.run(keys);
    const latencyMs = Date.now() - started;
    const raw = await res.text();
    let body: unknown = null;
    try { body = JSON.parse(raw); } catch { body = null; }
    if (res.ok) return { ...base, verdict: verdictOf?.(body) ?? "ok", httpStatus: res.status, latencyMs, detail: detail(body) };
    return { ...base, verdict: res.status === 429 ? "degraded" : "down", httpStatus: res.status, latencyMs, detail: errorLine(body, raw) };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return { ...base, verdict: "down", httpStatus: null, latencyMs, detail: aborted ? `No response within ${PROBE_TIMEOUT_MS / 1000}s.` : err instanceof Error ? err.message : "Probe threw a non-Error." };
  }
}
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
  const body = await readJsonOr<{ providers?: unknown }>(req, {});
  const requested = Array.isArray(body.providers) ? body.providers.filter((p): p is string => typeof p === "string") : null;
  const selected = requested ? PROBES.filter((p) => requested.includes(p.id)) : PROBES.filter((p) => p.cost === "free");
  if (selected.length === 0) return json({ ok: false, error: "No known providers selected." }, 400);
  const keyNames = [...new Set(PROBES.flatMap((p) => p.envKeys))];
  const keys: Record<string, string | undefined> = {};
  for (const n of keyNames) keys[n] = Deno.env.get(n);
  const results = await Promise.all(selected.map((p) => runProbe(p, keys)));
  return json({ ok: true, checkedAt: new Date().toISOString(), results });
});

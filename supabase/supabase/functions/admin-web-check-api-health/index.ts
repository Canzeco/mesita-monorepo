// Supabase Edge Function — admin-web-check-api-health
//
// Isolated liveness/quota probes for every third-party API Mesita depends on.
// Powers the admin console's Testing → Billing Test page: one card per
// provider, each answering three questions independently of the others —
//
//   1. Is the key even configured in this project's EF secrets?
//   2. Does the provider accept it right now (auth still valid, not suspended)?
//   3. What does the provider say about the remaining balance / quota?
//
// The point is ISOLATION. A single enrichment run touches Firecrawl, Perplexity
// and Google Places at once, so when it degrades you cannot tell which vendor
// went dark — every failure looks the same from the pipeline's side, and the
// Firecrawl leg in particular fails SOFT (returns [] on any non-2xx), so a dead
// key is indistinguishable from "no results". Probing one vendor at a time is
// the only way to attribute the failure.
//
// COST: most probes hit an account/metadata endpoint that vendors do not bill
// for. Perplexity and Google Places expose no such endpoint and must spend a
// token / a request unit to prove the key works. They used to be gated behind
// their own buttons so a sweep stayed free; that gate is gone — a few cents is
// nothing against an unattributed outage, and one button now runs the lot.
//
// Local:  supabase functions serve admin-web-check-api-health
// Deploy: supabase functions deploy admin-web-check-api-health

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import {
  STRIPE_SECRET_KEY_NAMES,
  stripeMode,
  stripeSecretKeyNames,
} from "../_shared/stripe-env.ts";

// How long any single probe may take before we call it dead. Vendors that are
// merely slow are still a problem worth surfacing, so this is deliberately
// tighter than the EF's own wall-clock budget.
const PROBE_TIMEOUT_MS = 8_000;

// A quota-killed call older than this is treated as history, not as proof the
// account is still dry — the operator may have topped up in between.
const STALE_CALL_MINS = 30;

type Verdict = "ok" | "degraded" | "down" | "unconfigured";

type ProbeResult = {
  id: string;
  label: string;
  /** What breaks in the product when this provider is down. */
  impact: string;
  verdict: Verdict;
  /** Env var names this probe read, so a missing secret is self-describing. */
  envKeys: string[];
  httpStatus: number | null;
  latencyMs: number | null;
  /** One-line human summary — the balance, the plan, or the error. */
  detail: string;
};

type ProbeSpec = {
  id: string;
  label: string;
  impact: string;
  envKeys: string[];
  run: (
    keys: Record<string, string | undefined>,
  ) => Promise<{
    res: Response;
    detail: (body: unknown) => string;
    /**
     * Downgrade a 2xx. A reachable vendor is not the same as a WORKING one:
     * ElevenLabs answers `/convai/agents` perfectly while the account is out
     * of credits and every call dies on answer. Without this the card reads
     * "Healthy" during a total outage, which is worse than having no card.
     */
    verdict?: (body: unknown) => Verdict | null;
  }>;
};

/** Strip paste noise operators often leave in dashboard secrets. */
function cleanSecret(raw: string): string {
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  // BOM / zero-width / newlines that survive a dashboard paste.
  s = s.replace(/^\uFEFF/, "").replace(/[\u200B-\u200D\uFEFF]/g, "");
  s = s.replace(/\r?\n/g, "").trim();
  return s;
}

/** First non-empty env var among `names` — tolerates the ELEVEN_KEY/ELEVENLABS_KEY drift. */
function firstKey(
  keys: Record<string, string | undefined>,
  names: string[],
): string | undefined {
  for (const n of names) {
    const v = keys[n];
    if (v && v.trim()) return cleanSecret(v);
  }
  return undefined;
}

/**
 * Prefer a secret that looks like a real vendor API key over a key *id*.
 * ElevenLabs in particular rejects key ids with "API key ID used as API key"
 * when ELEVENLABS_KEY holds the id and ELEVEN_KEY holds the sk_ value (or
 * the other way around) — take the sk_ one.
 */
function firstKeyedSecret(
  keys: Record<string, string | undefined>,
  names: string[],
  looksLikeKey: (v: string) => boolean,
): string | undefined {
  const candidates: string[] = [];
  for (const n of names) {
    const v = keys[n];
    if (v && v.trim()) candidates.push(cleanSecret(v));
  }
  return candidates.find(looksLikeKey) ?? candidates[0];
}

function num(body: unknown, ...path: string[]): number | null {
  let cur: unknown = body;
  for (const seg of path) {
    if (!cur || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return typeof cur === "number" ? cur : null;
}

/** First numeric hit across alternate paths (snake_case vs camelCase drift). */
function numAny(
  body: unknown,
  paths: string[][],
): number | null {
  for (const path of paths) {
    const v = num(body, ...path);
    if (v !== null) return v;
  }
  return null;
}

function str(body: unknown, ...path: string[]): string | null {
  let cur: unknown = body;
  for (const seg of path) {
    if (!cur || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return typeof cur === "string" ? cur : null;
}

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── The probe registry ──────────────────────────────────────────────────────
//
// Each entry is fully self-contained: it knows its own keys, its own endpoint,
// and how to turn that vendor's bespoke response into one line of English.
// Adding a vendor means adding one entry here and nothing else.

const PROBES: ProbeSpec[] = [
  {
    id: "firecrawl",
    label: "Firecrawl",
    impact:
      "Intaker link discovery (S4 gather) — fails SOFT, returns no links",
    envKeys: ["FIRECRAWL_KEY"],
    run: async (keys) => {
      const key = firstKey(keys, ["FIRECRAWL_KEY"])!;
      const res = await timedFetch(
        "https://api.firecrawl.dev/v2/team/credit-usage",
        { headers: { Authorization: `Bearer ${key}` } },
      );
      // Firecrawl v2 docs ship camelCase (`remainingCredits`); older payloads
      // and some internal commits still use snake_case. Accept either — the
      // page's whole job is the balance, so a shape miss must not read as
      // "Throttled / UNVERIFIED" on a healthy account.
      const remainingOf = (b: unknown) =>
        numAny(b, [
          ["data", "remainingCredits"],
          ["data", "remaining_credits"],
        ]);
      return {
        res,
        // "Key accepted" is not a balance. If the credit number is missing the
        // page cannot answer the question it exists to answer, so say so.
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
    id: "apify",
    label: "Apify",
    impact: "Intaker Instagram/actor scraping",
    envKeys: ["APIFY_KEY"],
    run: async (keys) => {
      const key = firstKey(keys, ["APIFY_KEY"])!;
      const res = await timedFetch(
        `https://api.apify.com/v2/users/me?token=${encodeURIComponent(key)}`,
      );

      // /users/me proves the token, not the money. Spend lives on the usage
      // endpoint; without it a drained account reads "Healthy".
      let spend: string | null = null;
      let spendUnknown = true;
      if (res.ok) {
        try {
          const u = await timedFetch(
            `https://api.apify.com/v2/users/me/usage/monthly?token=${
              encodeURIComponent(key)
            }`,
          );
          if (u.ok) {
            const b = await u.json();
            const used = num(b, "data", "totalUsageCreditsUsdBeforeVolumeDiscount") ??
              num(b, "data", "monthlyUsageUsd");
            if (used !== null) {
              spend = `$${used.toFixed(2)} used this month`;
              spendUnknown = false;
            }
          }
        } catch {
          // best-effort
        }
      }

      return {
        res,
        verdict: () => (spendUnknown ? "degraded" : null),
        detail: (b) => {
          const plan = str(b, "data", "plan", "id");
          const user = str(b, "data", "username");
          const head = [user && `user ${user}`, plan && `plan ${plan}`]
            .filter(Boolean).join(" · ") || "Key accepted";
          return `${head} · ${spend ?? "spend UNVERIFIED"}.`;
        },
      };
    },
  },
  {
    id: "twilio",
    label: "Twilio",
    impact: "Phone OTP — the ONLY consumer sign-in. Dead key = nobody logs in",
    envKeys: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
    run: async (keys) => {
      const sid = firstKey(keys, ["TWILIO_ACCOUNT_SID"])!;
      const token = firstKey(keys, ["TWILIO_AUTH_TOKEN"])!;
      const res = await timedFetch(
        `https://api.twilio.com/2010-04-01/Accounts/${
          encodeURIComponent(sid)
        }.json`,
        { headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}` } },
      );
      // An account reads "active" at $0.00 — and then every OTP silently fails
      // and nobody can sign in. Status is not money; fetch the balance.
      let balance: string | null = null;
      let balanceUnknown = true;
      let broke = false;
      if (res.ok) {
        try {
          const bal = await timedFetch(
            `https://api.twilio.com/2010-04-01/Accounts/${
              encodeURIComponent(sid)
            }/Balance.json`,
            { headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}` } },
          );
          if (bal.ok) {
            const b = await bal.json();
            const raw = str(b, "balance");
            const cur = str(b, "currency") ?? "";
            const amount = raw === null ? null : Number(raw);
            if (amount !== null && Number.isFinite(amount)) {
              balance = `${amount.toFixed(2)} ${cur}`.trim();
              balanceUnknown = false;
              broke = amount <= 0;
            }
          }
        } catch {
          // best-effort
        }
      }

      return {
        res,
        verdict: () => (broke ? "down" : (balanceUnknown ? "degraded" : null)),
        detail: (b) => {
          const status = str(b, "status");
          const type = str(b, "type");
          const head = [status && `account ${status}`, type]
            .filter(Boolean).join(" · ") || "Key accepted";
          if (broke) return `${head} · NO BALANCE (${balance}) — OTP sign-in will fail.`;
          return `${head} · ${
            balance ? `balance ${balance}` : "balance UNVERIFIED"
          }.`;
        },
      };
    },
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    impact: "Reservationist voice agents (a1–a4)",
    envKeys: ["ELEVENLABS_KEY", "ELEVEN_KEY"],
    run: async (keys) => {
      // ElevenLabs API keys start with `sk_`. A common dashboard mistake is
      // pasting the key *id* (shown in the table) into ELEVENLABS_KEY while
      // the real sk_ value lives under ELEVEN_KEY (or vice versa) — prefer
      // the one that looks like a key so the probe matches the product.
      const key = firstKeyedSecret(
        keys,
        ["ELEVENLABS_KEY", "ELEVEN_KEY"],
        (v) => v.startsWith("sk_"),
      )!;
      if (!key.startsWith("sk_")) {
        // Don't bother the vendor — the secret is the wrong kind of string.
        // Surface a synthetic 400 that the page already knows how to render.
        return {
          res: new Response(
            JSON.stringify({
              detail: {
                type: "authentication_error",
                message:
                  "Secret looks like an API key ID, not an API key. ElevenLabs keys start with 'sk_' — paste the secret value shown when the key was created/rotated into ELEVENLABS_KEY (or ELEVEN_KEY).",
              },
            }),
            { status: 400 },
          ),
          detail: (b) => errorLine(b, ""),
        };
      }
      const headers = { "xi-api-key": key };

      // Probe the capability Mesita actually depends on — the ConvAI agent
      // fleet — NOT /v1/user/subscription. ElevenLabs keys carry per-scope
      // permissions, and an agents-scoped key without `user_read` 401s on the
      // account endpoint while working perfectly for every call the product
      // makes. Reading the account first made a healthy key look like a dead
      // vendor (MESITA-826).
      const res = await timedFetch(
        "https://api.elevenlabs.io/v1/convai/agents?page_size=100",
        { headers },
      );

      // Quota, best-effort: an agents-scoped key 401s here.
      let quota: string | null = null;
      let quotaHidden = false;
      if (res.ok) {
        try {
          const sub = await timedFetch(
            "https://api.elevenlabs.io/v1/user/subscription",
            { headers },
          );
          if (sub.ok) {
            const b = await sub.json();
            const used = num(b, "character_count");
            const limit = num(b, "character_limit");
            const tier = str(b, "tier");
            const chars = used !== null && limit !== null
              ? `${used.toLocaleString()}/${limit.toLocaleString()} chars`
              : null;
            quota =
              [tier && `tier ${tier}`, chars].filter(Boolean).join(" · ") ||
              null;
          } else if (sub.status === 401 || sub.status === 403) {
            quotaHidden = true;
            quota = "quota hidden (key lacks user_read)";
          }
        } catch {
          quotaHidden = true;
        }
      }

      // THE CHECK THAT MATTERS. On 2026-08-04 this card read "Healthy" while
      // every reservation call was being killed the instant the guest answered:
      // `/convai/agents` answers fine with an exhausted balance, and the quota
      // leg was invisible because the key lacks `user_read`. So ask the only
      // question that can't be faked — did the LAST REAL CALL survive? A
      // conversation carries `metadata.error.code 1002` / a quota
      // termination_reason when the account is out of credits, and the
      // conversations endpoint is readable by an agents-scoped key.
      let lastCallFailure: string | null = null;
      let lastCallFailureStale = false;
      if (res.ok) {
        try {
          const conv = await timedFetch(
            "https://api.elevenlabs.io/v1/convai/conversations?page_size=1",
            { headers },
          );
          if (conv.ok) {
            const list = (await conv.json()) as {
              conversations?: Array<{ conversation_id?: string }>;
            };
            const id = list.conversations?.[0]?.conversation_id;
            if (id) {
              const one = await timedFetch(
                `https://api.elevenlabs.io/v1/convai/conversations/${
                  encodeURIComponent(id)
                }`,
                { headers },
              );
              if (one.ok) {
                const c = (await one.json()) as {
                  metadata?: {
                    error?: { code?: number; reason?: string };
                    termination_reason?: string;
                    charging?: { tier?: string };
                    start_time_unix_secs?: number;
                  };
                };
                const err = c.metadata?.error;
                const reason = c.metadata?.termination_reason ?? "";
                if (err?.code === 1002 || /quota/i.test(reason)) {
                  // TIMESTAMP IT. This is the LAST call, not a live balance —
                  // after a top-up the newest conversation is still the old
                  // failure, so an untimed "OUT OF CREDITS" keeps screaming
                  // long after the account has been paid up. Old evidence is
                  // a warning to go retest, not proof the account is dry.
                  const startedSecs = c.metadata?.start_time_unix_secs ?? null;
                  const ageMins = startedSecs
                    ? Math.round((Date.now() / 1000 - startedSecs) / 60)
                    : null;
                  lastCallFailureStale = ageMins === null ? false : ageMins > STALE_CALL_MINS;
                  const when = ageMins === null
                    ? "at an unknown time"
                    : ageMins < 60
                    ? `${ageMins} min ago`
                    : `${Math.round(ageMins / 60)} h ago`;
                  lastCallFailure = lastCallFailureStale
                    ? `Last call (${when}) was killed for quota — may be STALE if you have since topped up. Place a test call to confirm.`
                    : `OUT OF CREDITS — last call (${when}) killed on answer: ${
                      (err?.reason ?? reason).slice(0, 80)
                    }`;
                }
                if (!quota && c.metadata?.charging?.tier) {
                  quota = `tier ${c.metadata.charging.tier}`;
                }
              }
            }
          }
        } catch {
          // Best-effort: never let this leg crash the probe.
        }
      }

      return {
        res,
        // A reachable fleet is not a working one. Out of credits = down; a key
        // that can't show the balance is degraded, not healthy, because the
        // balance is precisely what this page promises to report.
        // Fresh quota kill = down. Stale one = degraded: worth chasing, but it
        // is history, and calling history an outage is how a card lies twice.
        verdict: () =>
          lastCallFailure
            ? (lastCallFailureStale ? "degraded" : "down")
            : (quotaHidden ? "degraded" : null),
        detail: (b) => {
          if (lastCallFailure) return lastCallFailure;
          const agents = (b as { agents?: unknown[] } | null)?.agents;
          const head = Array.isArray(agents)
            ? `${agents.length} agent(s) visible`
            : "Key accepted";
          const tail = quotaHidden
            ? "balance UNVERIFIED — grant user_read to the key to see it"
            : quota;
          return [head, tail].filter(Boolean).join(" · ") + ".";
        },
      };
    },
  },
  {
    id: "openai",
    label: "OpenAI",
    impact: "Memo airlock (parked) — not yet load-bearing",
    envKeys: ["OPENAI_KEY"],
    run: async (keys) => {
      const key = firstKey(keys, ["OPENAI_KEY"])!;
      const res = await timedFetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      return {
        res,
        // OpenAI exposes no unbilled balance endpoint, so this can only ever
        // prove the key. Say that outright instead of implying a green wallet.
        detail: (b) => {
          const data = (b as { data?: unknown[] } | null)?.data;
          const head = Array.isArray(data)
            ? `Key accepted — ${data.length} models visible`
            : "Key accepted";
          return `${head} · balance not exposed by OpenAI (key-only check).`;
        },
      };
    },
  },
  {
    id: "stripe",
    label: "Stripe",
    impact: "Business plans + consumer Premium subscriptions",
    envKeys: STRIPE_SECRET_KEY_NAMES,
    run: async (keys) => {
      // STRIPE_MODE picks WHICH key, and the other universe's key is never a
      // fallback — so "a Stripe secret is set" is not yet "the active mode
      // has one". Say which name won; it is the operator's only window onto
      // a switch that is otherwise a single invisible secret (MESITA-1530).
      const mode = stripeMode();
      const names = stripeSecretKeyNames(mode);
      const name = names.find((n) => firstKey(keys, [n]));
      const key = name ? firstKey(keys, [name])! : null;
      if (!key) {
        return {
          res: new Response(
            JSON.stringify({
              error: {
                message:
                  `STRIPE_MODE=${mode}, but neither ${names.join(" nor ")} is set. Another universe's key is present and is deliberately never used as a fallback — set the ${mode} key or flip STRIPE_MODE.`,
              },
            }),
            { status: 401 },
          ),
          detail: (b) => errorLine(b, ""),
        };
      }
      // Restricted keys (rk_…) can't hit /v1/balance; secret keys are sk_*.
      // Catch the wrong kind before Stripe's opaque "Invalid API Key".
      if (!/^sk_(live|test)_/.test(key)) {
        return {
          res: new Response(
            JSON.stringify({
              error: {
                message: key.startsWith("rk_")
                  ? `${name} holds a restricted key (rk_…). Billing Test needs the secret key (sk_live_… / sk_test_…).`
                  : key.startsWith("pk_")
                  ? `${name} holds a publishable key (pk_…). Paste the secret key (sk_live_… / sk_test_…).`
                  : key.startsWith("mk_")
                  ? `${name} holds an API key ID (mk_…), not the key. The dashboard shows both — copy the token that starts sk_test_… / sk_live_…, not the identifier beside it.`
                  : `${name} does not look like a Stripe secret key (expected sk_live_… or sk_test_…).`,
              },
            }),
            { status: 401 },
          ),
          detail: (b) => errorLine(b, ""),
        };
      }
      const res = await timedFetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${key}` },
      });
      // Stripe's own answer, not the key prefix, is the authority on which
      // universe answered — a key that disagrees with STRIPE_MODE means the
      // env addresses one account while believing it addresses the other.
      const agrees = (b: unknown) => {
        const live = (b as { livemode?: unknown } | null)?.livemode;
        return typeof live === "boolean" ? live === (mode === "live") : null;
      };
      return {
        res,
        verdict: (b) => agrees(b) === false ? "degraded" : null,
        detail: (b) => {
          const live = (b as { livemode?: unknown } | null)?.livemode;
          const universe = live === true
            ? "LIVE mode"
            : live === false
            ? "test mode"
            : "mode not reported";
          const head = `Key accepted — ${universe} · ${name} (STRIPE_MODE=${mode})`;
          return agrees(b) === false
            ? `${head}. MISMATCH: the key addresses the other universe — every EF is talking to the wrong Stripe account.`
            : `${head}.`;
        },
      };
    },
  },
  {
    id: "perplexity",
    label: "Perplexity",
    impact: "Memo answers + Intaker S5 (Agent Y link select)",
    envKeys: ["PERPLEXITY_KEY"],
    run: async (keys) => {
      const key = firstKey(keys, ["PERPLEXITY_KEY"])!;
      // No unbilled auth endpoint exists — the cheapest honest proof that the
      // key still works is a tiny completion. Sonar rejects max_tokens < 16
      // with HTTP 400, so 16 is the floor; disable_search keeps the spend to
      // the completion itself (no web search unit).
      const res = await timedFetch(
        "https://api.perplexity.ai/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar",
            max_tokens: 16,
            disable_search: true,
            messages: [{ role: "user", content: "ping" }],
          }),
        },
      );
      return {
        res,
        detail: (b) => {
          const model = str(b, "model");
          return model ? `Key accepted — ${model} answered.` : "Key accepted.";
        },
      };
    },
  },
  {
    id: "google-places",
    label: "Google Places",
    impact: "Identity spine for Atlas, the Intaker and place recall",
    envKeys: ["GMP_KEY", "SUPA_GMP_KEY"],
    run: async (keys) => {
      const key = firstKey(keys, ["GMP_KEY", "SUPA_GMP_KEY"])!;
      // Places v1 bills per request; a single field-masked Text Search is the
      // smallest billable unit that still proves the key and its restrictions.
      const res = await timedFetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "places.id",
          },
          body: JSON.stringify({ textQuery: "cafe", maxResultCount: 1 }),
        },
      );
      return {
        res,
        detail: (b) => {
          const places = (b as { places?: unknown[] } | null)?.places;
          return Array.isArray(places)
            ? `Key accepted — ${places.length} result(s).`
            : "Key accepted.";
        },
      };
    },
  },
];

/** Squeeze a vendor's error body into one readable line. */
function errorLine(body: unknown, raw: string): string {
  // ElevenLabs nests under detail.message; Stripe/OpenAI under error.message.
  const msg = str(body, "error", "message") ??
    str(body, "detail", "message") ??
    str(body, "error") ??
    str(body, "message") ??
    str(body, "detail");
  const line = (msg ?? raw).trim();
  return line.length > 220
    ? `${line.slice(0, 220)}…`
    : line || "No error body.";
}

async function runProbe(
  spec: ProbeSpec,
  keys: Record<string, string | undefined>,
): Promise<ProbeResult> {
  const base = {
    id: spec.id,
    label: spec.label,
    impact: spec.impact,
    envKeys: spec.envKeys,
  };

  if (!firstKey(keys, spec.envKeys)) {
    return {
      ...base,
      verdict: "unconfigured",
      httpStatus: null,
      latencyMs: null,
      detail: `No secret set for ${spec.envKeys.join(" / ")}.`,
    };
  }

  const started = Date.now();
  try {
    const { res, detail, verdict: verdictOf } = await spec.run(keys);
    const latencyMs = Date.now() - started;
    const raw = await res.text();
    let body: unknown = null;
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }

    if (res.ok) {
      return {
        ...base,
        // A 2xx means "the vendor answered", not "the vendor works". A probe
        // that knows better (out of credits, balance unverifiable) says so.
        verdict: verdictOf?.(body) ?? "ok",
        httpStatus: res.status,
        latencyMs,
        detail: detail(body),
      };
    }

    // 401/403 = the key itself is rejected; 402/429 = billing or throttling.
    // Both are "down" for our purposes, but the status code tells them apart
    // and the vendor's message is far more useful than any wording we'd invent.
    return {
      ...base,
      verdict: res.status === 429 ? "degraded" : "down",
      httpStatus: res.status,
      latencyMs,
      detail: errorLine(body, raw),
    };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return {
      ...base,
      verdict: "down",
      httpStatus: null,
      latencyMs,
      detail: aborted
        ? `No response within ${PROBE_TIMEOUT_MS / 1000}s.`
        : err instanceof Error
        ? err.message
        : "Probe threw a non-Error.",
    };
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
  const requested = Array.isArray(body.providers)
    ? body.providers.filter((p): p is string => typeof p === "string")
    : null;

  // No explicit list → EVERY probe, billed ones included. The page's one Run
  // button names them all anyway; this is the same answer for any other caller.
  const selected = requested
    ? PROBES.filter((p) => requested.includes(p.id))
    : PROBES;

  if (selected.length === 0) {
    return json({ ok: false, error: "No known providers selected." }, 400);
  }

  // Read every secret once, up front — probes receive a plain record and never
  // touch Deno.env themselves, which keeps them trivially unit-testable.
  const keyNames = [...new Set(PROBES.flatMap((p) => p.envKeys))];
  const keys: Record<string, string | undefined> = {};
  for (const n of keyNames) keys[n] = Deno.env.get(n);

  // ElevenLabs: EF secrets often hold the key *id* (hex), not sk_. Prefer env
  // sk_, else Vault via service_elevenlabs_api_key (same fallback as product EFs).
  {
    const elEnv = firstKeyedSecret(
      keys,
      ["ELEVENLABS_KEY", "ELEVEN_KEY"],
      (v) => v.startsWith("sk_"),
    );
    if (!elEnv?.startsWith("sk_")) {
      const { data: vaultKey, error: vaultErr } = await admin.rpc(
        "service_elevenlabs_api_key",
      );
      if (
        !vaultErr &&
        typeof vaultKey === "string" &&
        vaultKey.startsWith("sk_")
      ) {
        keys.ELEVENLABS_KEY = vaultKey;
      }
    }
  }

  // Probes are mutually independent by construction — run them concurrently so
  // one slow vendor cannot stretch the whole sweep.
  const results = await Promise.all(selected.map((p) => runProbe(p, keys)));

  return json({
    ok: true,
    checkedAt: new Date().toISOString(),
    results,
  });
});

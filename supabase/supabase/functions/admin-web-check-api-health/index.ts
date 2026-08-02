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
// COST: probes are tagged free | paid. Free probes hit an account/metadata
// endpoint that vendors do not bill for. Paid probes have no such endpoint and
// must spend a token or a request unit to prove the key works — those NEVER run
// unless the caller names them explicitly, so "run everything" stays free.
//
// Local:  supabase functions serve admin-web-check-api-health
// Deploy: supabase functions deploy admin-web-check-api-health

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

// How long any single probe may take before we call it dead. Vendors that are
// merely slow are still a problem worth surfacing, so this is deliberately
// tighter than the EF's own wall-clock budget.
const PROBE_TIMEOUT_MS = 8_000;

type Verdict = "ok" | "degraded" | "down" | "unconfigured";
type Cost = "free" | "paid";

type ProbeResult = {
  id: string;
  label: string;
  /** What breaks in the product when this provider is down. */
  impact: string;
  cost: Cost;
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
  cost: Cost;
  envKeys: string[];
  run: (
    keys: Record<string, string | undefined>,
  ) => Promise<{ res: Response; detail: (body: unknown) => string }>;
};

/** First non-empty env var among `names` — tolerates the ELEVEN_KEY/ELEVENLABS_KEY drift. */
function firstKey(
  keys: Record<string, string | undefined>,
  names: string[],
): string | undefined {
  for (const n of names) {
    const v = keys[n];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

function num(body: unknown, ...path: string[]): number | null {
  let cur: unknown = body;
  for (const seg of path) {
    if (!cur || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return typeof cur === "number" ? cur : null;
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
      "Enricher link discovery (S4 gather) — fails SOFT, returns no links",
    cost: "free",
    envKeys: ["FIRECRAWL_KEY"],
    run: async (keys) => {
      const key = firstKey(keys, ["FIRECRAWL_KEY"])!;
      const res = await timedFetch(
        "https://api.firecrawl.dev/v2/team/credit-usage",
        { headers: { Authorization: `Bearer ${key}` } },
      );
      return {
        res,
        detail: (b) => {
          const remaining = num(b, "data", "remaining_credits");
          return remaining === null
            ? "Key accepted."
            : `${remaining.toLocaleString()} credits remaining.`;
        },
      };
    },
  },
  {
    id: "apify",
    label: "Apify",
    impact: "Enricher Instagram/actor scraping",
    cost: "free",
    envKeys: ["APIFY_KEY"],
    run: async (keys) => {
      const key = firstKey(keys, ["APIFY_KEY"])!;
      const res = await timedFetch(
        `https://api.apify.com/v2/users/me?token=${encodeURIComponent(key)}`,
      );
      return {
        res,
        detail: (b) => {
          const plan = str(b, "data", "plan", "id");
          const user = str(b, "data", "username");
          return [user && `user ${user}`, plan && `plan ${plan}`]
            .filter(Boolean)
            .join(" · ") || "Key accepted.";
        },
      };
    },
  },
  {
    id: "twilio",
    label: "Twilio",
    impact: "Phone OTP — the ONLY consumer sign-in. Dead key = nobody logs in",
    cost: "free",
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
      return {
        res,
        detail: (b) => {
          const status = str(b, "status");
          const type = str(b, "type");
          return [status && `account ${status}`, type].filter(Boolean).join(
            " · ",
          ) ||
            "Key accepted.";
        },
      };
    },
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    impact: "Reservationist voice agents (a1–a4)",
    cost: "free",
    envKeys: ["ELEVENLABS_KEY", "ELEVEN_KEY"],
    run: async (keys) => {
      const key = firstKey(keys, ["ELEVENLABS_KEY", "ELEVEN_KEY"])!;
      const res = await timedFetch(
        "https://api.elevenlabs.io/v1/user/subscription",
        { headers: { "xi-api-key": key } },
      );
      return {
        res,
        detail: (b) => {
          const used = num(b, "character_count");
          const limit = num(b, "character_limit");
          const tier = str(b, "tier");
          const chars = used !== null && limit !== null
            ? `${used.toLocaleString()}/${limit.toLocaleString()} chars`
            : null;
          return [tier && `tier ${tier}`, chars].filter(Boolean).join(" · ") ||
            "Key accepted.";
        },
      };
    },
  },
  {
    id: "openai",
    label: "OpenAI",
    impact: "Memo airlock (parked) — not yet load-bearing",
    cost: "free",
    envKeys: ["OPENAI_KEY"],
    run: async (keys) => {
      const key = firstKey(keys, ["OPENAI_KEY"])!;
      const res = await timedFetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      return {
        res,
        detail: (b) => {
          const data = (b as { data?: unknown[] } | null)?.data;
          return Array.isArray(data)
            ? `Key accepted — ${data.length} models visible.`
            : "Key accepted.";
        },
      };
    },
  },
  {
    id: "stripe",
    label: "Stripe",
    impact: "Business plans + consumer Premium subscriptions",
    cost: "free",
    envKeys: ["STRIPE_SECRET_KEY"],
    run: async (keys) => {
      const key = firstKey(keys, ["STRIPE_SECRET_KEY"])!;
      const res = await timedFetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${key}` },
      });
      return {
        res,
        detail: (b) => {
          const live = (b as { livemode?: unknown } | null)?.livemode;
          return live === true
            ? "Key accepted — LIVE mode."
            : live === false
            ? "Key accepted — test mode."
            : "Key accepted.";
        },
      };
    },
  },
  {
    id: "perplexity",
    label: "Perplexity",
    impact: "Memo answers + Enricher S5 (Agent Y link select)",
    cost: "paid",
    envKeys: ["PERPLEXITY_KEY"],
    run: async (keys) => {
      const key = firstKey(keys, ["PERPLEXITY_KEY"])!;
      // No unbilled auth endpoint exists — the cheapest honest proof that the
      // key still works is a 1-token completion. Fractions of a cent.
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
            max_tokens: 1,
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
    impact: "Identity spine for Atlas, Enricher and Lineup",
    cost: "paid",
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
  const msg = str(body, "error", "message") ??
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
    cost: spec.cost,
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
    const { res, detail } = await spec.run(keys);
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
        verdict: "ok",
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

  const body = await readJsonOr<{ providers?: unknown }>(req, {});
  const requested = Array.isArray(body.providers)
    ? body.providers.filter((p): p is string => typeof p === "string")
    : null;

  // No explicit list → every FREE probe. Paid probes are opt-in by name only,
  // so the default "run everything" button can never surprise anyone with a bill.
  const selected = requested
    ? PROBES.filter((p) => requested.includes(p.id))
    : PROBES.filter((p) => p.cost === "free");

  if (selected.length === 0) {
    return json({ ok: false, error: "No known providers selected." }, 400);
  }

  // Read every secret once, up front — probes receive a plain record and never
  // touch Deno.env themselves, which keeps them trivially unit-testable.
  const keyNames = [...new Set(PROBES.flatMap((p) => p.envKeys))];
  const keys: Record<string, string | undefined> = {};
  for (const n of keyNames) keys[n] = Deno.env.get(n);

  // Probes are mutually independent by construction — run them concurrently so
  // one slow vendor cannot stretch the whole sweep.
  const results = await Promise.all(selected.map((p) => runProbe(p, keys)));

  return json({
    ok: true,
    checkedAt: new Date().toISOString(),
    results,
  });
});

// memo-data.ts — Memo's ONLY route to Mesita data.
//
// THE INVARIANT: no Memo code path touches Postgres. Not the agent, not the
// airlock tools, not the legacy Perplexity pipeline, not the admin playground.
// Every read goes over this client to a dedicated internal Edge Function:
//
//   recallPlaces()     → supabase-edgefunc-recall-places
//   searchPlaces()     → supabase-edgefunc-search-places
//   consumerContext()  → supabase-edgefunc-get-consumer-context
//   config()           → supabase-edgefunc-get-memo-config
//
// Why, when Memo already runs inside Supabase with a service-role client: the
// airlock makes Memo read-only by construction, and this does the same for its
// REACH. A service-role client is a general query capability — Memo holding one
// means every future tool is one `.from()` away from a table nobody audited.
// Routing through four named endpoints makes Memo's data surface a closed set
// you can enumerate (and the admin console does: Memo Config → Data Access).
// Each EF owns its own SELECT and projects to a public shape, so the whitelist
// lives at the source instead of in the agent that consumes it.
//
// Failure policy matches the rest of Memo: a data EF that errors degrades the
// answer, it never sinks it. Every method returns an empty/neutral value and
// logs — the concierge stays up.

import type { EFEnv } from "./auth.ts";
import { invokeInternalCaller } from "./internal.ts";
import { type ChannelPolicy, coerceChannelPolicy } from "./sourcing.ts";
import { type MemoPlaceCard, parseMemoPlaceCards } from "./memo-place-card.ts";
import { createTtlCache } from "./memo-cache.ts";

export type PlaceRecallResult = {
  cards: MemoPlaceCard[];
  poolSize: number;
  embedded: boolean;
};

export type MemoConfigResult = {
  // Consumer Ask AI opener from memo_greeting, or null when blank/unreadable.
  greeting: string | null;
  // Saved persona override, or null to use the in-code default (memo-prompt.ts).
  instructions: string | null;
  // Saved OpenAI model, or null for the caller's default.
  model: string | null;
  // Perplexity leg from models_config.memo.perplexity; null when "off"/unset.
  perplexity: string | null;
  // The `memo_search` sourcing slice, already coerced (falls back to the
  // launch policy when the config row is unreadable).
  searchPolicy: ChannelPolicy;
};

export type MemoData = {
  // Memo's RAG leg: recall a pool near the caller, embed the intent, cosine
  // rank, return the top public cards. One hop replaces query + embed + rank.
  recallPlaces(opts: {
    intent: string;
    lat: number | null;
    lng: number | null;
    limit?: number;
  }): Promise<PlaceRecallResult>;

  // Public catalog lookup by name and/or by Google place id.
  searchPlaces(opts: {
    name?: string;
    googlePlaceIds?: string[];
    limit?: number;
  }): Promise<MemoPlaceCard[]>;

  // The signed-in user's persona CLAUSE — never their raw profile. The EF
  // composes "named Ana, 28 years old, female" server-side, so birthday, full
  // name and sex never cross this wire at all.
  consumerContext(userId: string): Promise<string | null>;

  // Operator-tunable greeting + persona + model + the memo_search policy.
  config(): Promise<MemoConfigResult>;
};

// ── The read-through cache ─────────────────────────────────────────────
//
// Routing through EFs turned two in-process reads into network hops on the
// consumer's SYNCHRONOUS chat path, so the two that are worth caching are:
//
//   config()          — the app_settings singleton. An operator edits it maybe
//                       a few times a week; every turn was re-reading it.
//   consumerContext() — one user's persona clause. A chat replays history turn
//                       after turn for the SAME user, so this is the read most
//                       likely to repeat inside a warm isolate.
//
// Deliberately NOT cached: recallPlaces and searchPlaces. Those are the answer —
// caching them would serve stale recommendations, and they vary by intent anyway.
//
// Module scope, so entries survive across requests in a warm isolate and vanish
// with it. Opt-in per caller (see MemoDataOptions.cacheMs): the admin Playground
// passes 0 because its whole job is testing config you just saved.
//
// On the context cache and privacy: what's held is the derived CLAUSE, not the
// profile row — the raw fields never left get-consumer-context in the first
// place. It lives in one isolate's memory, keyed by auth id, for seconds. Keep
// it that way; this must not grow into a profile store.
const CONFIG_CACHE = createTtlCache<MemoConfigResult>();

// A warm isolate serving many users would otherwise grow this without bound.
const CONTEXT_CACHE = createTtlCache<string | null>(500);

export type MemoDataOptions = {
  // TTL for the config + consumer-context reads, in ms. Omit or 0 to always hit
  // the endpoint. Keep it short: this trades staleness for a hop, and an
  // operator editing Memo's persona should see it take effect promptly.
  cacheMs?: number;
};

// `callerName` is the natural EF asking on Memo's behalf
// (consumer-web-ask-memo or admin-web-ask-memo). It rides the
// X-Internal-Caller header so the data EFs can attribute every read.
export function createMemoData(
  env: EFEnv,
  callerName: string,
  opts?: MemoDataOptions,
): MemoData {
  const ttl = opts?.cacheMs ?? 0;

  async function call<T>(
    fn: string,
    body: unknown,
  ): Promise<T | null> {
    const res = await invokeInternalCaller<T>(env, callerName, fn, body);
    if (!res.ok) {
      console.error(`[memo-data] ${fn}: ${res.error}`);
      return null;
    }
    return res.data;
  }

  return {
    async recallPlaces({ intent, lat, lng, limit }) {
      const data = await call<{
        cards?: unknown;
        poolSize?: unknown;
        embedded?: unknown;
      }>("supabase-edgefunc-recall-places", { intent, lat, lng, limit });
      if (!data) return { cards: [], poolSize: 0, embedded: false };
      return {
        cards: parseMemoPlaceCards(data.cards),
        poolSize: typeof data.poolSize === "number" ? data.poolSize : 0,
        embedded: data.embedded === true,
      };
    },

    async searchPlaces({ name, googlePlaceIds, limit }) {
      const data = await call<{ places?: unknown }>(
        "supabase-edgefunc-search-places",
        { name, googlePlaceIds, limit },
      );
      return data ? parseMemoPlaceCards(data.places) : [];
    },

    async consumerContext(userId) {
      const cached = CONTEXT_CACHE.get(userId, ttl);
      if (cached.hit) return cached.value;

      const data = await call<{ clause?: unknown }>(
        "supabase-edgefunc-get-consumer-context",
        { userId },
      );
      // A failed read returns null, same as a profile miss — don't cache it, or
      // one blip would mute personalisation for the whole TTL.
      if (data === null) return null;

      const raw = data.clause;
      const clause = typeof raw === "string" && raw.length > 0 ? raw : null;
      CONTEXT_CACHE.set(userId, clause, ttl);
      return clause;
    },

    async config() {
      const cached = CONFIG_CACHE.get(env.url, ttl);
      if (cached.hit) return cached.value;

      const data = await call<{
        greeting?: unknown;
        instructions?: unknown;
        model?: unknown;
        perplexity?: unknown;
        searchPolicy?: unknown;
      }>("supabase-edgefunc-get-memo-config", {});

      const greeting = typeof data?.greeting === "string"
        ? data.greeting.trim()
        : "";
      const instructions = typeof data?.instructions === "string"
        ? data.instructions.trim()
        : "";
      const model = typeof data?.model === "string" ? data.model.trim() : "";
      const perplexity = typeof data?.perplexity === "string"
        ? data.perplexity.trim()
        : "";
      const result: MemoConfigResult = {
        greeting: greeting.length > 0 ? greeting : null,
        instructions: instructions.length > 0 ? instructions : null,
        model: model.length > 0 ? model : null,
        perplexity: perplexity.length > 0 ? perplexity : null,
        // coerce (not trust) — and it doubles as the fallback when the read failed.
        searchPolicy: coerceChannelPolicy(data?.searchPolicy ?? null, "memo_search"),
      };

      // Only cache a real read. Caching the degraded result would pin Memo to
      // its in-code default persona for the whole TTL after a single blip.
      if (data !== null) CONFIG_CACHE.set(env.url, result, ttl);
      return result;
    },
  };
}

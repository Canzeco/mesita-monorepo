// memo-data.ts — Memo's ONLY route to Mesita data.
//
// THE INVARIANT: no Memo code path touches Postgres. Not the agent, not the
// airlock tools, not the legacy Perplexity pipeline, not the admin playground.
// Every read goes over this client to a dedicated internal Edge Function:
//
//   recallLineup()     → supabase-edgefunc-recall-lineup
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
import { invokeArtificialCaller } from "./internal.ts";
import { type ChannelPolicy, coerceChannelPolicy } from "./sourcing.ts";
import { type MemoPlaceCard, parseMemoPlaceCards } from "./memo-place-card.ts";

export type LineupRecallResult = {
  cards: MemoPlaceCard[];
  poolSize: number;
  embedded: boolean;
};

export type MemoConfigResult = {
  // Saved persona override, or null to use the in-code default (memo-prompt.ts).
  instructions: string | null;
  // Saved OpenAI model, or null for the caller's default.
  model: string | null;
  // The `memo_search` sourcing slice, already coerced (falls back to the
  // launch policy when the config row is unreadable).
  searchPolicy: ChannelPolicy;
};

export type MemoData = {
  // Lineup's RAG leg: recall a pool near the caller, embed the intent, cosine
  // rank, return the top public cards. One hop replaces query + embed + rank.
  recallLineup(opts: {
    intent: string;
    lat: number | null;
    lng: number | null;
    limit?: number;
  }): Promise<LineupRecallResult>;

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

  // Operator-tunable persona + model + the memo_search sourcing policy.
  config(): Promise<MemoConfigResult>;
};

// `callerName` is the natural EF asking on Memo's behalf
// (consumer-web-ask-memo or admin-web-ask-memo). It rides the
// X-Internal-Caller header so the data EFs can attribute every read.
export function createMemoData(env: EFEnv, callerName: string): MemoData {
  async function call<T>(
    fn: string,
    body: unknown,
  ): Promise<T | null> {
    const res = await invokeArtificialCaller<T>(env, callerName, fn, body);
    if (!res.ok) {
      console.error(`[memo-data] ${fn}: ${res.error}`);
      return null;
    }
    return res.data;
  }

  return {
    async recallLineup({ intent, lat, lng, limit }) {
      const data = await call<{
        cards?: unknown;
        poolSize?: unknown;
        embedded?: unknown;
      }>("supabase-edgefunc-recall-lineup", { intent, lat, lng, limit });
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
      const data = await call<{ clause?: unknown }>(
        "supabase-edgefunc-get-consumer-context",
        { userId },
      );
      const clause = data?.clause;
      return typeof clause === "string" && clause.length > 0 ? clause : null;
    },

    async config() {
      const data = await call<{
        instructions?: unknown;
        model?: unknown;
        searchPolicy?: unknown;
      }>("supabase-edgefunc-get-memo-config", {});
      const instructions = typeof data?.instructions === "string"
        ? data.instructions.trim()
        : "";
      const model = typeof data?.model === "string" ? data.model.trim() : "";
      return {
        instructions: instructions.length > 0 ? instructions : null,
        model: model.length > 0 ? model : null,
        // coerce (not trust) — and it doubles as the fallback when the read failed.
        searchPolicy: coerceChannelPolicy(data?.searchPolicy ?? null, "memo_search"),
      };
    },
  };
}

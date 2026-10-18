// memo-data.ts — Memo's route to Mesita config.
//
<<<<<<< HEAD
// THE INVARIANT: Memo reads Mesita data through closed, named paths only, and
// no other Memo code path touches Postgres:
//
//   config()       → supabase-edgefunc-get-memo-config (this client)
//   the pipelines  → consumer-web-ask-memo runs the Chat Agent above them
//                    (MESITA-2327, MESITA-2339) with one client, used only
//                    by `loadDiscoveryConfig` and each pipeline module's own
//                    read-only `profiles` SELECT: the Name lane
//                    (`nameMesitaPlaces`), Area's Selected scope
//                    (`areaSelectedPlaces`) and Deep (`deepDepsFor`)
=======
// THE INVARIANT: Memo reads Mesita data through exactly two closed paths, and
// no other Memo code path touches Postgres:
//
//   config()           → supabase-edgefunc-get-memo-config (this client)
//   the Deep pipeline  → `_shared/deep-pipeline.ts`: `loadDiscoveryConfig`
//                        plus `deepDepsFor`'s one read-only `profiles` SELECT,
//                        which consumer-web-ask-memo runs as the Chat Agent
//                        above the pipelines (MESITA-2327, MESITA-2338)
>>>>>>> origin/main
//
// Why, when Memo already runs inside Supabase with a service-role client: a
// service-role client is a general query capability — Memo holding one means
// every future tool is one `.from()` away from a table nobody audited. Routing
// through named endpoints makes Memo's data surface a closed set you can
// enumerate. Each EF owns its own SELECT and projects to a public shape, so the
// whitelist lives at the source instead of in the agent that consumes it.
//
// Failure policy matches the rest of Memo: a data EF that errors degrades the
// answer, it never sinks it. Every method returns an empty/neutral value and
// logs — the concierge stays up.

import type { EFEnv } from "./auth.ts";
import { invokeInternalCaller } from "./internal.ts";
import { createTtlCache } from "./memo-cache.ts";

export type MemoConfigResult = {
  // Consumer Ask AI opener from memo_config.greeting, or null when blank/unreadable.
  greeting: string | null;
  // Saved persona override, or null to use the in-code default (memo-prompt.ts).
  instructions: string | null;
  // Saved OpenAI model, or null for the caller's default.
  model: string | null;
};

export type MemoData = {
  // Operator-tunable greeting + persona + model.
  config(): Promise<MemoConfigResult>;
};

// ── The read-through cache ─────────────────────────────────────────────
//
// Routing through an EF turned an in-process read into a network hop on the
// consumer's SYNCHRONOUS chat path. config() reads the app_config singleton: an
// operator edits it maybe a few times a week, and every turn was re-reading it.
//
// Module scope, so entries survive across requests in a warm isolate and vanish
// with it. Opt-in per caller (see MemoDataOptions.cacheMs).
const CONFIG_CACHE = createTtlCache<MemoConfigResult>();

export type MemoDataOptions = {
  // TTL for the config read, in ms. Omit or 0 to always hit the endpoint. Keep
  // it short: this trades staleness for a hop, and an operator editing Memo's
  // persona should see it take effect promptly.
  cacheMs?: number;
};

// `callerName` is the natural EF asking on Memo's behalf (consumer-web-ask-memo).
// It rides the X-Internal-Caller header so the data EFs can attribute every read.
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
    async config() {
      const cached = CONFIG_CACHE.get(env.url, ttl);
      if (cached.hit) return cached.value;

      const data = await call<{
        greeting?: unknown;
        instructions?: unknown;
        model?: unknown;
      }>("supabase-edgefunc-get-memo-config", {});

      const greeting = typeof data?.greeting === "string"
        ? data.greeting.trim()
        : "";
      const instructions = typeof data?.instructions === "string"
        ? data.instructions.trim()
        : "";
      const model = typeof data?.model === "string" ? data.model.trim() : "";
      const result: MemoConfigResult = {
        greeting: greeting.length > 0 ? greeting : null,
        instructions: instructions.length > 0 ? instructions : null,
        model: model.length > 0 ? model : null,
      };

      // Only cache a real read. Caching the degraded result would pin Memo to
      // its in-code default persona for the whole TTL after a single blip.
      if (data !== null) CONFIG_CACHE.set(env.url, result, ttl);
      return result;
    },
  };
}

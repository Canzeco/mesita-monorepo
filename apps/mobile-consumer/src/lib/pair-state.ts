// State forcing for `pnpm pair` (Docs › Apps › A2 §11): a link that ends in
// ?pairState=loading|empty|error|long puts every screen into that state by
// changing the backend's answer, so each screen's own parser and states run.
// This file imports nothing: lint/pair.mjs applies the same rule to the web.

export const PAIR_STATES = ["main", "loading", "empty", "error", "long"] as const;
export type PairState = (typeof PAIR_STATES)[number];

/** The build-profile constant. Expo inlines the literal, and only the
 *  development, simulator and preview profiles of eas.json set it: in the
 *  store profile this is `false` and the bundler drops every branch on it. */
export const PAIR_STATES_ON = process.env.EXPO_PUBLIC_PAIR_STATES === "1";

const LONG = "Restaurante y Cantina La Muy Noble y Leal Ciudad de Nuestra Señora de Monterrey";
const LONG_KEYS = /(^|_)(name|title|label|headline|address|neighborhood|description)$/i;

let forced: PairState = "main";

export const forcedPairState = (): PairState => forced;

/** Takes ?pairState= off an incoming link. Off, the link is left as it is. */
export function readPairState(link: string, on: boolean = PAIR_STATES_ON): { link: string; state: PairState } {
  if (!on) return { link, state: "main" };
  const found = /[?&]pairState=([a-z]+)/.exec(link);
  const state = PAIR_STATES.find((s) => s === found?.[1]) ?? "main";
  const rest = link.replace(/([?&])pairState=[a-z]*&?/, "$1").replace(/[?&]$/, "");
  return { link: rest, state };
}

/** True when the state changed, so the caller reads everything again. */
export function forcePairState(state: PairState, on: boolean = PAIR_STATES_ON): boolean {
  if (!on || state === forced) return false;
  forced = state;
  return true;
}

/** An answer as a screen with nothing, or with long text, would receive it. */
export function stubAnswer(state: PairState, json: unknown): unknown {
  if (state !== "empty" && state !== "long") return json;
  const walk = (value: unknown, key: string): unknown => {
    if (Array.isArray(value)) return state === "empty" ? [] : value.map((item) => walk(item, key));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, k)]));
    }
    return state === "long" && typeof value === "string" && value && LONG_KEYS.test(key) ? `${value} ${LONG}` : value;
  };
  return walk(json, "");
}

type Answer = {
  status: number;
  text: () => Promise<string>;
  headers: { get: (name: string) => string | null };
};
type Fetch = (url: string, init: { signal?: AbortSignal }) => Promise<Answer>;

/** The fetch the backend is called with. Off, it is the real one, untouched. */
export function forcedFetch<F>(real: F, on: boolean = PAIR_STATES_ON): F {
  if (!on) return real;
  const send = real as unknown as Fetch;
  const stubbed: Fetch = async (url, init) => {
    const state = forced;
    if (state === "main") return send(url, init);
    if (state === "loading") {
      return new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    }
    if (state === "error") {
      const body = JSON.stringify({
        ok: false,
        code: "pair_state",
        error: "Mesita could not answer.",
      });
      return {
        status: 500,
        text: async () => body,
        headers: { get: () => null },
      };
    }
    const res = await send(url, init);
    const text = await res.text();
    let out = text;
    try {
      out = JSON.stringify(stubAnswer(state, JSON.parse(text)));
    } catch {
      // Not JSON: passed on as it came.
    }
    return { status: res.status, text: async () => out, headers: res.headers };
  };
  return stubbed as unknown as F;
}

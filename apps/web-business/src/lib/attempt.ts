/** A server action that never reached the server (offline, or a deploy landed
 *  under an open tab) rejects instead of answering, which left its screen busy
 *  for good (MESITA-4900). This answers it as a normal failure. It says
 *  nothing about whether the server acted. */
export function attempt<T>(call: Promise<T>): Promise<T | { ok: false; error: string; code: null }> {
  return call.catch((e: unknown) => {
    console.error("[business] server action did not answer:", e);
    return { ok: false as const, error: "Mesita didn't answer. Check your connection and reload the page before trying again.", code: null };
  });
}

// _shared/background.ts — the ack-early primitive, and nothing else.
//
// An EF that must answer NOW but keep working after (place a phone call)
// hands the rest to the edge runtime and returns. The HTTP response is
// immediate; the ~400s wall clock still applies to the task.
//
// This lives alone, with no imports, on purpose: a seven-line helper is not
// worth pulling a big module graph into a call engine. It used to sit in the
// enrichment stage plumbing (retired in MESITA-2424).

/**
 * Run `task` past the response. `EdgeRuntime.waitUntil` keeps the isolate
 * alive for it where the runtime offers it; a plain `void` elsewhere (local
 * `deno test`, `deno serve`) so callers behave the same in both worlds.
 * A rejection is logged, never thrown: nobody is left to hear it.
 */
export function runInBackground(task: Promise<unknown>): void {
  const guarded = task.catch((e) => {
    console.error("[background] task failed:", e instanceof Error ? e.message : e);
  });
  const edgeRuntime = (globalThis as unknown as {
    EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(guarded);
  else void guarded;
}

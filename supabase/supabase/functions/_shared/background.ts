// _shared/background.ts — the ack-early primitive, and nothing else.
//
// An EF that must answer NOW but keep working after (place a phone call, walk
// an enrichment stage, mirror a gallery into storage) hands the rest to the
// edge runtime and returns. The HTTP response is immediate; the ~400s wall
// clock still applies to the task.
//
// This lives alone, with no imports, on purpose. It used to sit in
// enrich-pipeline.ts, and supabase-edgefunc-reservation-call carried a second
// copy with the reason written above it — "not imported: it drags the
// enrichment stages in". That reason was real: a seven-line helper is not
// worth pulling the Intaker pipeline into a call engine's module graph. A leaf
// module is what makes the import free, so the copy could go.

/**
 * Run `task` past the response. `EdgeRuntime.waitUntil` keeps the isolate
 * alive for it where the runtime offers it; a plain `void` elsewhere (local
 * `deno test`, `deno serve`) so callers behave the same in both worlds.
 */
export function runInBackground(task: Promise<unknown>): void {
  const edgeRuntime = (globalThis as unknown as {
    EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(task);
  else void task;
}

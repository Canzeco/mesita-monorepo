import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// THE EVENT UNION AND THE EF ALLOWLIST ARE ONE SET, PAIRED BY HAND.
//
// `track.ts` says so itself: "Add here (and to the EF's allowlist) before a
// call site ships a new one; nothing enforces this pairing at compile time."
// Nothing did, until MESITA-1619 added `plan_open` and needed it to.
//
// The failure is silent in the worst direction. `trackEvent` is
// fire-and-forget by design — it swallows its own reject so analytics can
// never stall the UI — so a client event missing from `ALLOWED_EVENTS` is
// rejected by the EF, dropped on the floor, and looks exactly like a feature
// nobody used. You would read the empty funnel as a product result.
//
// Cross-package source read, the same mechanism as ticket-journey-drift:
// these two files cannot import each other (no shared workspace, and one is
// Deno), so a test that reads both is the only link there is.

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

/** The string members of `export type AnalyticsEvent = | "a" | "b";` */
function clientEvents(): string[] {
  const src = read("apps/web-consumer/src/lib/analytics/track.ts");
  const m = src.match(/export type AnalyticsEvent\s*=([^;]*);/);
  if (!m) throw new Error("no `export type AnalyticsEvent = …;` in track.ts");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
}

/** The string members of the EF's `ALLOWED_EVENTS = new Set([...])`. */
function edgeAllowlist(): string[] {
  const src = read(
    "supabase/supabase/functions/consumer-web-track-event/index.ts",
  );
  const m = src.match(/ALLOWED_EVENTS\s*=\s*new Set\(\[([^\]]*)\]\)/);
  if (!m) throw new Error("no `ALLOWED_EVENTS = new Set([…])` in the EF");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
}

describe("analytics events are paired across the package boundary", () => {
  it("both sides parse to a non-empty set", () => {
    // Guards the extractors: a regex that silently returns [] would make the
    // equality below vacuously green.
    expect(clientEvents().length).toBeGreaterThan(0);
    expect(edgeAllowlist().length).toBeGreaterThan(0);
  });

  it("the client union and the EF allowlist are the same set", () => {
    expect(clientEvents()).toEqual(edgeAllowlist());
  });

  it("plan_open is on both sides", () => {
    // Me's Plan box is the ONE door to the plan sheet now that the Passport
    // prints no plan (MESITA-1619). If this event is dropped the change
    // becomes unmeasurable in both directions.
    expect(clientEvents()).toContain("plan_open");
    expect(edgeAllowlist()).toContain("plan_open");
  });

  it("search_coachmark_dismiss is on both sides", () => {
    // MESITA-1694. The localStorage flag is client-only; dropping this
    // event makes the timer-vs-tap split look like a product result of
    // zero forever.
    expect(clientEvents()).toContain("search_coachmark_dismiss");
    expect(edgeAllowlist()).toContain("search_coachmark_dismiss");
  });
});

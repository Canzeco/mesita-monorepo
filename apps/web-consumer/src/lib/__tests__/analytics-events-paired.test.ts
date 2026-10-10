import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// THE EVENT UNION IS A SUBSET OF THE EF ALLOWLIST, PAIRED BY HAND.
//
// `track.ts` says so itself: "Add here (and to the EF's allowlist) before a
// call site ships a new one; nothing enforces this pairing at compile time."
//
// The failure is silent in the worst direction. `trackEvent` is
// fire-and-forget by design — it swallows its own reject so analytics can
// never stall the UI — so a client event missing from `ALLOWED_EVENTS` is
// rejected by the EF, dropped on the floor, and looks exactly like a feature
// nobody used. You would read the empty funnel as a product result.
//
// SUBSET, not equality: the app fires four events and the EF's allowlist is
// longer — a stale name on the server drops nothing, a missing one on the
// server drops everything. Cross-package source read: these two files cannot import
// each other (no shared workspace, and one is Deno), so a test that reads
// both is the only link there is.

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
const SRC = join(__dirname, "..", "..");

/** The file with its `//` comments removed. Both literals below carry prose
 *  between their members, and a semicolon or a quoted phrase in that prose
 *  would end the union early or forge an event — this scraper reads code. */
const read = (rel: string) =>
  readFileSync(join(REPO_ROOT, rel), "utf8").replace(/\/\/[^\n]*/g, "");

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

/** Every `trackEvent(…, "<name>", …)` literal under src/, tests excluded. */
function firedEvents(): string[] {
  const out = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        const src = readFileSync(full, "utf8");
        for (const m of src.matchAll(/trackEvent\([^,]+,\s*"([^"]+)"/g)) {
          out.add(m[1]);
        }
      }
    }
  };
  walk(SRC);
  return [...out].sort();
}

describe("analytics events are paired across the package boundary", () => {
  it("both sides parse to a non-empty set", () => {
    // Guards the extractors: a regex that silently returns [] would make the
    // subset check below vacuously green.
    expect(clientEvents().length).toBeGreaterThan(0);
    expect(edgeAllowlist().length).toBeGreaterThan(0);
  });

  it("every client event is one the EF accepts", () => {
    const allowed = new Set(edgeAllowlist());
    expect(clientEvents().filter((e) => !allowed.has(e))).toEqual([]);
  });

  it("the union is exactly what the app fires", () => {
    // A name nobody fires is a funnel that reads as zero forever; a fired
    // name outside the union is a tsc error, but this is the line that says
    // which. Guards the call-site scanner too: it must find something.
    expect(firedEvents().length).toBeGreaterThan(0);
    expect(clientEvents()).toEqual(firedEvents());
  });

  it("carries no Second Stage event", () => {
    // Wallet, THE TICKET and Plan are not in the app. A name coming back here
    // is a surface coming back, and that is a decision, not a drift.
    for (const gone of [
      "wallet_open",
      "balance_card_tap",
      "ticket_created",
      "plan_open",
      "wallet_load_more_tap",
    ]) {
      expect(clientEvents(), gone).not.toContain(gone);
    }
  });
});

// The ticket-status vocabulary has THREE copies (MESITA-1085): the source of
// truth in supabase `_shared/ticket-status.ts`, and one `ACTIVE_TICKET_STATUSES`
// mirror in each consumer app (`lib/api/tickets.ts`). The apps can't import
// across package roots (independent install roots, no shared workspace), so
// this test reads all three SOURCES and fails when any pair drifts — the
// failure that used to be a live ticket silently vanishing from the wallet.
//
// Precedent: route-structure.test.tsx reads source files the same way.
// mobile-consumer has no test runner, so this file guards its copy too.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

/** Quoted string literals inside the named `X = new Set([ ... ])` block. */
function setLiteral(source: string, constName: string): string[] {
  const m = source.match(
    new RegExp(`${constName} = new Set\\(\\[([\\s\\S]*?)\\]\\)`),
  );
  if (!m) throw new Error(`no "new Set([...])" found for ${constName}`);
  return [...m[1].matchAll(/["']([a-z_]+)["']/g)].map((x) => x[1]).sort();
}

/** Quoted string literals inside `X: readonly TicketStatus[] = [ ... ];`. */
function arrayLiteral(source: string, constName: string): string[] {
  const m = source.match(new RegExp(`${constName}[^=]*= \\[([\\s\\S]*?)\\];`));
  if (!m) throw new Error(`no array literal found for ${constName}`);
  return [...m[1].matchAll(/["']([a-z_]+)["']/g)].map((x) => x[1]).sort();
}

describe("ticket status vocabulary drift (supabase · web · mobile)", () => {
  const supa = read("supabase/supabase/functions/_shared/ticket-status.ts");
  const web = read("apps/web-consumer/src/lib/api/tickets.ts");
  const mobile = read("apps/mobile-consumer/src/lib/api/tickets.ts");

  const live = arrayLiteral(supa, "LIVE_STATUSES");

  it("web-consumer ACTIVE_TICKET_STATUSES mirrors supabase LIVE_STATUSES", () => {
    expect(setLiteral(web, "ACTIVE_TICKET_STATUSES")).toEqual(live);
  });

  it("mobile-consumer ACTIVE_TICKET_STATUSES mirrors supabase LIVE_STATUSES", () => {
    expect(setLiteral(mobile, "ACTIVE_TICKET_STATUSES")).toEqual(live);
  });

  it("the mirrored set is non-empty and holds real labels", () => {
    // Guards the regexes themselves: an extraction bug that returns [] would
    // otherwise make the two assertions above vacuously green together.
    expect(live.length).toBeGreaterThan(0);
    const all = arrayLiteral(supa, "ALL_TICKET_STATUSES");
    for (const s of live) expect(all).toContain(s);
  });
});

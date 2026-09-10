// Every URL the legacy console owned must still land somewhere real.
//
// MESITA-1564 deleted `app/(console)` — 11 place routes plus /settings. Those
// URLs are in operators' bookmarks and in old emails, so the deletion is only
// safe if next.config.ts catches every one. This test is the proof: it walks
// the route shapes the old console could emit and asserts each resolves.
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

type Rule = { source: string; destination: string; permanent?: boolean };

async function rules(): Promise<Rule[]> {
  const r = await nextConfig.redirects?.();
  return (r ?? []) as Rule[];
}

/** Resolve `pathname` through the rule list the way Next does: first match
 *  wins, `:param` binds one segment, `:rest*` binds the remainder. */
function resolve(pathname: string, all: Rule[]): string | null {
  for (const rule of all) {
    const names: string[] = [];
    const pattern = rule.source
      .split("/")
      .filter(Boolean)
      .map((seg) => {
        if (seg.endsWith("*") && seg.startsWith(":")) {
          names.push(seg.slice(1, -1));
          return "(.*)";
        }
        if (seg.startsWith(":")) {
          names.push(seg.slice(1));
          return "([^/]+)";
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("/");
    const m = pathname.match(new RegExp(`^/${pattern}/?$`));
    if (!m) continue;
    let out = rule.destination;
    names.forEach((n, i) => {
      out = out.replace(`:${n}*`, m[i + 1] ?? "").replace(`:${n}`, m[i + 1] ?? "");
    });
    return out;
  }
  return null;
}

// The tab slugs the deleted console used. Partnership and Settings merged into
// Capabilities and Performance became Activity, so none of these map one to
// one — every one is expected to land on the place itself.
const LEGACY_TABS = [
  "home",
  "performance",
  "place",
  "place/preview",
  "place/basics",
  "place/media",
  "promos",
  "promos/perks",
  "reservations",
  "scan",
  "settings",
  "team",
  "tickets",
];

// Destinations are Profile's real address, not the bare place URL (MESITA-1732).
// These four are `permanent: true`, so their 308 is already cached on disk in
// every browser that followed them; pointing them at the bare URL would chain
// that spent 308 into the new 307 forever. One hop beats two.
describe("the legacy console's URLs all still resolve", () => {
  it("every /place/<id>/<tab> lands on that place, never a 404", async () => {
    const all = await rules();
    for (const tab of LEGACY_TABS) {
      expect(resolve(`/place/abc/${tab}`, all)).toBe("/places/abc/profile");
    }
  });

  it("the bare /place/<id> lands on that place", async () => {
    expect(resolve("/place/abc", await rules())).toBe("/places/abc/profile");
  });

  it("/unit/* is repointed, not left chaining through a deleted route", async () => {
    // It used to forward to /place/*, which this PR removed.
    const all = await rules();
    expect(resolve("/unit/abc", all)).toBe("/places/abc/profile");
    expect(resolve("/unit/abc/place/preview", all)).toBe("/places/abc/profile");
  });

  it("/settings lands on the shell's Account screen", async () => {
    expect(resolve("/settings", await rules())).toBe("/account");
  });

  it("every redirect is permanent — these moves are not coming back", async () => {
    for (const rule of await rules()) expect(rule.permanent).toBe(true);
  });

  it("no rule forwards to a route this repo no longer serves", async () => {
    for (const rule of await rules()) {
      expect(rule.destination.startsWith("/place/")).toBe(false);
      expect(rule.destination).not.toBe("/settings");
    }
  });
});

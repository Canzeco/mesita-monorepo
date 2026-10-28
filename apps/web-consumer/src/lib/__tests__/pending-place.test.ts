import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parsePendingPlace } from "../pending-place";

// A Google-only card opened from Home or Favorites (MESITA-2307): the tap
// stashes the card and goes to the opening route, which draws the generating
// view (MESITA-2935), awaits the create, then replaces the route with the
// real profile; the lists behind it draw the Mesita card where the Google
// card stood (created-places.test.ts).

const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

describe("the stashed card", () => {
  it("reads only a stash that carries a name", () => {
    expect(parsePendingPlace(null)).toBeNull();
    expect(parsePendingPlace("{}")).toBeNull();
    expect(parsePendingPlace("not json")).toBeNull();
    expect(parsePendingPlace('{"name":"Casa"}')).toEqual({ name: "Casa" });
  });
});

describe("the open, the create and the Feed", () => {
  it("a tap stashes the card and opens the opening screen at once", () => {
    const hook = read("../use-open-google-place.ts");
    const tap = hook.slice(
      hook.indexOf("export function useOpenGooglePlace"),
      hook.indexOf("export type OpenedGooglePlace"),
    );
    expect(tap).toContain("stashPendingPlace(gid, place)");
    expect(tap).toContain("openHref(googleOpenHref(gid, place.name))");
  });

  it("the opening screen awaits the create, then shows the real profile", () => {
    const screen = read("../../components/consumer/OpeningGooglePlace.tsx");
    const create = screen.indexOf("await getOrCreateGooglePlace(supabase, gid)");
    // The slide-over replaces itself through the one navigation guard, so a
    // replace that never commits still loads the profile (MESITA-2824).
    const replace = screen.indexOf(
      "navigateTo(router, opened.href, { replace: true })",
    );
    expect(create).toBeGreaterThan(0);
    expect(replace).toBeGreaterThan(create);
    // A hard-loaded page loads the real profile as a page, never as a
    // modal over itself with no Back to pop.
    expect(screen).toContain('if (variant === "page") window.location.replace(opened.href)');
  });
});

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { googleOpenHref } from "@/lib/use-open-google-place";

const SRC = join(__dirname, "../..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

// MESITA-2311 (Pato): a tap on a Google place goes to its screen at once and
// spins there while the profile is created, instead of waiting on Home.
describe("opening a Google place", () => {
  it("routes to the opening screen with the name for its header", () => {
    expect(googleOpenHref("ChIJ123", "Doña Tota")).toBe(
      "/place/open/ChIJ123?name=Do%C3%B1a%20Tota",
    );
    expect(googleOpenHref("ChIJ123", " ")).toBe("/place/open/ChIJ123");
  });

  it("navigates on the tap and never creates there", () => {
    const hook = read("lib/use-open-google-place.ts");
    const tap = hook.slice(
      hook.indexOf("export function useOpenGooglePlace"),
      hook.indexOf("export type OpenedGooglePlace"),
    );
    expect(tap).toContain("openHref(googleOpenHref(");
    expect(tap).not.toContain("apiCreateProject");
  });

  it("creates only from the opening screen's client effect", () => {
    const screen = read("components/consumer/OpeningGooglePlace.tsx");
    expect(screen.startsWith('"use client"')).toBe(true);
    expect(screen).toContain("useEffect(");
    expect(screen).toContain("getOrCreateGooglePlace(");
    expect(screen).toContain("router.replace(");
    for (const page of [
      "app/(shell)/place/open/[gid]/page.tsx",
      "app/(shell)/@modal/(.)place/open/[gid]/page.tsx",
    ]) {
      expect(existsSync(join(SRC, page)), page).toBe(true);
      expect(read(page)).not.toContain("apiCreateProject");
    }
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Place } from "@/lib/api/places";
import { CatalogTile } from "@/components/consumer/home/CatalogTile";

// NO PASSIVE CREATION (MESITA-2298 req 5, MESITA-2302). A Mesita Place is
// minted only when a guest explicitly opens a Google-only result's profile:
// the tap goes to /place/open/<gid> at once and THAT screen's client effect
// awaits `getOrCreateGooglePlace`, one deduped get-or-create per Google Place
// ID. Loading, rendering, scrolling, prefetching or selecting a pin or a card
// writes nothing. These pins keep every passive path free of the create call
// and name the only files that may reach the EF.

const SRC = join(__dirname, "..", "..");
const CODE = /\.(ts|tsx)$/;
const TEST = /\.test\.(ts|tsx)$/;

function appFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      appFiles(path, out);
    } else if (CODE.test(name) && !TEST.test(name)) {
      out.push(path);
    }
  }
  return out;
}

const files = appFiles(SRC);
const rel = (path: string) => relative(SRC, path);
const read = (relPath: string) => readFileSync(join(SRC, relPath), "utf8");

/** Source without its comments: a pin on an identifier never trips on prose. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const appCode = files.map((path) => ({
  path: rel(path),
  src: code(readFileSync(path, "utf8")),
}));

/** Every `<name>(…)` call in `src`, parentheses balanced, strings skipped. */
function callBlocks(src: string, name: string): string[] {
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const at = src.indexOf(`${name}(`, from);
    if (at < 0) return blocks;
    let depth = 0;
    let quote: string | null = null;
    let i = at + name.length;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (quote) {
        if (ch === "\\") i++;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") quote = ch;
      else if (ch === "(") depth++;
      else if (ch === ")" && --depth === 0) break;
    }
    blocks.push(src.slice(at, i + 1));
    from = i + 1;
  }
}

function tile(over: Partial<Place>): string {
  const place = {
    id: "p1",
    slug: "casa",
    name: "Casa",
    category: "restaurant",
    photos: [],
    ...over,
  } as Place;
  return renderToStaticMarkup(
    createElement(CatalogTile, { place, saved: false, onToggle: () => {} }),
  );
}

describe("no passive creation: a Mesita Place is minted only on an explicit open", () => {
  it("only the opener and the Chat tab import apiCreateProject; one file names the EF", () => {
    const importers = appCode
      .filter((f) => f.path !== "lib/api/place-search.ts")
      .filter((f) => /\bapiCreateProject\b/.test(f.src))
      .map((f) => f.path)
      .sort();
    // Search no longer imports it (MESITA-2311): its second tap navigates
    // through the hook, and the opening screen creates.
    expect(importers).toEqual([
      "components/consumer/home/AskAiTab.tsx",
      "lib/use-open-google-place.ts",
    ]);
    const namers = appCode
      .filter((f) => f.src.includes("consumer-web-create-place"))
      .map((f) => f.path);
    expect(namers).toEqual(["lib/api/place-search.ts"]);
  });

  it("the hook navigates on the tap; getOrCreateGooglePlace is the one create site, in no effect", () => {
    const hook = code(read("lib/use-open-google-place.ts"));
    expect(hook).not.toContain("useEffect");
    expect(hook.match(/apiCreateProject\(/g)).toHaveLength(1);
    const create = hook.indexOf("export function getOrCreateGooglePlace(");
    expect(create).toBeGreaterThan(-1);
    expect(hook.indexOf("apiCreateProject(")).toBeGreaterThan(create);
    const tap = hook.slice(
      hook.indexOf("export function useOpenGooglePlace"),
      hook.indexOf("export type OpenedGooglePlace"),
    );
    expect(tap).toContain("useCallback(");
    expect(tap).toContain("router.push(googleOpenHref(");
    expect(tap).not.toContain("apiCreateProject");
    expect(tap).not.toContain("getOrCreateGooglePlace");
  });

  it("getOrCreateGooglePlace runs from the opening screen's effect and the cards' Save/Share taps only", () => {
    const callers = appCode
      .filter((f) => /(?<!function )\bgetOrCreateGooglePlace\(/.test(f.src))
      .map((f) => f.path)
      .sort();
    // A Google-only card's Save and Share create on the tap (Pato,
    // MESITA-2663: "just create the profile and then trigger it"), on Home
    // and Search alike through one hook (MESITA-2668) — never on render.
    expect(callers).toEqual([
      "components/consumer/OpeningGooglePlace.tsx",
      "lib/use-card-save-share.ts",
    ]);
    const cards = code(read("lib/use-card-save-share.ts"));
    for (const hook of ["useEffect", "useMemo", "useLayoutEffect"]) {
      expect(cards, hook).not.toContain(`${hook}(`);
    }
    const screen = read("components/consumer/OpeningGooglePlace.tsx");
    expect(screen.startsWith('"use client"')).toBe(true);
    const effects = callBlocks(code(screen), "useEffect");
    expect(
      effects.filter((e) => e.includes("getOrCreateGooglePlace(")),
    ).toHaveLength(1);
  });

  it("rails, tiles, pins, cards and the server pages never create or prefetch", () => {
    for (const path of [
      "components/consumer/home/CatalogRails.tsx",
      "components/consumer/home/CatalogTile.tsx",
      "components/consumer/search/SearchRailCard.tsx",
      "components/consumer/search/SearchMap.tsx",
      "app/(shell)/place/[id]/page.tsx",
      "app/(shell)/@modal/(.)place/[id]/page.tsx",
      "app/(shell)/place/open/[gid]/page.tsx",
      "app/(shell)/@modal/(.)place/open/[gid]/page.tsx",
      "app/(shell)/(discovery)/home/layout.tsx",
      "app/(shell)/(discovery)/home/places/page.tsx",
      "app/(shell)/(discovery)/home/social/page.tsx",
    ]) {
      const src = code(read(path));
      for (const marker of [
        "apiCreateProject",
        "consumer-web-create-place",
        "getOrCreateGooglePlace",
        "prefetch",
      ]) {
        expect(src, `${path} carries ${marker}`).not.toContain(marker);
      }
    }
  });

  it("no app file prefetches a route: Next's default (the loading shell) is the only prefetch", () => {
    const prefetchers = appCode
      .filter((f) => /\bprefetch\b/.test(f.src))
      .map((f) => f.path);
    expect(prefetchers).toEqual([]);
  });

  it("Search's effects never open or create; the explicit open is a tap handler", () => {
    const client = code(read("components/consumer/search/SearchClient.tsx"));
    const effects = callBlocks(client, "useEffect");
    expect(effects.length).toBeGreaterThanOrEqual(4);
    for (const effect of effects) {
      for (const marker of [
        "apiCreateProject",
        "getOrCreateGooglePlace",
        "openGoogleProfile",
        "openGoogleOnly",
        "openGooglePlace(",
      ]) {
        expect(effect, marker).not.toContain(marker);
      }
    }
    // The opener is a memoised handler whose one door is the second tap
    // (`openGoogleOnly`); it hands the card to the hook and nothing else.
    expect(client).toContain("const openGoogleProfile = useCallback(");
    const opener = client.slice(
      client.indexOf("const openGoogleProfile"),
      client.indexOf("const openGoogleOnly"),
    );
    expect(opener).toContain("openGooglePlace(");
    expect(client.match(/openGoogleProfile\(/g)).toHaveLength(1);
  });

  it("a Google-only tile is a button, never a link to a page it has no row for", () => {
    const src = code(read("components/consumer/home/CatalogTile.tsx"));
    const link = src.slice(
      src.indexOf("function TileLink("),
      src.indexOf("function readableKind("),
    );
    const branch = link.indexOf("if (google) {");
    expect(branch).toBeGreaterThan(-1);
    const fallThrough = link.indexOf(
      "return (",
      link.indexOf("return (", branch) + 1,
    );
    const googleBranch = link.slice(branch, fallThrough);
    const mesitaBranch = link.slice(fallThrough);
    expect(googleBranch).toContain("<button");
    expect(googleBranch).toContain('type="button"');
    expect(googleBranch).not.toContain("<Link");
    expect(googleBranch).not.toContain("href=");
    expect(mesitaBranch).toContain("<Link href={href}");
    expect(mesitaBranch).not.toContain("prefetch");

    const google = tile({
      id: "g:ChIJx",
      slug: "ChIJx",
      google_place_id: "ChIJx",
      googleOnly: true,
    });
    expect(google).not.toContain("<a ");
    expect(google).toContain('aria-label="Open Casa"');
    expect(tile({})).toMatch(/<a\s[^>]*href="\/place\/casa"/);
  });
});

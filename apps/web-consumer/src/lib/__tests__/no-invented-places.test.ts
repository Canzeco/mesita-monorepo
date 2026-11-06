import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// THE APP SHIPS NO INVENTED PLACES (MESITA-2095). Twice a frontend sample deck
// stood in for the catalog — `lib/mock/feed-places.ts` until 2026-09-08, and
// `lib/mock/scroll-places.ts` behind SCROLL_USES_MOCK until 2026-10-11 — and
// both times the real code it leaned on (the PlaceDetail type, the reservation
// types, enrichPlaceOverview) lived beside it under `lib/mock/`. That
// directory is gone, and this gate keeps the door shut for every file, not
// only the decks a per-file pin happens to name.
//
// Tests are exempt: a render test needs a row, and no app file may import a
// test's fixture.

const SRC = join(__dirname, "..", "..");
const CODE = /\.(ts|tsx)$/;

function appFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      appFiles(path, out);
    } else if (CODE.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

const files = appFiles(SRC);
const rel = (path: string) => relative(SRC, path);

// Every module specifier in a file: static imports and re-exports, and
// dynamic `import()`.
function specifiers(src: string): string[] {
  const found: string[] = [];
  for (const m of src.matchAll(/\bfrom\s+["']([^"']+)["']/g)) found.push(m[1]);
  for (const m of src.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    found.push(m[1]);
  }
  for (const m of src.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) found.push(m[1]);
  return found;
}

describe("no file under src/ invents a place", () => {
  it("scans the app, not an empty directory", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("lib/mock/ does not exist", () => {
    expect(existsSync(join(SRC, "lib", "mock"))).toBe(false);
  });

  it("no app file is named for a mock", () => {
    const named = files.map(rel).filter((p) => /mock/i.test(p));
    expect(named).toEqual([]);
  });

  it("no app file imports a mock or fixture module", () => {
    const offenders = files.flatMap((path) =>
      specifiers(readFileSync(path, "utf8"))
        .filter((spec) => /(^|[/._-])mocks?([/._-]|$)|fixtures?\//i.test(spec))
        .map((spec) => `${rel(path)} -> ${spec}`),
    );
    expect(offenders).toEqual([]);
  });

  it("no app file defines a `mock-` place id", () => {
    const offenders = files
      .filter((path) => /["'`]mock-/.test(readFileSync(path, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  // The gate must be able to fail: each pattern catches the shape it names.
  it("catches what it claims to", () => {
    expect(specifiers('import { a } from "@/lib/mock/scroll-places";')).toEqual([
      "@/lib/mock/scroll-places",
    ]);
    expect(specifiers('const m = await import("@/lib/mock/x");')).toEqual([
      "@/lib/mock/x",
    ]);
    for (const spec of ["@/lib/mock/x", "./mocks", "../place.mock", "./__tests__/fixtures/place"]) {
      expect(/(^|[/._-])mocks?([/._-]|$)|fixtures?\//i.test(spec), spec).toBe(true);
    }
    for (const spec of ["@/lib/api/places", "@/lib/adapters/enrich-overview", "hammock"]) {
      expect(/(^|[/._-])mocks?([/._-]|$)|fixtures?\//i.test(spec), spec).toBe(false);
    }
  });
});

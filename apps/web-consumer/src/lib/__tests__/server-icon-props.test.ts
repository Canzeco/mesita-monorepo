import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A SERVER COMPONENT MAY NOT HAND A COMPONENT TO A CLIENT ONE (MESITA-2129).
//
// `icon={Smartphone}` passes a function. React serialises every prop that
// crosses from a Server Component into a "use client" module, and a function
// cannot be serialised, so the page dies at request time with "Functions
// cannot be passed directly to Client Components" — digest 4172959490, and
// consumer.mesita.ai showed "This page couldn't load" on every /web visit.
//
// Nothing else catches it: typecheck, lint and `next build` all pass, because
// every shell route is force-dynamic and only renders on a real request.
// jsdom has no server/client boundary either. So this is a source-level guard:
// for every module WITHOUT "use client", any JSX element given a capitalised
// identifier through an icon-ish prop must not be imported from a module that
// HAS "use client".

const SRC = join(__dirname, "..", "..");
const ICON_PROP = /<([A-Z]\w*)\b[^>]*?\b(?:icon|Icon)=\{([A-Z]\w*)\}/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx") && !p.includes(".test.")) out.push(p);
  }
  return out;
}

const isClient = (source: string) =>
  /^\s*(?:\/\/[^\n]*\n\s*)*["']use client["']/.test(source);

function resolveImport(source: string, name: string): string | null {
  const m = source.match(
    new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*["'](@/[^"']+)["']`),
  );
  if (!m) return null;
  const base = join(SRC, m[1].slice(2));
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    if (existsSync(base + ext)) return base + ext;
  }
  return null;
}

describe("server components pass no component props to client modules", () => {
  it("finds no server → client icon prop", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const source = readFileSync(file, "utf8");
      if (isClient(source)) continue;
      for (const [, element] of source.matchAll(ICON_PROP)) {
        const target = resolveImport(source, element);
        if (target && isClient(readFileSync(target, "utf8"))) {
          offenders.push(`${file.slice(SRC.length + 1)} → <${element}>`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the guard bites: EmptyState as a client module would fail it", () => {
    const pay = readFileSync(join(SRC, "app/(shell)/pay/page.tsx"), "utf8");
    expect(isClient(pay)).toBe(false);
    expect([...pay.matchAll(ICON_PROP)].map((m) => m[1])).toContain(
      "EmptyState",
    );
    expect(isClient(`"use client";\n\nexport function EmptyState() {}`)).toBe(
      true,
    );
  });
});

import { assert, assertEquals } from "@std/assert";
import { dirname, fromFileUrl } from "@std/path";

import { extractHumanStrings, scanPackageCards, scanSource, scanVocabulary } from "./vocabulary-ratchet.ts";

const repoRoot = dirname(dirname(fromFileUrl(import.meta.url)));

Deno.test("extractHumanStrings finds JSX text", () => {
  const src = `export const x = () => <p>Crenup</p>;`;
  const hits = extractHumanStrings(src);
  assert(hits.some((h) => h.text === "Crenup"));
});

Deno.test("scanPackageCards rejects venue → place / business teaching", () => {
  const violations = scanPackageCards(repoRoot);
  const bad = violations.filter((v) => v.token === "venue→business");
  assertEquals(bad.length, 0);
});

Deno.test("vocabulary ratchet is green on the repo tree", async () => {
  const violations = await scanVocabulary(repoRoot);
  if (violations.length > 0) {
    const msg = violations
      .slice(0, 20)
      .map((v) => `${v.file}:${v.line} [${v.token}] ${v.excerpt}`)
      .join("\n");
    throw new Error(
      `${violations.length} vocabulary violation(s):\n${msg}${
        violations.length > 20 ? "\n..." : ""
      }`,
    );
  }
});

Deno.test("planted Crenup in a string would fail", () => {
  const src = `const t = "Crenup";`;
  const hits = extractHumanStrings(src);
  assert(hits.some((h) => /\bCrenup\b/.test(h.text)));
});

Deno.test("Second Stage words fail in UI copy; a family's membership does not", () => {
  const tokens = (src: string) => scanSource("apps/web-admin/src/x.tsx", src).map((v) => v.token);
  assertEquals(tokens(`const a = "Get a promo code";`), ["promo"]);
  assertEquals(tokens(`export const B = () => <p>Mesita membership</p>;`), ["membership"]);
  assertEquals(tokens(`const c = "Family membership lives on Atlas";`), []);
  assertEquals(tokens(`// a promo in a comment is not copy\nconst d = "Promoting a place";`), []);
});

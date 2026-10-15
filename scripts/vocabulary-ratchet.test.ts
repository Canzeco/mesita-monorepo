import { assert, assertEquals } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";

import { extractHumanStrings, scanPackageCards, scanVocabulary } from "./vocabulary-ratchet.ts";

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

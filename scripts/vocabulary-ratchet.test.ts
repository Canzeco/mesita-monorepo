import { assert, assertEquals } from "@std/assert";
import { dirname, fromFileUrl, globToRegExp, join } from "@std/path";

import {
  extractHumanStrings,
  SCAN_ROOTS,
  scanPackageCards,
  scanSource,
  scanVocabulary,
} from "./vocabulary-ratchet.ts";

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

Deno.test("a violation reports its own line, comments above it included", () => {
  const src = `// one\n/* two\n   three */\nconst a = "Get a promo";\n`;
  assertEquals(scanSource("supabase/supabase/functions/x/index.ts", src).map((v) => v.line), [4]);
});

Deno.test("Edge Function strings are scanned: they reach the console and the guest", () => {
  assert(SCAN_ROOTS.includes("supabase/supabase/functions"));
});

Deno.test("every scan root exists, and rules.yml runs on it (push paths and the changes filter)", async () => {
  // scanVocabulary skips a missing root without a word, and a root the
  // workflow does not trigger on is never scanned in CI: either way the gate
  // reports green because it never ran.
  const yml = await Deno.readTextFile(join(repoRoot, ".github", "workflows", "rules.yml"));
  const [triggers, jobs] = yml.split(/^jobs:$/m);
  const globsIn = (text: string) =>
    [...text.matchAll(/^\s*- ["']([^"']+)["']\s*$/gm)].map((m) => globToRegExp(m[1]));
  for (const root of SCAN_ROOTS) {
    assert(Deno.statSync(join(repoRoot, root)).isDirectory, `${root} is not a directory`);
    const file = `${root}/x.ts`;
    assert(globsIn(triggers).some((re) => re.test(file)), `rules.yml push paths miss ${root}`);
    assert(globsIn(jobs).some((re) => re.test(file)), `rules.yml's changes filter misses ${root}`);
  }
});

import { assertEquals } from "@std/assert";
import { firstDrift, normalize, quickstartBody } from "./notion-drift.ts";

Deno.test("normalize ignores formatting, links and case, keeps every word", () => {
  const notion = "**Notion is the library** — it wins. Read [Rules](https://x.y/z) §0 · `deno task boot`";
  const repo = "Notion is the library — it wins. Read Rules §0 · deno task boot";
  assertEquals(normalize(notion), normalize(repo));
  assertEquals(normalize("I-1 Every repo or cloud write has an issue, in a project."), ["i-1", "every", "repo", "or", "cloud", "write", "has", "an", "issue", "in", "a", "project"]);
});

Deno.test("marks vanish instead of splitting: adjacent code spans stay one word, as Notion plain text has them", () => {
  assertEquals(normalize("invariants `I-1`…`I-10`, loop"), normalize("invariants I-1…I-10, loop"));
  assertEquals(normalize("**The repo.** `Canzeco/mesita-monorepo` is (`--adopt .`)"), ["the", "repo", "canzeco/mesita-monorepo", "is", "adopt"]);
  assertEquals(normalize("Pato's live instruction \\> the Linear issue"), normalize("Pato's live instruction > the Linear issue"));
});

Deno.test("firstDrift names the first differing word with windows on both sides", () => {
  const a = normalize("one two three four five six seven eight nine ten");
  const b = normalize("one two three four FIVE! six seven eight nine ten");
  assertEquals(firstDrift(a, b), null);
  const c = normalize("one two three four six seven eight nine ten");
  const d = firstDrift(a, c)!;
  assertEquals(d.at, 4);
  assertEquals(d.notion.startsWith("one two three four five"), true);
  assertEquals(d.repo.startsWith("one two three four six"), true);
  assertEquals(firstDrift(a, a.slice(0, 3))?.at, 3);
});

Deno.test("quickstartBody drops only the H1 title line", () => {
  assertEquals(quickstartBody("# Mesita — agent quickstart\n\n**Notion** wins."), "\n**Notion** wins.");
  assertEquals(quickstartBody("no title here"), "no title here");
});

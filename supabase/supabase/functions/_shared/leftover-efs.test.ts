// MESITA-2090 — the cloud half of every Edge Function retirement.
//
// `supabase functions deploy` only ADDS, so a retired function stays callable
// in the cloud until the `leftover=( … )` array in
// .github/workflows/supabase-deploy.yml names it. That step runs AFTER the
// full deploy, in the same job, and nothing else in `deno test` reads it.
// Two ways the list breaks the deploy job on main:
//
//   1. A leftover slug that still has a folder or a config.toml block. The
//      job deploys it and then deletes it, on every merge: a function the
//      repo says exists and the cloud never keeps.
//   2. A lookup that matches PART of a slug. `grep -Fqw` treated a hyphen as a
//      word boundary, so a retired slug also matched any listed slug it was a
//      hyphen-bounded part of; `functions delete` then failed on the absent
//      name and `set -euo pipefail` aborted the step, leaving every slug after
//      it deployed. The step now matches the whole `| slug |` cell.
//
// MESITA-2090 put 109 slugs on the list at once (the MVP First Stage cut).

import { assertEquals } from "jsr:@std/assert@1";

const FUNCTIONS_DIR = new URL("../", import.meta.url);
const CONFIG_TOML = new URL("../../config.toml", import.meta.url);
const DEPLOY_WORKFLOW = new URL(
  "../../../../.github/workflows/supabase-deploy.yml",
  import.meta.url,
);

async function leftoverSlugs(): Promise<string[]> {
  const text = await Deno.readTextFile(DEPLOY_WORKFLOW);
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.trim() === "leftover=(");
  if (start < 0) throw new Error("supabase-deploy.yml has no `leftover=(` array");
  const slugs: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const t = line.trim();
    if (t === ")") return slugs;
    if (t === "" || t.startsWith("#")) continue;
    slugs.push(t);
  }
  throw new Error("supabase-deploy.yml's `leftover=(` array is never closed");
}

async function deployedFolders(): Promise<string[]> {
  const out: string[] = [];
  for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
    if (entry.isDirectory && entry.name !== "_shared") out.push(entry.name);
  }
  return out.sort();
}

Deno.test("leftover: no retired slug is still deployable from the repo", async () => {
  const leftover = await leftoverSlugs();
  const folders = new Set(await deployedFolders());
  const config = await Deno.readTextFile(CONFIG_TOML);
  const declared = new Set(
    [...config.matchAll(/^\[functions\.([^\]]+)\]/gm)].map((m) => m[1]),
  );
  const live = leftover.filter((s) => folders.has(s) || declared.has(s));
  assertEquals(
    live,
    [],
    `named for cloud deletion but still a folder or a [functions.*] block — ` +
      `the deploy job would deploy and then delete it on every merge: ${live.join(", ")}`,
  );
});

Deno.test("leftover: no slug is listed twice", async () => {
  const leftover = await leftoverSlugs();
  const dupes = leftover.filter((s, i) => leftover.indexOf(s) !== i);
  assertEquals(dupes, [], `listed more than once: ${dupes.join(", ")}`);
});

Deno.test("leftover: the delete step matches the whole slug cell, never part of one", async () => {
  const text = await Deno.readTextFile(DEPLOY_WORKFLOW);
  // A partial match is what aborted the step: business-web-create-place
  // inside business-web-create-place-api-key.
  assertEquals(/grep -Fqw "\$fn"/.test(text), false, "the word-boundary grep is back");
  assertEquals(
    text.includes('grep -Eq "\\\\|[[:space:]]*${fn}[[:space:]]*\\\\|"'),
    true,
    "the delete loop no longer matches the `| slug |` cell exactly",
  );
});

Deno.test("leftover: a slug the registry lists but delete cannot find does not abort the step", async () => {
  const text = await Deno.readTextFile(DEPLOY_WORKFLOW);
  // Run 38097168472: the listing showed consumer-web-list-credit-gifts,
  // delete answered "does not exist", and set -e stopped every slug after it.
  assertEquals(text.includes('grep -q "does not exist"'), true, "the already-gone branch is missing");
});

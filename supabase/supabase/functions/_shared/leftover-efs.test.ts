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
//   2. The lookup is `grep -Fqw`, and a hyphen is a word boundary, so a slug
//      also matches any LIVE slug it is a hyphen-bounded part of. Once the
//      shorter slug is gone, the grep still matches the longer one,
//      `functions delete` fails on the absent name, and `set -euo pipefail`
//      aborts the step — every slug after it stays deployed. So no leftover
//      slug may sit inside a function the repo still deploys, and inside the
//      list the longer slug of such a pair is deleted first.
//
// MESITA-2090 put 110 slugs on the list at once (the MVP First Stage cut);
// business-web-create-place / business-web-create-place-api-key is the pair
// that rule 2 orders.

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

/** `grep -Fw needle` on a line holding `hay`: a fixed-string hit whose
 *  neighbours are not word characters (letters, digits, underscore). */
function grepWordMatches(needle: string, hay: string): boolean {
  let at = hay.indexOf(needle);
  while (at >= 0) {
    const before = at === 0 ? "" : hay[at - 1];
    const after = hay[at + needle.length] ?? "";
    if (!/\w/.test(before) && !/\w/.test(after)) return true;
    at = hay.indexOf(needle, at + 1);
  }
  return false;
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

Deno.test("leftover: no retired slug is a hyphen-bounded part of a deployed function", async () => {
  const leftover = await leftoverSlugs();
  const folders = await deployedFolders();
  const hits: string[] = [];
  for (const slug of leftover) {
    for (const fn of folders) {
      if (fn !== slug && grepWordMatches(slug, fn)) hits.push(`${slug} ⊂ ${fn}`);
    }
  }
  assertEquals(
    hits,
    [],
    `grep -Fqw would match the deployed function and try to delete the absent ` +
      `slug forever, aborting the step: ${hits.join(", ")}`,
  );
});

Deno.test("leftover: inside a prefix pair the longer slug is deleted first", async () => {
  const leftover = await leftoverSlugs();
  const misordered: string[] = [];
  leftover.forEach((short, i) => {
    leftover.forEach((long, j) => {
      if (short !== long && grepWordMatches(short, long) && j > i) {
        misordered.push(`${long} must come before ${short}`);
      }
    });
  });
  assertEquals(misordered, [], misordered.join("\n"));
});

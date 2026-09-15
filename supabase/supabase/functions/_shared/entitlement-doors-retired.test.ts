// MESITA-1889 — retiring an Edge Function takes THREE deletions, and the
// third is the one everybody forgets.
//
//   1. the folder under supabase/functions/   (stops it being deployed)
//   2. its [functions.<slug>] block in config.toml   (stops it being declared)
//   3. its slug in the `leftover=(` array in .github/workflows/supabase-deploy.yml
//
// `supabase functions deploy` only ever ADDS. A folder deleted in the repo
// stays live and callable in the cloud FOREVER unless CI is told to delete it
// by name — and the MCP cannot delete a function, so that workflow step is the
// only thing that can. Doing 1 and 2 without 3 is the failure this file
// prevents: a repo that reads as if the door were closed, in front of a cloud
// that still answers on it.
//
// The two doors here wrote the same entitlement the organization's Mesita
// Membership now owns: `business-web-set-org-partnership` (the operator
// switch, which also coupled `mesita_pay_enabled` into the same write) and
// `business-web-change-subscription` (the per-place Verified checkout).

import { assert, assertEquals } from "jsr:@std/assert@1";

const FUNCTIONS_DIR = new URL("../", import.meta.url);
const CONFIG_TOML = new URL("../../config.toml", import.meta.url);
const DEPLOY_WORKFLOW = new URL(
  "../../../../.github/workflows/supabase-deploy.yml",
  import.meta.url,
);
const RETIRED_DIR = new URL("../../../../retired/edge-functions/", import.meta.url);

const RETIRED_SLUGS = [
  "business-web-set-org-partnership",
  "business-web-change-subscription",
] as const;

async function exists(url: URL): Promise<boolean> {
  try {
    await Deno.stat(url);
    return true;
  } catch {
    return false;
  }
}

Deno.test("deletion 1 of 3: neither retired door has a function folder", async () => {
  const leftovers: string[] = [];
  for (const slug of RETIRED_SLUGS) {
    if (await exists(new URL(`${slug}/`, FUNCTIONS_DIR))) leftovers.push(slug);
  }
  assertEquals(
    leftovers,
    [],
    `still deployable from the repo: ${leftovers.join(", ")}`,
  );
});

Deno.test("deletion 2 of 3: config.toml declares neither retired door", async () => {
  const text = await Deno.readTextFile(CONFIG_TOML);
  const declared = RETIRED_SLUGS.filter((slug) =>
    new RegExp(`^\\[functions\\.${slug}\\]`, "m").test(text)
  );
  assertEquals(
    declared,
    [],
    `leftover [functions.*] blocks: ${declared.join(", ")}`,
  );
});

Deno.test("deletion 3 of 3: both slugs are queued for cloud deletion", async () => {
  const workflow = await Deno.readTextFile(DEPLOY_WORKFLOW);
  const start = workflow.indexOf("leftover=(");
  assert(start > 0, "the leftover=( array must exist in the deploy workflow");
  const listed = workflow.slice(start, workflow.indexOf(")", start));
  const missing = RETIRED_SLUGS.filter(
    (slug) => !new RegExp(`^\\s*${slug}\\s*$`, "m").test(listed),
  );
  assertEquals(
    missing,
    [],
    `not named in supabase-deploy.yml's leftover=( array: ${missing.join(", ")}. ` +
      `Deleting the folder and the config block does NOT undeploy anything — ` +
      `these stay callable in the cloud until CI deletes them by name.`,
  );
});

Deno.test("the source survives under retired/edge-functions with its ARCHIVED header", async () => {
  for (const slug of RETIRED_SLUGS) {
    const file = new URL(`${slug}/index.ts`, RETIRED_DIR);
    assert(await exists(file), `missing archive: retired/edge-functions/${slug}/index.ts`);
    const text = await Deno.readTextFile(file);
    assert(
      text.startsWith("// ARCHIVED —"),
      `${slug}: the archive must open with the ARCHIVED header, or a reader ` +
        `cannot tell a record from a module`,
    );
    assert(
      text.includes("MESITA-1889"),
      `${slug}: the header must name the issue that retired it`,
    );
  }
});

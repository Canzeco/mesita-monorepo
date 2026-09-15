// MESITA-1892: the nine organization Edge Functions are retired.
//
// Same guard the repo already runs twice — `check-web-retired.test.ts`
// (MESITA-1117) and `sourcing-retired.test.ts`. A retirement is only complete
// when THREE things are true, and this file pins the two that live in the repo:
// no folder, and no `[functions.<name>]` block in config.toml. The third is the
// cloud, which `supabase-deploy.yml`'s `leftover` array deletes on the next
// push — the CLI can delete a deployed function, MCP cannot.
//
// WHY IT MATTERS HERE MORE THAN USUAL. The EF name IS the ACL. A leftover
// `business-web-list-org-members` folder would redeploy a public endpoint that
// reads a table the schema no longer has: a 42P01 on every call at best, and
// at worst a surface nobody is looking at any more.
//
// SEVEN OF THE NINE WERE DUPLICATES, and the place twin they duplicated has
// been live the whole time:
//   list-organizations     → business-web-list-places
//   create-organization    → business-web-create-place
//   add-org-member         → business-web-invite-member
//   remove-org-member      → business-web-remove-member
//   update-org-member-role → business-web-update-member-role
//   list-org-members       → business-web-list-members
//   accept-org-invite      → business-web-accept-invite
// The other two were RENAMED, not duplicated, so their new names must exist:
//   update-organization    → business-web-update-legal-identity
//   set-org-partnership    → business-web-set-partner-status
// That second assertion is the one that catches a half-done rename — a deleted
// folder with nothing put in its place reads as a clean retirement otherwise.

import { assertEquals } from "jsr:@std/assert@1";

const FUNCTIONS_DIR = new URL("../", import.meta.url);
const CONFIG_TOML = new URL("../../config.toml", import.meta.url);

/** Gone from the repo and queued for cloud deletion. */
const RETIRED = [
  "business-web-accept-org-invite",
  "business-web-add-org-member",
  "business-web-create-organization",
  "business-web-list-org-members",
  "business-web-list-organizations",
  "business-web-remove-org-member",
  "business-web-set-org-partnership",
  "business-web-update-org-member-role",
  "business-web-update-organization",
] as const;

/** The two that were renamed rather than dropped. */
const SUCCESSORS = [
  "business-web-update-legal-identity",
  "business-web-set-partner-status",
] as const;

async function folders(): Promise<Set<string>> {
  const out = new Set<string>();
  for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
    if (entry.isDirectory) out.add(entry.name);
  }
  return out;
}

Deno.test("MESITA-1892: no organization Edge Function folders", async () => {
  const present = await folders();
  const leftovers = RETIRED.filter((n) => present.has(n));
  assertEquals(
    leftovers,
    [],
    `leftover organization EF folders: ${leftovers.join(", ")}`,
  );
});

Deno.test("MESITA-1892: config.toml declares no organization functions", async () => {
  const text = await Deno.readTextFile(CONFIG_TOML);
  const declared = [...text.matchAll(/^\[functions\.([^\]]+)\]/gm)].map((m) => m[1]);
  const leftovers = declared.filter((n) => (RETIRED as readonly string[]).includes(n));
  assertEquals(
    leftovers,
    [],
    `leftover [functions.*] blocks: ${leftovers.join(", ")}`,
  );
});

Deno.test("MESITA-1892: the two renamed endpoints exist under their new names", async () => {
  const present = await folders();
  const missing = SUCCESSORS.filter((n) => !present.has(n));
  assertEquals(
    missing,
    [],
    `renamed endpoints with no folder — a half-done rename: ${missing.join(", ")}`,
  );

  const text = await Deno.readTextFile(CONFIG_TOML);
  const undeclared = SUCCESSORS.filter(
    (n) => !new RegExp(`^\\[functions\\.${n}\\]`, "m").test(text),
  );
  assertEquals(
    undeclared,
    [],
    `renamed endpoints missing their config.toml block: ${undeclared.join(", ")}`,
  );
});

Deno.test("MESITA-1892: the cloud-deletion list names every retired function", async () => {
  // The repo half of a retirement is free; the CLOUD half is the one that gets
  // forgotten, because nothing in `deno test` can see a deployed function. So
  // assert against the deploy workflow's own array instead: if a name is
  // retired here and absent there, the old endpoint stays live in Supabase
  // after this lands.
  const wf = new URL("../../../../.github/workflows/supabase-deploy.yml", import.meta.url);
  const text = await Deno.readTextFile(wf);
  const missing = RETIRED.filter((n) => !new RegExp(`^\\s+${n}\\s*$`, "m").test(text));
  assertEquals(
    missing,
    [],
    `not in supabase-deploy.yml's leftover array, so they stay deployed: ${
      missing.join(", ")
    }`,
  );
});

// _shared/catalog-membership-seed.test.ts
//
// catalog_membership is the Google-type half of the family map:
// families_for_category() reads place_categories, then this table, and the
// place_profiles taxonomy trigger refuses a category found in neither. The
// cloud copy was wiped by an admin Reset and nothing reseeded it, so Create
// refused most restaurants (MESITA-2759).
//
// The migrations carry the table as a FULL seed (`insert into membership_seed`,
// printed by supabase/scripts/catalog-membership-sql.ts). This pins the newest
// such block to the code map, so a family change in catalog-families.ts that
// forgets to regenerate the seed fails here instead of in the cloud.
//
// Every parser throws when it matches nothing: a regex that quietly returns []
// is a vacuous test.

import { assertEquals } from "jsr:@std/assert@1";
import { membershipSeedRows } from "../../../scripts/catalog-membership-sql.ts";

const MIGRATIONS = new URL("../../migrations/", import.meta.url);

async function newestSeed(): Promise<{ file: string; rows: { slug: string; keys: string[] }[] }> {
  const names: string[] = [];
  for await (const e of Deno.readDir(MIGRATIONS)) {
    if (e.isFile && e.name.endsWith(".sql")) names.push(e.name);
  }
  names.sort().reverse();
  for (const name of names) {
    const src = await Deno.readTextFile(new URL(name, MIGRATIONS));
    const block = src.match(
      /insert\s+into\s+membership_seed\s*\(\s*slug\s*,\s*keys\s*\)\s*values([\s\S]*?);/i,
    );
    if (!block) continue;
    const row = /\(\s*'([a-z0-9_]+)'\s*,\s*array\[([^\]]*)\]::text\[\]\s*\)/g;
    const rows: { slug: string; keys: string[] }[] = [];
    let m: RegExpExecArray | null;
    while ((m = row.exec(block[1]!)) !== null) {
      const keys = m[2]!.split(",").map((k) => k.trim().replace(/^'|'$/g, ""));
      rows.push({ slug: m[1]!, keys });
    }
    if (rows.length === 0) throw new Error(`${name}: membership_seed block parsed empty`);
    return { file: name, rows };
  }
  throw new Error("no migration carries `insert into membership_seed` — the seed's shape moved");
}

Deno.test("the newest catalog_membership seed equals the code map", async () => {
  const { file, rows } = await newestSeed();
  assertEquals(rows, membershipSeedRows(), `${file} is stale: rerun supabase/scripts/catalog-membership-sql.ts`);
});

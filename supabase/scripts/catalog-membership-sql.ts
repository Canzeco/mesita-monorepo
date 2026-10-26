// supabase/scripts/catalog-membership-sql.ts — prints the full
// catalog_membership seed from the code map, for a migration to paste.
//
//   cd supabase && deno run --allow-read scripts/catalog-membership-sql.ts
//
// One row per Google Table A type (GOOGLE_TYPE_SUPER), its families as a list
// in the catalog's family order (familiesForCatalogSlug; no family is
// primary, MESITA-2808); a type in no family is ['undefined']. The output is
// the VALUES block of `insert into membership_seed`, the shape
// catalog-membership-seed.test.ts reads back from the newest migration that
// carries it (MESITA-2759).

import { familiesForCatalogSlug } from "../supabase/functions/_shared/catalog-families.ts";
import { GOOGLE_TYPE_SUPER } from "../supabase/functions/_shared/google-type-super.ts";

export function membershipSeedRows(): { slug: string; keys: string[] }[] {
  return Object.keys(GOOGLE_TYPE_SUPER).sort().map((slug) => {
    const keys = familiesForCatalogSlug(slug, GOOGLE_TYPE_SUPER[slug] ?? null);
    return { slug, keys: keys.length > 0 ? keys : ["undefined"] };
  });
}

if (import.meta.main) {
  const rows = membershipSeedRows();
  const lines = rows.map(({ slug, keys }) =>
    `  ('${slug}', array[${keys.map((k) => `'${k}'`).join(", ")}]::text[])`
  );
  console.log("insert into membership_seed (slug, keys) values");
  console.log(lines.join(",\n") + ";");
}

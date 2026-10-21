// MESITA-2588 — no two migrations may share a version.
//
// The ledger (supabase_migrations.schema_migrations) is keyed by the
// filename's timestamp. When two PRs each landed a `20261021070000_*.sql`,
// the cloud recorded the first one and the GitHub integration skipped the
// second as already applied: `place_activity_liked_by` never existed in the
// cloud while every check on both PRs was green. Each branch was fine alone;
// only the merged tree had the duplicate, so this runs on every PR against
// the tree it would land.

import { assertEquals } from "jsr:@std/assert@1";

const MIGRATIONS_DIR = new URL("../../migrations/", import.meta.url);

Deno.test("every migration file has its own version", () => {
  const byVersion = new Map<string, string[]>();
  for (const entry of Deno.readDirSync(MIGRATIONS_DIR)) {
    if (!entry.isFile || !entry.name.endsWith(".sql")) continue;
    const version = entry.name.split("_")[0];
    byVersion.set(version, [...(byVersion.get(version) ?? []), entry.name]);
  }
  const shared = [...byVersion.values()].filter((names) => names.length > 1);
  assertEquals(shared, [], "renumber one of each pair to a free version");
});

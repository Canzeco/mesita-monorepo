// _shared/place-families-parity.test.ts
//
// THE FAMILY VOCABULARY HAS FOUR COPIES, AND NOTHING TYPE-CHECKS BETWEEN THEM.
//
//   · public.place_families            — the catalog (pinned by pgTAP)
//   · _shared/place-taxonomy.ts        — the EF twin, `FAMILIES`
//   · apps/web-consumer/src/lib/place-families.ts
//   · apps/mobile-consumer/src/lib/place-families.ts
//
// `shared/` mirrors modules BETWEEN the web apps and never into supabase;
// mobile is a separate install root with a different linker; each Vercel
// project builds from its own Root Directory. So a slug that exists in three
// of the four compiles green everywhere and is wrong only on a guest's
// screen — which is precisely what happened: mobile shipped `wellness_spa`
// (a slug the catalog dropped on 2026-08-29) and was missing `sports_fitness`
// and `wellness_beauty`, so its Filters sheet offered a family no place can
// carry and hid two that most places do, for two and a half weeks, with every
// check green (MESITA-1857).
//
// The repo's stated answer for this boundary is duplicate + pin, not codegen
// (same posture as ticket-journey-drift.test.ts). This is the pin. It lives in
// the supabase package because mobile has no test runner at all and
// web-consumer's CI is path-filtered to its own directory, so a mobile-only
// edit would never run a test that lived there. Same cross-package idiom as
// config-section-callers.test.ts next door.
//
// THE DB LEG IS PINNED HERE TOO, BECAUSE pgTAP DOES NOT PIN IT.
//
// `schema_invariants.test.sql` compares the LIVE catalog to its own hardcoded
// slug array, and `place-taxonomy.test.ts` compares FAMILIES to a SECOND
// hardcoded array. Both are green while they disagree with each other, so
// "FAMILIES agrees with pgTAP" was never a fact anyone checked — it was two
// hand-maintained lists that happened to match. A migration that adds a family
// row and updates only the pgTAP array would leave FAMILIES, web and mobile on
// the old list with every check green: the wellness_spa failure this file
// exists to prevent, moved one file upstream. Labels, emoji and sort_order
// were weaker still — pgTAP asserts only the `undefined` label, so the seven
// guest-facing labels and emoji were compared to nothing outside TypeScript.
//
// So this file reads the two SQL sources directly and joins the literals:
//   · the pgTAP `array[...]::text[]` slug list  → FAMILIES slugs, in order
//   · `seed_place_families()`'s INSERT rows      → FAMILIES slug+label+emoji
//                                                  +sort_order, in order
// The seed is what actually writes the catalog, so pinning it pins what the
// DB will hold; the pgTAP array is what asserts the DB holds it. With both
// joined to FAMILIES, the four copies are one chain.
//
// Every parser here throws when it matches nothing. A regex that quietly
// returns [] is a vacuous test, which is worse than no test at all.
//
// The last test in this file is the token gate MESITA-1857 asks for: zero
// `super_categor` outside the migration ledger.

import { assertEquals } from "jsr:@std/assert@1";
import { FAMILIES } from "./place-taxonomy.ts";

const REPO_ROOT = new URL("../../../../", import.meta.url);
const WEB_FAMILIES = new URL("apps/web-consumer/src/lib/place-families.ts", REPO_ROOT);
const MOBILE_FAMILIES = new URL("apps/mobile-consumer/src/lib/place-families.ts", REPO_ROOT);
const PGTAP = new URL("supabase/supabase/tests/database/schema_invariants.test.sql", REPO_ROOT);
const MIGRATIONS = new URL("supabase/supabase/migrations/", REPO_ROOT);

/** The three persisted discovery-filter stores — mobile has no test runner. */
const FILTER_STORES = [
  "apps/mobile-consumer/src/lib/use-discovery-filters.ts",
  "apps/web-consumer/src/lib/use-discovery-filters.ts",
  "apps/web-consumer/src/lib/use-map-filters.ts",
] as const;

type Family = { key: string; label: string; emoji: string };

/**
 * These two files are hand-written twins in a fixed shape, so a regex over the
 * literal is the honest reader: it sees what a human sees, and it fails loudly
 * (rather than silently returning []) when the shape moves.
 */
function parsePlaceFamilies(src: string, where: string): Family[] {
  const arr = src.match(/export const PLACE_FAMILIES[^=]*=\s*\[([\s\S]*?)\n\];/);
  if (!arr) throw new Error(`${where}: no PLACE_FAMILIES array literal found`);
  const entry =
    /\{\s*key:\s*"([a-z_]+)",\s*label:\s*"([^"]+)",\s*emoji:\s*"([^"]+)"\s*\}/g;
  const out: Family[] = [];
  let m: RegExpExecArray | null;
  while ((m = entry.exec(arr[1]!)) !== null) {
    out.push({ key: m[1]!, label: m[2]!, emoji: m[3]! });
  }
  if (out.length === 0) throw new Error(`${where}: PLACE_FAMILIES parsed empty`);
  return out;
}

function parseFamilyKeyUnion(src: string, where: string): string[] {
  const union = src.match(/export type FamilyKey =([\s\S]*?);/);
  if (!union) throw new Error(`${where}: no FamilyKey union found`);
  return [...union[1]!.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]!);
}

Deno.test("web and mobile ship the SAME eight families as the DB twin", async () => {
  const web = parsePlaceFamilies(await Deno.readTextFile(WEB_FAMILIES), "web-consumer");
  const mobile = parsePlaceFamilies(
    await Deno.readTextFile(MOBILE_FAMILIES),
    "mobile-consumer",
  );

  // place-taxonomy.ts is the DB twin. It is joined to the real catalog by the
  // two SQL tests below (pgTAP's slug array and seed_place_families()'s INSERT
  // rows), NOT by pgTAP alone — pgTAP only compares the live DB to its own
  // literal and never looks at FAMILIES.
  const db = FAMILIES.map((f) => ({ key: f.slug, label: f.label, emoji: f.emoji }));

  assertEquals(
    web,
    db,
    "apps/web-consumer/src/lib/place-families.ts disagrees with _shared/place-taxonomy.ts",
  );
  assertEquals(
    mobile,
    db,
    "apps/mobile-consumer/src/lib/place-families.ts disagrees with _shared/place-taxonomy.ts",
  );
});

Deno.test("the FamilyKey unions match the arrays they type", async () => {
  const webSrc = await Deno.readTextFile(WEB_FAMILIES);
  const mobileSrc = await Deno.readTextFile(MOBILE_FAMILIES);
  const keys = FAMILIES.map((f) => f.slug as string);

  // Catalog order, not sorted: a union that lists them in a different order is
  // still a compile-time lie waiting to be read as the render order.
  assertEquals(parseFamilyKeyUnion(webSrc, "web-consumer"), keys);
  assertEquals(parseFamilyKeyUnion(mobileSrc, "mobile-consumer"), keys);
});

Deno.test("both consumer apps filter on the seven, never on Undefined", async () => {
  for (
    const [where, url] of [
      ["web-consumer", WEB_FAMILIES],
      ["mobile-consumer", MOBILE_FAMILIES],
    ] as const
  ) {
    const src = await Deno.readTextFile(url);
    const derived =
      /export const FILTERABLE_PLACE_FAMILIES[^=]*=\s*PLACE_FAMILIES\.filter\(\s*\(family\)\s*=>\s*family\.key\s*!==\s*"undefined",?\s*\)/
        .test(src);
    assertEquals(
      derived,
      true,
      `${where}: FILTERABLE_PLACE_FAMILIES must be PLACE_FAMILIES minus "undefined", derived not retyped ` +
        "(Pato, 2026-08-29: nobody goes out looking for an unclassified place)",
    );
  }
});

Deno.test("every persisted filter store hydrates from the seven, not all eight", async () => {
  // Mobile has no test runner, so the shape is read from source. A store that
  // accepts a key its sheet does not render leaves the guest with a filter
  // they can see the effect of (empty deck, lit dot) and no pill to clear.
  for (const rel of FILTER_STORES) {
    const src = await Deno.readTextFile(new URL(rel, REPO_ROOT));
    const decl = src.match(/const KNOWN_FAMILY_KEYS[^;]*;/);
    if (!decl) {
      throw new Error(
        `${rel}: no KNOWN_FAMILY_KEYS declaration found — this pin went blind`,
      );
    }
    assertEquals(
      /FILTERABLE_PLACE_FAMILIES\s*\.?\s*map\(/.test(decl[0]),
      true,
      `${rel}: KNOWN_FAMILY_KEYS must be built from FILTERABLE_PLACE_FAMILIES, ` +
        `not PLACE_FAMILIES — a persisted "undefined" would survive hydrate and ` +
        "narrow the deck to nothing with no pill to clear it (MESITA-1857).\n  " +
        decl[0],
    );
  }
});

// ── the DB leg ─────────────────────────────────────────────────────────────

/**
 * The slug list pgTAP asserts the live catalog holds, in sort_order. Anchored
 * on the assertion's own subquery so it cannot drift onto one of the other
 * `array[...]::text[]` literals in that file.
 */
function parsePgtapFamilySlugs(sql: string): string[] {
  const m = sql.match(
    /\(\s*select\s+array_agg\s*\(\s*slug\s+order\s+by\s+sort_order\s*\)\s+from\s+public\.place_families\s*\)\s*,\s*array\[([\s\S]*?)\]::text\[\]/i,
  );
  if (!m) {
    throw new Error(
      "schema_invariants.test.sql: no `array_agg(slug order by sort_order) from public.place_families` " +
        "assertion found — the pgTAP catalog pin moved or was deleted, and this test went blind",
    );
  }
  const slugs = [...m[1]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]!);
  if (slugs.length === 0) {
    throw new Error("schema_invariants.test.sql: family slug array parsed empty");
  }
  return slugs;
}

type SeedRow = { slug: string; label: string; emoji: string; sort_order: number };

/**
 * The rows `seed_place_families()` writes. The seed is the migration ledger's
 * newest definition of that function, not a fixed filename: a later migration
 * that redefines it is what the DB will actually run, so that is the one that
 * has to agree with FAMILIES.
 */
async function parseSeedFamilies(): Promise<{ file: string; rows: SeedRow[] }> {
  const names: string[] = [];
  for await (const e of Deno.readDir(MIGRATIONS)) {
    if (e.isFile && e.name.endsWith(".sql")) names.push(e.name);
  }
  if (names.length === 0) {
    throw new Error("supabase/supabase/migrations/ holds no .sql files — the path moved");
  }
  names.sort();

  for (const name of names.reverse()) {
    const src = await Deno.readTextFile(new URL(name, MIGRATIONS));
    if (!/function\s+public\.seed_place_families\s*\(\s*\)/i.test(src)) continue;
    const body = src.match(
      /insert\s+into\s+public\.place_families\s*\([^)]*\)\s*values([\s\S]*?);/i,
    );
    if (!body) {
      throw new Error(
        `${name}: defines seed_place_families() but no ` +
          "`insert into public.place_families (...) values` block was found — the seed's shape moved",
      );
    }
    const row = /\(\s*'([a-z_]+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*\)/g;
    const rows: SeedRow[] = [];
    let m: RegExpExecArray | null;
    while ((m = row.exec(body[1]!)) !== null) {
      rows.push({
        slug: m[1]!,
        label: m[2]!,
        emoji: m[3]!,
        sort_order: Number(m[4]!),
      });
    }
    if (rows.length === 0) {
      throw new Error(`${name}: seed_place_families() INSERT parsed zero rows`);
    }
    return { file: name, rows };
  }
  throw new Error(
    "no migration defines seed_place_families() — the seed was renamed and this pin went blind",
  );
}

Deno.test("pgTAP's hardcoded catalog array IS FAMILIES' slugs, in order", async () => {
  const sql = await Deno.readTextFile(PGTAP);
  assertEquals(
    parsePgtapFamilySlugs(sql),
    FAMILIES.map((f) => f.slug as string),
    "supabase/tests/database/schema_invariants.test.sql pins the live catalog to a literal " +
      "that disagrees with _shared/place-taxonomy.ts. pgTAP compares the DB to ITS OWN array " +
      "and place-taxonomy.test.ts compares FAMILIES to a SECOND array; without this test the " +
      "two literals can diverge and every check still passes.",
  );
});

Deno.test("seed_place_families() writes exactly FAMILIES — slug, label, emoji, order", async () => {
  const { file, rows } = await parseSeedFamilies();
  assertEquals(
    rows,
    FAMILIES.map((f) => ({
      slug: f.slug as string,
      label: f.label,
      emoji: f.emoji,
      sort_order: f.sort_order,
    })),
    `supabase/migrations/${file} seeds a catalog that disagrees with ` +
      "_shared/place-taxonomy.ts. The seed is what public.place_families actually ends up " +
      "holding (Reset calls it), and labels/emoji/sort_order are compared to NOTHING in pgTAP " +
      "except the `undefined` label — so this assertion is the only thing standing between a " +
      "renamed family in SQL and seven guest-facing pills that still say the old word.",
  );
});

// ── the token gate ─────────────────────────────────────────────────────────
//
// MESITA-1857 renamed the word everywhere. This is what keeps it renamed.
// `supabase/supabase/migrations/**` is EXCLUDED on purpose: applied migrations
// are an immutable ledger and the old name is the historical truth in them.
//
// WHAT IT FORBIDS is the IDENTIFIER — `super_category_slugs`,
// `place_super_categories`, `superCategories`, `SuperCategoriesClient`. The
// English phrase "Super Category" with a space is guest-facing COPY on
// web-consumer's Filters sheet; renaming what a guest reads is a product call,
// not a rename, and it is deliberately not this gate's business.
//
// `database.types.ts` is exempt for one reason and one reason only: it is
// GENERATED from the live schema by `supabase/scripts/regen-types.sh`, and
// repo law is that generated output is never hand-edited. A gate over
// hand-written source has no business failing on it.

const GATE_ROOTS = [
  "supabase/supabase/functions",
  "supabase/supabase/tests",
  "apps/web-admin/src",
  "apps/web-business/src",
  "apps/web-consumer/src",
  "apps/mobile-consumer/src",
  ".github/workflows",
];

/** Files that name the retired token on purpose. */
const GATE_EXEMPT = [
  // This file: the gate has to spell what it forbids.
  "supabase/supabase/functions/_shared/place-families-parity.test.ts",
  // The retired-name list; `place_super_categories` belongs in it by design.
  "supabase/supabase/functions/_shared/dropped-table-refs.test.ts",
  // Reads pg_proc.prosrc for the token — the string-body guard needs the word.
  "supabase/supabase/tests/database/schema_invariants.test.sql",
];

const SKIP_DIRS = new Set(["node_modules", ".next", ".expo", "dist", "build"]);
const SCANNED = /\.(ts|tsx|js|jsx|sql|yml|yaml|json|md)$/;

async function walk(dir: URL, rel: string, out: string[]): Promise<void> {
  let entries: Deno.DirEntry[];
  try {
    entries = [];
    for await (const e of Deno.readDir(dir)) entries.push(e);
  } catch {
    // A root that does not exist is a real finding: the gate would silently
    // scan nothing. Surfaced by the emptiness assertion below, not swallowed.
    return;
  }
  for (const e of entries) {
    if (e.isDirectory) {
      if (SKIP_DIRS.has(e.name)) continue;
      await walk(new URL(`${e.name}/`, dir), `${rel}${e.name}/`, out);
    } else if (SCANNED.test(e.name)) {
      out.push(`${rel}${e.name}`);
    }
  }
}

Deno.test("zero `super_categor` tokens outside the migration ledger", async () => {
  const offenders: string[] = [];
  let scanned = 0;

  for (const root of GATE_ROOTS) {
    const files: string[] = [];
    await walk(new URL(`${root}/`, REPO_ROOT), `${root}/`, files);
    if (files.length === 0) {
      throw new Error(
        `gate root ${root} scanned zero files — the path moved and this gate went blind`,
      );
    }
    for (const rel of files) {
      if (GATE_EXEMPT.includes(rel)) continue;
      if (rel.endsWith("/database.types.ts")) continue;
      scanned++;
      const src = await Deno.readTextFile(new URL(rel, REPO_ROOT));
      const hits = src.match(/super[_-]?categor/gi);
      if (hits) offenders.push(`${rel} (${hits.length})`);
    }
  }

  assertEquals(
    offenders,
    [],
    `These still say "super category" after MESITA-1857 (${scanned} files scanned):\n  ` +
      offenders.join("\n  ") +
      "\n\nThe vocabulary is `family` / `family_keys` / `place_families`. " +
      "Only supabase/supabase/migrations/** may keep the old name — it is an immutable ledger.",
  );
});

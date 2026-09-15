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
// The last test in this file is the token gate MESITA-1857 asks for: zero
// `super_categor` outside the migration ledger.

import { assertEquals } from "jsr:@std/assert@1";
import { FAMILIES } from "./place-taxonomy.ts";

const REPO_ROOT = new URL("../../../../", import.meta.url);
const WEB_FAMILIES = new URL("apps/web-consumer/src/lib/place-families.ts", REPO_ROOT);
const MOBILE_FAMILIES = new URL("apps/mobile-consumer/src/lib/place-families.ts", REPO_ROOT);

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

  // place-taxonomy.ts is the DB twin: pgTAP pins FAMILIES' slugs and order
  // against the live `public.place_families` catalog, so agreeing with it is
  // agreeing with the database.
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

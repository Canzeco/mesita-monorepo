// Source guard: nothing may write `places.name`.
//
// `places.name` is a GENERATED column (coalesce(mesita_name, google_name)).
// Postgres rejects writes to it, so a straggler write is a hard 428C9 at
// runtime rather than a silent clobber — but `deno test` has no database
// attached, and `supabase gen types` does NOT mark generated columns read-only
// (places.Insert still carries `name?: string`), so TypeScript will not catch
// it either. This scan is the only check that runs before deploy.
//
// It also pins the two rules that replaced the old sticky-sync design:
//   * the Intaker writes google_name and NEVER mesita_name
//   * _shared/place-display-name.ts is gone and stays gone
//
// See the phase 1/2 migrations (20260809201500, 20260809203000) for the model.

import { assertEquals } from "jsr:@std/assert@1";

const FUNCTIONS_DIR = new URL("../", import.meta.url);

/**
 * A file's path relative to the functions dir, e.g.
 * `supabase-cron-enrich-place-research/index.ts`. Every path guard in this file
 * matches on this, never on an absolute path — see the note in walk().
 */
function relativeToFunctions(file: URL): string {
  const base = FUNCTIONS_DIR.pathname;
  const full = file.pathname;
  return full.startsWith(base) ? full.slice(base.length) : full;
}

async function tsSources(): Promise<Array<{ path: string; text: string }>> {
  const out: Array<{ path: string; text: string }> = [];
  for await (
    const entry of Deno.readDir(FUNCTIONS_DIR)
  ) {
    if (!entry.isDirectory) continue;
    const dir = new URL(`${entry.name}/`, FUNCTIONS_DIR);
    for await (const f of walk(dir)) out.push(f);
  }
  return out;
}

async function* walk(
  dir: URL,
): AsyncGenerator<{ path: string; text: string }> {
  for await (const entry of Deno.readDir(dir)) {
    const child = new URL(
      entry.isDirectory ? `${entry.name}/` : entry.name,
      dir,
    );
    if (entry.isDirectory) {
      yield* walk(child);
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      // RELATIVE to the functions dir, never absolute (MESITA-1075). The
      // Intaker scan below filters on /enrich/, and ASDM puts every agent in
      // `.claude/worktrees/<ISSUE-ID>-<slug>/` — so an absolute path inside any
      // worktree whose slug contains "enrich" matched EVERY file, and this guard
      // reported innocent operator-initiated writers as offenders. It cried wolf
      // locally while CI, checked out at a clean path, stayed green. Relative
      // paths also keep the failure message portable.
      yield {
        path: relativeToFunctions(child),
        text: await Deno.readTextFile(child),
      };
    }
  }
}

/** Strip line comments so documentation about `name:` never trips the scan. */
function stripLineComments(src: string): string {
  return src.split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
}

/** A bare `name:` key — not google_name, mesita_name, menu_pdf_name, etc. */
const BARE_NAME_KEY = /(?<![\w$])name\s*:/;
/** `something.name = ...` assignment building a write payload. */
const BARE_NAME_ASSIGN = /(?<![\w$])update\.name\s*=|(?<![\w$])nameUpdate\.name\s*=/;

const PLACE_TABLE = /\.from\(\s*["'](places|profiles)["']\s*\)/g;
const WRITE_CALL = /\.(insert|update|upsert)\s*\(/;

Deno.test("no Edge Function writes places.name (it is a generated column)", async () => {
  const offenders: string[] = [];
  for (const { path, text } of await tsSources()) {
    const src = stripLineComments(text);
    for (const m of src.matchAll(PLACE_TABLE)) {
      // Window forward far enough to cover a chained write and its payload.
      const window = src.slice(m.index ?? 0, (m.index ?? 0) + 2000);
      if (!WRITE_CALL.test(window)) continue;
      const payload = window.slice(window.search(WRITE_CALL));
      if (BARE_NAME_KEY.test(payload)) {
        offenders.push(`${path} — write to ${m[1]} carries a bare \`name:\``);
      }
    }
    if (BARE_NAME_ASSIGN.test(src)) {
      offenders.push(`${path} — assigns \`name\` into a places update payload`);
    }
  }
  assertEquals(
    offenders,
    [],
    `places.name is generated and rejects writes. Write mesita_name (operator ` +
      `override) or google_name (Intaker observation) instead.\n` +
      offenders.join("\n"),
  );
});

// ── the guard above only works if `path` is RELATIVE (MESITA-1075) ──────────
//
// This is the regression pin. Reverting walk() to `child.pathname` puts the
// checkout's own directory name inside every path, and ASDM runs agents from
// `.claude/worktrees/<ISSUE-ID>-<slug>/` — so any issue whose slug contains
// "enrich" (a whole subsystem's worth) silently widens the Intaker scan to
// EVERY edge function. The observed damage was two innocent files reported as
// offenders: `business-web-update-project/index.ts` and `_shared/save-place.ts`,
// both operator-initiated writers, which is exactly what mesita_name is FOR.
// An agent trusting that local run either wastes a cycle or "fixes" a real
// writer. CI never caught it because CI checks out at a clean path.
Deno.test("the source scan yields paths relative to the functions dir", async () => {
  const sources = await tsSources();
  assertEquals(sources.length > 0, true, "the scan found no sources at all");

  const absolute = sources.filter((s) => s.path.startsWith("/"));
  assertEquals(
    absolute.map((s) => s.path).slice(0, 3),
    [],
    "paths must be relative to the functions dir, never absolute",
  );

  // The exact false positive this fixes: an operator-write EF that lives
  // nowhere near enrichment must not be caught by the Intaker filter, no
  // matter what the checkout is called.
  const innocent = sources.find(
    (s) => s.path === "business-web-update-project/index.ts",
  );
  assertEquals(
    innocent !== undefined,
    true,
    "expected business-web-update-project/index.ts in the scan",
  );
  assertEquals(
    /enrich|cron-enrich/.test(innocent!.path),
    false,
    "the Intaker filter matched a non-enrichment EF — path is not relative",
  );

  // And the filter still catches what it is for.
  const realEnricher = sources.filter((s) => /enrich|cron-enrich/.test(s.path));
  assertEquals(
    realEnricher.length > 0,
    true,
    "the Intaker filter matched nothing — it is now too narrow",
  );
  assertEquals(
    realEnricher.every((s) => s.path.includes("enrich")),
    true,
  );
});

Deno.test("the Intaker never writes mesita_name", async () => {
  const offenders: string[] = [];
  for (const { path, text } of await tsSources()) {
    if (!/enrich|cron-enrich/.test(path)) continue;
    const src = stripLineComments(text);
    // Deleting the key off `gathered` is the correct defensive move, not a write.
    let writes = src.replace(/delete\s+\w+\.mesita_name\s*;?/g, "");
    // §8.4 v3: the Description function INFERS a Mesita Name, but only the
    // gated door (_shared/mesita-name-door.ts, gate D2) may WRITE it. A JSON
    // schema/type declaration of the inferred field is not a write.
    writes = writes.replace(/mesita_name:\s*\{\s*type:/g, "");
    if (/mesita_name\s*:/.test(writes)) {
      offenders.push(`${path} — enrichment path sets mesita_name`);
    }
  }
  assertEquals(
    offenders,
    [],
    `mesita_name may only be written through _shared/mesita-name-door.ts ` +
      `(gate D2: NULL / google-copy / the door's own last value). A raw write ` +
      `in an enrich path would reintroduce the sticky-sync clobber.\n` +
      offenders.join("\n"),
  );
});

Deno.test("contents persist drops google_place_id before the writePlace update", async () => {
  const src = await Deno.readTextFile(
    new URL("../supabase-cron-enrich-place-contents/index.ts", import.meta.url),
  );
  assertEquals(
    /google_place_id:\s*_dropGooglePlaceId/.test(src),
    true,
    "gathered.place carries google_place_id; writePlace refuses that key on " +
      "UPDATE. Drop it in the persist destructure or Contents S7 dies on every place.",
  );
  assertEquals(
    /yelp_url:\s*_dropYelp/.test(src) &&
      /tiktok_url:\s*_dropTiktok/.test(src) &&
      /tripadvisor_url:\s*_dropTripadvisor/.test(src),
    true,
    "Wave 040 dropped those URL columns. A gathered leftover must not ride the UPDATE.",
  );
});

Deno.test("place-display-name.ts stays deleted", async () => {
  let exists = true;
  try {
    await Deno.stat(new URL("place-display-name.ts", import.meta.url));
  } catch {
    exists = false;
  }
  assertEquals(
    exists,
    false,
    "Display resolution lives in the generated `places.name` column. A second " +
      "resolver in TypeScript can drift from it.",
  );

  const importers: string[] = [];
  for (const { path, text } of await tsSources()) {
    if (/place-display-name/.test(text)) importers.push(path);
  }
  assertEquals(importers, [], `stale imports of place-display-name.ts`);
});

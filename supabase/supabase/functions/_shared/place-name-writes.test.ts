// Source guard: three writers of `place_profiles.name`, and no other.
//
// `place_profiles.name` is the one Mesita name (MESITA-2828): stored, seeded
// from Google at Create, refined by the Description step, edited by the
// operator. A straggler write elsewhere — above all in an enrich path —
// would silently revert an operator's rename on the next run, the sticky-sync
// clobber MESITA-917 closed. `deno test` has no database attached and
// TypeScript cannot tell one `name:` key from another, so this scan is the
// only check that runs before deploy.
//
// The allowed writers:
//   · _shared/save-place.ts            — Create seeds `name` from google_name
//   · _shared/place-name-door.ts       — the Description step's inference,
//                                        gate D2 (machine-owned values only)
//   · admin-web-update-place/index.ts  — the operator's edit
//
// The Enricher writes google_name (Google's own label, Search's alias) and
// reaches `name` ONLY through the door.

import { assertEquals } from "jsr:@std/assert@1";

const FUNCTIONS_DIR = new URL("../", import.meta.url);

/**
 * A file's path relative to the functions dir, e.g.
 * `admin-web-update-place/index.ts`. Every path guard in this file
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
      // Enricher scan below filters on /enrich/, and Rules §0 puts every agent in
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

/** A bare `name:` key — not google_name, menu_pdf_name, etc. */
const BARE_NAME_KEY = /(?<![\w$])name\s*:/;
/** `something.name = ...` assignment building a write payload. */
const BARE_NAME_ASSIGN = /(?<![\w$])update\.name\s*=|(?<![\w$])nameUpdate\.name\s*=/;

const PLACE_TABLE = /\.from\(\s*["'](place_profiles|profiles)["']\s*\)/g;
const WRITE_CALL = /\.(insert|update|upsert)\s*\(/;

/**
 * Every argument list of a `writePlace(` call against a place table —
 * balanced parens, so a `name:` three objects later is not this call's.
 */
function placeWriteCalls(src: string): string[] {
  const out: string[] = [];
  const re = /writePlace\s*\(/g;
  for (const m of src.matchAll(re)) {
    let depth = 0;
    let i = (m.index ?? 0) + m[0].length - 1;
    const start = i;
    for (; i < src.length; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")" && --depth === 0) break;
    }
    const call = src.slice(start, i + 1);
    if (/table:\s*["'](place_profiles|profiles)["']/.test(call)) out.push(call);
  }
  return out;
}

/** The three writers of the Mesita name (MESITA-2828). */
const NAME_WRITERS = new Set([
  "_shared/save-place.ts",
  "_shared/place-name-door.ts",
  "admin-web-update-place/index.ts",
]);

Deno.test("only Create, the name door and the operator's save write place_profiles.name", async () => {
  const offenders: string[] = [];
  const seenWriters = new Set<string>();
  for (const { path, text } of await tsSources()) {
    const src = stripLineComments(text);
    let writes = false;
    for (const m of src.matchAll(PLACE_TABLE)) {
      // Window forward far enough to cover a chained write and its payload.
      const window = src.slice(m.index ?? 0, (m.index ?? 0) + 2000);
      if (!WRITE_CALL.test(window)) continue;
      const payload = window.slice(window.search(WRITE_CALL));
      if (BARE_NAME_KEY.test(payload)) writes = true;
    }
    if (BARE_NAME_ASSIGN.test(src)) writes = true;
    if (placeWriteCalls(src).some((call) => BARE_NAME_KEY.test(call))) writes = true;
    if (!writes) continue;
    if (NAME_WRITERS.has(path)) seenWriters.add(path);
    else offenders.push(`${path} — writes place_profiles.name outside the three allowed writers`);
  }
  assertEquals(
    offenders,
    [],
    `place_profiles.name is the Mesita name: Create seeds it, the name door ` +
      `(_shared/place-name-door.ts) lands the Description step's inference, ` +
      `admin-web-update-place takes the operator's edit. Nothing else writes it.\n` +
      offenders.join("\n"),
  );
  // The door itself must still be a writer, or the guard is scanning nothing.
  assertEquals(
    seenWriters.has("_shared/place-name-door.ts"),
    true,
    "the name door no longer writes `name:` — the scan has gone blind",
  );
});

// ── the guard above only works if `path` is RELATIVE (MESITA-1075) ──────────
//
// This is the regression pin. Reverting walk() to `child.pathname` puts the
// checkout's own directory name inside every path, and Rules §0 runs agents from
// `.claude/worktrees/<ISSUE-ID>-<slug>/` — so any issue whose slug contains
// "enrich" (a whole subsystem's worth) silently widens the Enricher scan to
// EVERY edge function. The observed damage was two innocent files reported as
// offenders: `business-web-update-place/index.ts` (admin-web-update-place since
// MESITA-2090) and `_shared/save-place.ts`,
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
  // nowhere near enrichment must not be caught by the Enricher filter, no
  // matter what the checkout is called.
  const innocent = sources.find(
    (s) => s.path === "admin-web-update-place/index.ts",
  );
  assertEquals(
    innocent !== undefined,
    true,
    "expected admin-web-update-place/index.ts in the scan",
  );
  assertEquals(
    /enrich|cron-enrich/.test(innocent!.path),
    false,
    "the Enricher filter matched a non-enrichment EF — path is not relative",
  );

  // And the filter still catches what it is for.
  const realEnricher = sources.filter((s) => /enrich|cron-enrich/.test(s.path));
  assertEquals(
    realEnricher.length > 0,
    true,
    "the Enricher filter matched nothing — it is now too narrow",
  );
  assertEquals(
    realEnricher.every((s) => s.path.includes("enrich")),
    true,
  );
});

Deno.test("the Enricher reaches the Mesita name only through the door", async () => {
  const offenders: string[] = [];
  for (const { path, text } of await tsSources()) {
    if (!/enrich|cron-enrich/.test(path)) continue;
    const src = stripLineComments(text);
    for (const m of src.matchAll(PLACE_TABLE)) {
      const window = src.slice(m.index ?? 0, (m.index ?? 0) + 2000);
      if (!WRITE_CALL.test(window)) continue;
      const payload = window.slice(window.search(WRITE_CALL));
      if (BARE_NAME_KEY.test(payload)) {
        offenders.push(`${path} — enrichment path writes name`);
      }
    }
    if (placeWriteCalls(src).some((call) => BARE_NAME_KEY.test(call))) {
      offenders.push(`${path} — enrichment path hands writePlace a name`);
    }
  }
  assertEquals(
    offenders,
    [],
    `the Mesita name may only be written through _shared/place-name-door.ts ` +
      `(gate D2: blank / google-copy / the door's own last value). A raw write ` +
      `in an enrich path would reintroduce the sticky-sync clobber.\n` +
      offenders.join("\n"),
  );
  // Every enrich-path writer of the name goes through the door: the import
  // is the proof. The door's own file is in _shared/, outside this filter.
  const callers = (await tsSources()).filter((s) =>
    /enrich|cron-enrich/.test(s.path) && /applyInferredPlaceName\(/.test(s.text)
  );
  assertEquals(
    callers.every((s) => s.text.includes("place-name-door.ts")),
    true,
    "an enrich path calls the door without importing it",
  );
});

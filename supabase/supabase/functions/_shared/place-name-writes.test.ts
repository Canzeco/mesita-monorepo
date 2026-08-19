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
//   * the Enricher writes google_name and NEVER mesita_name
//   * _shared/place-display-name.ts is gone and stays gone
//
// See the phase 1/2 migrations (20260809201500, 20260809203000) for the model.

import { assertEquals } from "jsr:@std/assert@1";

const FUNCTIONS_DIR = new URL("../", import.meta.url);

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
      yield { path: child.pathname, text: await Deno.readTextFile(child) };
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
      `override) or google_name (Enricher observation) instead.\n` +
      offenders.join("\n"),
  );
});

Deno.test("the Enricher never writes mesita_name", async () => {
  const offenders: string[] = [];
  for (const { path, text } of await tsSources()) {
    if (!/enrich|cron-enrich/.test(path)) continue;
    const src = stripLineComments(text);
    // Deleting the key off `gathered` is the correct defensive move, not a write.
    const writes = src.replace(/delete\s+\w+\.mesita_name\s*;?/g, "");
    if (/mesita_name\s*:/.test(writes)) {
      offenders.push(`${path} — enrichment path sets mesita_name`);
    }
  }
  assertEquals(
    offenders,
    [],
    `mesita_name is the operator's label. The Enricher refreshing it would ` +
      `reintroduce the clobber that sticky-sync caused.\n` + offenders.join("\n"),
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
